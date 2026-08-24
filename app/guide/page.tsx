import type { Metadata } from "next";
import Guide from "@/pages/Guide";

export const metadata: Metadata = {
  title: "Field notes — how we verify",
  description: "Architech's methodology: RERA verification, source trails, and freshness stamps — plus locality studies and essays on trust.",
  alternates: { canonical: "/guide/" },
};

export default function Page() {
  return <Guide />;
}
