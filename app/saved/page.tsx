import type { Metadata } from "next";
import Saved from "@/pages/Saved";

export const metadata: Metadata = {
  title: "Saved homes",
  description: "Your Architech shortlist, saved on this device.",
  robots: { index: false },
};

export default function Page() {
  return <Saved />;
}
