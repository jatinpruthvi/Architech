import type { Metadata } from "next";
import Collections from "@/pages/Collections";
import { canonicalUrl } from "@/lib/seo/urls";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Collections — saved homes on this device",
  description: "Organize saved homes from any Indian city into private collections with notes for visits, comparisons, and follow-up.",
  alternates: { canonical: canonicalUrl("/collections/") },
  robots: { index: false, follow: true },
};

export default function Page() {
  return <Collections />;
}
