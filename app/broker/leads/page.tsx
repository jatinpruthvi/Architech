import type { Metadata } from "next";
import BrokerLeadInbox from "@/pages/BrokerLeadInbox";

export const metadata: Metadata = { title: "Lead inbox · Architech broker", robots: { index: false, follow: false } };

export default function Page() {
  return <BrokerLeadInbox />;
}
