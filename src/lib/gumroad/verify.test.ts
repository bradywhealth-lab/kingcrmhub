import { describe, expect, it, vi } from 'vitest'
import { createGumroadVerifier, type GumroadVerifyResult } from './verify'

const GOOD_KEY = 'AAAA-BBBB-CCCC-DDDD'
const PRODUCT_ID = 'pencil-v1'

function buildFetch(handler: (url: string, init?: RequestInit) => Promise<Response>) {
  return vi.fn(handler) as unknown as typeof fetch
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const OK_PURCHASE = {
  product_name: 'AI Prompt Arsenal',
  permalink: 'ai-prompt-arsenal',
  email: 'buyer@example.com',
  order_number: 123456,
  sale_id: 'SALE-1',
  refunded: false,
  disputed: false,
  chargebacked: false,
}

describe('Gumroad license verification', () => {
  it('verifies a valid non-refunded key and returns the purchase', async () => {
    const fetchMock = buildFetch(async (url, init) => {
      expect(String(url)).toBe('https://api.gumroad.com/v2/licenses/verify')
      const body = new URLSearchParams(init?.body as string)
      expect(body.get('product_id')).toBe(PRODUCT_ID)
      expect(body.get('license_key')).toBe(GOOD_KEY)
      return jsonResponse({ success: true, uses: 1, purchase: OK_PURCHASE })
    })

    const verifier = createGumroadVerifier({ fetchImpl: fetchMock, productId: PRODUCT_ID })
    const result = await verifier.verify(GOOD_KEY)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.purchase.email).toBe('buyer@example.com')
      expect(result.purchase.saleId).toBe('SALE-1')
      expect(result.purchase.refunded).toBe(false)
    }
  })

  it('rejects an unknown key (success:false, message) instead of throwing', async () => {
    const fetchMock = buildFetch(async () =>
      jsonResponse({ success: false, message: 'That license does not exist for the provided product.' }),
    )
    const verifier = createGumroadVerifier({ fetchImpl: fetchMock, productId: PRODUCT_ID })
    const result = await verifier.verify('NOPE-NOPE-NOPE-NOPE')
    expect(result.ok).toBe(false)
  })

  it('fails closed on a transport error — network failure never fakes a grant', async () => {
    const fetchMock = buildFetch(async () => {
      throw new Error('ECONNRESET')
    })
    const verifier = createGumroadVerifier({ fetchImpl: fetchMock, productId: PRODUCT_ID })
    const result = await verifier.verify(GOOD_KEY)
    expect(result.ok).toBe(false)
  })

  it('fails closed when Gumroad returns a non-JSON / error status body', async () => {
    const fetchMock = buildFetch(async () => new Response('gateway timeout', { status: 502 }))
    const verifier = createGumroadVerifier({ fetchImpl: fetchMock, productId: PRODUCT_ID })
    const result = await verifier.verify(GOOD_KEY)
    expect(result.ok).toBe(false)
  })

  it('flags refunded/chargebacked/disputed purchases as invalid', async () => {
    for (const flags of [
      { refunded: true, disputed: false, chargebacked: false },
      { refunded: false, disputed: true, chargebacked: false },
      { refunded: false, disputed: false, chargebacked: true },
    ]) {
      const fetchMock = buildFetch(async () =>
        jsonResponse({ success: true, uses: 1, purchase: { ...OK_PURCHASE, ...flags } }),
      )
      const verifier = createGumroadVerifier({ fetchImpl: fetchMock, productId: PRODUCT_ID })
      const result = await verifier.verify(GOOD_KEY)
      expect(result.ok).toBe(false)
    }
  })

  it('verifies against the manual allowlist when configured (env-gated fallback)', async () => {
    const verifier = createGumroadVerifier({
      fetchImpl: buildFetch(async () => {
        throw new Error('should not be called in allowlist mode')
      }),
      productId: PRODUCT_ID,
      allowlist: [
        { email: 'buyer@example.com', key: GOOD_KEY },
        { email: 'other@example.com', key: 'ANOTHER-KEY' },
      ],
    })

    const result = await verifier.verify(GOOD_KEY, 'buyer@example.com')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.purchase.email).toBe('buyer@example.com')
      expect(result.fromAllowlist).toBe(true)
      expect(result.purchase.saleId).toBe('ALLOWLIST')
    }
  })

  it('rejects an allowlist key whose email does not match the claimed email', async () => {
    const verifier = createGumroadVerifier({
      fetchImpl: buildFetch(async () => jsonResponse({ success: false, message: 'unused' })),
      productId: PRODUCT_ID,
      allowlist: [{ email: 'buyer@example.com', key: GOOD_KEY }],
    })

    const result = await verifier.verify(GOOD_KEY)

    expect(result.ok).toBe(false)
  })
})
