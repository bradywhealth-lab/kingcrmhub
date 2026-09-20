import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockDb = vi.hoisted(() => ({
  organization: {
    findUnique: vi.fn(),
  },
}))

// Mock the SDKs so createChatStream retry behavior is testable without network.
const mockSdkCreate = vi.hoisted(() => vi.fn())
vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: mockSdkCreate } }
  },
}))
vi.mock('groq-sdk', () => ({
  default: class {
    chat = { completions: { create: mockSdkCreate } }
  },
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))

import {
  createChatStream,
  friendlyProviderError,
  getDefaultModel,
  resolveAIConfig,
  type AIProvider,
} from './ai-providers'

const ORIG_ENV: Record<string, string | undefined> = {}

function setEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    const prev = process.env[key]
    ORIG_ENV[key] = prev
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

function clearPlatformKeys() {
  setEnv({
    OPENAI_API_KEY: undefined,
    ANTHROPIC_API_KEY: undefined,
    OPENROUTER_API_KEY: undefined,
    GROQ_API_KEY: undefined,
  })
}

const NO_KEY_MSG = 'Your AI provider key is invalid or expired — open Settings → AI to fix it.'
const OUTAGE_MSG = 'AI provider temporarily unavailable. Please try again in a moment.'

describe('resolveAIConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.organization.findUnique.mockResolvedValue({ settings: null })
    setEnv({ OPENROUTER_API_KEY: 'sk-or-1234567890', GROQ_API_KEY: undefined, OPENAI_API_KEY: undefined, ANTHROPIC_API_KEY: undefined })
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(ORIG_ENV)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  })

  it('falls back to OpenRouter free tier when the saved BYOK key is a placeholder', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({
      settings: { aiProvider: 'openai', aiApiKey: 'sk-placeholder', aiModel: 'gpt-4o' },
    })

    const config = await resolveAIConfig('org-1')

    expect(config.provider).toBe('openrouter')
    expect(config.model).toBe('openrouter/free')
    expect(config.label).toContain('OpenRouter Free')
    expect(config.byokFailure).toBeDefined()
    expect(config.byokFailure).toContain('invalid or missing')
    expect(config.byokFailure).toContain('Open Settings')
  })

  it('falls back when the saved BYOK key is short junk', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({
      settings: { aiProvider: 'groq', aiApiKey: 'abc' },
    })

    const config = await resolveAIConfig('org-1')

    expect(config.provider).toBe('openrouter')
    expect(config.byokFailure).toBeDefined()
  })

  it('falls back with NO notice when the org simply has no saved key', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({
      settings: { aiProvider: 'openai' },
    })

    const config = await resolveAIConfig('org-1')

    expect(config.provider).toBe('openrouter')
    expect(config.byokFailure).toBeUndefined()
  })

  it('trims whitespace from a valid BYOK key', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({
      settings: { aiProvider: 'openai', aiApiKey: '  sk-live-1234567890abcdef  ', aiModel: 'gpt-4o' },
    })

    const config = await resolveAIConfig('org-1')

    expect(config.provider).toBe('openai')
    expect(config.apiKey).toBe('sk-live-1234567890abcdef')
    expect(config.byokFailure).toBeUndefined()
  })

  it('uses the org BYOK key when it looks valid', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({
      settings: { aiProvider: 'openai', aiApiKey: 'sk-live-1234567890abcdef', aiModel: 'gpt-4o' },
    })

    const config = await resolveAIConfig('org-1')

    expect(config.provider).toBe('openai')
    expect(config.model).toBe('gpt-4o')
    expect(config.label).toContain('BYOK')
    expect(config.byokKey).toBe(true)
    expect(config.byokFailure).toBeUndefined()
  })

  it('skips a structurally-valid BYOK key on demand and notices the user', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({
      settings: { aiProvider: 'openai', aiApiKey: 'sk-live-1234567890abcdef', aiModel: 'gpt-4o' },
    })

    const config = await resolveAIConfig('org-1', { skipByokKey: true })

    expect(config.provider).toBe('openrouter')
    expect(config.byokFailure).toBeDefined()
    expect(config.byokFailure).toContain('rejected')
  })

  it('attaches the notice to the platform branch when the chosen provider has an env key and the saved key is junk', async () => {
    setEnv({ OPENROUTER_API_KEY: undefined, GROQ_API_KEY: undefined, OPENAI_API_KEY: 'sk-platform-1234567890' })
    mockDb.organization.findUnique.mockResolvedValueOnce({
      settings: { aiProvider: 'openai', aiApiKey: 'sk-placeholder' },
    })

    const config = await resolveAIConfig('org-1')

    expect(config.provider).toBe('openai')
    expect(config.label).toBe('OpenAI (platform)')
    expect(config.byokFailure).toBeDefined()
    expect(config.byokFailure).toContain('invalid or missing')
  })

  it('uses the OpenRouter platform key when org chose openrouter without BYOK', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({
      settings: { aiProvider: 'openrouter' },
    })

    const config = await resolveAIConfig('org-1')

    expect(config.provider).toBe('openrouter')
    expect(config.label).toBe('OpenRouter (platform)')
  })

  it('uses the Groq free tier when no OpenRouter key is set but Groq is', async () => {
    setEnv({ OPENROUTER_API_KEY: undefined, GROQ_API_KEY: 'gsk-1234567890' })
    mockDb.organization.findUnique.mockResolvedValueOnce({
      settings: { aiProvider: 'openai', aiApiKey: 'sk-placeholder' },
    })

    const config = await resolveAIConfig('org-1')

    expect(config.provider).toBe('groq')
    expect(config.model).toBe('llama-3.3-70b-versatile')
    expect(config.byokFailure).toBeDefined()
  })

  it('returns no-provider config when no keys exist anywhere', async () => {
    clearPlatformKeys()
    mockDb.organization.findUnique.mockResolvedValueOnce({
      settings: { aiProvider: 'openai', aiApiKey: 'sk-placeholder' },
    })

    const config = await resolveAIConfig('org-1')

    expect(config.apiKey).toBe('')
    expect(config.label).toBe('No AI provider configured')
  })
})

