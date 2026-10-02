import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const mockDb = vi.hoisted(() => ({ organization: { findUnique: vi.fn() } }))
const mockSdkCreate = vi.hoisted(() => vi.fn())
vi.mock('openai', () => ({ default: class { chat = { completions: { create: mockSdkCreate } } } }))
vi.mock('groq-sdk', () => ({ default: class { chat = { completions: { create: mockSdkCreate } } } }))
vi.mock('@/lib/db', () => ({ db: mockDb }))

import {
  createChatStream,
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
    // Snapshot each key only the first time it is touched, so a setEnv call
    // inside a test body cannot record another test's fixture as the "original"
    // (cubic P3: afterEach would then restore fixtures instead of the real env).
    if (!(key in ORIG_ENV)) ORIG_ENV[key] = process.env[key]
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
    // t_c1c40620: with BOTH platform keys present, a key-less stored
    // openrouter preference is "no preference" and resolves to Groq-first (see
    // ai-openrouter-keyless-failover.test.ts). The OpenRouter branch only
    // fires when no Groq key exists — assert the coercion there.
    setEnv({ GROQ_API_KEY: undefined })
    mockDb.organization.findUnique.mockResolvedValueOnce({
      settings: { aiProvider: 'openrouter', aiModel: 'openrouter/free' },
    })

    const config = await resolveAIConfig('org-1')

    // Pin the exact coercion target (cubic P3): a bare not.toBe('openrouter/free')
    // would also pass if this org were routed to a PAID slug or another
    // auto-router alias — the precise regressions this migration-trap test exists
    // to catch.
    expect(config.model).toBe('qwen/qwen3.8-27b:free')
    expect(config.provider).toBe('openrouter')
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

describe('platform Groq fallback is actually pinned (codex P1 + cubic P1/P2)', () => {
  beforeEach(() => {
    // mockReset, not clearAllMocks: clearAllMocks leaves queued
    // mockRejectedValueOnce/mockResolvedValueOnce entries in place, so an
    // unconsumed value from one test leaks into the next and changes its
    // outcome. That leak is what made the BYOK test resolve instead of reject.
    mockSdkCreate.mockReset()
    vi.clearAllMocks()
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

  it('coerces a persisted RETIRED Groq model instead of replaying it on the platform key', async () => {
    // Orgs that chose Groq before this deploy have llama-3.3-70b-versatile stored
    // in settings.aiModel (the old getDefaultModel('groq')). The provider rejects
    // that id outright, and the platform key never paid for it — so the fallback
    // must coerce to a pinned model, not honour the stored slug.
    mockDb.organization.findUnique.mockResolvedValueOnce({
      settings: { aiProvider: 'groq', aiModel: 'llama-3.3-70b-versatile' },
    })

    const config = await resolveAIConfig('org-1')

    expect(config.provider).toBe('groq')
    expect(config.model).toBe('openai/gpt-oss-120b')
    expect(config.model).not.toBe('llama-3.3-70b-versatile')
  })

  it('coerces ANY stored model outside the pinned list on the platform Groq fallback', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({
      settings: { aiProvider: 'groq', aiModel: 'some/unsupported-model' },
    })

    const config = await resolveAIConfig('org-1')

    expect(['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b']).toContain(config.model)
  })

  it('still honours a stored model that IS in the pinned list', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({
      settings: { aiProvider: 'groq', aiModel: 'openai/gpt-oss-20b' },
    })

    const config = await resolveAIConfig('org-1')

    expect(config.model).toBe('openai/gpt-oss-20b')
  })

  it('fails over through the remaining pinned Groq models when the first one errors', async () => {
    // The pinned list is best-first CANDIDATES; selecting only index 0 means one
    // model-specific 429/access error fails the whole free-tier request
    // (codex P2 + cubic P2). createChatStream must walk the rest of the list on
    // the platform key.
    const config = await resolveAIConfig('org-1')
    expect(config.provider).toBe('groq')

    mockSdkCreate
      .mockRejectedValueOnce(new Error('429 Rate limit reached for model openai/gpt-oss-120b'))
      .mockResolvedValueOnce(
        (async function* () {
          yield { choices: [{ delta: { content: 'answer from fallback model' } }] }
        })(),
      )

    const stream = await createChatStream(config, [{ role: 'user', content: 'hi' }])
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let text = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      text += decoder.decode(value, { stream: true })
    }

    expect(mockSdkCreate).toHaveBeenCalledTimes(2)
    // Second attempt must be the NEXT pinned model, not a re-try of the same one.
    expect((mockSdkCreate.mock.calls[1][0] as { model: string }).model).toBe('openai/gpt-oss-20b')
    expect(text).toContain('answer from fallback model')
    expect(text).not.toContain('error')
  })

  it('does NOT model-failover on a BYOK Groq key (the org chose that model deliberately)', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({
      settings: { aiProvider: 'groq', aiApiKey: ORG_BYOK_FIXTURE, aiModel: 'openai/gpt-oss-20b' },
    })
    const config = await resolveAIConfig('org-1')
    expect(config.byokKey).toBe(true)

    mockSdkCreate.mockRejectedValueOnce(new Error('500 Internal Server Error'))

    await expect(
      createChatStream(config, [{ role: 'user', content: 'hi' }]),
    ).rejects.toThrow('500 Internal Server Error')
    expect(mockSdkCreate).toHaveBeenCalledTimes(1)
  })
})
