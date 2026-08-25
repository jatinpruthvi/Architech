"use client";
/* The visible trust dossier. Renders the 0-100 trust score, the six
   verification signals, and an honest explanation of which signals pass and
   which are still open. Derived from structured facts — never invented. */
import { ShieldCheck, Check } from "lucide-react";
import Link from "next/link";
import type { Property } from "@/lib/repositories";
import { badgesToTrustInput, computeTrustScore, trustGradeLabel, type TrustScore, type TrustSignal } from "@/lib/trust/score";
import { useLang } from "@/contexts/LangContext";

function gradeColor(score: TrustScore): string {
  return score.grade === "HIGH" ? "text-trust" : score.grade === "MEDIUM" ? "text-ember" : "text-brick";
}

function SignalRow({ signal, confirmed, label }: { signal: TrustSignal; confirmed: string; label: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center border ${
          signal.met ? "border-trust/40 bg-trust/10 text-trust" : "border-ink/20 text-ink/40"
        }`}
        aria-hidden="true"
      >
        {signal.met ? <Check size={12} strokeWidth={3} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      </span>
      <span>
        <span className="text-sm font-medium leading-5 text-ink/85">{signal.label}</span>
        <span className="stamp block !text-[9px] leading-4 text-ink/55">
          {signal.met ? confirmed : label}
        </span>
      </span>
    </li>
  );
}

export function TrustPanel({ property }: { property: Property }) {
  const { t } = useLang();
  const trust = computeTrustScore(badgesToTrustInput(property.badge, property.status));
  const metCount = trust.signals.filter((signal) => signal.met).length;
  const headingId = `trust-heading-${property.id}`;

  return (
    <section className="mt-12 border border-ink/15 bg-sand/50 p-6 md:p-8" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="kicker text-brick !text-[10px]">{t.listing.trust.kicker}</p>
          <h2 id={headingId} className="mt-3 font-display text-3xl font-medium tracking-[-0.02em]">
            {property.title.split(" in ")[0]}, {trust.summary.toLowerCase()}.
          </h2>
        </div>
        <div className="flex items-center gap-4 border-l-4 border-brick pl-5">
          <div>
            <p className="stamp !text-[10px] text-ink/60">{t.listing.trust.scoreLabel}</p>
            <p className={`font-display text-[44px] font-semibold leading-none tracking-[-0.03em] ${gradeColor(trust)}`}>
              {trust.score}
              <span className="text-xl text-ink/40">/100</span>
            </p>
          </div>
          <div className={`stamp !text-[10px] font-semibold ${gradeColor(trust)}`}>{trustGradeLabel(trust.grade)}</div>
        </div>
      </div>

      <div className="mt-7 grid gap-8 md:grid-cols-[1fr_0.8fr]">
        <div>
          <p className="stamp !text-[11px] text-ink/60">{t.listing.trust.summaryHeader}</p>
          <ul className="mt-4 space-y-3">
            {trust.signals.map((signal) => (
              <SignalRow
                key={signal.id}
                signal={signal}
                confirmed={t.listing.trust.confirmed}
                label={t.listing.trust.notConfirmed}
              />
            ))}
          </ul>
          <p className="mt-5 text-sm leading-6 text-ink/60">{trust.reasons.join(" ")}</p>
        </div>
        <div className="border-l border-ink/12 pl-6 md:pl-8">
          <p className="stamp !text-[11px] text-ink/60">
            {metCount} / {trust.signals.length} {t.listing.trust.confirmed.toLowerCase()}
          </p>
          <p className="mt-3 text-sm leading-6 text-ink/65">{t.listing.trust.disclaimer}</p>
          <Link
            href="/guide/rera/gujarat/how-we-verify-rera"
            className="group mt-5 inline-flex items-center gap-2 stamp !text-[11px] font-semibold text-brick"
          >
            <ShieldCheck size={14} className="text-trust" /> {t.listing.trust.howWeVerify}
          </Link>
        </div>
      </div>
    </section>
  );
}
