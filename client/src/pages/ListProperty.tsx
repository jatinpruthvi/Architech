"use client";
/* Public "List your property" entry point.
   Explains the source-trail process and funnels owner/seller to the listing form
   (the broker operations workspace). Keeps the messaging truthful: a listing is
   only published once a moderator verifies the source trail. */
import { ArrowUpRight, Camera, Check, Clock3, FileCheck2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import useTitle from "@/hooks/useTitle";
import { useLang } from "@/contexts/LangContext";

export default function ListProperty() {
  useTitle("List your property");
  const { t } = useLang();

  const steps = [
    { icon: FileCheck2, title: t.list.step1Title, body: t.list.step1Body },
    { icon: Camera, title: t.list.step2Title, body: t.list.step2Body },
    { icon: ShieldCheck, title: t.list.step3Title, body: t.list.step3Body },
  ];

  return (
    <div className="bg-paper pt-[78px] text-ink">
      <section className="border-b border-ink/12 bg-sand/70 py-14 md:py-24">
        <div className="container">
          <p className="kicker text-brick">{t.list.kicker}</p>
          <h1 className="display mt-6 max-w-[860px] text-[clamp(40px,6vw,84px)]">{t.list.title} <em className="text-brick">{t.list.titleEm}</em>{t.list.titleSuffix}</h1>
          <p className="mt-7 max-w-[600px] text-base leading-8 text-ink/65 md:text-lg">{t.list.copy}</p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/broker/listings/new" className="btn-sweep motion-press inline-flex items-center gap-2 bg-brick px-8 py-5 stamp !text-[12px] font-semibold text-cream">{t.list.cta} <ArrowUpRight size={16} /></Link>
            <Link href="/guide/" className="motion-press inline-flex items-center gap-2 border border-ink/25 px-8 py-5 stamp !text-[12px] font-semibold text-ink/75 transition-colors hover:border-brick hover:text-brick">{t.nav.notes} <ArrowUpRight size={16} /></Link>
          </div>
        </div>
      </section>

      <section className="container py-14 md:py-20">
        <div className="grid gap-10 md:grid-cols-[1fr_380px]">
          <div>
            <div className="grid gap-5 md:grid-cols-3">
              {steps.map(({ icon: Icon, title, body }, i) => (
                <article key={title} className="border border-ink/12 bg-card p-6">
                  <span className="index-num text-[28px] text-ink/25">{String(i + 1).padStart(2, "0")}</span>
                  <Icon size={20} className="mt-4 text-brick" />
                  <h2 className="mt-4 font-display text-xl font-medium tracking-[-0.01em]">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-ink/60">{body}</p>
                </article>
              ))}
            </div>

            <div className="mt-10 border border-ink/15 bg-sand/50 p-6">
              <p className="kicker text-brick !text-[10px]">{t.list.sourceTrail}</p>
              <ul className="mt-4 grid gap-3 text-sm text-ink/75 md:grid-cols-3">
                {[t.listing.sourceReviewed, t.listing.reraDetails, t.list.sourceTrail].map((item) => (
                  <li key={item} className="flex items-start gap-2"><Check size={15} className="mt-0.5 shrink-0 text-trust" /> {item}</li>
                ))}
              </ul>
            </div>
          </div>

          <aside className="h-fit border border-ink/12 bg-sand/70 p-7">
            <ShieldCheck size={22} className="text-trust" />
            <h2 className="mt-4 font-display text-2xl font-medium tracking-[-0.02em]">Why the source trail?</h2>
            <p className="mt-3 text-sm leading-6 text-ink/65">Public pages never publish unverified facts. Every listing carries its source, and stale data is withdrawn — so buyers trust what they see.</p>
            <p className="stamp mt-5 flex items-center gap-1.5 !text-[10px] text-ink/55"><Clock3 size={12} /> {t.list.portalNote}</p>
          </aside>
        </div>
      </section>
    </div>
  );
}
