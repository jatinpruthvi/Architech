import type { Metadata } from "next";
import ModerationQueue from "@/pages/ModerationQueue";

export const metadata: Metadata = { title: "Listing moderation", robots: { index: false, follow: false } };

export default function Page() { return <ModerationQueue />; }
