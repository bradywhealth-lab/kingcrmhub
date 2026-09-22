import Link from 'next/link'
import { ArrowRight, ExternalLink, TrendingUp, Wand2, Zap, CheckCircle2 } from 'lucide-react'
import type { Metadata } from 'next'

// `/` is rewritten to this page for visitors; declare `/` as the canonical
// so the duplicate /welcome URL can't split ranking signals (SEO review fix).
export const metadata: Metadata = {
  title: {
    absolute: 'King CRM Hub — The Client Pipeline for One-Person Businesses',
  },
  description:
    'See who to follow up with, what to say, and when to send it. Built for freelancers and solo operators, not sales teams.',
  alternates: { canonical: '/' },
}

// Locked landing palette (Gate v3): Ink #0C111B, Paper #F4F0E6, Signal Teal #18B897
// Contrast (machine-verified, WCAG AA normal text):
//   Paper on Ink 16.60:1 PASS | Ink on Paper 16.60:1 PASS
//   Teal on Ink   7.50:1 PASS | Ink on Teal   7.50:1 PASS
//   Teal on Paper 2.21:1 FAIL -> teal NEVER used as text on paper surfaces;
//   teal is an accent on Ink backgrounds only.
const INK = '#0C111B'
const PAPER = '#F4F0E6'
const TEAL = '#18B897'

const PROOF_POINTS = [
  'Made for one-person businesses',
  'Pipeline from first contact → paid',
  'Automations in every plan, no upsell games',
  'Free for AI Prompt Arsenal & Freelancer OS buyers',
]

