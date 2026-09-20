import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetOrgContext = vi.hoisted(() => vi.fn())
const mockResolveAIConfig = vi.hoisted(() => vi.fn())
const mockCreateChatStream = vi.hoisted(() => vi.fn())
const mockFriendlyProviderError = vi.hoisted(() => vi.fn())

vi.mock('@/lib/request-context', () => ({
  getOrgContext: mockGetOrgContext,
}))

vi.mock('@/lib/ai-providers', () => ({
  resolveAIConfig: mockResolveAIConfig,
  createChatStream: mockCreateChatStream,
  friendlyProviderError: mockFriendlyProviderError,
}))

import { POST } from './route'

function chatRequest(message = 'hello'): NextRequest {
  return new NextRequest('http://localhost/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: message }] }),
  })
}

describe('/api/ai/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetOrgContext.mockResolvedValue({ organizationId: 'org-1', userId: 'user-1' })
    mockResolveAIConfig.mockResolvedValue({
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'sk-live-1234567890',
      label: 'OpenAI (BYOK)',
    })
    mockFriendlyProviderError.mockImplementation((_provider: string, _err: unknown) => 'Friendly mapped error')
  })

  it('rejects unauthenticated requests with 401', async () => {
    mockGetOrgContext.mockResolvedValueOnce(null)

    const res = await POST(chatRequest())

    expect(res.status).toBe(401)
  })

  it('rejects a request with no messages', async () => {
    const res = await POST(
      new NextRequest('http://localhost/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [] }),
      }),
    )

    expect(res.status).toBe(400)
  })

  it('returns a client-safe 503 when no provider key is configured', async () => {
    mockResolveAIConfig.mockResolvedValueOnce({
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      apiKey: '',
      label: 'No AI provider configured',
    })

    const res = await POST(chatRequest())
    const json = await res.json()

    expect(res.status).toBe(503)
    expect(json.error).toContain('No AI provider configured')
    expect(json.error).toContain('Settings')
  })

  it('never leaks raw SDK text through the route catch — maps to friendly error instead', async () => {
    mockCreateChatStream.mockRejectedValueOnce(new Error('401 Missing Authentication header'))
    mockFriendlyProviderError.mockImplementation((_provider: string, _err: unknown) => 'Friendly mapped error')

    const res = await POST(chatRequest())
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('Friendly mapped error')
    expect(JSON.stringify(json)).not.toContain('Missing Authentication')
    expect(mockFriendlyProviderError).toHaveBeenCalledWith('openai', expect.any(Error))
  })

  it('returns a neutral message for failures before a config resolves (bad JSON)', async () => {
    const res = await POST(
      new NextRequest('http://localhost/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not-json',
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('Something went wrong while starting the AI assistant. Please try again.')
    expect(JSON.stringify(json)).not.toContain('Missing Authentication')
    expect(mockFriendlyProviderError).not.toHaveBeenCalled()
  })

  it('returns a streaming response on success', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"content":"hi"}\n\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    mockCreateChatStream.mockResolvedValueOnce(stream)

    const res = await POST(chatRequest())

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/event-stream')
    const text = await res.text()
    expect(text).toContain('data: [DONE]')
  })
})
