import type { Metadata } from "next";
import AgentWorkspace, { type AgentSection } from "@/pages/AgentWorkspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Agent workspace · Architech",
  description: "Protected Ahmedabad partner workspace.",
  robots: { index: false, follow: false },
};

const sections: AgentSection[] = [
  "inquiry",
  "subscriptions",
  "leads",
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
  return <AgentWorkspace section={safeSection} />;
}
