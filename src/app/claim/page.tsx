'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, ShieldCheck, Users, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// Public /claim page — the pre-signup entry point for the promo
// "claim your free 1-month Studio" flow. Buyer enters the email used on their
// Gumroad purchase + their license key; the server verifies via the Gumroad
// License API and returns an OPAQUE claim-token (the server-issued ClaimGrant
// id). Signup then redeems that token as a direct $0 entitlement grant (never
// Stripe). The raw license key NEVER enters a URL — it stays in component
// memory until the server round-trip finishes (cubic P2 round 1).
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
  const [productId, setProductId] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [claimResult, setClaimResult] = useState<{ grantId: string; expiresAt: string } | null>(null)
  const [products, setProducts] = useState<{ id: string; name: string }[]>([])

  // The eligible-product list is server-side truth (GET /api/claim reads the
  // configured GUMROAD_PRODUCT_ID_* env): a product with no configured id (e.g.
  // Freelancer OS when GUMROAD_PRODUCT_ID_2 is empty) is NOT advertised, so no
  // buyer is sent into a claim that cannot succeed (cubic P2 round 1).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/claim')
        const data = await res.json()
        if (cancelled) return
        if (res.ok && Array.isArray(data.products)) setProducts(data.products)
      } catch {
        // Non-blocking: a failed catalog fetch falls back to the single
        // configured product on the POST path; the form still works.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const needsProductSelect = products.length > 1

  const submitClaim = async () => {
    setError(null)
    if (!email.trim() || !licenseKey.trim()) {
      setError('Enter the email from your Gumroad receipt and your license key.')
      return
    }
    if (needsProductSelect && !productId) {
      setError('Select the product you purchased.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          licenseKey: licenseKey.trim(),
          ...(needsProductSelect ? { productId } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Verification failed')
      setClaimResult({ grantId: data.claimToken, expiresAt: data.expiresAt })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (claimResult) {
      // The claim-token is the opaque server-issued grant id — NOT the license
      // key. The key never appears in the URL / referrer / history.
      router.push(
        `/auth?mode=signup&email=${encodeURIComponent(email.trim())}&claimToken=${encodeURIComponent(claimResult.grantId)}`,
      )
    }
  }, [claimResult, email, router])

  const INK = '#0C111B'
  const PAPER = '#F4F0E6'
  const TEAL = '#18B897'
  // Truthful window copy: the 30-day clock starts at VERIFICATION (the server
  // mints expiresAt = verification + 30d — cubic P2 round 1). We never promise
  // a date that assumes signup-day start; buyers who delay lose days, not the
  // whole claim.
  const expiresLabel = claimResult
    ? new Date(claimResult.expiresAt).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })
    : ''

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

            {needsProductSelect && (
              <div>
                <Label className="text-sm font-semibold" style={{ color: PAPER }}>Product you purchased</Label>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {products.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => setProductId(product.id)}
                      className={cn(
                        'flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-medium transition',
                        productId === product.id
                          ? 'border-[#18b897] bg-[#18b897]/15 text-[#f4f0e6]'
                          : 'border-white/15 bg-white/5 text-[#f4f0e6]/80 hover:border-white/30',
                      )}
                    >
                      <span>{product.name}</span>
                      {productId === product.id && <CheckCircle2 className="h-4 w-4 text-[#18b897]" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
              <p className="text-lg font-semibold" style={{ color: PAPER }}>License verified. Your Studio month starts today.</p>
            </div>
            <p className="mt-2 text-sm" style={{ color: 'rgba(244,240,230,0.66)' }}>
              Free Studio through {expiresLabel}. Finish creating your account to activate it — the 30-day clock runs from verification, so sign up today.
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
            {products.map((product) => (
              <span key={product.id} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium" style={{ borderColor: 'rgba(244,240,230,0.2)', color: PAPER }}>
                <ShieldCheck className="h-3.5 w-3.5" style={{ color: TEAL }} /> {product.name}
              </span>
            ))}
            {products.length === 0 && (
              <span className="text-xs" style={{ color: 'rgba(244,240,230,0.4)' }}>
                Eligible products are listed when available.
              </span>
            )}
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