describe('createChatStream retry (P1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.organization.findUnique.mockResolvedValue({ settings: null })
    setEnv({ OPENROUTER_API_KEY: 'sk-or-1234567890', GROQ_API_KEY: undefined, OPENAI_API_KEY: undefined, ANTHROPIC_API_KEY: undefined })
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(ORIG_ENV)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  })

  it('retries with the platform free tier when a structurally valid BYOK key is rejected at request time', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({
      settings: { aiProvider: 'openai', aiApiKey: 'sk-live-1234567890abcdef', aiModel: 'gpt-4o' },
    })
    const byokConfig = await resolveAIConfig('org-1')
    mockDb.organization.findUnique.mockResolvedValueOnce({
      settings: { aiProvider: 'openai', aiApiKey: 'sk-live-1234567890abcdef', aiModel: 'gpt-4o' },
    })

    // Call 1: BYOK openai request 401s. Call 2: openrouter free request succeeds.
    mockSdkCreate
      .mockRejectedValueOnce(new Error('401 Missing Authentication header'))
      .mockResolvedValueOnce(async function* () {
        yield { choices: [{ delta: { content: 'fallback response' } }] }
      }())

    const stream = await createChatStream(byokConfig, [{ role: 'user', content: 'hi' }], { organizationId: 'org-1' })

    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let text = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      text += decoder.decode(value, { stream: true })
    }

    expect(mockSdkCreate).toHaveBeenCalledTimes(2)
    expect(text).toContain('notice')
    expect(text).toContain('rejected by the provider')
    expect(text).toContain('fallback response')
    expect(text).not.toContain('Missing Authentication')
  })

  it('re-throws when the fallback itself fails to start', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({
      settings: { aiProvider: 'openai', aiApiKey: 'sk-live-1234567890abcdef' },
    })
    const byokConfig = await resolveAIConfig('org-1')
    mockDb.organization.findUnique.mockResolvedValueOnce({
      settings: { aiProvider: 'openai', aiApiKey: 'sk-live-1234567890abcdef' },
    })

    mockSdkCreate.mockRejectedValue(new Error('502 Bad Gateway'))

    await expect(
      createChatStream(byokConfig, [{ role: 'user', content: 'hi' }], { organizationId: 'org-1' }),
    ).rejects.toThrow('502 Bad Gateway')
  })
})

describe('friendlyProviderError', () => {
  it('maps 401 to the invalid-key message', () => {
    expect(friendlyProviderError('openai', { status: 401 })).toBe(NO_KEY_MSG)
  })

  it('maps 403 to the invalid-key message', () => {
    expect(friendlyProviderError('openrouter', { status: 403 })).toBe(NO_KEY_MSG)
  })

  it('maps raw SDK 401 text like Missing Authentication header to the friendly message', () => {
    const err = new Error('401 Missing Authentication header')
    expect(friendlyProviderError('openai', err)).toBe(NO_KEY_MSG)
  })

  it('gives the generic auth message for fallback-provider auth failures (never mis-blame the org key)', () => {
    expect(friendlyProviderError('openrouter', { status: 401 })).toBe(NO_KEY_MSG)
    expect(NO_KEY_MSG).not.toContain('saved AI provider key')
  })

  it('keeps 5xx provider-outage cases distinct', () => {
    expect(friendlyProviderError('openai', { status: 503 })).toBe(OUTAGE_MSG)
  })

  it('keeps 5xx outage distinct even when the underlying message mentions auth keywords', () => {
    expect(friendlyProviderError('groq', new Error('503 Service Unavailable'))).toBe(OUTAGE_MSG)
  })

  it('always returns client-safe text for unexpected errors', () => {
    const msg = friendlyProviderError('openai', Object.assign(new Error('rate limit 429'), { status: 429 }))
    expect(msg).toContain('AI provider error')
    expect(msg).not.toContain('rate limit')
  })
})

describe('getDefaultModel', () => {
  it('returns the exact free-tier model ids', () => {
    const expected: Record<AIProvider, string> = {
      groq: 'llama-3.3-70b-versatile',
      openai: 'gpt-4o',
      anthropic: 'claude-sonnet-4-20250514',
      openrouter: 'openrouter/free',
    }
    for (const [provider, model] of Object.entries(expected)) {
      expect(getDefaultModel(provider as AIProvider)).toBe(model)
    }
  })
})
