import { describe, it, expect } from 'vitest'
import { classifyAIError, AI_KEY_REJECTED_MESSAGE, AI_GENERIC_MESSAGE } from './ai-errors'

describe('classifyAIError', () => {
  it('maps OpenAI 401 authentication errors to the friendly key-rejected message', () => {
    const err = new Error('401 Invalid API key provided: sk-abc123. You can find your API key at https://platform.openai.com/account/api-keys.')
    Object.assign(err, { name: 'AuthenticationError' })
    const res = classifyAIError(err)
    expect(res.kind).toBe('ai_key_rejected')
    expect(res.message).toBe(AI_KEY_REJECTED_MESSAGE)
  })

  it('maps the raw "Missing Authentication header" case to the friendly message', () => {
    const err = new Error('Missing Authentication header')
    const res = classifyAIError(err)
    expect(res.kind).toBe('ai_key_rejected')
    expect(res.message).toBe(AI_KEY_REJECTED_MESSAGE)
    // Never leak the raw SDK text
    expect(res.message).not.toContain('Missing Authentication header')
  })

  it('maps Anthropic/OpenRouter 401 flavors to the friendly message', () => {
    for (const text of [
      '401 authentication_error: invalid x-api-key',
      'Error: Incorrect API key provided',
      '401 Unauthorized: api key is invalid',
    ]) {
      const res = classifyAIError(new Error(text))
      expect(res.kind).toBe('ai_key_rejected')
      expect(res.message).toBe(AI_KEY_REJECTED_MESSAGE)
    }
  })

  it('falls back to the generic message for non-auth failures', () => {
    const res = classifyAIError(new Error('ETIMEDOUT upstream'))
    expect(res.kind).toBe('generic')
    expect(res.message).toBe(AI_GENERIC_MESSAGE)
  })

  it('classifies non-Error values as generic', () => {
    const res = classifyAIError('random string')
    expect(res.kind).toBe('generic')
    expect(res.message).toBe(AI_GENERIC_MESSAGE)
  })
})
