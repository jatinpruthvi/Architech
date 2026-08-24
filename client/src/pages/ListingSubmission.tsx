"use client";
import Link from "next/link";
import { ArrowUpRight, FileCheck2, ShieldCheck } from "lucide-react";
import useTitle from "@/hooks/useTitle";
import { getLocalities } from "@/lib/repositories";

export default function ListingSubmission() {
  useTitle("New listing draft");
  return (
    <div className="bg-paper pt-[78px] text-ink">
      <section className="border-b border-ink/12 bg-sand/70 py-14 md:py-20">
        <div className="container">
          <p className="kicker text-brick">Listing draft · moderation required</p>
          <h1 className="display mt-6 max-w-[760px] text-[clamp(40px,6vw,78px)]">Submit a home with the <em className="text-brick">source trail</em> attached.</h1>
          <p className="mt-6 max-w-[560px] text-base leading-8 text-ink/65">This UI documents the fields enforced by the `/api/broker/listings` contract. Live autosave and uploads follow once media storage is active.</p>
        </div>
      </section>
      <section className="container grid gap-8 py-14 lg:grid-cols-[1fr_360px] md:py-20">
        <div className="border border-ink/12 bg-card p-7">
          <p className="kicker text-brick !text-[10px]">Draft fields</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {["Title", "Price INR", "BHK", "Area sq ft", "Availability", "RERA number"].map((label) => <div key={label} className="border border-ink/15 px-4 py-3 text-sm text-ink/60">{label}</div>)}
          </div>
          <div className="mt-5 border border-ink/15 px-4 py-8 text-sm text-ink/60">Description and source summary</div>
          <p className="mt-5 text-sm leading-6 text-ink/60">Locality options: {getLocalities().map((l) => l.name).join(" · ")}</p>
        </div>
        <aside className="h-fit border border-ink/12 bg-sand/70 p-7">
          <ShieldCheck size={22} className="text-trust" />
          <h2 className="mt-4 font-display text-2xl font-medium tracking-[-0.02em]">Before review</h2>
          <ul className="mt-5 space-y-3 text-sm text-ink/65">
            <li className="flex gap-2"><FileCheck2 size={15} className="mt-0.5 text-brick" /> Media rights confirmed</li>
            <li className="flex gap-2"><FileCheck2 size={15} className="mt-0.5 text-brick" /> Locality selected</li>
            <li className="flex gap-2"><FileCheck2 size={15} className="mt-0.5 text-brick" /> Price and area supplied</li>
            <li className="flex gap-2"><FileCheck2 size={15} className="mt-0.5 text-brick" /> Description has source context</li>
          </ul>
          <Link href="/admin/moderation/listings" className="mt-7 inline-flex items-center gap-2 stamp !text-[12px] font-semibold text-brick">View moderation queue <ArrowUpRight size={14} /></Link>
        </aside>
      </section>
    </div>
  );
}
