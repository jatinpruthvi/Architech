import type { Metadata } from "next";
import { AboutPage } from "@/pages/PublicParity";
import { canonicalUrl, homeUrl } from "@/lib/seo/urls";
import { defaultSocialImage } from "@/lib/seo/social";

export const metadata: Metadata = {
  title: "About Architech — India property discovery",
  description: "Learn how Architech combines locality context across Indian cities, source trails, freshness, and privacy-aware property discovery.",
  alternates: { canonical: canonicalUrl("/about-us/") },
  openGraph: { title: "About Architech — India property discovery", description: "A place-first, evidence-led property discovery platform for India.", url: canonicalUrl("/about-us/"), type: "website", images: [defaultSocialImage()] },
};

export default function Page() {
  const jsonLd = { "@context": "https://schema.org", "@type": "AboutPage", name: "About Architech", url: canonicalUrl("/about-us/"), isPartOf: { "@type": "WebSite", name: "Architech", url: homeUrl() } };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /><AboutPage /></>;
}
