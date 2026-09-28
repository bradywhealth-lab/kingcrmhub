import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const mockDb = vi.hoisted(() => ({ organization: { findUnique: vi.fn() } }))
const mockSdkCreate = vi.hoisted(() => vi.fn())
vi.mock('openai', () => ({ default: class { chat = { completions: { create: mockSdkCreate } } } }))
vi.mock('groq-sdk', () => ({ default: class { chat = { completions: { create: mockSdkCreate } } } }))
vi.mock('@/lib/db', () => ({ db: mockDb }))

import {
  getDefaultModel,
  isFreeOpenRouterModel,
  resolveAIConfig,
} from './ai-providers'

const repoRoot = join(import.meta.dirname, '..', '..')
const providerSrc = readFileSync(join(repoRoot, 'src/lib/ai-providers.ts'), 'utf8')

/**
 * Fixture values, defined once and referenced by both the mock and the
 * assertion. Sharing one constant means a literal can never drift between the
 * two — which is what produced two artifact failures when a file writer
 * redacted one copy of a key-shaped string but not the other.
 * These are NOT credentials: fixed test-only strings with no secret shape.
 */
const ORG_BYOK_FIXTURE = 'org-byok-fixture-value-0123456789'
const GROQ_PLATFORM_FIXTURE = 'groq-platform-fixture-value-0123'
const ROUTER_PLATFORM_FIXTURE = 'router-platform-fixture-value-0123'
const JUNK_BYOK_FIXTURE = 'x'

const ORIG_ENV: Record<string, string | undefined> = {}
function setEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    ORIG_ENV[key] = process.env[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

/**
 * Regression gate for the "nonsense AI replies" defect, root-caused by OpsForge
 * against the live platform key (2026-09-28) and specced in
 * 10_EVIDENCE_QA_PROOFS/OPSFORGE-LIVE-VERIFICATION.md section M.
 *
 * The free tier defaulted to `openrouter/free`, which is OpenRouter's
 * AUTO-ROUTER. Measured behaviour: a sales prompt was routed to
 * `poolside/laguna-xs-2.1:free` (a coding model) returning `content: null`,
 * and earlier to `nvidia/nemotron-3.5-content-safety:free` (a safety
 * classifier) — which is where the user-visible "User Safety: safe" came from.
 *
 * Prod holds BOTH GROQ_API_KEY and OPENROUTER_API_KEY, and the old free-tier
 * branch tested OpenRouter BEFORE Groq — so the measured-working Groq key was
 * unreachable in production. Ordering is the bug, not just the model id.
 */
describe('free-tier AI routing — Groq pinned models win over the OpenRouter auto-router', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.organization.findUnique.mockResolvedValue({ settings: null })
    // Mirror production: both platform keys present.
    setEnv({
      GROQ_API_KEY: GROQ_PLATFORM_FIXTURE,
      OPENROUTER_API_KEY: ROUTER_PLATFORM_FIXTURE,
      OPENAI_API_KEY: undefined,
      ANTHROPIC_API_KEY: undefined,
    })
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(ORIG_ENV)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('routes the platform free tier to Groq, NOT the OpenRouter auto-router, when both keys exist', async () => {
    const config = await resolveAIConfig('org-1')

    expect(config.provider).toBe('groq')
    expect(config.model).not.toBe('openrouter/free')
    expect(config.label, 'label must not advertise auto-routing').not.toMatch(/auto-rout/i)
  })

  it('pins a Groq model that OpsForge measured returning real answers', async () => {
    const config = await resolveAIConfig('org-1')

    // Measured working on the platform Groq key: gpt-oss-120b 376ms,
    // gpt-oss-20b 313ms, qwen3.8-27b 278ms — all returned real sentence answers.
    expect(['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b']).toContain(config.model)
  })

  it('still prefers a valid org BYOK key over every platform key', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({
      settings: { aiProvider: 'openai', aiApiKey: ORG_BYOK_FIXTURE, aiModel: 'gpt-4o' },
    })

    const config = await resolveAIConfig('org-1')

    expect(config.provider).toBe('openai')
    expect(config.apiKey).toBe(ORG_BYOK_FIXTURE)
    expect(config.byokKey).toBe(true)
  })

  it('honours an org that explicitly chose Groq with its own model', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({
      settings: { aiProvider: 'groq', aiApiKey: ORG_BYOK_FIXTURE, aiModel: 'openai/gpt-oss-20b' },
    })

    const config = await resolveAIConfig('org-1')

    expect(config.provider).toBe('groq')
    expect(config.model).toBe('openai/gpt-oss-20b')
  })

  it('coerces an org whose STORED model is the retired auto-router slug', async () => {
    // Migration trap: orgs saved `openrouter/free` under earlier versions. Left
    // as-is it would resurrect the exact defect this PR removes.
    mockDb.organization.findUnique.mockResolvedValueOnce({
      settings: { aiProvider: 'openrouter', aiModel: 'openrouter/free' },
    })

    const config = await resolveAIConfig('org-1')

    expect(config.model).not.toBe('openrouter/free')
  })

  it('falls back to Groq when only the Groq key exists', async () => {
    setEnv({ OPENROUTER_API_KEY: undefined })

    const config = await resolveAIConfig('org-1')

    expect(config.provider).toBe('groq')
    expect(config.apiKey).toBe(GROQ_PLATFORM_FIXTURE)
  })

  it('falls back to OpenRouter only when Groq is unavailable, and pins a real model', async () => {
    setEnv({ GROQ_API_KEY: undefined })

    const config = await resolveAIConfig('org-1')

    expect(config.provider).toBe('openrouter')
    expect(config.model).not.toBe('openrouter/free')
    // Must be an explicit `:free` slug so the platform key never funds a paid model.
    expect(config.model).toMatch(/:free$/)
  })

  it('getDefaultModel returns pinned ids for both free providers', () => {
    expect(getDefaultModel('groq')).toBe('openai/gpt-oss-120b')
    expect(getDefaultModel('openrouter')).not.toBe('openrouter/free')
    expect(getDefaultModel('openrouter')).toMatch(/:free$/)
  })
})

describe('retired model ids are gone from the provider source', () => {
  it('the OpenRouter auto-router slug appears nowhere in ai-providers.ts', () => {
    // Includes comments and the isFreeOpenRouterModel allowlist — a retired slug
    // left in a comparison is a slug that can still be selected.
    const hits = providerSrc.split('\n')
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => l.includes('openrouter/free'))
      .map(({ l, i }) => `${i + 1}: ${l.trim()}`)
    expect(hits, 'openrouter/free must be fully retired').toEqual([])
  })

  it('the stale Groq id llama-3.3-70b-versatile appears nowhere in ai-providers.ts', () => {
    // OpsForge measured the provider rejecting it outright ("does not exist or
    // you do not have access"), so this default was already dead.
    const hits = providerSrc.split('\n')
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => l.includes('llama-3.3-70b-versatile'))
      .map(({ l, i }) => `${i + 1}: ${l.trim()}`)
    expect(hits, 'stale groq model id must be fully retired').toEqual([])
  })

  it('isFreeOpenRouterModel no longer whitelists the auto-router', () => {
    expect(isFreeOpenRouterModel('openrouter/free')).toBe(false)
    expect(isFreeOpenRouterModel('qwen/qwen3.8-27b:free')).toBe(true)
    expect(isFreeOpenRouterModel(null)).toBe(false)
    expect(isFreeOpenRouterModel(undefined)).toBe(false)
  })
})
