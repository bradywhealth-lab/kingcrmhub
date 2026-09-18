import Link from 'next/link'
import { Metadata } from 'next'

/**
 * Terms of Service — TEMPLATE content, marked noindex until reviewed by the
 * business owner and replaced with real legal copy (Sentinel audit defect 2).
 * Do not remove the noindex flag while the copy is still a template.
 */
export const metadata: Metadata = {
  // Root layout template appends "— King CRM Hub"; don't repeat the brand here.
  title: 'Terms of Service',
  description: 'Terms of Service for King CRM Hub.',
  alternates: { canonical: '/terms' },
  robots: { index: false, follow: true },
}

const SECTIONS = [
  {
    heading: '1. Acceptance of these terms',
    body: 'By creating an account or using King CRM Hub, you agree to these Terms of Service. If you do not agree with them, do not use the service.',
  },
  {
    heading: '2. Your account',
    body: 'You are responsible for keeping your login credentials secure and for all activity under your account. Accounts are intended for one-person businesses and small teams as described in the plan you select.',
  },
  {
    heading: '3. Acceptable use',
    body: 'You agree not to misuse the service, including attempting to access other organizations\u2019 data, reverse-engineering the platform, uploading unlawful content, or using the service to send spam.',
  },
  {
    heading: '4. Plans and billing',
    body: 'Plan features and limits are listed on the pricing page. Paid plans are billed monthly or annually as displayed at checkout. You may cancel at any time; cancellation stops future billing.',
  },
  {
    heading: '5. Your data',
    body: 'You retain ownership of the client and pipeline data you enter. We process that data only to operate the service, as described in our Privacy Policy.',
  },
  {
    heading: '6. Service availability',
    body: 'We work to keep the service available and reliable, but we do not guarantee uninterrupted access. We may change or discontinue features with reasonable notice where practical.',
  },
  {
    heading: '7. Limitation of liability',
    body: 'To the maximum extent permitted by law, King CRM Hub is not liable for indirect, incidental, or consequential damages arising from your use of the service.',
  },
  {
    heading: '8. Changes to these terms',
    body: 'We may update these terms over time. Material changes will be announced in the product or by email where we have your contact details.',
  },
] as const

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--paper,#fcf8ec)] text-[var(--ink,#0C111B)]">
      <header className="border-b border-[var(--ink,#0C111B)]/10 bg-white/40 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[var(--teal,#18B897)] flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">K</span>
            </div>
            <span className="text-xl font-bold">King CRM Hub</span>
          </Link>
          <Link
            href="/auth?mode=signup"
            className="px-6 py-2.5 bg-[var(--ink,#0C111B)] text-white rounded-full font-semibold hover:opacity-90 transition-opacity"
          >
            Create account
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
        <section className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">Terms of Service</h1>
          <p className="text-sm text-[var(--ink,#0C111B)]/60">Last updated: September 18, 2026</p>
          <p className="text-base text-[var(--ink,#0C111B)]/80">
            These terms govern your use of King CRM Hub, the client pipeline for
            one-person businesses.
          </p>
        </section>

        <section className="space-y-6">
          {SECTIONS.map((section) => (
            <div key={section.heading} className="space-y-2">
              <h2 className="text-xl font-semibold">{section.heading}</h2>
              <p className="text-[var(--ink,#0C111B)]/75 leading-7">{section.body}</p>
            </div>
          ))}
        </section>

        <footer className="border-t border-[var(--ink,#0C111B)]/10 pt-6 flex flex-wrap gap-4 text-sm text-[var(--ink,#0C111B)]/60">
          <Link href="/privacy" className="hover:text-[var(--ink,#0C111B)] transition-colors">
            Privacy Policy
          </Link>
          <Link href="/pricing" className="hover:text-[var(--ink,#0C111B)] transition-colors">
            Pricing
          </Link>
        </footer>
      </main>
    </div>
  )
}
