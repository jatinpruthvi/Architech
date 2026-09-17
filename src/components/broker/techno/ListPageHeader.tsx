"use client";
import { useState } from "react";
import { Search, Filter, LayoutList, Maximize2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

export function ListPageHeader({
  title,
  searchLabel,
  initialQuery = "",
  basePath,
  filterAllLabel = "All",
  showPremiumOption = true,
  children,
}: {
  title: string;
  searchLabel: string;
  initialQuery?: string;
  basePath: string;
  filterAllLabel?: string;
  showPremiumOption?: boolean;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(window.location.search);
    if (q) params.set("q", q); else params.delete("q");
    router.push(`${basePath}?${params.toString()}`);
  }

  function applyFilter(key: string, value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value && value !== "all") params.set(key, value); else params.delete(key);
    params.delete("page");
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="tp-section-title text-2xl">
          {title}
        </h1>
        <div className="flex items-center gap-2">{children}</div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative">
          <Filter size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tp-muted)]" />
          <select
            className="tp-input min-w-[180px] appearance-none bg-white py-2.5 pl-9 pr-8 font-semibold"
            defaultValue="all"
            onChange={(e) => applyFilter("premium", e.target.value)}
          >
            <option value="all">{filterAllLabel}</option>
            {showPremiumOption && <option value="1">Premium only</option>}
            <option value="rented">Rented / Sold out</option>
            <option value="new">New this week</option>
          </select>
        </div>
        <form className="tp-search flex-1" onSubmit={submit}>
          <Search size={16} className="text-[var(--tp-muted)]" />
          <input
            aria-label={searchLabel}
            placeholder={searchLabel}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </form>
        <div className="flex items-center gap-2">
          <button type="button" className="tp-btn tp-btn-ghost border-[var(--tp-accent)]/30 bg-[#eef3ff] text-[var(--tp-accent)] hover:bg-[#e3edff]">
            <LayoutList size={14} /> Side view
          </button>
          <button type="button" className="tp-btn tp-btn-ghost border-emerald-200 bg-[#e6fff7] text-emerald-700 hover:bg-[#d5fff0]">
            <Maximize2 size={14} /> Zoom
          </button>
        </div>
      </div>
    </div>
  );
}