export default function PublicLandingPage() {
  return (
    <main data-deploy-marker="public-landing-v3" className="min-h-screen px-6 py-10" style={{ background: INK }}>
      <div
        className="mx-auto max-w-6xl rounded-[32px] border p-8 md:p-14"
        style={{ background: INK, borderColor: 'rgba(244,240,230,0.14)' }}
      >
        {/* NAV */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]"
            style={{ borderColor: `${TEAL}55`, background: `${TEAL}14`, color: TEAL }}
          >
            <Wand2 className="h-3.5 w-3.5" /> King CRM Hub
          </div>
          <nav aria-label="Primary navigation" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium">
            <Link href="/pricing" style={{ color: 'rgba(244,240,230,0.72)' }} className="transition-opacity hover:opacity-80">Pricing</Link>
            <Link href="/claim" style={{ color: 'rgba(244,240,230,0.72)' }} className="transition-opacity hover:opacity-80">Claim</Link>
            <a
              href="https://www.amazon.com/dp/B0HJPZX6WG"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-opacity hover:opacity-80"
              style={{ color: 'rgba(244,240,230,0.72)' }}
            >
              Amazon Planner <ExternalLink className="ml-1 h-3.5 w-3.5" />
            </a>
            <Link href="/auth" style={{ color: 'rgba(244,240,230,0.72)' }} className="transition-opacity hover:opacity-80">Log in</Link>
            <Link
              href="/auth?mode=signup"
              className="inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ background: TEAL, color: INK }}
            >
              Start free <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </nav>
        </div>

        <h1
          className="mt-6 max-w-4xl text-4xl font-semibold leading-tight tracking-[-0.03em] md:text-6xl"
          style={{ color: PAPER }}
        >
          Run your client pipeline like a one-person agency.
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8" style={{ color: 'rgba(244,240,230,0.72)' }}>
          See who to follow up with, what to say, and when to send it. Built for freelancers and solo
          operators, not sales teams.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/auth?mode=signup"
            className="inline-flex items-center rounded-2xl px-6 py-3 text-sm font-semibold"
            style={{ background: TEAL, color: INK }}
          >
            Start free <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
          <Link
            href="/claim"
            className="inline-flex items-center rounded-2xl border px-6 py-3 text-sm font-semibold"
            style={{ borderColor: 'rgba(244,240,230,0.25)', background: 'transparent', color: PAPER }}
          >
            Bought the prompts? Claim your free account
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center rounded-2xl border px-6 py-3 text-sm font-semibold"
            style={{ borderColor: 'rgba(244,240,230,0.25)', background: 'transparent', color: PAPER }}
          >
            View pricing
          </Link>
        </div>
        <p className="mt-4 max-w-3xl text-sm font-medium" style={{ color: 'rgba(244,240,230,0.62)' }}>
          No per-seat fees. Automations included on every plan.
        </p>

        {/* PROOF STRIP */}
        <div
          className="mt-12 rounded-3xl border p-6 md:p-8"
          style={{ borderColor: `${TEAL}44`, background: `${TEAL}0F` }}
        >
          <p className="text-base font-semibold" style={{ color: PAPER }}>
            Built for people who sell their own work.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {PROOF_POINTS.map((point) => (
              <div
                key={point}
                className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium"
                style={{ borderColor: 'rgba(244,240,230,0.16)', background: 'rgba(244,240,230,0.05)', color: PAPER }}
              >
                <CheckCircle2 className="h-4 w-4" style={{ color: TEAL }} />
                {point}
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm leading-6" style={{ color: 'rgba(244,240,230,0.66)' }}>
            New product. Early freelancers get founder pricing and a direct line to Brady.
          </p>
        </div>

        {/* FEATURE CARDS */}
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { icon: TrendingUp, title: 'Client pipeline command center', desc: 'Every client and project tracked from first contact to paid — no spreadsheet chaos.' },
            { icon: Wand2, title: 'Follow-up guidance', desc: 'Know who to contact next, what to say, and when to send it — with your own prompts plugged in.' },
            { icon: Zap, title: 'Automations in every plan', desc: 'Sequences, reminders, and workflow rules included from day one. No upsell games.' },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-3xl border p-5"
              style={{ borderColor: 'rgba(244,240,230,0.12)', background: 'rgba(244,240,230,0.05)' }}
            >
              <div
                className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl"
                style={{ background: `${TEAL}22`, color: TEAL }}
              >
                <item.icon className="h-5 w-5" />
              </div>
              <p className="text-lg font-semibold" style={{ color: PAPER }}>{item.title}</p>
              <p className="mt-2 text-sm leading-6" style={{ color: 'rgba(244,240,230,0.62)' }}>{item.desc}</p>
            </div>
          ))}
        </div>

        {/* SEE THE WORKSPACE — real product screenshots only (no mockups rule).
            Images are actual captures of the built UI: pipeline kanban, lead
            detail with AI follow-up guidance, and automation rules. */}
        <div className="mt-12">
          <h2 className="text-2xl font-semibold tracking-[-0.02em]" style={{ color: PAPER }}>
            See the workspace
          </h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {[
              {
                caption: 'Client pipeline command center',
                alt: 'King CRM Hub pipeline view for freelancers',
                src: '/screenshots/pipeline.png',
              },
              {
                caption: 'Follow-up guidance',
                alt: 'Follow-up guidance with custom AI prompts',
                src: '/screenshots/follow-up-guidance.png',
              },
              {
                caption: 'Automations from day one',
                alt: 'Automation rules included on every plan',
                src: '/screenshots/automations.png',
              },
            ].map((shot) => (
              <figure key={shot.src} className="rounded-3xl border overflow-hidden" style={{ borderColor: 'rgba(244,240,230,0.14)' }}>
                <img
                  src={shot.src}
                  alt={shot.alt}
                  loading="lazy"
                  className="w-full aspect-[16/10] object-cover object-top"
                  style={{ background: INK }}
                />
                <figcaption className="px-4 py-3 text-sm font-medium" style={{ color: PAPER, background: `${TEAL}0F` }}>
                  {shot.caption}
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-5 text-sm leading-6" style={{ color: 'rgba(244,240,230,0.66)' }}>
            Your prompts do the thinking. The CRM handles the follow-up.
          </p>
        </div>

        <div className="mt-8 rounded-3xl p-5" style={{ background: PAPER }}>
          <p className="text-sm font-semibold" style={{ color: INK }}>
            Automations in every plan. Flat pricing, no per-seat tax.
          </p>
        </div>

        {/* GUMROAD PATH */}
        <div
          className="mt-10 rounded-3xl border p-6"
          style={{ borderColor: `${TEAL}44`, background: `${TEAL}0F` }}
        >
          <p className="text-base font-semibold" style={{ color: PAPER }}>
            Already own the AI Prompt Arsenal or Freelancer OS?
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: 'rgba(244,240,230,0.66)' }}>
            Your prompts do the thinking — let your CRM do the follow-up. Grab the prompt packs and
            templates that plug straight into this workspace.
          </p>
          <a
            href="https://bradywave32.gumroad.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center rounded-2xl border px-5 py-2.5 text-sm font-semibold"
            style={{ borderColor: `${TEAL}66`, background: INK, color: TEAL }}
          >
            Browse the prompt library <ExternalLink className="ml-2 h-3.5 w-3.5" />
          </a>
        </div>

        <footer className="mt-12 flex flex-col items-center gap-3">
          <nav aria-label="Footer navigation" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium">
            <Link href="/pricing" style={{ color: 'rgba(244,240,230,0.55)' }} className="transition-opacity hover:opacity-80">Pricing</Link>
            <Link href="/claim" style={{ color: 'rgba(244,240,230,0.55)' }} className="transition-opacity hover:opacity-80">Claim</Link>
            <Link href="/terms" style={{ color: 'rgba(244,240,230,0.55)' }} className="transition-opacity hover:opacity-80">Terms</Link>
            <Link href="/privacy" style={{ color: 'rgba(244,240,230,0.55)' }} className="transition-opacity hover:opacity-80">Privacy</Link>
            <Link href="/auth" style={{ color: 'rgba(244,240,230,0.55)' }} className="transition-opacity hover:opacity-80">Log in</Link>
          </nav>
          <p className="text-center text-sm font-semibold" style={{ color: PAPER }}>
            © 2026 King CRM Hub. Proof. Decision. Next Move.
          </p>
        </footer>
      </div>
    </main>
  )
}
