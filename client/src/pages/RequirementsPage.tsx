"use client";
/* Amdavad Modern requirements page: structured brief capture with honest privacy copy. */
import Link from "next/link";
import { ArrowUpRight, Check, ShieldCheck } from "lucide-react";
import RequirementCapture from "@/components/architech/RequirementCapture";
import Reveal from "@/components/architech/Reveal";

const steps = [
  ["01", "Name the brief", "Buy or rent, category, subtype, and the Ahmedabad localities that feel right."],
  ["02", "Keep the contact masked", "Your phone is not placed on a public page. The first response stays inside the partner workflow."],
  ["03", "Review the evidence", "Any home suggested through Architech keeps its freshness signal, RERA context, and source trail in view."],
];

export default function RequirementsPage() {
  return (
    <div className="bg-paper pt-[78px] text-ink">
      <section className="border-b border-ink/12 bg-night py-20 text-cream md:py-32">
        <div className="container grid gap-12 lg:grid-cols-[1fr_0.7fr] lg:items-end">
          <Reveal><p className="kicker text-ember">Personal property manager · Ahmedabad</p><h1 className="display mt-6 max-w-[840px] text-[clamp(46px,8vw,110px)]">A better brief makes a better <em className="text-ember">address.</em></h1><p className="mt-7 max-w-xl text-[15px] leading-7 text-cream/70">Tell Architech what you are trying to find. We turn a loose search into a clear, reviewable brief for homes, commercial space, co-living, plots, land, and bank-auction opportunities.</p></Reveal>
          <Reveal delay={120} className="flex flex-col items-start gap-4"><RequirementCapture /><p className="stamp !text-[10px] text-cream/55">Free to submit · no public phone number · masked by default</p></Reveal>
        </div>
      </section>
      <section className="container py-20 md:py-28"><div className="grid gap-5 md:grid-cols-3">{steps.map(([num, title, body]) => <Reveal key={num}><article className="h-full border-t-2 border-brick pt-5"><p className="index-num text-4xl text-brick/75">{num}</p><h2 className="mt-8 font-display text-2xl font-medium tracking-[-0.02em]">{title}</h2><p className="mt-3 text-sm leading-6 text-ink/65">{body}</p></article></Reveal>)}</div></section>
      <section className="border-y border-ink/12 bg-sand/60 py-20 md:py-28"><div className="container grid gap-10 lg:grid-cols-[1fr_0.8fr] lg:items-center"><div><p className="kicker text-brick">Brief, not spam</p><h2 className="display mt-5 max-w-xl text-[clamp(34px,5vw,64px)]">Your requirement is a <em className="text-brick">starting point.</em></h2><ul className="mt-8 grid gap-4 text-sm leading-6 text-ink/70">{["No unverified inventory is presented as a fact.", "No phone number is printed on a public listing page.", "You can ask for consent to be revoked at any time."].map((item) => <li key={item} className="flex gap-3"><Check size={16} className="mt-1 shrink-0 text-trust" />{item}</li>)}</ul></div><aside className="border border-ink/15 bg-paper p-7"><ShieldCheck size={22} className="text-trust" /><h3 className="mt-5 font-display text-2xl font-medium">What happens next?</h3><p className="mt-3 text-sm leading-6 text-ink/65">In this Phase 1 preview, the brief is recorded in the safe fixture workflow. Production delivery to a CRM, email, or WhatsApp partner stays behind an explicit activation gate.</p><Link href="/guide/" className="link-rail mt-6 inline-flex items-center gap-1.5 stamp !text-[11px] font-semibold text-brick">Read the methodology <ArrowUpRight size={14} /></Link></aside></div></section>
    </div>
  );
}
