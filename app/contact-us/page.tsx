import type { Metadata } from "next";
import { ContactPage } from "@/pages/PublicParity";
import { canonicalUrl, homeUrl } from "@/lib/seo/urls";
import { defaultSocialImage } from "@/lib/seo/social";
import { serializeJsonLd } from "@/lib/seo/jsonld-serialize";

export const metadata: Metadata = {
  title: "Contact Architech — India property desk",
  description: "Contact Architech about property discovery in any city we cover, partnerships, editorial context, or a moderated property brief.",
  alternates: { canonical: canonicalUrl("/contact-us/") },
  openGraph: { title: "Contact Architech — India property desk", url: canonicalUrl("/contact-us/"), type: "website", images: [defaultSocialImage()] },
};

export default function Page() {
  const jsonLd = { "@context": "https://schema.org", "@type": "ContactPage", name: "Contact Architech", url: canonicalUrl("/contact-us/"), isPartOf: { "@type": "WebSite", name: "Architech", url: homeUrl() } };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} /><ContactPage /></>;
}
