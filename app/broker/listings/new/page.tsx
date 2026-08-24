import type { Metadata } from "next";
import ListingSubmission from "@/pages/ListingSubmission";

export const metadata: Metadata = { title: "New listing draft", robots: { index: false, follow: false } };

export default function Page() { return <ListingSubmission />; }
