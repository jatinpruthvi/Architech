import type { Metadata } from "next";
import AcquisitionQueue from "@/pages/AcquisitionQueue";
import RequireSession from "@/components/architech/RequireSession";

/* Internal worklist, not a public page: `force-dynamic` because it must
   reflect the inventory as it stands this minute, and noindexed because it
   exposes exactly where coverage is thin. The data itself is fetched from an
   authorised route, so the page shell leaks nothing. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Acquisition queue",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <RequireSession permission="authority.registry.read"><AcquisitionQueue /></RequireSession>;
}
