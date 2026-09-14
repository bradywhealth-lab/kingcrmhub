import type { Metadata } from 'next'

/**
 * /admin/* is an authenticated internal surface — never indexable.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
