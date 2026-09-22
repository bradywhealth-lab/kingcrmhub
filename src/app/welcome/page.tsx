import Link from 'next/link'
import { ArrowRight, ExternalLink, LayoutGrid, Send, Sparkles } from 'lucide-react'
import type { Metadata } from 'next'

// `/` is rewritten to this page for visitors; declare `/` as the canonical
// so the duplicate /welcome URL can't split ranking signals (SEO review fix).
export const metadata: Metadata = {
  title: {
    absolute: 'King CRM Hub — The Client Command Center for One-Person Businesses',
  },
  description:
    'Clients, pipeline, work, and money in one calm command center — with follow-ups handled for you. Built for freelancers and solo operators, not sales teams.',
  alternates: { canonical: '/' },
}

// "Regal" landing palette: white canvas, ink-black chrome, one Cobalt accent.
const INK = '#0B0B0C'
const COBALT = '#2F6BFF'

const PROOF = [
  'Made for one-person businesses',
  'Pipeline from first hello → paid',
  'Automations on every plan, no upsell games',
  'Free for AI Prompt Arsenal & Freelancer OS buyers',
]

const FEATURES = [
  { icon: LayoutGrid, title: 'One command center', desc: 'Every client, project, and payment tracked from first hello to paid — no spreadsheet chaos.' },
  { icon: Send, title: 'Follow-ups on autopilot', desc: 'Know who to contact next, what to say, and when — with your own prompts plugged in.' },
  { icon: Sparkles, title: 'Automations, every plan', desc: 'Sequences, reminders, and workflow rules from day one. No upsell games.' },
]

