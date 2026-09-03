import type { Metadata } from "next";
import ModerationQueue from "@/pages/ModerationQueue";
import RequireSession from "@/components/architech/RequireSession";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Listing moderation", robots: { index: false, follow: false } };

export default function Page() { return <RequireSession permission="moderation.queue.read"><ModerationQueue /></RequireSession>; }
