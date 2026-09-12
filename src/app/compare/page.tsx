import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'King CRM Hub — Built for Freelancers',
  description:
    'Flat pricing with no per-seat tax. Pipeline boards, client booking, AI assistant on Studio+, and a built-in prompt library — for freelancers.',
}

const INCLUDED = [
  {
    title: 'Pipeline board',
    detail: 'Basic view on Free, full Kanban pipeline on paid plans',
  },
  {
    title: 'Client booking page',
    detail: 'Public scheduling links for your clients — every plan',
  },
  {
    title: 'Prompt library',
    detail: 'Starter pack on Free, full library on Studio+',
  },
  {
    title: 'CSV import',
    detail: 'Bring your client spreadsheet in one click — Pro ($19/mo) and up',
  },
  {
    title: 'Automations',
    detail: '5 rules on Pro, unlimited on Studio+',
  },
  {
    title: 'AI assistant',
    detail: 'Follow-up drafts and next moves from your pipeline — Studio ($39/mo) and up',
  },
  {
    title: 'AI lead scraping + prioritization',
    detail: 'Studio ($39/mo) and up',
  },
  {
    title: 'Unlimited seats',
    detail: 'Grow your team with no per-seat pricing — Elite ($69/mo)',
  },
] as const

const TIERS = [
  { name: 'Free', price: '$0', note: 'Lead capture' },
  { name: 'Pro', price: '$19/mo', note: 'Solo freelancer' },
  { name: 'Studio', price: '$39/mo', note: 'Most popular' },
  { name: 'Elite', price: '$69/mo', note: 'Team scale' },
] as const

const WHY = [
  {
    title: 'Flat pricing',
    detail: 'No per-seat tax — unlimited seats flat at Elite ($69/mo)',
  },
  {
    title: 'Freelancer-first',
    detail: 'Built for independent businesses, not enterprise jargon',
  },
  {
    title: 'Booking on every plan',
    detail: 'Public client scheduling links start at Free',
  },
  {
    title: 'Honest feature list',
    detail: 'Everything we list is live or explicitly marked planned',
  },
] as const

const BUILDING_NEXT = [
  'Tasks & Appointments hub — unified day view with Kanban board mode',
  'Pipeline auto-spawn — winning a deal drafts your contract, kickoff, and invoice tasks (Pro+)',
  'White-label client surfaces (planned — Elite)',
  'Client portal — a public link per client to see project status',
  'Email sequences — drip campaigns for lead nurturing',
  'More integrations — connect to the tools you already use',
] as const

export default function ComparePage() {
  return (
    <div className="min-h-screen bg-[var(--paper,#fcf8ec)] text-[var(--ink,#0C111B)]">
      {/* Header */}
      <header className="border-b border-[var(--ink,#0C111B)]/10 bg-white/40 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[var(--teal,#18B897)] flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">K</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">King CRM Hub</h1>
              <p className="text-sm text-[var(--ink,#0C111B)]/60">Built for freelancers</p>
            </div>
          </div>
          <a
            href="/pricing"
            className="px-6 py-2.5 bg-[var(--ink,#0C111B)] text-white rounded-full font-semibold hover:opacity-90 transition-opacity"
          >
            View Our Pricing
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        {/* Hero */}
        <section className="text-center space-y-4">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Everything your freelance business runs on
          </h1>
          <p className="text-xl text-[var(--ink,#0C111B)]/70 max-w-2xl mx-auto">
            Flat pricing. No per-seat tax. Freelancer-first, from the first lead
            to the last invoice.
          </p>
        </section>

        {/* What's included */}
        <section className="space-y-6">
          <h2 className="text-3xl font-bold">What&apos;s included</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {INCLUDED.map((feature) => (
              <div
                key={feature.title}
                className="border border-[var(--ink,#0C111B)]/10 rounded-2xl p-6 space-y-2 bg-white/40"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl text-emerald-600" aria-hidden="true">
                    ✓
                  </span>
                  <h3 className="text-lg font-semibold">{feature.title}</h3>
                </div>
                <p className="text-[var(--ink,#0C111B)]/70">{feature.detail}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-[var(--ink,#0C111B)]/60">
            Tier details match our{' '}
            <a href="/pricing" className="underline font-medium">
              pricing page
            </a>
            .
          </p>
        </section>

        {/* Flat pricing */}
        <section className="space-y-6">
          <h2 className="text-3xl font-bold">Simple, flat pricing</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className="border border-[var(--ink,#0C111B)]/10 rounded-2xl p-6 text-center space-y-2 bg-[var(--teal,#18B897)]/10"
              >
                <p className="font-semibold">{tier.name}</p>
                <p className="text-3xl font-bold">{tier.price}</p>
                <p className="text-sm text-[var(--ink,#0C111B)]/60">{tier.note}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-[var(--ink,#0C111B)]/60">
            Paid-plan preview. Billing is not active yet. Full details on the{' '}
            <a href="/pricing" className="underline font-medium">
              pricing page
            </a>
            .
          </p>
        </section>

        {/* Why King CRM Hub */}
        <section className="bg-[var(--ink,#0C111B)] text-white rounded-3xl p-8 sm:p-12 space-y-6">
          <h2 className="text-3xl font-bold">Why King CRM Hub</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {WHY.map((item) => (
              <div key={item.title} className="space-y-1">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="text-white/70">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What we're building next */}
        <section className="space-y-6">
          <h2 className="text-3xl font-bold">What we&apos;re building next</h2>
          <ul className="space-y-3 text-lg">
            {BUILDING_NEXT.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="text-[var(--teal,#18B897)] font-bold" aria-hidden="true">
                  •
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--ink,#0C111B)]/10 bg-white/40 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-sm text-[var(--ink,#0C111B)]/60">
          <p>&copy; 2026 King CRM Hub. Proof. Decision. Next Move.</p>
        </div>
      </footer>
    </div>
  )
}
