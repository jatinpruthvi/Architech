import type { Metadata } from "next";
import Guide from "@/pages/Guide";
import { guideUrl } from "@/lib/seo/urls";

export const metadata: Metadata = {
  title: "Field notes — how we verify",
  description: "Architech's methodology: RERA verification, source trails, and freshness stamps — plus locality studies and essays on trust.",
  alternates: { canonical: guideUrl() },
};

export default function Page() {
  return <Guide />;
}
