/* The dashboard for every kind of person the product serves.
 *
 * This route used to be `redirect("/broker/dashboard/")`, which sent buyers,
 * owners, tenants and builders straight into a surface gated on
 * `broker.dashboard.read` + an organization — so four of the five roles saw
 * "You do not have access to this workspace" instead of a dashboard.
 *
 * It now renders a persona-aware dashboard. Brokers are not worse off: their
 * default persona is `broker`, and the partner desk remains one click away at
 * `/broker/dashboard/` (still gated, still the deeper workspace).
 *
 * `RequireSession` with no permission means "any signed-in session". The
 * persona system deliberately carries no authority of its own, so there is
 * nothing further to gate here; each panel's data comes from an API that
 * performs its own server-side check.
 */
import { Suspense } from "react";
import type { Metadata } from "next";
import RequireSession from "@/components/architech/RequireSession";
import RoleDashboard from "@/pages/RoleDashboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your requirements, shortlist, listings and enquiries in one place.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <RequireSession>
      {/* useSearchParams needs a Suspense boundary to avoid opting the whole
          route into client-side bailout during prerender. */}
      <Suspense fallback={null}>
        <RoleDashboard />
      </Suspense>
    </RequireSession>
  );
}
