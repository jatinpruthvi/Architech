import type { Metadata } from "next";
import ListProperty from "@/pages/ListProperty";
import { homeUrl, listPropertyUrl } from "@/lib/seo/urls";
import { serializeJsonLd } from "@/lib/seo/jsonld-serialize";

/* Static content page: no request-scoped data, so it prerenders instead of
   invoking server code on every hit (cost-reduction-audit P0.4). */
export const metadata: Metadata = {
  title: "List your property — Architech",
  description: "Put your home on the market with its source trail attached: media rights, RERA context, and a freshness stamp. Publish only what can be proven.",
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <ListProperty />
    </>
  );
}
