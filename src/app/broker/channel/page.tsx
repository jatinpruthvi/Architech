import type { Metadata } from "next";
import BrokerChannel from "@/screens/BrokerChannel";
import RequireSession from "@/components/architech/RequireSession";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Broker channel · Architech",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <RequireSession permission="channel.read" requireOrganization>
      <BrokerChannel />
    </RequireSession>
  );
}
