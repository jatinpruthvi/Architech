"use client";
import { CheckCircle2, ClipboardList, XCircle } from "lucide-react";
import useTitle from "@/hooks/useTitle";

export default function ModerationQueue() {
  useTitle("Listing moderation");
  return (
    <div className="bg-paper pt-[78px] text-ink">
      <section className="border-b border-ink/12 bg-sand/70 py-14 md:py-20">
        <div className="container">
          <p className="kicker text-brick">Moderator queue · source trail review</p>
          <h1 className="display mt-6 max-w-[760px] text-[clamp(40px,6vw,78px)]">Approve only what can be <em className="text-brick">proven</em>.</h1>
          <p className="mt-6 max-w-[560px] text-base leading-8 text-ink/65">The moderation contract supports approve, request changes, and reject decisions with audit reasons.</p>
        </div>
      </section>
      <section className="container py-14 md:py-20">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            [ClipboardList, "Review source trail", "RERA number, broker org, price, media rights, and locality context."],
            [CheckCircle2, "Approve", "Listing becomes active only after source and media gates pass."],
            [XCircle, "Request changes", "Moderators can return drafts with a visible reason in the audit trail."],
          ].map(([Icon, title, body]) => (
            <article key={String(title)} className="border border-ink/12 bg-card p-6">
              <Icon size={20} className="text-brick" />
              <h2 className="mt-4 font-display text-2xl font-medium tracking-[-0.02em]">{title as string}</h2>
              <p className="mt-2 text-sm leading-6 text-ink/60">{body as string}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
