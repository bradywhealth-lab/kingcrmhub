import Link from 'next/link'
import { ArrowRight, ExternalLink, TrendingUp, Wand2, Zap } from 'lucide-react'

// Locked landing palette (Gate v3): Ink #0C111B, Paper #F4F0E6, Signal Teal #18B897
// Contrast (machine-verified, WCAG AA normal text):
//   Paper on Ink 16.60:1 PASS | Ink on Paper 16.60:1 PASS
//   Teal on Ink   7.50:1 PASS | Ink on Teal   7.50:1 PASS
//   Teal on Paper 2.21:1 FAIL -> teal NEVER used as text on paper surfaces;
//   teal is an accent on Ink backgrounds only.
const INK = '#0C111B'
const PAPER = '#F4F0E6'
const TEAL = '#18B897'

export default function PublicLandingPage() {
  return (
    <main className="min-h-screen px-6 py-10" style={{ background: INK }}>
      <div
        className="mx-auto max-w-6xl rounded-[32px] border p-8 md:p-14"
        style={{ background: INK, borderColor: 'rgba(244,240,230,0.14)' }}
      >
        <div
          className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]"
          style={{ borderColor: `${TEAL}55`, background: `${TEAL}14`, color: TEAL }}
        >
          <Wand2 className="h-3.5 w-3.5" /> King CRM Hub
        </div>

        <h1
          className="mt-6 max-w-4xl text-4xl font-semibold leading-tight tracking-[-0.03em] md:text-6xl"
          style={{ color: PAPER }}
        >
          Run your client pipeline like a one-person agency.
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8" style={{ color: 'rgba(244,240,230,0.72)' }}>
          See who to follow up with, what to say, and when to send it — then make the next move.
        </p>

        <p className="mt-3 max-w-3xl text-base font-medium leading-7" style={{ color: PAPER }}>
          Built for freelancers and solo operators. Not designed for sales teams. Free for AI Prompt Arsenal &amp; Freelancer OS buyers.
        </p>

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

        <div className="mt-8 rounded-3xl p-5" style={{ background: PAPER }}>
          <p className="text-sm font-semibold" style={{ color: INK }}>
            HoneyBook raised prices 89%. We put automations in every plan.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/auth?mode=signup"
            className="inline-flex items-center rounded-2xl px-6 py-3 text-sm font-semibold"
            style={{ background: TEAL, color: INK }}
          >
            Bought the prompts? Claim your free account <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
          <Link
            href="/auth"
            className="inline-flex items-center rounded-2xl border px-6 py-3 text-sm font-semibold"
            style={{ borderColor: 'rgba(244,240,230,0.25)', background: 'transparent', color: PAPER }}
          >
            Sign in
          </Link>
        </div>

        <div
          className="mt-10 rounded-3xl border p-6"
          style={{ borderColor: `${TEAL}44`, background: `${TEAL}0F` }}
        >
          <p className="text-base font-semibold" style={{ color: PAPER }}>
            Already own the AI Prompt Arsenal or Freelancer OS?
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: 'rgba(244,240,230,0.66)' }}>
            Your prompts do the thinking — let your CRM do the follow-up. Grab the prompt packs and templates that plug straight into this workspace.
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

        <p className="mt-12 text-center text-sm font-semibold" style={{ color: PAPER }}>
          © 2026 King CRM Hub. Proof. Decision. Next Move.
        </p>
      </div>
    </main>
  )
}
