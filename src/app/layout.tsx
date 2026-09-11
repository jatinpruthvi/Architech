import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
/* Self-hosted fonts via Fontsource (npm) — replaces the render-blocking
   Google Fonts link (extra external round-trips, third-party origin, no
   subsetting guarantee). Variable faces for display/sans, static weights for
   mono and the Devanagari fallback; woff2 with unicode-range subsetting, so
   the browser only downloads the subsets it renders. Family names in
   theme.css must match the Fontsource names (* Variable). */
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/instrument-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/noto-sans-devanagari/400.css";
import "@fontsource/noto-sans-devanagari/500.css";
import Providers from "@/components/architech/Providers";
import Header from "@/components/architech/Header";
import Footer from "@/components/architech/Footer";
import WebVitalsReporter from "@/components/architech/WebVitalsReporter";
import { homeUrl, SITE_URL } from "@/lib/seo/urls";
import { defaultSocialImage } from "@/lib/seo/social";
import { organizationJsonLd } from "@/lib/seo/organization";
import "@/theme.css";
import { serializeJsonLd } from "@/lib/seo/jsonld-serialize";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Architech — Find the place before the address.",
    template: "%s · Architech",
  },
  description:
    "Architech is a high-trust way to discover homes across India: verified RERA context, locality intelligence, and architecture-grade curation in 12 cities.",
  manifest: "/manifest.webmanifest",
  /* No layout-level canonical default: any route that forgets its own would
     otherwise publish `<canonical = homepage>` — a false identity claim the
     crawl simulation now catches. Home sets homeUrl() explicitly in page.tsx;
     every other route carries its own canonical via the urls.ts builders. */
  icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }], apple: "/icon-192.png" },
  openGraph: {
    type: "website",
    siteName: "Architech",
    locale: "en_IN",
    url: homeUrl(),
    title: "Architech — Find the place before the address.",
    description: "A high-trust way to discover homes across India: verified RERA context, locality intelligence, and architecture-grade curation.",
    /* Dimensions and the absolute URL both come from the shared helper, not a
       hand-written guess. These were 1600x900 against an image that is
       actually 1376x768 — a 16% overstatement of width published on every
       route that inherits this default, which is what tells a social platform
       how to crop the preview. The URL was relative too, which OGP requires
       to be absolute. Omitted dimensions if the asset is ever unmapped: no
       dimensions is better than wrong dimensions. */
    images: [{ ...defaultSocialImage(), alt: "Indian contemporary architecture at golden hour" }],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#180b05" };

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${homeUrl()}#website`,
      url: homeUrl(),
      name: "Architech",
      description: "High-trust home discovery across India.",
      inLanguage: ["en-IN", "hi-IN"],
    },
    /* F §3: property is YMYL, so the organisation behind the site is part of
       how Google decides whether to trust it. The address and coordinates are
       facts /contact-us/ already publishes; the phone and email are omitted
       because those channels are not activated yet and inventing them would be
       the fabricated trust signal this scrutiny exists to catch. */
    organizationJsonLd(),
  ],
};

/* Theme flash prevention lives in ThemeProvider (a pre-paint layout effect),
   not in an inline <script> here: React dev builds warn on inline scripts
   rendered through the component tree, and next/script's inline queue is
   still such a script. */

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* The hero <img> is eager + high-priority, which is the preload; a
            separate <link rel="preload"> for a URL that can 404 only adds a
            console error. */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(websiteJsonLd) }} />
      </head>
      {/* <body> carries suppressHydrationWarning because browser/DOM-instrumentation
          extensions inject attributes (e.g. __processed_*) before React hydrates; it is
          not caused by app state. Warnings for child content still surface normally. */}
      <body suppressHydrationWarning>
        {/* RUM heartbeat: reports LCP/INP/CLS/TTFB to /api/observability/web-vitals. */}
        <WebVitalsReporter />
        <Providers>
          <a href="#main" className="skip-link">Skip to content</a>
          <Header />
          <main id="main" tabIndex={-1}>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
