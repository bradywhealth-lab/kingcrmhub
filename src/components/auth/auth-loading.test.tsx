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
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-busy="true"')
    expect(html).toMatch(/aria-label="[^"]*[Ll]oading[^"]*"/)
  })

  it('shapes the form area like the real auth page (brand + panel + fields)', () => {
    const html = renderToStaticMarkup(<AuthLoadingSkeleton />)
    // Form-shaped placeholder inputs/skeleton bars in the right-side panel.
    expect(html.match(/h-12/g) ?? []).not.toHaveLength(0)
    // Pulsing placeholders so the page reads as loading, not broken.
    expect(html).toContain('animate-pulse')
  })
})
