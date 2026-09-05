import type { Metadata } from "next";
import Saved from "@/pages/Saved";
import { getListings } from "@/lib/repositories/listings";
import { savedUrl } from "@/lib/seo/urls";

/* Prerenderable by design: saved state hydrates from localStorage in an
   effect, so the static snapshot carries this page and the a11y/UI suites
   (which run against `dist/`) test the real saved surface instead of the
   home-page fallback. Keep it that way — do not re-add force-dynamic. */
export const metadata: Metadata = {
  title: "Saved homes",
  description: "Your Architech shortlist, saved on this device.",
  alternates: { canonical: savedUrl() },
  robots: { index: false },
};

export default function Page() {
  return <Saved listings={getListings()} />;
}
