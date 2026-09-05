import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canonicalUrl } from "@/lib/seo/urls";

/* Pure redirect — no per-request computation, so it prerenders to a static
   redirect (cost-reduction-audit P0.4). */

export const metadata: Metadata = {
  title: "Blogs and field notes — Architech India",
  description: "Architech’s reviewed field notes on Indian locality context, property verification, and responsible discovery.",
  alternates: { canonical: canonicalUrl("/guide/") },
};

export default function Page() {
  redirect("/guide/");
}
