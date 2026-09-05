import type { Metadata } from "next";
import Collections from "@/pages/Collections";
import { getListings } from "@/lib/repositories/listings";
import { canonicalUrl } from "@/lib/seo/urls";

/* Static: the catalogue is the fixture repository (synchronous, no DB) and
   saved state hydrates client-side — nothing is request-scoped, so this
   prerenders instead of running server code per hit (audit P0.4). */
export const metadata: Metadata = {
  title: "Collections — saved homes on this device",
  description: "Organize saved homes from any Indian city into private collections with notes for visits, comparisons, and follow-up.",
  alternates: { canonical: canonicalUrl("/collections/") },
  robots: { index: false, follow: true },
};

export default function Page() {
  return <Collections catalog={getListings()} />;
}
