import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Regression gate for the intermittent paying-customer outage root-caused by
 * OpsForge (ledger addendum 2026-10-02T19:20Z, card t_c1c40620):
 *
 * An org that merely STORED `{aiProvider:'openrouter', aiModel:'openrouter/free',
 * aiApiKey:null}` was pinned onto the platform OpenRouter route BEFORE the
 * Groq-first free tier, and that route has no failover — so an upstream 429
 * (`qwen/qwen3.8-27b:free is temporarily rate-limited upstream`) surfaced as a
 * user-visible HTTP 500. Measured live: 1 failure in 9 requests (intermittent),
 * and clearing the stale shape gave 9/9 substantive replies.
 *
 * Because the failure is 1-in-9, these tests assert the RESOLUTION PATH (which
 * branch resolves), never a single mocked reply.
 */
const mockDb = vi.hoisted(() => ({ organization: { findUnique: vi.fn() } }))
const mockSdkCreate = vi.hoisted(() => vi.fn())
const mockCtorArgs = vi.hoisted(() => [] as Array<{ apiKey?: string }>)
vi.mock('openai', () => ({
  default: class {
    constructor(opts: { apiKey?: string }) { mockCtorArgs.push(opts) }
    chat = { completions: { create: mockSdkCreate } }
  },
}))
vi.mock('groq-sdk', () => ({
  default: class {
    constructor(opts: { apiKey?: string }) { mockCtorArgs.push(opts) }
    chat = { completions: { create: mockSdkCreate } }
  },
}))
vi.mock('@/lib/db', () => ({ db: mockDb }))

import { createChatStream, resolveAIConfig } from './ai-providers'

/** Fixed test-only strings with no secret shape (shared by mock + assertion). */
const GROQ_PLATFORM_FIXTURE = 'groq-platform-fixture-0123456789'
const ROUTER_PLATFORM_FIXTURE = 'router-platform-fixture-0123456789'
const ORG_OPENROUTER_BYOK_FIXTURE = 'org-openrouter-byok-fixture-0123456789'

/** The exact stored shape of the customer-impacted org (live prod census). */
const STALE_SHAPE = {
  aiProvider: 'openrouter',
  aiModel: 'openrouter/free',
  aiApiKey: null,
}

