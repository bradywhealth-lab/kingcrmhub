import Link from 'next/link'
import { Metadata } from 'next'

/**
 * Privacy Policy — TEMPLATE content, marked noindex until reviewed by the
 * business owner and replaced with real legal copy (Sentinel audit defect 2).
 * Do not remove the noindex flag while the copy is still a template.
 */
export const metadata: Metadata = {
  // Root layout template appends "— King CRM Hub"; don't repeat the brand here.
  title: 'Privacy Policy',
  description: 'Privacy Policy for King CRM Hub.',
  alternates: { canonical: '/privacy' },
  robots: { index: false, follow: true },
}

const SECTIONS = [
  {
    heading: '1. What we collect',
    body: 'We collect the information you provide when you create an account (name, email, organization), the client data you enter into the workspace (leads, pipeline records, tasks, and documents you upload), technical session data needed to keep you signed in and secure (session identifiers, login state, request metadata), and — when you use AI features — the prompts sent and responses received, which may be stored with your workspace to power history and reporting.',
  },
  {
    heading: '2. How we use your data',
    body: 'Your data is used to operate the service: authentication, storing and displaying your workspace, running automations you configure, and providing AI-assisted features when you enable them. We do not sell your data.',
  },
  {
    heading: '3. AI features',
    body: 'When you use AI-assisted features, relevant workspace content may be sent to the provider selected in Settings or to a platform fallback provider when the selected provider is unavailable. Your organization can configure a provider and use its own API key (BYOK).',
  },
  {
    heading: '4. Data isolation',
    body: 'Each organization\u2019s data is isolated. Access is scoped to the accounts within your organization, and API requests are bound to your organization context.',
  },
  {
    heading: '5. Data retention and deletion',
    body: 'Your data is retained while your account is active. When you delete records or close your account, the associated data is removed from the active database.',
  },
  {
    heading: '6. Security',
    body: 'We use hashed passwords, session tokens, rate limiting, and transport encryption (TLS). No system is perfectly secure; report concerns to us and we will investigate.',
  },
  {
    heading: '7. Cookies',
    body: 'We use session cookies strictly for authentication. We do not use third-party advertising trackers.',
  },
  {
    heading: '8. Changes to this policy',
    body: 'We may update this policy over time. Material changes will be announced in the product or by email where we have your contact details.',
  },
] as const

export default function PrivacyPage() {
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
          <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-[var(--ink,#0C111B)]/60">Last updated: September 18, 2026</p>
          <p className="text-base text-[var(--ink,#0C111B)]/80">
            This policy explains what King CRM Hub collects, how it is used, and
            the choices you have.
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
          <Link href="/terms" className="hover:text-[var(--ink,#0C111B)] transition-colors">
            Terms of Service
          </Link>
          <Link href="/pricing" className="hover:text-[var(--ink,#0C111B)] transition-colors">
            Pricing
          </Link>
        </footer>
      </main>
    </div>
  )
}
