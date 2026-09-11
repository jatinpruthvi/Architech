import type { Metadata } from "next";
import PlanAdmin from "@/pages/PlanAdmin";

/* Owner-only plan administration (spec §7). NOT wrapped in RequireSession:
   that guard redirects to /login, but the super-admin surface signs in with
   its own password — the page renders its own gate. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Plans · Architech owner",
  description: "Grant and manage broker plans.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <PlanAdmin />;
}
