import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/next-auth', () => ({
  buildNextAuthOptions: vi.fn(() => ({})),
}))

import { getServerSession } from 'next-auth'
import { POST } from './route'

const mockSession = getServerSession as unknown as ReturnType<typeof vi.fn>

function post(body: unknown) {
  return new Request('http://localhost/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('/api/billing/checkout — honest coming-soon gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated callers with 401', async () => {
    mockSession.mockResolvedValueOnce(null)
    const response = await POST(post({ planId: 'pro', interval: 'monthly' }))
    expect(response.status).toBe(401)
  })

  it('returns coming_soon with no charge path for a valid paid plan', async () => {
    mockSession.mockResolvedValueOnce({ user: { id: 'u1', email: 'a@b.co' } })
    const response = await POST(post({ planId: 'pro', interval: 'monthly' }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.status).toBe('coming_soon')
    expect(json.url).toBeNull()
    expect(json.message).toContain('not active yet')
  })

  it('400s on malformed JSON, missing fields, and unknown plans', async () => {
    mockSession.mockResolvedValue({ user: { id: 'u1', email: 'a@b.co' } })

    expect((await POST(post('{oops'))).status).toBe(400)
    expect((await POST(post({ planId: 'pro' }))).status).toBe(400)
    expect((await POST(post({ planId: 'hacked', interval: 'monthly' }))).status).toBe(400)
    expect((await POST(post({ planId: 'free', interval: 'monthly' }))).status).toBe(400)
  })
})
