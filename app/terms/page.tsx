import type { Metadata } from "next";
import Link from "next/link";
import { termsUrl } from "@/lib/seo/urls";

export const metadata: Metadata = {
  title: "Terms and disclaimers",
  description: "Architech Phase 1 terms, demo-data disclaimers, RERA disclaimer, broker media rights, and lead consent terms.",
  alternates: { canonical: termsUrl() },
  robots: { index: false, follow: true },
};

const terms = [
  ["Demo data", "Prototype listings, prices, testimonials, counts, and RERA references are illustrative until production verification is enabled."],
  ["RERA", "Architech is not endorsed by any government or RERA authority. Production RERA claims require source approval and visible provenance."],
  ["Broker media", "Brokers must confirm ownership/license and publication rights before submitting media for moderation."],
  ["Leads", "Contact is masked by default. Direct sharing requires explicit consent and a recorded purpose."],
  ["No ranking promises", "SEO work is designed for quality and crawlability; it never promises rankings."],
];

export default function TermsPage() {
  return (
    <div className="bg-paper pt-[78px] text-ink">
      <section className="border-b border-ink/12 bg-sand/70 py-14 md:py-20"><div className="container"><p className="kicker text-brick">Terms · responsible prototype use</p><h1 className="display mt-6 max-w-[780px] text-[clamp(40px,6vw,78px)]">Trust needs clear boundaries.</h1><p className="mt-6 max-w-[620px] text-base leading-8 text-ink/65">These terms define the Phase 1 product/legal assumptions before public production enablement.</p></div></section>
      <section className="container py-14 md:py-20"><div className="space-y-4">{terms.map(([title, body]) => <article key={title} className="border border-ink/12 bg-card p-6"><h2 className="font-display text-2xl tracking-[-0.02em]">{title}</h2><p className="mt-3 text-sm leading-6 text-ink/60">{body}</p></article>)}</div><Link href="/privacy" className="mt-8 inline-flex stamp !text-[12px] font-semibold text-brick">Read privacy notice →</Link></section>
    </div>
  );
}
