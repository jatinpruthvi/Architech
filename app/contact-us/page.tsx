import type { Metadata } from "next";
import { ContactPage } from "@/pages/PublicParity";
import { canonicalUrl, homeUrl } from "@/lib/seo/urls";

export const metadata: Metadata = {
  title: "Contact Architech — Ahmedabad property desk",
  description: "Contact Architech about Ahmedabad property discovery, partnerships, editorial context, or a moderated property brief.",
  alternates: { canonical: canonicalUrl("/contact-us/") },
  openGraph: { title: "Contact Architech — Ahmedabad property desk", url: canonicalUrl("/contact-us/"), type: "website" },
};

export default function Page() {
  const jsonLd = { "@context": "https://schema.org", "@type": "ContactPage", name: "Contact Architech", url: canonicalUrl("/contact-us/"), isPartOf: { "@type": "WebSite", name: "Architech", url: homeUrl() } };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /><ContactPage /></>;
}
