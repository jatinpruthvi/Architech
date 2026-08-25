import type { Metadata } from "next";
import SavedSearches from "@/pages/SavedSearches";

export const metadata: Metadata = {
  title: "Saved searches",
  description: "Searches you saved on Architech; we notify you when matching homes arrive.",
  robots: { index: false },
};

export default function Page() {
  return <SavedSearches />;
}
