import type { Metadata } from "next";
import { Suspense } from "react";
import ResultsPage from "@/pages/ResultsPage";

export const metadata: Metadata = {
  title: "Search homes in Ahmedabad",
  description: "Search RERA-checked homes across Ahmedabad with combinable filters, honest freshness stamps, and a live map.",
  alternates: { canonical: "/search/" },
  robots: { index: false, follow: true }, // faceted-navigation rule: search results stay unindexed
};

export default function Page() {
  return (
    <Suspense fallback={<div className="flex min-h-[70vh] items-center justify-center bg-paper pt-[78px]" role="status" aria-label="Loading search"><span className="arch-mark grid h-14 w-14 animate-pulse place-items-center"><span className="arch-mark-arch" /></span></div>}>
      <ResultsPage />
    </Suspense>
  );
}
