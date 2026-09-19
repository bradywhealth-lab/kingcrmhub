import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/next-auth', () => ({
  buildNextAuthOptions: vi.fn(() => ({})),
}))

vi.mock('@/lib/billing/stripe', () => ({
  stripeMode: vi.fn(),
  stripeModeLabel: vi.fn(),
  isLivePendingActivation: vi.fn(() => false),
}))

import { getServerSession } from 'next-auth'
import { stripeMode, stripeModeLabel } from '@/lib/billing/stripe'
import { GET } from './route'

const mockSession = getServerSession as unknown as ReturnType<typeof vi.fn>
const mockMode = stripeMode as unknown as ReturnType<typeof vi.fn>
const mockLabel = stripeModeLabel as unknown as ReturnType<typeof vi.fn>

describe('/api/billing/status — honest mode label', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession.mockResolvedValue({ user: { id: 'u1' } })
  })

  it('reports off when no Stripe key is configured', async () => {
    mockMode.mockReturnValue('off')
    mockLabel.mockReturnValue('off')
    const res = await GET()
    const json = await res.json()
    expect(json.mode).toBe('off')
    expect(json.active).toBe('off')
    expect(json.livePendingActivation).toBe(false)
  })

  it('reports test mode as active (test billing is real against test cards)', async () => {
    mockMode.mockReturnValue('test')
    mockLabel.mockReturnValue('test')
    const res = await GET()
    const json = await res.json()
    expect(json.mode).toBe('test')
    expect(json.active).toBe('test')
  })

  it('reports live-pending-activation when live keys exist without the go flag', async () => {
    mockMode.mockReturnValue('live')
    mockLabel.mockReturnValue('live-pending-activation')
    const res = await GET()
    const json = await res.json()
    expect(json.mode).toBe('live')
    expect(json.active).toBe('live-pending-activation')
  })
})
