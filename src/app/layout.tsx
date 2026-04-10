import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { initSentry } from "@/lib/observability/sentry";
import { Analytics } from "@vercel/analytics/next";

initSentry()

export const metadata: Metadata = {
  title: "King CRM Hub",
  description: "King CRM Hub is an AI-powered insurance CRM for lead capture, pipeline management, auth-protected operations, carrier intelligence, and team execution.",
  keywords: ["King CRM Hub", "insurance CRM", "AI CRM", "broker workflow", "lead management", "pipeline", "carrier intelligence"],
  authors: [{ name: "King CRM Hub" }],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "King CRM Hub",
    description: "AI-powered CRM infrastructure for modern insurance teams.",
    url: "https://kingcrmhub.net",
    siteName: "King CRM Hub",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "King CRM Hub",
    description: "AI-powered CRM infrastructure for modern insurance teams.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        {children}
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
