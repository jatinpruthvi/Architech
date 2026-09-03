import type { Metadata } from "next";
import ListingSubmission from "@/pages/ListingSubmission";
import RequireSession from "@/components/architech/RequireSession";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New listing draft", robots: { index: false, follow: false } };

export default function Page() { return <RequireSession permission="listing.draft.create" requireOrganization><ListingSubmission /></RequireSession>; }
