'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles, Users, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Public /claim page — the pre-signup entry point for the promo
// "claim your free 1-month Studio" flow. Buyer enters the email used on their
// Gumroad purchase + their license key; the server verifies via the Gumroad
// License API, then the buyer signs up with a claimToken envelope that the
// signup route redeems as a direct $0 entitlement grant (never Stripe).
export default function ClaimPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0c111b] py-24 text-center text-[#f4f0e6]">Loading…</div>}>
      <ClaimPageInner />
    </Suspense>
  )
}

function ClaimPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    document.title = 'Claim your free Studio month — King CRM Hub'
  }, [])

  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const [licenseKey, setLicenseKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [claimResult, setClaimResult] = useState<{ expiresAt: string } | null>(null)

  const submitClaim = async () => {
    setError(null)
    if (!email.trim() || !licenseKey.trim()) {
      setError('Enter the email from your Gumroad receipt and your license key.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), licenseKey: licenseKey.trim() }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Verification failed')
      setClaimResult({ expiresAt: data.expiresAt })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (claimResult) {
      const claimToken = btoa(JSON.stringify({ licenseKey: licenseKey.trim() }))
      router.push(`/auth?mode=signup&email=${encodeURIComponent(email.trim())}&claimToken=${encodeURIComponent(claimToken)}`)
    }
  }, [claimResult, email, licenseKey, router])

  const INK = '#0C111B'
  const PAPER = '#F4F0E6'
  const TEAL = '#18B897'
  const expiresLabel = claimResult ? new Date(claimResult.expiresAt).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' }) : ''

  return (
    <main className="min-h-screen px-6 py-10" style={{ background: INK }}>
      <div className="mx-auto max-w-3xl rounded-[32px] border p-8 md:p-12" style={{ background: INK, borderColor: 'rgba(244,240,230,0.14)' }}>
        <div className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]" style={{ borderColor: `${TEAL}55`, background: `${TEAL}14`, color: TEAL }}>
          <Wand2 className="h-3.5 w-3.5" /> King CRM Hub
        </div>

        <h1 className="mt-6 text-3xl font-semibold leading-tight tracking-[-0.03em] md:text-5xl" style={{ color: PAPER }}>
          One month of Studio, free.
        </h1>
        <p className="mt-4 text-lg leading-8" style={{ color: 'rgba(244,240,230,0.72)' }}>
          Buy any prompt pack, claim your month. Your license key from the AI Prompt Arsenal or Freelancer OS unlocks Studio for 30 days — no card required.
        </p>

        <div className="mt-8 rounded-3xl border p-5" style={{ borderColor: 'rgba(244,240,230,0.12)', background: 'rgba(244,240,230,0.05)' }}>
          <p className="text-sm font-semibold" style={{ color: PAPER }}>What you get</p>
          <p className="mt-2 text-sm leading-6" style={{ color: 'rgba(244,240,230,0.62)' }}>
            Unlimited leads, full automation, team seats, and the complete prompt library. When your month ends, keep your data — nothing disappears, nothing is charged automatically.
          </p>
        </div>

        {!claimResult ? (
          <div className="mt-8 space-y-5">
            <div>
              <Label htmlFor="claim-email" className="text-sm font-semibold" style={{ color: PAPER }}>Order email</Label>
              <Input
                id="claim-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-2 h-12 rounded-2xl border px-4"
                style={{ borderColor: 'rgba(244,240,230,0.2)', background: '#0C111B', color: PAPER }}
              />
            </div>
            <div>
              <Label htmlFor="claim-key" className="text-sm font-semibold" style={{ color: PAPER }}>License key</Label>
              <Input
                id="claim-key"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                className="mt-2 h-12 rounded-2xl border px-4 font-mono"
                style={{ borderColor: 'rgba(244,240,230,0.2)', background: '#0C111B', color: PAPER }}
              />
            </div>

            {error && <p className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(220,38,38,0.12)', color: '#fca5a5' }}>{error}</p>}

            <Button onClick={() => void submitClaim()} disabled={loading} className="h-12 w-full rounded-2xl text-sm font-semibold" style={{ background: TEAL, color: INK }}>
              {loading ? 'Verifying license…' : 'Verify my license'}
            </Button>

            <p className="text-xs leading-5" style={{ color: 'rgba(244,240,230,0.5)' }}>
              Your license key is verified against Gumroad on the server and never stored. We only save a one-way hash to prevent the same key claiming the offer twice.
            </p>
          </div>
        ) : (
          <div className="mt-8 rounded-3xl border p-6" style={{ borderColor: `${TEAL}55`, background: `${TEAL}14` }}>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6" style={{ color: TEAL }} />
              <p className="text-lg font-semibold" style={{ color: PAPER }}>License verified. Your Studio month starts when you finish signup.</p>
            </div>
            <p className="mt-2 text-sm" style={{ color: 'rgba(244,240,230,0.66)' }}>
              Free Studio through {expiresLabel}. Finish creating your account to activate it.
            </p>
          </div>
        )}

        <div className="mt-10 rounded-3xl border p-5" style={{ borderColor: `${TEAL}44`, background: `${TEAL}0F` }}>
          <p className="text-sm font-semibold" style={{ color: PAPER }}>Already have an account?</p>
          <Link href="/auth" className="mt-2 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: TEAL }}>
            Sign in instead <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-10 border-t pt-6" style={{ borderColor: 'rgba(244,240,230,0.12)' }}>
          <p className="text-xs uppercase tracking-[0.2em]" style={{ color: 'rgba(244,240,230,0.45)' }}>Eligible products</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {['AI Prompt Arsenal', 'Freelancer OS'].map((product) => (
              <span key={product} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium" style={{ borderColor: 'rgba(244,240,230,0.2)', color: PAPER }}>
                <ShieldCheck className="h-3.5 w-3.5" style={{ color: TEAL }} /> {product}
              </span>
            ))}
          </div>
          <p className="mt-4 text-xs" style={{ color: 'rgba(244,240,230,0.4)' }}>
            No guarantees, no refunds, no surprise charges. At the end of your month you choose: keep Studio at $39/mo or drop to Free — your data stays either way.
          </p>
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-xs" style={{ color: 'rgba(244,240,230,0.45)' }}>
          <Users className="h-4 w-4" />
          Built for freelancers and one-person businesses.
        </div>
      </div>
    </main>
  )
}
