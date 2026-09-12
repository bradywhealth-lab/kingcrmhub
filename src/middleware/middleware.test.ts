import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

// middleware.ts imports next-auth/jwt — mock getToken so no real secret or
// session cookie is needed: the default (undefined token) models a logged-out
// visitor, exactly the case where PWA assets must stay public.
vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn().mockResolvedValue(undefined),
}))

const { middleware } = await import('../../middleware')

describe('PWA assets stay public for logged-out visitors', () => {
  it('passes manifest.webmanifest through without an auth redirect', async () => {
    const request = new NextRequest('http://localhost:3000/manifest.webmanifest')
    const response = await middleware(request, undefined as never)

    // NextResponse.next() answers 200 with no Location header — a 307 to
    // /auth is exactly the production bug this test pins down.
    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })

  it.each([
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-512-maskable.png',
  ])('passes %s through without an auth redirect', async (path) => {
    const request = new NextRequest(`http://localhost:3000${path}`)
    const response = await middleware(request, undefined as never)

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })

  it('still rewrites the landing page for logged-out visitors (regression guard)', async () => {
    const request = new NextRequest('http://localhost:3000/')
    const response = await middleware(request, undefined as never)

    // The root rewrite must survive this change: logged-out / stays public
    // via /welcome, proving the middleware still executes for non-PWA paths.
    expect(response.headers.get('x-middleware-rewrite')).toContain('/welcome')
  })

  it('still redirects protected routes to /auth for logged-out visitors', async () => {
    const request = new NextRequest('http://localhost:3000/some-protected-view')
    const response = await middleware(request, undefined as never)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/auth')
  })
})