const ORIG_ENV: Record<string, string | undefined> = {}
function setEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (!(key in ORIG_ENV)) ORIG_ENV[key] = process.env[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

/** Prod mirror: both platform keys present (Groq measured working). */
function mirrorProdEnv() {
  setEnv({
    GROQ_API_KEY: GROQ_PLATFORM_FIXTURE,
    OPENROUTER_API_KEY: ROUTER_PLATFORM_FIXTURE,
    OPENAI_API_KEY: undefined,
    ANTHROPIC_API_KEY: undefined,
  })
}

afterEach(() => {
  for (const [key, value] of Object.entries(ORIG_ENV)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('key-less stored openrouter preference means "no preference" (t_c1c40620)', () => {
  beforeEach(() => {
    mockSdkCreate.mockReset()
    mockCtorArgs.length = 0
    vi.clearAllMocks()
    mockDb.organization.findUnique.mockResolvedValue({ settings: null })
    mirrorProdEnv()
  })

  it('resolves the stale customer shape to the Groq-first free tier, NOT the platform OpenRouter route', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({ settings: { ...STALE_SHAPE } })

    const config = await resolveAIConfig('org-1')

    expect(config.provider).toBe('groq')
    expect(config.model).toBe('openai/gpt-oss-120b')
    expect(config.apiKey).toBe(GROQ_PLATFORM_FIXTURE)
    expect(config.label).toBe('Groq (free, pinned model)')
    // A null stored key is "no key": no BYOK-failure banner for this org.
    expect(config.byokFailure).toBeUndefined()
  })

  it('holds for EVERY resolution — the outage was 1-in-9, so one pass proves nothing (intermittency guard)', async () => {
    mockDb.organization.findUnique.mockResolvedValue({ settings: { ...STALE_SHAPE } })

    for (let i = 0; i < 25; i++) {
      const config = await resolveAIConfig('org-1')
      if (config.provider !== 'groq' || config.apiKey !== GROQ_PLATFORM_FIXTURE) {
        throw new Error(`resolution ${i + 1}/25 escaped the Groq-first tier: ${JSON.stringify({ provider: config.provider, label: config.label })}`)
      }
    }
  })

  it('an unusable (junk) stored key is equally key-less — falls to Groq, with the invalid-key notice', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({
      settings: { aiProvider: 'openrouter', aiModel: 'openrouter/free', aiApiKey: 'x' },
    })

    const config = await resolveAIConfig('org-1')

    expect(config.provider).toBe('groq')
    expect(config.apiKey).toBe(GROQ_PLATFORM_FIXTURE)
    expect(config.byokFailure).toBeDefined()
    expect(config.byokFailure).toContain('invalid or missing')
  })

  it('preserves genuine OpenRouter BYOK — a real key still routes to the org own provider (regression guard)', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({
      settings: { aiProvider: 'openrouter', aiApiKey: ORG_OPENROUTER_BYOK_FIXTURE, aiModel: 'qwen/qwen3.8-27b:free' },
    })

    const config = await resolveAIConfig('org-1')

    expect(config.provider).toBe('openrouter')
    expect(config.apiKey).toBe(ORG_OPENROUTER_BYOK_FIXTURE)
    expect(config.model).toBe('qwen/qwen3.8-27b:free')
    expect(config.byokKey).toBe(true)
    expect(config.label).toContain('BYOK')
  })

  it('still uses the platform OpenRouter route when NO Groq key exists (the branch keeps its no-Groq job)', async () => {
    setEnv({ GROQ_API_KEY: undefined })
    mockDb.organization.findUnique.mockResolvedValueOnce({ settings: { ...STALE_SHAPE } })

    const config = await resolveAIConfig('org-1')

    expect(config.provider).toBe('openrouter')
    expect(config.model).toBe('qwen/qwen3.8-27b:free')
    expect(config.apiKey).toBe(ROUTER_PLATFORM_FIXTURE)
  })
})

describe('platform OpenRouter → Groq failover in createChatStream (t_c1c40620)', () => {
  beforeEach(() => {
    mockSdkCreate.mockReset()
    mockCtorArgs.length = 0
    vi.clearAllMocks()
    mockDb.organization.findUnique.mockResolvedValue({ settings: null })
  })

  it('an upstream 429 on the platform OpenRouter route fails over to Groq instead of surfacing HTTP 500', async () => {
    // Resolve under a Groq-less env so the (post-fix, Groq-gated) platform
    // OpenRouter branch is the honest resolution — then the Groq key appears
    // before the stream starts, which is the state the failover defends.
    setEnv({
      GROQ_API_KEY: undefined,
      OPENROUTER_API_KEY: ROUTER_PLATFORM_FIXTURE,
      OPENAI_API_KEY: undefined,
      ANTHROPIC_API_KEY: undefined,
    })
    mockDb.organization.findUnique.mockResolvedValueOnce({ settings: { ...STALE_SHAPE } })
    const config = await resolveAIConfig('org-1')
    expect(config.provider).toBe('openrouter')

    setEnv({ GROQ_API_KEY: GROQ_PLATFORM_FIXTURE })

    // Call 1: the exact prod-log 429. Call 2: Groq pinned model answers.
    mockSdkCreate
      .mockRejectedValueOnce(
        new Error("429 Provider returned error: 'qwen/qwen3.8-27b:free is temporarily rate-limited upstream'"),
      )
      .mockResolvedValueOnce(
        (async function* () {
          yield { choices: [{ delta: { content: 'answer via groq failover' } }] }
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
    const second = mockSdkCreate.mock.calls[1][0] as { model?: string }
    // Forced default of the FALLBACK provider — never the stale stored slug (pitfall 18).
    expect(second.model).toBe('openai/gpt-oss-120b')
    // The failover attempt must auth with the PLATFORM Groq key (constructor arg).
    const lastCtor = mockCtorArgs[mockCtorArgs.length - 1]
    expect(lastCtor.apiKey).toBe(GROQ_PLATFORM_FIXTURE)
    expect(text).toContain('answer via groq failover')
    expect(text).not.toContain('error')
  })

  it('keeps walking the pinned Groq list when the first failover model also 429s (mirrors the Groq walk)', async () => {
    setEnv({
      GROQ_API_KEY: undefined,
      OPENROUTER_API_KEY: ROUTER_PLATFORM_FIXTURE,
      OPENAI_API_KEY: undefined,
      ANTHROPIC_API_KEY: undefined,
    })
    mockDb.organization.findUnique.mockResolvedValueOnce({ settings: { ...STALE_SHAPE } })
    const config = await resolveAIConfig('org-1')
    expect(config.provider).toBe('openrouter')

    setEnv({ GROQ_API_KEY: GROQ_PLATFORM_FIXTURE })

    mockSdkCreate
      .mockRejectedValueOnce(new Error('429 openrouter upstream rate limit'))
      .mockRejectedValueOnce(new Error('429 Rate limit reached for model openai/gpt-oss-120b'))
      .mockResolvedValueOnce(
        (async function* () {
          yield { choices: [{ delta: { content: 'answer via second groq model' } }] }
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

    expect(mockSdkCreate).toHaveBeenCalledTimes(3)
    expect((mockSdkCreate.mock.calls[1][0] as { model?: string }).model).toBe('openai/gpt-oss-120b')
    expect((mockSdkCreate.mock.calls[2][0] as { model?: string }).model).toBe('openai/gpt-oss-20b')
    expect(text).toContain('answer via second groq model')
  })

  it('does NOT fail over a BYOK OpenRouter key — the org chose that provider deliberately', async () => {
    mirrorProdEnv()
    mockDb.organization.findUnique.mockResolvedValueOnce({
      settings: { aiProvider: 'openrouter', aiApiKey: ORG_OPENROUTER_BYOK_FIXTURE, aiModel: 'qwen/qwen3.8-27b:free' },
    })
    const config = await resolveAIConfig('org-1')
    expect(config.byokKey).toBe(true)

    mockSdkCreate.mockRejectedValueOnce(new Error('429 rate limited upstream'))

    await expect(
      createChatStream(config, [{ role: 'user', content: 'hi' }]),
    ).rejects.toThrow('429 rate limited upstream')
    expect(mockSdkCreate).toHaveBeenCalledTimes(1)
  })

  it('re-throws when no Groq key exists to fail over to (no silent retry storm)', async () => {
    setEnv({
      GROQ_API_KEY: undefined,
      OPENROUTER_API_KEY: ROUTER_PLATFORM_FIXTURE,
      OPENAI_API_KEY: undefined,
      ANTHROPIC_API_KEY: undefined,
    })
    mockDb.organization.findUnique.mockResolvedValueOnce({ settings: { ...STALE_SHAPE } })
    const config = await resolveAIConfig('org-1')
    expect(config.provider).toBe('openrouter')

    mockSdkCreate.mockRejectedValueOnce(new Error('429 rate limited upstream'))

    await expect(
      createChatStream(config, [{ role: 'user', content: 'hi' }]),
    ).rejects.toThrow('429 rate limited upstream')
    expect(mockSdkCreate).toHaveBeenCalledTimes(1)
  })
})
