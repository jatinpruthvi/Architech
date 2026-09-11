"use client";
import Link from "next/link";
import { ArrowUpRight, Building2, Check, FileText, ShieldCheck } from "lucide-react";
import useTitle from "@/hooks/useTitle";
import { demoBrokerSession } from "@/lib/auth/roles";

export default function BrokerOnboarding() {
  useTitle("Broker onboarding");
  return (
    <div className="bg-paper pt-[78px] text-ink">
      <section className="border-b border-ink/12 bg-sand/70 py-14 md:py-20">
        <div className="container">
          <p className="kicker text-brick">Partner onboarding · proof first</p>
          <h1 className="display mt-6 max-w-[760px] text-[clamp(40px,6vw,84px)]">Bring the right homes forward with <em className="text-brick">evidence</em>.</h1>
          <p className="mt-6 max-w-[560px] text-base leading-8 text-ink/65">A clear partner record, documented media rights, and a calm review path help every home arrive with the context buyers need.</p>
        </div>
      </section>

      <section className="container grid gap-8 py-14 lg:grid-cols-[0.9fr_1.1fr] md:py-20">
        <aside className="h-fit border border-ink/12 bg-card p-7">
          <Building2 size={24} className="text-brick" />
          <h2 className="mt-5 font-display text-3xl font-medium tracking-[-0.02em]">{demoBrokerSession.organization?.name}</h2>
          <p className="stamp mt-2 !text-[10px] text-trust">{demoBrokerSession.organization?.verificationStatus.replaceAll("_", " ")}</p>
          <p className="mt-5 text-sm leading-6 text-ink/60">Your partner profile keeps identity, city coverage, source commitments, and contact permissions together before a home is submitted.</p>
        </aside>

        <div className="space-y-5">
          {[
            [ShieldCheck, "Organization verification", "Confirm legal name, city coverage, RERA identifiers, and contact details."],
            [FileText, "Media rights", "Broker must confirm photo ownership/license and agree to moderation before publication."],
            [Check, "Listing workflow", "Draft → evidence review → publish, or return with a clear note on what needs attention."],
          ].map(([Icon, title, body]) => (
            <article key={String(title)} className="border border-ink/12 bg-card p-6">
              <Icon size={20} className="text-brick" />
              <h3 className="mt-4 font-display text-2xl font-medium tracking-[-0.02em]">{title as string}</h3>
              <p className="mt-2 text-sm leading-6 text-ink/60">{body as string}</p>
            </article>
          ))}
          <Link href="/broker/listings/new" className="clay-fill btn-sweep motion-press inline-flex items-center gap-2 bg-brick px-7 py-4 stamp !text-[12px] font-semibold text-cream">Create listing draft <ArrowUpRight size={15} /></Link>
        </div>
      </section>
    </div>
  );
}
