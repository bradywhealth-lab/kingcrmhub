import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { initSentry } from "@/lib/observability/sentry";
import { Analytics } from "@vercel/analytics/next";

initSentry()

export const metadata: Metadata = {
  title: "King CRM Hub — The Client Pipeline for One-Person Businesses",
  description: "King CRM Hub is the client pipeline for freelancers and one-person businesses: lead capture, follow-up automation, proposals, and AI guidance in one workspace.",
  keywords: ["King CRM Hub", "freelancer CRM", "client pipeline", "lead management", "follow-up automation", "one-person business", "solo operator"],
  authors: [{ name: "King CRM Hub" }],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "King CRM Hub",
    description: "The client pipeline for freelancers and solo operators.",
    url: "https://kingcrmhub.net",
    siteName: "King CRM Hub",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "King CRM Hub",
    description: "The client pipeline for freelancers and solo operators.",
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
