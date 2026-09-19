import { Sparkles } from 'lucide-react'

/**
 * Zero-blip skeleton for the auth surface (PR: loading fallback for the
 * ~2s pre-hydration window on /auth, /auth?mode=signup).
 *
 * Background: the previous Suspense fallback was a bare dark screen with a
 * single pulse bar and NO innerText — browser innerText=0 and the page read
 * as blank/broken to a new visitor until the client component hydrated.
 * Contract (enforced by auth-loading.test.tsx): the pre-hydration shell MUST
 * paint the brand wordmark, real text, and form-shaped placeholders from the
 * first frame — visible content at t≈0, no blank window.
 *
 * Server-rendered by /auth/page.tsx's Suspense fallback, this ships inside the
 * initial HTML payload for the statically prerendered /auth route, so it paints
 * before any JS hydration round-trip.
 */
export function AuthLoadingSkeleton() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading sign in"
      className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(24,184,151,0.18),transparent_32%),linear-gradient(180deg,#fcf8ec_0%,#f4f0e6_100%)] px-4 py-6 lg:px-8 lg:py-8"
    >
      <p role="status" aria-live="polite" className="sr-only">
        Loading sign in
      </p>
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl overflow-hidden rounded-[32px] border border-white/60 bg-[rgba(252,252,252,0.76)] shadow-[0_30px_100px_rgba(31,42,54,0.14)] backdrop-blur-xl lg:min-h-[calc(100vh-4rem)]">
        <section className="relative hidden flex-1 overflow-hidden bg-[#0c111b] px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(24,184,151,0.35),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(58,95,217,0.28),transparent_28%)]" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--teal)]">
                <Sparkles className="h-5 w-5 text-[var(--ink)]" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">King CRM Hub</p>
                <p className="text-lg font-semibold text-white">Freelancer client workspace</p>
              </div>
            </div>
            <div className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-medium text-white/70">
              Freelancer client system
            </div>
          </div>

          <div className="relative z-10 max-w-2xl space-y-8">
            <div className="h-10 w-44 animate-pulse rounded-xl bg-white/8" />
            <div className="h-14 w-3/4 animate-pulse rounded-2xl bg-white/8" />
            <div className="space-y-3">
              <div className="h-5 w-full animate-pulse rounded-lg bg-white/6" />
              <div className="h-5 w-5/6 animate-pulse rounded-lg bg-white/6" />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="h-28 animate-pulse rounded-3xl bg-white/6" />
              <div className="h-28 animate-pulse rounded-3xl bg-white/6" />
              <div className="h-28 animate-pulse rounded-3xl bg-white/6" />
            </div>
          </div>

          <div className="relative z-10 h-20 w-full animate-pulse rounded-[28px] bg-white/6" />
        </section>

        <section className="flex w-full flex-col justify-between px-5 py-6 sm:px-8 lg:w-[520px] lg:px-10 lg:py-10 xl:w-[560px]">
          <div>
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--teal)]">
                <Sparkles className="h-5 w-5 text-[var(--ink)]" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--ink)]/50">King CRM Hub</p>
                <p className="text-sm font-semibold text-[var(--ink)]">Freelancer workspace</p>
              </div>
            </div>

            <div className="mb-8 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--teal-deep)]">Secure workspace access</p>
              <div className="h-9 w-64 animate-pulse rounded-xl bg-[var(--ink)]/10" />
              <div className="h-5 w-full animate-pulse rounded-lg bg-[var(--ink)]/8" />
              <div className="h-5 w-3/4 animate-pulse rounded-lg bg-[var(--ink)]/8" />
            </div>

            <div className="mb-6 grid grid-cols-2 gap-1 rounded-2xl border border-[rgba(31,42,54,0.08)] bg-[var(--paper)] p-1">
              <div className="h-12 animate-pulse rounded-[14px] bg-white shadow-[0_10px_25px_rgba(31,42,54,0.08)]" />
              <div className="h-12 animate-pulse rounded-[14px] bg-[var(--ink)]/5" />
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="h-3 w-24 animate-pulse rounded bg-[var(--ink)]/15" />
                <div className="h-12 animate-pulse rounded-2xl bg-white shadow-sm" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-16 animate-pulse rounded bg-[var(--ink)]/15" />
                <div className="h-12 animate-pulse rounded-2xl bg-white shadow-sm" />
              </div>
              <div className="h-12 w-full animate-pulse rounded-2xl bg-[var(--teal)]" />
              <div className="h-14 w-full animate-pulse rounded-2xl bg-white/60" />
            </div>
          </div>

          <p className="mt-10 text-center text-xs text-[var(--ink)]/35">
            © {new Date().getFullYear()} King CRM Hub. Proof. Decision. Next Move.
          </p>
        </section>
      </div>
    </main>
  )
}
