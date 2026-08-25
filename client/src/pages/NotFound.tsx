"use client";
/* ARCHITECH — 404: the arch that leads nowhere. */
import { ArrowUpRight, Compass } from "lucide-react";
import Link from "next/link";
import useTitle from "../hooks/useTitle";

export default function NotFound() {
  useTitle("Page not found");
  return (
    <div className="bg-paper pt-[78px] text-ink">
      <section className="container flex min-h-[80vh] flex-col items-center justify-center py-24 text-center">
        <div className="flex items-end gap-3 font-display text-[clamp(110px,20vw,240px)] font-medium leading-none tracking-[-0.05em]" aria-hidden="true">
          <span>4</span>
          <span className="arch-frame grain relative mb-2 inline-block h-[0.78em] w-[0.62em] overflow-hidden bg-brick">
            <img src="/images/brick-arch.jpg" alt="" className="h-full w-full object-cover opacity-80" />
          </span>
          <span>4</span>
        </div>
        <h1 className="display mt-8 max-w-[560px] text-[clamp(28px,3.6vw,44px)]">This address doesn't exist — <em className="text-brick">yet</em>.</h1>
        <p className="mt-4 max-w-[400px] text-[15px] leading-7 text-ink/60">The page may have moved, or the plot was never registered. Either way, the city is still out there.</p>
        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link href="/" className="btn-sweep motion-press inline-flex items-center gap-2 bg-brick px-8 py-5 stamp !text-[12px] font-semibold text-cream"><Compass size={15} /> Back to the start</Link>
          <Link href="/search" className="motion-press inline-flex items-center gap-2 border border-ink/25 px-8 py-5 stamp !text-[12px] font-semibold text-ink transition-colors hover:border-brick hover:text-brick">Search homes <ArrowUpRight size={15} /></Link>
        </div>
      </section>
    </div>
  );
}
