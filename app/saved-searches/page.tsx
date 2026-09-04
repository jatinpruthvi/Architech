import type { Metadata } from "next";
import SavedSearches from "@/pages/SavedSearches";
import { savedSearchesUrl } from "@/lib/seo/urls";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Saved searches",
  description: "Searches you saved on Architech; we notify you when matching homes arrive.",
  alternates: { canonical: savedSearchesUrl() },
  robots: { index: false },
};

export default function Page() {
  return <SavedSearches />;
}