export default function PublicLandingPage() {
  return (
    <main data-deploy-marker="regal-landing-v1" className="min-h-screen bg-white text-[#0B0B0C]">
      {/* TOP NAV */}
      <header className="sticky top-0 z-40 bg-[#0B0B0C] text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-7 px-5 sm:px-8">
          <span className="font-display text-xl font-extrabold tracking-tight">KING<span style={{ color: COBALT }}>.</span></span>
          <nav aria-label="Primary" className="ml-2 hidden items-center gap-6 text-sm font-medium text-white/70 md:flex">
            <Link href="/pricing" className="transition-colors hover:text-white">Pricing</Link>
            <Link href="/claim" className="transition-colors hover:text-white">Claim</Link>
            <Link href="/compare" className="transition-colors hover:text-white">Compare</Link>
            <a href="https://www.amazon.com/dp/B0HJPZX6WG" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 transition-colors hover:text-white">
              Amazon Planner <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <Link href="/auth" className="text-sm font-semibold text-white/80 transition-colors hover:text-white">Log in</Link>
            <Link href="/auth?mode=signup" className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold" style={{ background: COBALT, color: '#fff' }}>
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-4xl px-5 pt-16 pb-6 text-center sm:px-8 sm:pt-20">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#0B0B0C]/12 px-4 py-2 text-[13px] font-semibold text-[#0B0B0C]/60">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: COBALT }} /> The client OS for one-person businesses
        </span>
        <h1 className="font-display mx-auto mt-6 max-w-3xl text-5xl font-bold leading-[1.03] tracking-[-0.03em] sm:text-6xl">
          Run your whole business from{' '}
          <span className="relative whitespace-nowrap">
            one calm
            <span className="absolute inset-x-0 bottom-1.5 -z-0 h-3.5 rounded-sm" style={{ background: COBALT, opacity: 0.28 }} />
          </span>{' '}
          command center.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[#0B0B0C]/60">
          Clients, pipeline, work, and money — with the follow-ups handled for you. Built for freelancers and solo operators, not sales teams.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/auth?mode=signup" className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-bold" style={{ background: COBALT, color: '#fff' }}>
            Start free <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/claim" className="inline-flex items-center rounded-xl border border-[#0B0B0C]/15 bg-white px-6 py-3.5 text-[15px] font-bold text-[#0B0B0C]">
            Bought the prompts? Claim free
          </Link>
        </div>
        <p className="mt-5 text-[13px] font-semibold text-[#0B0B0C]/45">No per-seat fees · Automations on every plan · Free for prompt-pack owners</p>
      </section>

      {/* PRODUCT PREVIEW */}
      <section className="mx-auto mt-10 max-w-5xl px-5 sm:px-8">
        <div className="overflow-hidden rounded-2xl border border-[#0B0B0C]/10 bg-white shadow-[0_40px_90px_rgba(11,11,12,0.14)]">
          <div className="flex h-11 items-center gap-2 bg-[#0B0B0C] px-4">
            <span className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-white/25" /><i className="h-2.5 w-2.5 rounded-full bg-white/25" /><i className="h-2.5 w-2.5 rounded-full bg-white/25" /></span>
            <span className="ml-3 font-mono text-xs text-white/50">app.kingcrmhub.net/home</span>
          </div>
          <div className="grid grid-cols-[180px_1fr] max-sm:grid-cols-1">
            <div className="border-r border-[#0B0B0C]/8 bg-[#F6F6F4] p-4 max-sm:hidden">
              {['Overview', "Today's plays", 'Follow-ups', 'Invoices'].map((n, i) => (
                <div key={n} className={`mb-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold ${i === 0 ? 'border border-[#0B0B0C]/10 bg-white text-[#0B0B0C]' : 'text-[#0B0B0C]/55'}`}>{n}</div>
              ))}
            </div>
            <div className="p-5">
              <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-2">
                {[['Clients', '5'], ['Pipeline', '$300k'], ['Score', '82'], ['Due', '7']].map(([l, v], i) => (
                  <div key={l} className={`rounded-xl border p-3 ${i === 1 ? 'border-[color:var(--x)] bg-[#2F6BFF]/8' : 'border-[#0B0B0C]/10'}`} style={i === 1 ? { borderColor: COBALT } : undefined}>
                    <div className="text-[11px] font-bold uppercase tracking-wide text-[#0B0B0C]/45">{l}</div>
                    <div className="font-display mt-1 text-2xl font-bold">{v}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 overflow-hidden rounded-xl border border-[#0B0B0C]/10">
                {[['Emily Davis — send pricing', 'Proposal', '$75,000'], ['Alex Chen — book call', 'Qualified', '$50,000'], ['Lisa Anderson — qualify budget', 'New', '$30,000']].map((r, i) => (
                  <div key={r[0]} className={`flex items-center gap-3 px-4 py-3 text-[13px] ${i > 0 ? 'border-t border-[#0B0B0C]/8' : ''}`}>
                    <span className="flex-1 font-medium text-[#0B0B0C]">{r[0]}</span>
                    <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: 'rgba(47,107,255,0.12)', color: '#1E4FCC' }}>{r[1]}</span>
                    <span className="font-mono font-semibold">{r[2]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROOF STRIP */}
      <section className="mx-auto mt-14 max-w-5xl px-5 sm:px-8">
        <div className="flex flex-wrap gap-2.5">
          {PROOF.map((p) => (
            <span key={p} className="inline-flex items-center gap-2 rounded-full border border-[#0B0B0C]/10 bg-[#F6F6F4] px-4 py-2 text-sm font-medium text-[#0B0B0C]/75">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: COBALT }} /> {p}
            </span>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto mt-12 grid max-w-5xl gap-5 px-5 sm:px-8 md:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-2xl border border-[#0B0B0C]/10 p-6">
            <div className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: INK, color: COBALT }}>
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="font-display mt-4 text-xl font-semibold">{f.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-[#0B0B0C]/60">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* METRICS BAND */}
      <section className="mt-16 bg-[#0B0B0C] px-5 py-14 text-white sm:px-8">
        <div className="mx-auto grid max-w-4xl gap-8 text-center md:grid-cols-3">
          {[['3.2×', 'faster follow-ups'], ['$0', 'per-seat fees, ever'], ['1', 'calm place for everything']].map(([n, l]) => (
            <div key={l}>
              <div className="font-display text-5xl font-extrabold" style={{ color: COBALT }}>{n}</div>
              <div className="mt-2 text-[15px] text-white/65">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* GUMROAD PATH */}
      <section className="mx-auto max-w-5xl px-5 py-14 sm:px-8">
        <div className="rounded-2xl border border-[#0B0B0C]/10 bg-[#F6F6F4] p-7 md:flex md:items-center md:justify-between md:gap-6">
          <div>
            <h3 className="font-display text-xl font-semibold">Already own the AI Prompt Arsenal or Freelancer OS?</h3>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[#0B0B0C]/60">
              Your prompts do the thinking — let your CRM do the follow-up. Grab the packs and templates that plug straight into this workspace.
            </p>
          </div>
          <a href="https://bradywave32.gumroad.com" target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex shrink-0 items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold md:mt-0" style={{ background: INK, color: '#fff' }}>
            Browse the prompt library <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#0B0B0C]/10 px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="font-display text-lg font-extrabold">KING<span style={{ color: COBALT }}>.</span></span>
          <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-[#0B0B0C]/55">
            <Link href="/pricing" className="hover:text-[#0B0B0C]">Pricing</Link>
            <Link href="/claim" className="hover:text-[#0B0B0C]">Claim</Link>
            <Link href="/terms" className="hover:text-[#0B0B0C]">Terms</Link>
            <Link href="/privacy" className="hover:text-[#0B0B0C]">Privacy</Link>
            <Link href="/auth" className="hover:text-[#0B0B0C]">Log in</Link>
          </nav>
          <span className="text-sm text-[#0B0B0C]/45">© 2026 King CRM Hub</span>
        </div>
      </footer>
    </main>
  )
}
