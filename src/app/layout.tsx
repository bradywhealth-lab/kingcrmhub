import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { initSentry } from "@/lib/observability/sentry";

initSentry()

export const metadata: Metadata = {
  title: "InsuraFuze CRM",
  description: "InsuraFuze is an AI-first insurance CRM for lead capture, pipeline management, quoting workflows, carrier intelligence, and team operations.",
  keywords: ["InsuraFuze", "insurance CRM", "AI CRM", "broker workflow", "lead management", "pipeline", "quoting", "carrier intelligence"],
  authors: [{ name: "InsuraFuze" }],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "InsuraFuze CRM",
    description: "AI-first CRM infrastructure for modern insurance teams.",
    url: "https://insurafuze-king-crm.vercel.app",
    siteName: "InsuraFuze",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "InsuraFuze CRM",
    description: "AI-first CRM infrastructure for modern insurance teams.",
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
      </body>
    </html>
  );
}
