import type { Metadata } from "next";
import { Suspense } from "react";
import Login from "@/pages/Login";

/* Authentication surface: never indexed. A login page carries no discovery
   value, and letting it into the index dilutes the crawl budget the SEO model
   spends on hubs and dossiers. It is also excluded from the sitemap for the
   same reason `/saved` is. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Architech to reach your shortlist, saved searches, and partner workspace.",
  robots: { index: false, follow: false },
};

export default function Page() {
  /* `useSearchParams` (the `?next=` destination) requires a Suspense boundary
     in the App Router; without one the whole route opts out of prerendering. */
  return (
    <Suspense fallback={<div className="min-h-[70vh] bg-paper" />}>
      <Login />
    </Suspense>
  );
}
