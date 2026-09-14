import type { Metadata } from 'next'

/**
 * /auth/* is an authenticated-utility surface — never indexable. Title is set
 * per-route via document.title effects in the client pages (they can't export
 * metadata), so this layout deliberately carries no title of its own.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
