import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import Providers from "@/components/architech/Providers";
import Header from "@/components/architech/Header";
import Footer from "@/components/architech/Footer";
import { assetUrl, homeUrl, SITE_URL } from "@/lib/seo/urls";
import "maplibre-gl/dist/maplibre-gl.css";
import "@/theme.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Architech — Find the place before the address. Homes across India.",
    template: "%s · Architech",
  },
  description:
    "Architech is a high-trust way to discover homes across India: verified RERA context, locality intelligence, and architecture-grade curation in 12 cities.",
  manifest: "/manifest.webmanifest",
  alternates: { canonical: homeUrl() },
  icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }], apple: "/icon-192.png" },
  openGraph: {
    type: "website",
    siteName: "Architech",
    locale: "en_IN",
    url: homeUrl(),
    title: "Architech — Find the place before the address.",
    description: "A high-trust way to discover homes across India: verified RERA context, locality intelligence, and architecture-grade curation.",
    images: [{ url: "/images/hero-ahmedabad.jpg", width: 1600, height: 900, alt: "Indian contemporary architecture at golden hour" }],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#1b1612" };

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
    {
      "@type": "Organization",
      "@id": `${homeUrl()}#org`,
      name: "Architech",
      url: homeUrl(),
      logo: assetUrl("/icon-512.png"),
      areaServed: { "@type": "Country", name: "India" },
    },
  ],
};

/* Pre-paint theme script: applies stored/system dark class before first paint. */
const themeScript = `try{var t=localStorage.getItem("architech.theme");if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* beforeInteractive: injected into the document HTML by Next and run
            before first paint, but never rendered through the client React
            tree — a plain inline <script> here makes React dev builds log
            "Encountered a script tag while rendering React component". */}
        <Script id="theme-pre-paint" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,300..600&family=Archivo:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&family=Noto+Sans+Devanagari:wght@400;500&display=swap"
          rel="stylesheet"
        />
        {/* The hero <img> is eager + high-priority, which is the preload; a
            separate <link rel="preload"> for a URL that can 404 only adds a
            console error. */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
      </head>
      {/* <body> carries suppressHydrationWarning because browser/DOM-instrumentation
          extensions inject attributes (e.g. __processed_*) before React hydrates; it is
          not caused by app state. Warnings for child content still surface normally. */}
      <body suppressHydrationWarning>
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
