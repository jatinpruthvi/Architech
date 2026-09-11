import type { Metadata } from "next";
import { AboutPage } from "@/screens/PublicParity";
import { aboutFaqs } from "@/lib/content/about-faqs";
import { canonicalUrl, homeUrl } from "@/lib/seo/urls";
import { buildFaqPage } from "@/lib/seo/faq";
import { defaultSocialImage } from "@/lib/seo/social";
import { serializeJsonLd } from "@/lib/seo/jsonld-serialize";

export const metadata: Metadata = {
  title: "About us — India property discovery",
  description: "Learn how Architech combines locality context across Indian cities, source trails, freshness, and privacy-aware property discovery.",
  alternates: { canonical: canonicalUrl("/about-us/") },
  openGraph: { title: "About us — India property discovery", description: "A place-first, evidence-led property discovery platform for India.", url: canonicalUrl("/about-us/"), type: "website", images: [defaultSocialImage()] },
};

export default function Page() {
  /* The FAQ node is built from `aboutFaqs`, the same constant the component
     renders as <details> elements. Google requires FAQ markup to describe
     content visible on the page, so sharing one source is not a convenience —
     it is the thing that keeps this compliant as the copy changes. */
  const faq = buildFaqPage(aboutFaqs, canonicalUrl("/about-us/"));
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "AboutPage", name: "About Architech", url: canonicalUrl("/about-us/"), isPartOf: { "@type": "WebSite", name: "Architech", url: homeUrl() } },
      ...(faq ? [faq] : []),
    ],
  };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} /><AboutPage /></>;
}
