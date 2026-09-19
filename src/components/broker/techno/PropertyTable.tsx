"use client";

import Link from "next/link";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Home,
  IndianRupee,
  MapPin,
  Ruler,
  Share2,
} from "lucide-react";
import { NoteEditor } from "./NoteEditor";
import { ContactRevealButton } from "./ContactRevealButton";
import { InventoryEmptyState } from "./InventoryEmptyState";
import { ResponsiveDataView } from "./ResponsiveDataView";
import { ShortlistToggle } from "./ShortlistToggle";
import { categoryLabel } from "@/lib/technoproperty/categories";
import { buildPaginationUrl } from "./list-controls";

export interface PropertyRow {
  id: string;
  externalId: string;
  category: string;
  propertyType: string | null;
  datePosted: Date | null;
  address: string | null;
  premiseName: string | null;
  area: string | null;
  rentPriceRaw: string | null;
  availabilityRaw: string | null;
  sqftRaw: string | null;
  keyInfo: string | null;
  isRentedOut: boolean;
  hasGallery: boolean;
  isPremium: boolean;
  ownerName: string | null;
  ownerPhoneLast4: string | null;
  ownerPhone: string | null;
  hasOwnerPhone: boolean;
  note: { text: string } | null;
  shortlisted: boolean;
  daysAgo: number | null;
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  const day = String(dt.getDate()).padStart(2, "0");
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const year = dt.getFullYear();
  return `${day}/${month}/${year}`;
}

