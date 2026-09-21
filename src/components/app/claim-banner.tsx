'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, X } from 'lucide-react'

/**
 * Day-21/31 in-app nudge banner (spec t_7160ffb5 §4/§6 — banner only, no
 * mailer). Rendered at the top of the workspace for orgs on a promo claim
 * grant. Copy follows the Copy Law: no competitor names, no model names, no
 * guarantees, no surprise-charge language.
 */
export function ClaimBanner() {
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'hidden' }
    | { kind: 'active'; daysLeft: number; expiresAt: string }
    | { kind: 'expired' }
  >({ kind: 'loading' })
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/billing/grant')
        const data = await res.json()
        if (cancelled) return
        if (!res.ok || data.error) {
          setState({ kind: 'hidden' })
          return
        }
        if (!data.grant) {
          setState({ kind: 'hidden' })
          return
        }
        if (data.grant.active && data.grant.nudgeAt === 0) {
          setState({ kind: 'active', daysLeft: data.grant.daysLeft, expiresAt: data.grant.expiresAt })
        } else if (data.grant.active) {
          // Banner only starts on day 21 of the window (spec §6: nudge at
          // day-21/31); showing it the moment a claim lands would be noise.
          setState({ kind: 'hidden' })
        } else if (data.grantExpired && (data.plan === 'pro' || data.plan === 'enterprise')) {
          // Grant expired but a live Stripe subscription still grants the paid
          // tier — no nudge to "keep Studio" for someone already paying for it
          // (cubic P3 round 1: resolveEffectivePlan surfaces this distinction).
          setState({ kind: 'hidden' })
        } else {
          setState({ kind: 'expired' })
        }
      } catch {
        if (!cancelled) setState({ kind: 'hidden' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (dismissed || state.kind === 'loading' || state.kind === 'hidden') return null

  const expiredLabel =
    state.kind === 'expired'
      ? 'Your free Studio month has ended. Your data is still here — keep Studio at $39/mo or stay on Free.'
      : undefined

  const activeLabel =
    state.kind === 'active'
      ? `Your free Studio month is active through ${new Date(state.expiresAt).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })}. Keep Studio at $39/mo when it ends, or drop to Free — your data stays either way.`
      : undefined

  const label = activeLabel ?? expiredLabel

  return (
    <div className="flex items-start justify-between gap-3 border-b border-[color:var(--cobalt-dark)]/25 bg-[color:var(--cobalt)]/10 px-4 py-3 sm:px-6 lg:px-8">
      <div className="flex items-start gap-2.5 text-sm text-[color:var(--ink)]">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--cobalt-dark)]" />
        <p>
          {label}{' '}
          <Link href="/pricing" className="font-semibold underline decoration-[color:var(--cobalt-dark)]/40 underline-offset-2">
            See your options
          </Link>
        </p>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-full p-1 text-[color:var(--ink)]/50 hover:bg-[color:var(--ink)]/5 hover:text-[color:var(--ink)]"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
