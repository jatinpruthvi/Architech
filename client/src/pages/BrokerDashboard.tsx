"use client";
import Link from "next/link";
import { ArrowUpRight, Building2, Inbox, ShieldCheck, UserRoundCog } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { demoBrokerSession } from "@/lib/auth/roles";
import type { ListingDraft } from "@/lib/broker/workflow";
import useTitle from "@/hooks/useTitle";

const cards = [
  { icon: Building2, title: "Organization profile", body: "Nivasa Partners is shown as a verified partner, with its identity and source commitments ready for review.", action: "Review profile" },
  { icon: Inbox, title: "Lead inbox", body: "Enquiries arrive with contact details masked, consent visible, and every next step recorded for clarity.", action: "Open leads", href: "/broker/leads" },
  { icon: UserRoundCog, title: "Team access", body: "Each teammate sees only the work their role permits, keeping listings, evidence, and buyer conversations in the right hands.", action: "View access" },
];

export default function BrokerDashboard() {
  useTitle("Broker dashboard");
  const session = demoBrokerSession;
  const [drafts, setDrafts] = useState<ListingDraft[]>([]);

  const loadDrafts = useCallback(async () => {
    try {
      const response = await fetch("/api/broker/listings", { cache: "no-store" });
      const payload = await response.json();
      setDrafts(Array.isArray(payload.drafts) ? payload.drafts : []);
    } catch {
      setDrafts([]);
    }
  }, []);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts]);

  return (
    <div className="bg-paper pt-[78px] text-ink">
      <section className="border-b border-ink/12 bg-sand/70 py-14 md:py-20">
        <div className="container">
          <p className="kicker text-brick">Partner desk · source-led operations</p>
          <h1 className="display mt-6 max-w-[780px] text-[clamp(40px,6vw,84px)]">A considered workspace for <em className="text-brick">trusted partners</em>.</h1>
          <p className="mt-6 max-w-[560px] text-base leading-8 text-ink/65">Prepare homes with the evidence buyers deserve: a clear source trail, protected conversations, and a review path that keeps every promise visible.</p>
        </div>
      </section>

      <section className="container border-b border-ink/12 py-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-medium tracking-[-0.02em]">My submissions <span className="text-brick">{drafts.length}</span></h2>
          <Link href="/broker/listings/new" className="stamp inline-flex items-center gap-1.5 !text-[11px] font-semibold text-brick">New draft <ArrowUpRight size={13} /></Link>
        </div>
        {drafts.length === 0 ? (
          <p className="mt-4 text-sm text-ink/60">No drafts yet. Create one to build the source trail.</p>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {drafts.map((draft) => (
              <article key={draft.id} className="border border-ink/12 bg-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-display text-lg font-medium leading-tight">{draft.title}</h3>
                  <span className={`stamp px-2 py-1 !text-[9px] font-semibold ${draft.status === "ACTIVE" ? "bg-trust/10 text-trust" : draft.status === "IN_REVIEW" ? "bg-ember/10 text-ember" : "bg-sand text-ink/60"}`}>{draft.status.toLowerCase()}</span>
                </div>
                <p className="mt-2 text-sm text-ink/60">{draft.localitySlug} · {draft.priceInr >= 10000000 ? `₹${(draft.priceInr / 10000000).toFixed(2)} Cr` : `₹${(draft.priceInr / 100000).toFixed(1)} L`} · {draft.bhk} BHK</p>
                <Link href="/admin/moderation/listings" className="mt-4 inline-flex items-center gap-1.5 stamp !text-[10px] font-semibold text-brick">Track in queue <ArrowUpRight size={12} /></Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="container py-14 md:py-20">
        <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <aside className="h-fit border border-ink/12 bg-card p-7">
            <span className="grid h-14 w-14 place-items-center rounded-t-full bg-trust/10 text-trust"><ShieldCheck size={24} /></span>
            <p className="mt-5 font-display text-2xl font-medium tracking-[-0.02em]">{session.organization?.name}</p>
            <p className="stamp mt-2 !text-[10px] text-trust">{session.organization?.verificationStatus.replaceAll("_", " ")}</p>
            <dl className="mt-7 space-y-4 border-t border-ink/10 pt-5 text-sm">
              <div><dt className="stamp !text-[10px] text-ink/55">Signed in as</dt><dd className="mt-1 font-medium">{session.user.name}</dd></div>
              <div><dt className="stamp !text-[10px] text-ink/55">Role</dt><dd className="mt-1 font-medium">{session.user.role.replaceAll("_", " ")}</dd></div>
              <div><dt className="stamp !text-[10px] text-ink/55">Partner access</dt><dd className="mt-1 font-medium">{session.source === "better-auth-contract-demo" ? "Verified partner preview" : "Secure partner session"}</dd></div>
            </dl>
          </aside>

          <div className="grid gap-5 md:grid-cols-3">
            {cards.map(({ icon: Icon, title, body, action, href }) => (
              <article key={title} className="border border-ink/12 bg-card p-6 motion-lift hover:editorial-shadow">
                <Icon size={20} className="text-brick" />
                <h2 className="mt-5 font-display text-2xl font-medium tracking-[-0.02em]">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-ink/60">{body}</p>
                {href ? (
                  <Link href={href} className="group mt-6 inline-flex items-center gap-1.5 stamp !text-[11px] font-semibold text-brick">{action} <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></Link>
                ) : (
                  <p className="mt-6 inline-flex items-center gap-1.5 stamp !text-[11px] font-semibold text-brick">{action} <ArrowUpRight size={13} /></p>
                )}
              </article>
            ))}
          </div>
        </div>

        <div className="mt-12 border border-dashed border-ink/20 bg-sand/50 p-7">
          <p className="stamp !text-[10px] text-ink/60">Partner readiness</p>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-ink/65">Secure sign-in, protected team access, and durable evidence records are the foundation of every Architech partnership. Complete the verification method before a home is presented to buyers.</p>
          <Link href="/guide" className="mt-5 inline-flex items-center gap-2 stamp !text-[12px] font-semibold text-brick">Read our verification method <ArrowUpRight size={14} /></Link>
        </div>
      </section>
    </div>
  );
}