function Pagination({ page, perPage, total, basePath, currentSearch }: { page: number; perPage: number; total: number; basePath: string; currentSearch: string }) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageNumbers: (number | "…")[] = [];
  const push = (p: number | "…") => pageNumbers.push(p);
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) push(i);
  } else {
    push(1);
    if (page > 3) push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) push(i);
    if (page < totalPages - 2) push("…");
    push(totalPages);
  }
  const qs = (p: number, nextPerPage = perPage) =>
    buildPaginationUrl(basePath, currentSearch, p, nextPerPage);
  return (
    <div className="tp-pagination-wrap mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--tp-muted)]">
      <div>
        Showing {(page - 1) * perPage + 1} to {Math.min(total, page * perPage)} of {total.toLocaleString("en-IN")} entries
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-h-11 items-center gap-2">
          <select
            aria-label="Entries per page"
            className="tp-input min-h-11 !px-2 !py-1 !text-sm"
            defaultValue={perPage}
            onChange={(e) => {
              window.location.href = qs(1, Number(e.target.value));
            }}
          >
            {[25, 50, 100].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <span>per page</span>
        </label>
        <div className="tp-pagination">
          <Link href={qs(1)} aria-label="First page" className="tp-page-btn tp-page-edge" aria-disabled={page === 1} tabIndex={page === 1 ? -1 : undefined}>
            <ChevronsLeft size={16} />
          </Link>
          <Link href={qs(Math.max(1, page - 1))} aria-label="Previous page" className="tp-page-btn" aria-disabled={page === 1} tabIndex={page === 1 ? -1 : undefined}>
            <ChevronLeft size={16} />
          </Link>
          {pageNumbers.map((n, i) =>
            n === "…" ? (
              <span key={`e${i}`} className="tp-page-number px-1 text-[var(--tp-muted)]">…</span>
            ) : (
              <Link key={n} href={qs(n)} aria-label={`Page ${n}`} aria-current={n === page ? "page" : undefined} className={`tp-page-btn tp-page-number ${n === page ? "active" : ""}`}>
                {n}
              </Link>
            ),
          )}
          <Link href={qs(Math.min(totalPages, page + 1))} aria-label="Next page" className="tp-page-btn" aria-disabled={page === totalPages} tabIndex={page === totalPages ? -1 : undefined}>
            <ChevronRight size={16} />
          </Link>
          <Link href={qs(totalPages)} aria-label="Last page" className="tp-page-btn tp-page-edge" aria-disabled={page === totalPages} tabIndex={page === totalPages ? -1 : undefined}>
            <ChevronsRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function PropertyTable({
  rows,
  total,
  page,
  perPage,
  basePath = "/broker/owners",
  currentSearch = "",
}: {
  rows: PropertyRow[];
  total: number;
  page: number;
  perPage: number;
  basePath?: string;
  currentSearch?: string;
}) {
  if (total === 0) {
    return (
      <InventoryEmptyState
        title="No properties match these filters"
        description="Try clearing the current filters or start a broader inventory search."
        clearHref={basePath}
      />
    );
  }

  const pagination = <Pagination page={page} perPage={perPage} total={total} basePath={basePath} currentSearch={currentSearch} />;

  return (
    <>
      <ResponsiveDataView
        cardsLabel="Property cards"
        cards={
          <div className="space-y-3">
            {rows.map((row) => <PropertyCard key={row.id} row={row} />)}
            {pagination}
          </div>
        }
        table={
          <>
            <div className="tp-table overflow-x-auto" role="region" aria-label="Property table. Swipe horizontally to see all columns.">
              <table className="min-w-[900px]">
                <thead>
                  <tr>
                    <th><span className="inline-flex items-center gap-1"><Share2 size={13} /> Action</span></th>
                    <th>Note</th>
                    <th>Property Type</th>
                    <th><span className="inline-flex items-center gap-1">📅 Date <span className="text-[var(--tp-accent)]">↕</span></span></th>
                    <th>Name &amp; Contact</th>
                    <th>Address</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const fresh = r.daysAgo !== null && r.daysAgo <= 1;
                    return (
                      <tr key={r.id}>
                        <td>
                          <div className="flex items-center gap-1">
                            <button type="button" aria-label="Share property" className="tp-action-btn share" title="Share" data-tp-action="share" onClick={() => shareProperty(r)}><Share2 size={16} /></button>
                            <ShortlistToggle propertyId={r.id} initially={r.shortlisted} />
                          </div>
                        </td>
                        <td><NoteEditor propertyId={r.id} initialText={r.note?.text || ""} /></td>
                        <td>{r.propertyType || categoryLabel(r.category)}</td>
                        <td className="tp-date">
                          <span className={`tp-date-fresh ${fresh ? "" : "bg-transparent text-[var(--tp-ink-soft)]"}`}>
                            {formatDate(r.datePosted)}
                            {r.daysAgo !== null ? (
                              <><br /><span className="text-[10px] font-semibold">{r.daysAgo}d</span></>
                            ) : null}
                          </span>
                        </td>
                        <td><ContactRevealButton propertyId={r.id} initialName={r.ownerName} initialPhone={r.ownerPhone} initialPhoneLast4={r.ownerPhoneLast4} waContext={waContextFor(r.keyInfo, r.area, r.rentPriceRaw)} /></td>
                        <td>
                          <AddressCell address={r.address} />
                          {r.isPremium ? <span className="ml-2 tp-chip tp-chip-amber">Premium</span> : null}
                          {r.isRentedOut ? <span className="ml-2 tp-chip tp-chip-slate">Rented out</span> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-[var(--tp-muted)] md:hidden">Swipe the table sideways to see every column.</p>
            {pagination}
          </>
        }
      />
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--tp-muted)]">
        <span className="tp-legend"><span className="tp-legend-swatch tp-tint-amber" /> Premium</span>
        <span className="tp-legend"><span className="tp-legend-swatch tp-tint-green" /> Fresh today</span>
        <span className="tp-legend"><span className="tp-legend-swatch tp-tint-slate" /> Sold / rented</span>
      </div>
    </>
  );
}

function PropertyCard({ row }: { row: PropertyRow }) {
  const type = row.propertyType || categoryLabel(row.category);
  const place = row.area || row.premiseName || "Ahmedabad";
  const fresh = row.daysAgo !== null && row.daysAgo <= 1;
  return (
    <article className="tp-mobile-card" aria-label={`${type} property in ${place}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tp-chip tp-chip-blue"><Home size={13} /> {type}</span>
            {fresh ? <span className="tp-chip tp-chip-green">New today</span> : null}
            {row.isPremium ? <span className="tp-chip tp-chip-amber">Premium</span> : null}
          </div>
          <h2 className="mt-3 font-display text-lg font-bold text-[var(--tp-ink)]">
            {row.premiseName || place}
          </h2>
        </div>
        <span className="shrink-0 text-xs font-semibold text-[var(--tp-muted)]">
          {formatDate(row.datePosted)}
        </span>
      </div>

      <p className="mt-2 flex items-start gap-2 text-sm leading-5 text-[var(--tp-ink-soft)]">
        <MapPin size={16} className="mt-0.5 shrink-0 text-[var(--tp-accent)]" />
        <span>{row.address || place}</span>
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-2">
        <CardFact icon={<IndianRupee size={15} />} label="Price" value={row.rentPriceRaw || "Ask owner"} />
        <CardFact icon={<Home size={15} />} label="Configuration" value={row.keyInfo || type} />
        <CardFact icon={<Calendar size={15} />} label="Available" value={row.availabilityRaw || "Confirm availability"} />
        <CardFact icon={<Ruler size={15} />} label="Area" value={row.sqftRaw || row.area || "Not listed"} />
      </dl>

      {row.isRentedOut ? <p className="mt-3 tp-chip tp-chip-slate">Marked rented / sold</p> : null}

      <div className="mt-4 border-t border-[var(--tp-border)] pt-4">
        <ContactRevealButton
          propertyId={row.id}
          initialName={row.ownerName}
          initialPhone={row.ownerPhone}
          initialPhoneLast4={row.ownerPhoneLast4}
          waContext={waContextFor(row.keyInfo, row.area, row.rentPriceRaw)}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <button type="button" className="tp-mobile-action" data-tp-action="share" onClick={() => shareProperty(row)}>
          <Share2 size={16} /> Share
        </button>
        <NoteEditor propertyId={row.id} initialText={row.note?.text || ""} showLabel />
        <ShortlistToggle propertyId={row.id} initially={row.shortlisted} showLabel />
      </div>
    </article>
  );
}

function waContextFor(config: string | null, place: string | null, price: string | null): string | null {
  const parts = [config, place, price].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function CardFact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="tp-tint-neutral rounded-xl p-3">
      <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--tp-muted)]">{icon}{label}</dt>
      <dd className="mt-1 text-sm font-semibold leading-5 text-[var(--tp-ink)]">{value}</dd>
    </div>
  );
}

async function shareProperty(row: PropertyRow) {
  const data = {
    title: row.premiseName || row.propertyType || "Property",
    text: [row.keyInfo, row.rentPriceRaw, row.address].filter(Boolean).join(" · "),
    url: window.location.href,
  };
  try {
    if (navigator.share) await navigator.share(data);
    else await navigator.clipboard.writeText(`${data.title}\n${data.text}\n${data.url}`);
  } catch {
    // Dismissing the native share sheet is not an error the user needs to see.
  }
}

function AddressCell({ address }: { address: string | null }) {
  const full = address || "";
  if (full.length <= 80) return <span>{full}</span>;
  return (
    <span>
      {full.slice(0, 80)}…{" "}
      <button type="button" className="min-h-11 font-semibold text-[var(--tp-accent)]" onClick={(e) => {
        const btn = e.currentTarget;
        const span = btn.parentElement;
        if (span) span.textContent = full;
      }}>read more</button>
    </span>
  );
}
