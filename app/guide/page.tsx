import type { Metadata } from "next";
import Guide from "@/pages/Guide";
import { guideUrl } from "@/lib/seo/urls";
import { guideHubJsonLd } from "@/lib/seo/guide-jsonld";

export const metadata: Metadata = {
  title: "Field notes — how we verify",
  description: "Architech's methodology: RERA verification, source trails, and freshness stamps — plus locality studies and essays on trust.",
  alternates: { canonical: guideUrl() },
};

export default function Page() {
  const jsonLd = guideHubJsonLd();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Guide />
    </>
  );
}
