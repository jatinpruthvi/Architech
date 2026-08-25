"use client";
/* Area-level trust band for city and locality hubs. Renders RERA coverage,
   source review, and the average trust score derived from structured facts. */
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { LocalityTrustSummary } from "@/lib/trust/locality";
import { useLang } from "@/contexts/LangContext";

export function LocalityTrust({ summary }: { summary: LocalityTrustSummary }) {
  const { t } = useLang();
  const headingId = `locality-trust-${summary.slug}`;
  const gradeClass = summary.grade === "HIGH" ? "text-trust" : summary.grade === "MEDIUM" ? "text-ember" : "text-brick";

  return (
    <section className="mt-12 grid gap-8 border border-ink/15 bg-sand/50 p-6 md:grid-cols-[1fr_auto] md:p-8" aria-labelledby={headingId}>
      <div>
        <p className="kicker text-brick !text-[10px]">{t.locality.trust.kicker}</p>
        <h2 id={headingId} className="mt-3 font-display text-3xl font-medium tracking-[-0.02em]">
          {summary.name} <span className="text-ink/40">· {summary.total} homes</span>
        </h2>

        <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
          <div>
            <dt className="stamp !text-[10px] text-ink/55">{t.locality.trust.coverage}</dt>
            <dd className="mt-1 font-display text-3xl font-semibold tracking-[-0.02em] text-trust">{summary.reraCoveragePct}%</dd>
          </div>
          <div>
            <dt className="stamp !text-[10px] text-ink/55">{t.locality.trust.verified}</dt>
            <dd className="mt-1 font-display text-3xl font-semibold tracking-[-0.02em]">{summary.reraVerified}</dd>
          </div>
          <div>
            <dt className="stamp !text-[10px] text-ink/55">{t.locality.trust.sourceReviewed}</dt>
            <dd className="mt-1 font-display text-3xl font-semibold tracking-[-0.02em]">{summary.sourceReviewed}</dd>
          </div>
          <div>
            <dt className="stamp !text-[10px] text-ink/55">{t.locality.trust.avgScore}</dt>
            <dd className={`mt-1 font-display text-3xl font-semibold tracking-[-0.02em] ${gradeClass}`}>{summary.avgScore}<span className="text-base text-ink/40">/100</span></dd>
          </div>
        </dl>

        <p className="mt-5 max-w-2xl text-sm leading-6 text-ink/65">{t.locality.trust.copy}</p>
      </div>

      <div className="border-l border-ink/12 pl-6 md:pl-8">
        <Link href="/guide/rera/gujarat/how-we-verify-rera" className="stamp inline-flex items-center gap-2 !text-[11px] font-semibold text-brick">
          <ShieldCheck size={14} className="text-trust" /> {t.locality.verifyCta}
        </Link>
      </div>
    </section>
  );
}
