import type { Metadata } from "next";
import { FeedbackPage } from "@/pages/PublicParity";
import { canonicalUrl, homeUrl } from "@/lib/seo/urls";
import { defaultSocialImage } from "@/lib/seo/social";

export const metadata: Metadata = {
  title: "Feedback for Architech — property discovery",
  description: "Share feedback about the Architech property discovery experience. Reviews are never published without real consent and moderation.",
  alternates: { canonical: canonicalUrl("/review/") },
  openGraph: { title: "Feedback for Architech — property discovery", url: canonicalUrl("/review/"), type: "website", images: [defaultSocialImage()] },
};

export default function Page() {
  const jsonLd = { "@context": "https://schema.org", "@type": "WebPage", name: "Feedback for Architech", url: canonicalUrl("/review/"), isPartOf: { "@type": "WebSite", name: "Architech", url: homeUrl() } };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /><FeedbackPage /></>;
}
