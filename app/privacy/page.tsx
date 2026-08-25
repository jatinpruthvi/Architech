import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: "Architech Phase 1 privacy notice covering leads, saved searches, broker operations, observability, and data rights.",
  robots: { index: false, follow: true },
};

const rows = [
  ["Leads", "Name, masked phone, message, listing context, consent text", "Respond to property enquiries", "Until deletion/retention policy is approved"],
  ["Saved searches", "Query, filters, city/locality, notification preference", "Notify users about matching homes", "Until user deletes or retention job runs"],
  ["Broker operations", "Organization, role, listing drafts, media rights evidence", "Moderation, verification, and lead handling", "Lifecycle plus audit retention"],
  ["Observability", "Route, Web Vitals metrics, errors where configured", "Reliability, performance, and incident response", "Aggregated operational retention"],
];

export default function PrivacyPage() {
  return (
    <div className="bg-paper pt-[78px] text-ink">
      <section className="border-b border-ink/12 bg-sand/70 py-14 md:py-20">
        <div className="container">
          <p className="kicker text-brick">Privacy · Phase 1 notice</p>
          <h1 className="display mt-6 max-w-[760px] text-[clamp(40px,6vw,78px)]">Clear purpose, consent, and deletion paths.</h1>
          <p className="mt-6 max-w-[620px] text-base leading-8 text-ink/65">This notice documents the current privacy contract for the prototype. Production release requires legal approval for each active data flow.</p>
        </div>
      </section>
      <section className="container py-14 md:py-20">
        <div className="overflow-x-auto border border-ink/12 bg-card">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="border-b border-ink/12 stamp !text-[10px] text-ink/60"><tr>{["Area", "Data", "Purpose", "Retention"].map((h) => <th key={h} className="p-4">{h}</th>)}</tr></thead>
            <tbody>{rows.map((row) => <tr key={row[0]} className="border-b border-ink/8 last:border-0">{row.map((cell) => <td key={cell} className="p-4 align-top text-ink/70">{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="border border-ink/12 bg-card p-6"><h2 className="font-display text-2xl">Your choices</h2><p className="mt-3 text-sm leading-6 text-ink/60">Request access, correction, withdrawal, or deletion through the production support channel once enabled.</p></div>
          <div className="border border-ink/12 bg-card p-6"><h2 className="font-display text-2xl">No sale of data</h2><p className="mt-3 text-sm leading-6 text-ink/60">Architech does not sell personal data. Broker sharing requires an explicit product purpose and consent gate.</p></div>
          <div className="border border-ink/12 bg-card p-6"><h2 className="font-display text-2xl">Security</h2><p className="mt-3 text-sm leading-6 text-ink/60">PII is minimized, masked where possible, and protected by the security/privacy gates in the repository.</p></div>
        </div>
        <Link href="/terms" className="mt-8 inline-flex stamp !text-[12px] font-semibold text-brick">Read terms →</Link>
      </section>
    </div>
  );
}
