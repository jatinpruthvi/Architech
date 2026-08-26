import type { Metadata } from "next";
import BrokerOnboarding from "@/pages/BrokerOnboarding";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Broker onboarding", robots: { index: false, follow: false } };

export default function Page() { return <BrokerOnboarding />; }
