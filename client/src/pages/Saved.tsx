/* ARCHITECH — Saved homes: quiet, on-brand empty state. */
import { ArrowUpRight, Bookmark } from "lucide-react";
import { Link } from "wouter";

export default function Saved() {
  return (
    <div className="bg-paper pt-[78px] text-ink">
      <section className="container flex min-h-[70vh] flex-col items-center justify-center py-24 text-center">
        <span className="grid h-20 w-20 place-items-center rounded-t-full bg-sand text-brick"><Bookmark size={28} /></span>
        <h1 className="display mt-8 max-w-[560px] text-[clamp(34px,4.6vw,60px)]">Nothing saved — <em className="text-brick">yet</em>.</h1>
        <p className="mt-5 max-w-[400px] text-[15px] leading-7 text-ink/60">Tap the heart on any home and it will wait for you here, freshness stamps and all.</p>
        <Link href="/search" className="btn-sweep motion-press mt-10 inline-flex items-center gap-2 bg-brick px-8 py-5 stamp !text-[12px] font-semibold text-paper">Find a home worth saving <ArrowUpRight size={15} /></Link>
      </section>
    </div>
  );
}
