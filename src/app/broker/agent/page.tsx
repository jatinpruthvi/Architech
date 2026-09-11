import type { Metadata } from "next";
import AgentWorkspace from "@/pages/AgentWorkspace";
import RequireSession from "@/components/architech/RequireSession";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Agent workspace · Architech",
  description: "Protected India-wide, city-scoped partner workspace for listings, leads, inventory, and follow-up.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <RequireSession permission="broker.dashboard.read" requireOrganization><AgentWorkspace section="dashboard" /></RequireSession>;
}
