import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AuthLoadingSkeleton } from '@/components/auth/auth-loading'

/**
 * Regression: Sentinel full-app sweep (2026-09-19) measured /auth and
 * /auth?mode=signup rendering a BLANK view for ~2s after navigation
 * (body_chars=0, inputs=0 at t≈0). Root cause: the Suspense fallback
 * shipped a near-empty dark screen with aria-label text only — no real
 * innerText — so the first paint read as a blank/broken page to a new
 * visitor. This test locks the zero-blip contract: the pre-hydration
 * skeleton MUST contain visible text plus branded wordmark and form-shaped
 * placeholders, not an empty screen. React 19 Suspense fallbacks stream
 * into the initial HTML before hydration, so this is server-renderable
 * and assertable in the node-env Vitest harness.
 *
 * Note on renderToStaticMarkup: stripping tags yields a text approximation,
 * NOT a browser's innerText — it also includes aria-label attribute values
 * and text inside CSS-hidden elements (the brand panel is `hidden lg:flex`).
 * The length guard alone therefore does not prove visible innerText; the
 * specific string matches below are the real guard.
 */
describe('AuthLoadingSkeleton', () => {
  it('renders real, non-empty innerText in the pre-hydration shell', () => {
    const html = renderToStaticMarkup(<AuthLoadingSkeleton />)
    // Strips tags; yields the text a browser's innerText would expose.
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    expect(text.length).toBeGreaterThan(0)
    expect(text).toMatch(/King CRM Hub/)
    expect(text).toMatch(/Freelancer client workspace/)
    expect(text).toMatch(/Secure workspace access/)
  })

  it('exposes the loading state to assistive tech', () => {
    const html = renderToStaticMarkup(<AuthLoadingSkeleton />)
    // The landmark stays a <main>; the live region is a small separate
    // element, so screen readers announce a concise status, not the whole
    // skeleton.
    expect(html).toContain('<main')
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-busy="true"')
    expect(html).toMatch(/aria-label="[^"]*[Ll]oading[^"]*"/)
  })

  it('shapes the form area like the real auth page (brand + panel + fields)', () => {
    const html = renderToStaticMarkup(<AuthLoadingSkeleton />)
    // Form-shaped placeholder rows in the right-side panel. Scoped to
    // "h-12 animate-pulse" so the brand-panel logo (h-12 w-12, no pulse)
    // cannot satisfy this assertion alone.
    expect(html.match(/h-12 animate-pulse/g) ?? []).not.toHaveLength(0)
    // Pulsing placeholders so the page reads as loading, not broken.
    expect(html).toContain('animate-pulse')
  })
})
