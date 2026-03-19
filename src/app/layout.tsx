import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "EliteCRM - AI-Powered Insurance CRM",
  description: "Elite AI-powered CRM for life and health insurance brokers. Manage leads, pipeline, automation, and more.",
  keywords: ["CRM", "insurance", "AI", "lead management", "pipeline", "automation"],
  icons: {
    icon: "/logo.svg",
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
