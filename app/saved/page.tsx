import type { Metadata } from "next";
import Saved from "@/pages/Saved";
import { savedUrl } from "@/lib/seo/urls";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Saved homes",
  description: "Your Architech shortlist, saved on this device.",
  alternates: { canonical: savedUrl() },
  robots: { index: false },
};

export default function Page() {
  return <Saved />;
}
