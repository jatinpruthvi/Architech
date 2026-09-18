import Link from "next/link";
import { RotateCcw, Search } from "lucide-react";

export function InventoryEmptyState({
  title,
  description,
  clearHref,
}: {
  title: string;
  description: string;
  clearHref: string;
}) {
  return (
    <div className="tp-empty tp-card text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#e3f0ff] text-[var(--tp-accent)]">
        <Search size={21} aria-hidden="true" />
      </span>
      <h2 className="mt-3 font-display text-lg font-bold text-[var(--tp-ink)]">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-[var(--tp-muted)]">{description}</p>
      <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
        <Link href={clearHref} className="tp-btn tp-btn-ghost min-h-11 justify-center">
          <RotateCcw size={16} /> Clear filters
        </Link>
        <Link href="/broker/search" className="tp-btn tp-btn-primary min-h-11 justify-center">
          <Search size={16} /> New search
        </Link>
      </div>
    </div>
  );
}
