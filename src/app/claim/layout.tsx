import type { Metadata } from 'next'

/**
 * /claim is a conversion utility page for Gumroad buyers — never indexable
 * (same policy as /auth*). The page itself is a client component and cannot
 * export metadata, so this layout enforces robots: noindex directly (cubic P3
 * round 1: PUBLIC_ROUTES exclusion only removes the route from the sitemap;
 * search engines can still discover it via the /welcome CTA).
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

export default function ClaimLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
