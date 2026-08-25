import type { Metadata } from "next";
import BrokerDashboard from "@/pages/BrokerDashboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Broker dashboard",
  description: "Protected broker workspace contract for verified Architech partners.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <BrokerDashboard />;
}
