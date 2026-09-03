import type { Metadata } from "next";
import BrokerDashboard from "@/pages/BrokerDashboard";
import RequireSession from "@/components/architech/RequireSession";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Broker dashboard",
  description: "Protected broker workspace contract for verified Architech partners.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <RequireSession permission="broker.dashboard.read" requireOrganization><BrokerDashboard /></RequireSession>;
}
