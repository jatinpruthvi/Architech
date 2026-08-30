import type { Metadata } from "next";
import { HomeLoanPage } from "@/pages/PublicParity";
import { canonicalUrl, homeUrl } from "@/lib/seo/urls";
import { defaultSocialImage } from "@/lib/seo/social";

export const metadata: Metadata = {
  title: "Home loan EMI calculator — India | Architech",
  description: "Use Architech’s educational home-loan EMI calculator to explore indicative principal, tenure, rate, interest, and total payable outputs.",
  alternates: { canonical: canonicalUrl("/home-loan/") },
  openGraph: { title: "Home loan EMI calculator — India | Architech", url: canonicalUrl("/home-loan/"), type: "website", images: [defaultSocialImage()] },
};

export default function Page() {
  const jsonLd = { "@context": "https://schema.org", "@type": "FinancialProduct", name: "Architech educational home-loan EMI calculator", url: canonicalUrl("/home-loan/"), isPartOf: { "@type": "WebSite", name: "Architech", url: homeUrl() } };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /><HomeLoanPage /></>;
}
