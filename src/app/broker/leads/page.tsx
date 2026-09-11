import type { Metadata } from "next";
import BrokerLeadInbox from "@/pages/BrokerLeadInbox";
import RequireSession from "@/components/architech/RequireSession";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lead inbox · Architech broker", robots: { index: false, follow: false } };

export default function Page() {
  return <RequireSession permission="lead.inbox.read" requireOrganization><BrokerLeadInbox /></RequireSession>;
}
