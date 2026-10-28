/**
 * Render-level regression test for the auth page.
 *
 * Deploy defect 2026-10-28 (image d4522eb8e36e, HEAD 91a0f53): #254 added
 * `safeCallback` to the mount effect's dependency array while the const was
 * declared AFTER the effect in the component body. A deps-array reference
 * evaluates during render, so every browser hit "ReferenceError: Cannot
 * access 'safeCallback' before initialization" (minified: 'es') and the error
 * boundary served "This page couldn't load" — login AND signup dead — while
 * build, lint, and the whole unit suite stayed green. Root cause of the escape:
 * the suite runs in a node environment and never executed a component render.
 *
 * This test executes the real render phase via react-dom/server's
 * renderToString — no jsdom or testing-library needed — so declaration-order
 * defects (TDZ) in the component body fail HERE instead of in production.
 * The navigation hooks are mocked so the Suspense-wrapped tree renders
 * synchronously.
 */
import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'

vi.mock('next/navigation', () => ({
  // SSR renders the login-mode shell; the mode deep-link switches in a
  // client effect, which never runs under renderToString. The regression
  // this test guards is the render-phase TDZ, not the mode switch.
  useSearchParams: () => new URLSearchParams('mode=signup'),
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

describe('auth page render regression (deploy defect 2026-10-28)', () => {
  it('renders the signup form without a TDZ ReferenceError', async () => {
    const { default: AuthPage } = await import('@/app/auth/page')

    let html = ''
    // On the defective build this line threw:
    //   ReferenceError: Cannot access 'safeCallback' before initialization
    expect(() => {
      html = renderToString(<AuthPage />)
    }).not.toThrow()

    // The login-mode form actually rendered (not an error boundary). Labels
    // are styled uppercase via CSS, not text — assert on rendered strings.
    expect(html).toContain('Welcome back')
    expect(html).toContain('Forgot password?')
  })
})
