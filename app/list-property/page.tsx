import type { Metadata } from "next";
import ListProperty from "@/pages/ListProperty";
import { homeUrl, listPropertyUrl } from "@/lib/seo/urls";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "List your property — Architech",
  description: "Put your home on the market with its source trail attached: media rights, RERA context, and a freshness stamp. Submit for review and publish only what can be proven.",
  alternates: { canonical: listPropertyUrl() },
  openGraph: { title: "List your property — Architech", url: listPropertyUrl(), type: "website" },
};

export default function Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "List your property",
    description: "Submit a home for review with its source trail: media rights, RERA context, and freshness.",
    url: listPropertyUrl(),
    isPartOf: { "@type": "WebSite", name: "Architech", url: homeUrl() },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ListProperty />
    </>
  );
}
