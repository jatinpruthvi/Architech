import type { Metadata } from "next";
import SavedSearches from "@/pages/SavedSearches";
import { savedSearchesUrl } from "@/lib/seo/urls";

/* Prerenderable by design: saved-searches state hydrates client-side, so the
   static snapshot carries this page and the UI suite's overflow check tests
   the real page instead of the home-page fallback. Do not re-add
   force-dynamic. */
export const metadata: Metadata = {
  title: "Saved searches",
  description: "Searches you saved on Architech; we notify you when matching homes arrive.",
  alternates: { canonical: savedSearchesUrl() },
  robots: { index: false },
};

export default function Page() {
  return <SavedSearches />;
}
