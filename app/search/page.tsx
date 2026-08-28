import type { Metadata } from "next";
import { Suspense } from "react";
import ResultsPage from "@/pages/ResultsPage";
import { searchUrl } from "@/lib/seo/urls";

export const metadata: Metadata = {
  title: "Search homes across India",
  description: "Search RERA-checked homes across 12 Indian cities with combinable filters, a city scope, honest freshness stamps, and a live map.",
  alternates: { canonical: searchUrl() },
  robots: { index: false, follow: true }, // faceted-navigation rule: search results stay unindexed
};

export default function Page() {
  return (
    <Suspense fallback={<div className="flex min-h-[70vh] items-center justify-center bg-paper pt-[78px]" role="status" aria-label="Loading search"><span className="arch-mark grid h-14 w-14 animate-pulse place-items-center"><span className="arch-mark-arch" /></span></div>}>
      <ResultsPage />
    </Suspense>
  );
}
