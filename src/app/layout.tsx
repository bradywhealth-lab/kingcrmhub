import type { Metadata } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { initSentry } from "@/lib/observability/sentry";
import { rootJsonLdGraph } from "@/lib/seo/jsonld";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/seo/site-config";

initSentry()

// "Regal" brand type system: Bricolage Grotesque for editorial display headlines
// that pop, Plus Jakarta Sans for calm, legible UI/body, JetBrains Mono for
// tabular money + metrics. Self-hosted via next/font (no runtime CDN calls).
const fontDisplay = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-bricolage",
  display: "swap",
});
const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
  display: "swap",
});
const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s — ${SITE_NAME}`,
  },
  description: "King CRM Hub is the client pipeline for freelancers and one-person businesses: lead capture, follow-up automation, client booking, proposals, and AI guidance in one workspace.",
  keywords: ["King CRM Hub", "freelancer CRM", "client pipeline", "lead management", "follow-up automation", "one-person business", "solo operator", "CRM for freelancers", "client management software"],
  authors: [{ name: SITE_NAME }],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SITE_NAME,
  },
  openGraph: {
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: "Lead capture, follow-up automation, client booking, proposals, and AI guidance — one workspace for one-person businesses.",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_US",
    type: "website",
    images: [{ url: "/og-home.png", width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: "The client pipeline for freelancers and solo operators.",
    images: ["/og-home.png"],
  },
};

const jsonLd = JSON.stringify(rootJsonLdGraph());

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable}`}
    >
      <body className="antialiased bg-background text-foreground">
        <script
          type="application/ld+json"
          // Static, build-time JSON-LD from a typed builder (no user input).
          dangerouslySetInnerHTML={{ __html: jsonLd }}
        />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
