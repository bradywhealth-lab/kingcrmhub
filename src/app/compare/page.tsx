import { Metadata } from 'next'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'King CRM Hub vs. The Competition — Honest Pricing, Honest Features',
  description: 'See how King CRM Hub stacks up against HoneyBook, Bonsai, Dubsado, and Moxie. Flat pricing, AI in every plan, no per-seat tax.',
}

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
              <p className="text-sm text-[var(--ink,#0C111B)]/60">vs. The Competition</p>
            </div>
          </div>
          <a href="/pricing" className="px-6 py-2.5 bg-[var(--ink,#0C111B)] text-white rounded-full font-semibold hover:opacity-90 transition-opacity">
            View Our Pricing
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        {/* Hero */}
        <section className="text-center space-y-4">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            King CRM Hub vs. The Competition
          </h1>
          <p className="text-xl text-[var(--ink,#0C111B)]/70 max-w-2xl mx-auto">
            Honest pricing. Honest features. No per-seat tax.
          </p>
        </section>

        {/* Price Comparison Table */}
        <section className="space-y-6">
          <h2 className="text-3xl font-bold">The Price Check</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-[var(--ink,#0C111B)]">
                  <th className="text-left py-4 px-3 font-semibold">Platform</th>
                  <th className="text-center py-4 px-3 font-semibold">Free</th>
                  <th className="text-center py-4 px-3 font-semibold">Entry Paid</th>
                  <th className="text-center py-4 px-3 font-semibold">Mid Tier</th>
                  <th className="text-center py-4 px-3 font-semibold">Top Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ink,#0C111B)]/10">
                <tr className="bg-[var(--teal,#18B897)]/10 font-semibold">
                  <td className="py-4 px-3">King CRM Hub</td>
                  <td className="text-center py-4 px-3">$0</td>
                  <td className="text-center py-4 px-3">$19/mo</td>
                  <td className="text-center py-4 px-3">$39/mo</td>
                  <td className="text-center py-4 px-3">$69/mo</td>
                </tr>
                <tr>
                  <td className="py-4 px-3">HoneyBook</td>
                  <td className="text-center py-4 px-3">—</td>
                  <td className="text-center py-4 px-3">$36/mo</td>
                  <td className="text-center py-4 px-3">$59/mo</td>
                  <td className="text-center py-4 px-3">$129/mo</td>
                </tr>
                <tr>
                  <td className="py-4 px-3">Bonsai</td>
                  <td className="text-center py-4 px-3">—</td>
                  <td className="text-center py-4 px-3">$25/mo</td>
                  <td className="text-center py-4 px-3">$39/mo</td>
                  <td className="text-center py-4 px-3">$59/mo</td>
                </tr>
                <tr>
                  <td className="py-4 px-3">Dubsado</td>
                  <td className="text-center py-4 px-3">—</td>
                  <td className="text-center py-4 px-3">$35/mo</td>
                  <td className="text-center py-4 px-3">—</td>
                  <td className="text-center py-4 px-3">$55/mo</td>
                </tr>
                <tr>
                  <td className="py-4 px-3">Moxie</td>
                  <td className="text-center py-4 px-3">—</td>
                  <td className="text-center py-4 px-3">$25/mo</td>
                  <td className="text-center py-4 px-3">—</td>
                  <td className="text-center py-4 px-3">$40/mo</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-[var(--ink,#0C111B)]/60">
            Sources: HoneyBook pricing (Feb 2025 reprice: Starter $19→$36, +89%), Bonsai, Dubsado, Moxie official pricing pages.
          </p>
        </section>

        {/* Feature Comparison */}
        <section className="space-y-6">
          <h2 className="text-3xl font-bold">What They Gate That We Don&apos;t</h2>
          <div className="space-y-6">
            <FeatureCard
              title="White-label client portal"
              competitors={[
                { name: 'HoneyBook ($129)', available: true, note: 'Premium only' },
                { name: 'Bonsai ($59)', available: true, note: 'Elite only' },
                { name: 'Dubsado ($55)', available: false },
                { name: 'KingCRMHub ($69)', available: true, highlight: true },
              ]}
            />
            <FeatureCard
              title="AI assistant built-in"
              competitors={[
                { name: 'HoneyBook ($129)', available: false },
                { name: 'Bonsai ($59)', available: false },
                { name: 'Dubsado ($55)', available: false },
                { name: 'KingCRMHub ($69)', available: true, note: 'All plans', highlight: true },
              ]}
            />
            <FeatureCard
              title="Bring your own AI key"
              competitors={[
                { name: 'HoneyBook ($129)', available: false },
                { name: 'Bonsai ($59)', available: false },
                { name: 'Dubsado ($55)', available: false },
                { name: 'KingCRMHub ($69)', available: true, note: 'Pro ($19)', highlight: true },
              ]}
            />
            <FeatureCard
              title="Unlimited seats"
              competitors={[
                { name: 'HoneyBook ($129)', available: true, note: 'Premium' },
                { name: 'Bonsai ($59)', available: false, note: '$25/user add-on' },
                { name: 'Dubsado ($55)', available: false, note: '$25/user for 4+' },
                { name: 'KingCRMHub ($69)', available: true, note: 'Elite ($69)', highlight: true },
              ]}
            />
            <FeatureCard
              title="Automations"
              competitors={[
                { name: 'HoneyBook ($129)', available: true, note: 'Essentials ($59)' },
                { name: 'Bonsai ($59)', available: true, note: 'Premium ($39)' },
                { name: 'Dubsado ($55)', available: true, note: 'Premier ($55)' },
                { name: 'KingCRMHub ($69)', available: true, note: 'Pro ($19)', highlight: true },
              ]}
            />
            <FeatureCard
              title="Flat pricing (no per-seat)"
              competitors={[
                { name: 'HoneyBook ($129)', available: false },
                { name: 'Bonsai ($59)', available: false },
                { name: 'Dubsado ($55)', available: false },
                { name: 'KingCRMHub ($69)', available: true, note: 'Always', highlight: true },
              ]}
            />
          </div>
        </section>

        {/* The HoneyBook Problem */}
        <section className="bg-[var(--ink,#0C111B)] text-white rounded-3xl p-8 sm:p-12 space-y-6">
          <h2 className="text-3xl font-bold">The HoneyBook Problem</h2>
          <p className="text-lg leading-relaxed">
            In February 2025, HoneyBook raised prices across every plan — Starter jumped <strong className="text-[var(--teal,#18B897)]">89%</strong> from $19 to $36/mo, Premium went from $79 to $129/mo. Freelancers flooded Reddit asking for alternatives.
          </p>
          <p className="text-lg leading-relaxed font-semibold">
            Our response: We put AI in every plan at $19/mo. Flat. No seat tax.
          </p>
        </section>

        {/* Why KingCRMHub */}
        <section className="space-y-6">
          <h2 className="text-3xl font-bold">Why KingCRMHub</h2>
          <blockquote className="text-xl italic text-[var(--ink,#0C111B)]/80 border-l-4 border-[var(--teal,#18B897)] pl-6 py-4">
            &ldquo;The only CRM with a built-in AI that tells you what to do next — at half the price of tools that make you figure it out yourself.&rdquo;
          </blockquote>
          <div className="grid sm:grid-cols-2 gap-6">
            <BenefitCard
              number={1}
              title="AI Follow-Up Copilot"
              description="Tells you who to email, what to say, and when"
            />
            <BenefitCard
              number={2}
              title="BYO AI"
              description="Connect your own AI provider, no vendor lock-in"
            />
            <BenefitCard
              number={3}
              title="Flat pricing"
              description="Grow your team without per-seat punishment"
            />
            <BenefitCard
              number={4}
              title="Freelancer-first"
              description="Not enterprise jargon, not wedding defaults"
            />
            <BenefitCard
              number={5}
              title="Prompt Arsenal"
              description="100+ battle-tested prompts plugged right into your workflow"
            />
          </div>
        </section>

        {/* What We're Building Next */}
        <section className="space-y-6">
          <h2 className="text-3xl font-bold">What We&apos;re Building Next</h2>
          <ul className="space-y-3 text-lg">
            <li className="flex items-start gap-3">
              <span className="text-[var(--teal,#18B897)] font-bold">•</span>
              <span><strong>Client portal</strong> — public link per client to see project status without login</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[var(--teal,#18B897)] font-bold">•</span>
              <span><strong>CSV import</strong> — bring your spreadsheet in one click</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[var(--teal,#18B897)] font-bold">•</span>
              <span><strong>Email sequences</strong> — drip campaigns for lead nurturing</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[var(--teal,#18B897)] font-bold">•</span>
              <span><strong>Zapier integration</strong> — connect to 1000+ apps</span>
            </li>
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

function FeatureCard({
  title,
  competitors,
}: {
  title: string
  competitors: { name: string; available: boolean; note?: string; highlight?: boolean }[]
}) {
  return (
    <div className="border border-[var(--ink,#0C111B)]/10 rounded-2xl p-6 space-y-4">
      <h3 className="text-xl font-semibold">{title}</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        {competitors.map((comp) => (
          <div
            key={comp.name}
            className={cn(
              'flex items-center gap-3 p-3 rounded-xl',
              comp.highlight ? 'bg-[var(--teal,#18B897)]/20' : 'bg-white/40'
            )}
          >
            <span className={cn('text-2xl', comp.available ? 'text-emerald-600' : 'text-red-600')}>
              {comp.available ? '✓' : '✗'}
            </span>
            <div>
              <p className="font-semibold">{comp.name}</p>
              {comp.note && <p className="text-sm text-[var(--ink,#0C111B)]/60">{comp.note}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BenefitCard({
  number,
  title,
  description,
}: {
  number: number
  title: string
  description: string
}) {
  return (
    <div className="border border-[var(--ink,#0C111B)]/10 rounded-2xl p-6 space-y-2">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--teal,#18B897)] text-white font-bold text-sm">
          {number}
        </span>
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <p className="text-[var(--ink,#0C111B)]/70">{description}</p>
    </div>
  )
}
