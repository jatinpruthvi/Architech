"use client";

import { useEffect, useState } from "react";
import { Filter, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { buildListUrl, type ListingFilter } from "./list-controls";

export function ListPageHeader({
  title,
  searchLabel,
  initialQuery = "",
  basePath,
  resultCount,
  activeFilter = "all",
  filterAllLabel = "All",
  showPremiumOption = true,
  showStatusFilter = true,
  children,
}: {
  title: string;
  searchLabel: string;
  initialQuery?: string;
  basePath: string;
  resultCount?: number;
  activeFilter?: ListingFilter;
  filterAllLabel?: string;
  showPremiumOption?: boolean;
  showStatusFilter?: boolean;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  function navigate(changes: Record<string, string | null>) {
    router.push(buildListUrl(basePath, window.location.search, changes));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    navigate({ q: query.trim() || null });
  }

  function applyFilter(value: ListingFilter) {
    navigate({
      premium: value === "premium" ? "1" : null,
      rented: value === "rented" ? "1" : null,
    });
  }

  const filterLabel = activeFilter === "premium" ? "Premium only" : "Rented out";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="tp-section-title !text-2xl">{title}</h1>
          {resultCount !== undefined ? (
            <p role="status" className="mt-1 text-sm text-[var(--tp-muted)]">
              <span className="font-semibold text-[var(--tp-ink)]">{resultCount.toLocaleString("en-IN")}</span>{" "}
              {resultCount === 1 ? "matching result" : "matching results"}
            </p>
          ) : null}
        </div>
        {children ? <div className="flex min-h-11 items-center gap-2">{children}</div> : null}
      </div>

      <div className={`grid gap-3 ${showStatusFilter ? "lg:grid-cols-[auto_minmax(0,1fr)]" : "grid-cols-1"} lg:items-center`}>
        {showStatusFilter ? (
          <div className="relative">
            <Filter size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tp-muted)]" />
            <select
              aria-label="Filter listings"
              className="tp-input min-h-11 w-full appearance-none bg-white py-2.5 pl-9 pr-8 font-semibold lg:min-w-[180px]"
              value={activeFilter}
              onChange={(event) => applyFilter(event.target.value as ListingFilter)}
            >
              <option value="all">{filterAllLabel}</option>
              {showPremiumOption ? <option value="premium">Premium only</option> : null}
              <option value="rented">Rented out</option>
            </select>
          </div>
        ) : null}
        <form className="tp-search min-h-11 min-w-0" role="search" onSubmit={submit}>
          <Search size={17} className="shrink-0 text-[var(--tp-muted)]" />
          <input aria-label={searchLabel} placeholder={searchLabel} value={query} onChange={(event) => setQuery(event.target.value)} />
          <button type="submit" className="tp-search-submit">Search</button>
        </form>
      </div>

      {initialQuery || activeFilter !== "all" ? (
        <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
          <span className="text-xs font-semibold text-[var(--tp-muted)]">Active:</span>
          {initialQuery ? (
            <button type="button" className="tp-active-filter min-h-11" onClick={() => { setQuery(""); navigate({ q: null }); }}>
              Search: “{initialQuery}” <X size={14} aria-hidden="true" />
            </button>
          ) : null}
          {activeFilter !== "all" ? (
            <button type="button" className="tp-active-filter min-h-11" onClick={() => applyFilter("all")}>
              {filterLabel} <X size={14} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
