import type { Metadata } from "next";
import AgentWorkspace, { type AgentSection } from "@/pages/AgentWorkspace";
import RequireSession from "@/components/architech/RequireSession";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Agent workspace · Architech",
  description: "Protected India-wide, city-scoped partner workspace.",
  robots: { index: false, follow: false },
};

const sections: AgentSection[] = [
  "inquiry",
  "subscriptions",
  "leads",
  "channel",
  "my-listings",
  "newspaper",
  "agent-listings",
  "owner-listings",
  "ai",
  "auctions",
  "tenders",
  "shortlisted",
  "contacted",
  "requirements",
  "profile",
];

export function generateStaticParams() {
  return sections.map((section) => ({ section }));
}

export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const safeSection = sections.includes(section as AgentSection) ? (section as AgentSection) : "dashboard";
  return <RequireSession permission="broker.dashboard.read" requireOrganization><AgentWorkspace section={safeSection} /></RequireSession>;
}
