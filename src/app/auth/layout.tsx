import type { Metadata } from 'next'

/**
 * Auth pages (login/signup/password/invite) are utility routes with no
 * search value — keep them out of the index but let crawlers follow links
 * back into the public site.
 */
export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in or create your King CRM Hub account.',
  robots: { index: false, follow: true },
}

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
