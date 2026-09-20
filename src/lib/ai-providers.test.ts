import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockDb = vi.hoisted(() => ({
  organization: {
    findUnique: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))

import {
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
    expect(config.byokFailure).toContain('platform free tier')
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

  it('uses the org BYOK key when it looks valid', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({
      settings: { aiProvider: 'openai', aiApiKey: 'sk-live-1234567890abcdef', aiModel: 'gpt-4o' },
    })

    const config = await resolveAIConfig('org-1')

    expect(config.provider).toBe('openai')
    expect(config.model).toBe('gpt-4o')
    expect(config.label).toContain('BYOK')
    expect(config.byokFailure).toBeUndefined()
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

describe('friendlyProviderError', () => {
  it('maps 401 to the invalid-key message', () => {
    expect(friendlyProviderError('openai', { status: 401 }, undefined)).toBe(
      'Your AI provider key is invalid or expired — open Settings → AI to fix it.',
    )
  })

  it('maps 403 to the invalid-key message', () => {
    expect(friendlyProviderError('openrouter', { status: 403 }, undefined)).toBe(
      'Your AI provider key is invalid or expired — open Settings → AI to fix it.',
    )
  })

  it('maps raw SDK 401 text like Missing Authentication header to the friendly message', () => {
    const err = new Error('401 Missing Authentication header')
    expect(friendlyProviderError('openai', err, undefined)).toBe(
      'Your AI provider key is invalid or expired — open Settings → AI to fix it.',
    )
  })

  it('returns the BYOK failure notice when a BYOK key was rejected', () => {
    const notice = 'Your saved AI provider key is invalid or missing — using the platform free tier. Open Settings → AI to fix it.'
    expect(friendlyProviderError('openai', { status: 401 }, notice)).toBe(notice)
  })

  it('keeps 5xx provider-outage cases distinct', () => {
    expect(friendlyProviderError('openai', { status: 503 }, undefined)).toBe(
      'AI provider temporarily unavailable. Please try again in a moment.',
    )
  })

  it('keeps 5xx outage distinct even when a BYOK notice exists', () => {
    const notice = 'Your saved AI provider key is invalid or missing — using the platform free tier. Open Settings → AI to fix it.'
    expect(friendlyProviderError('groq', new Error('503 Service Unavailable'), notice)).toBe(
      'AI provider temporarily unavailable. Please try again in a moment.',
    )
  })

  it('always returns client-safe text for unexpected errors', () => {
    const msg = friendlyProviderError('openai', Object.assign(new Error('rate limit 429'), { status: 429 }), undefined)
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
