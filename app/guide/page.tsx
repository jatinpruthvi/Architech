import type { Metadata } from "next";
import Guide from "@/pages/Guide";
import { getGuides } from "@/lib/repositories";
import { guideUrl } from "@/lib/seo/urls";

export const metadata: Metadata = {
  title: "Field notes — how we verify",
  description: "Architech's methodology: RERA verification, source trails, and freshness stamps — plus locality studies and essays on trust.",
  alternates: { canonical: guideUrl() },
};

export default function Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${guideUrl()}#collection`,
    name: "Field notes — how we verify",
    url: guideUrl(),
    isPartOf: { "@type": "WebSite", name: "Architech" },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: getGuides().map((guide, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: guide.title,
        url: guide.path,
      })),
    },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Guide />
    </>
  );
}
