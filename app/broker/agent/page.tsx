import type { Metadata } from "next";
import AgentWorkspace from "@/pages/AgentWorkspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Agent workspace · Architech",
  description: "Protected India-wide, city-scoped partner workspace for listings, leads, inventory, and follow-up.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <AgentWorkspace section="dashboard" />;
}
