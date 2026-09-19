/* Server Component (PERF-R5-002): RequirementTable — pure markup; renders the client ResponsiveDataView/ContactRevealButton as children.
   Every interactive control inside is its own client component, so this file
   needs no client boundary of its own — one here re-ships this markup (and its
   icon imports) in the route's first-load JS for no behaviour. No hooks, event
   handlers, browser APIs or time-dependent render output (verified; pinned by
   server-client-boundary.test.ts). Re-measure before adding `"use client"` back. */
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
  User,
} from "lucide-react";
import { ContactRevealButton } from "./ContactRevealButton";
import { InventoryEmptyState } from "./InventoryEmptyState";
import { ResponsiveDataView } from "./ResponsiveDataView";
import { buildPaginationUrl } from "./list-controls";

export interface RequirementRow {
  id: string;
  datePosted: Date | null;
  premiseName: string | null;
  area: string | null;
  address: string | null;
  rentPriceRaw: string | null;
  availabilityRaw: string | null;
  ownerName: string | null;
  ownerPhoneLast4: string | null;
  ownerPhone: string | null;
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

export default function RequirementTable({
  rows,
  total,
  page,
  perPage,
  basePath,
  currentSearch = "",
}: {
  rows: RequirementRow[];
  total: number;
  page: number;
  perPage: number;
  basePath: string;
  currentSearch?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const qs = (nextPage: number) => buildPaginationUrl(basePath, currentSearch, nextPage, perPage);
  if (total === 0) {
    return (
      <InventoryEmptyState
        title="No requirement matches found"
        description="Clear the search or choose another category to widen the matching inventory."
        clearHref={basePath}
      />
    );
  }

  const pagination = (
    <div className="tp-pagination-wrap mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--tp-muted)]">
      <div>Showing {(page - 1) * perPage + 1}–{Math.min(total, page * perPage)} of {total.toLocaleString("en-IN")} requirements</div>
      <div className="tp-pagination">
        <Link href={qs(1)} aria-label="First page" className="tp-page-btn tp-page-edge" aria-disabled={page === 1} tabIndex={page === 1 ? -1 : undefined}><ChevronsLeft size={16} /></Link>
        <Link href={qs(Math.max(1, page - 1))} aria-label="Previous page" className="tp-page-btn" aria-disabled={page === 1} tabIndex={page === 1 ? -1 : undefined}><ChevronLeft size={16} /></Link>
        <span className="tp-page-btn active" aria-current="page">{page}</span>
        <Link href={qs(Math.min(totalPages, page + 1))} aria-label="Next page" className="tp-page-btn" aria-disabled={page === totalPages} tabIndex={page === totalPages ? -1 : undefined}><ChevronRight size={16} /></Link>
        <Link href={qs(totalPages)} aria-label="Last page" className="tp-page-btn tp-page-edge" aria-disabled={page === totalPages} tabIndex={page === totalPages ? -1 : undefined}><ChevronsRight size={16} /></Link>
      </div>
    </div>
  );

  return (
    <ResponsiveDataView
      cardsLabel="Requirement cards"
      cards={
        <div className="space-y-3">
          {rows.map((row) => <RequirementCard key={row.id} row={row} />)}
          {pagination}
        </div>
      }
      table={
        <>
          <div className="tp-table overflow-x-auto" role="region" aria-label="Requirements table. Swipe horizontally to see all columns.">
            <table className="min-w-[900px]">
              <thead>
                <tr>
                  <th><span className="inline-flex items-center gap-1"><Calendar size={13} /> Posted</span></th>
                  <th><span className="inline-flex items-center gap-1"><User size={13} /> Seeker</span></th>
                  <th><span className="inline-flex items-center gap-1"><Home size={13} /> Requirement</span></th>
                  <th><span className="inline-flex items-center gap-1"><MapPin size={13} /> Area</span></th>
                  <th><span className="inline-flex items-center gap-1"><IndianRupee size={13} /> Budget</span></th>
                  <th>Contact</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="tp-date">{formatDate(r.datePosted)}{r.daysAgo !== null ? <><br /><span className="text-[10px] font-semibold">{r.daysAgo}d</span></> : null}</td>
                    <td className="text-sm">{r.ownerName || "Buyer/Tenant"}</td>
                    <td className="text-sm">{r.availabilityRaw || "3 BHK"}</td>
                    <td className="text-sm">{r.area || r.premiseName || "—"}</td>
                    <td className="whitespace-nowrap font-semibold">{r.rentPriceRaw || "—"}</td>
                    <td><ContactRevealButton propertyId={r.id} initialName={r.ownerName} initialPhone={r.ownerPhone} initialPhoneLast4={r.ownerPhoneLast4} waContext={waContextFor(r.availabilityRaw, r.area || r.premiseName, r.rentPriceRaw)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-[var(--tp-muted)] md:hidden">Swipe the table sideways to see every column.</p>
          {pagination}
        </>
      }
    />
  );
}

function waContextFor(detail: string | null, place: string | null, budget: string | null): string | null {
  const parts = [detail, place, budget].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function RequirementCard({ row }: { row: RequirementRow }) {
  const area = row.area || row.premiseName || "Ahmedabad";
  return (
    <article className="tp-mobile-card" aria-label={`Requirement in ${area}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--tp-muted)]">Buyer / tenant requirement</p>
          <h2 className="mt-1 font-display text-lg font-bold text-[var(--tp-ink)]">{row.availabilityRaw || "Property requirement"}</h2>
        </div>
        {row.daysAgo !== null ? <span className={`tp-chip ${row.daysAgo <= 1 ? "tp-chip-green" : "tp-chip-slate"}`}>{row.daysAgo === 0 ? "Today" : `${row.daysAgo}d ago`}</span> : null}
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm text-[var(--tp-ink-soft)]"><MapPin size={16} className="text-[var(--tp-accent)]" />{area}</p>
      <div className="mt-3 rounded-xl tp-tint-neutral rounded-xl p-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--tp-muted)]">Budget</p>
        <p className="mt-1 font-display text-lg font-bold text-[var(--tp-ink)]">{row.rentPriceRaw || "Confirm budget"}</p>
      </div>
      {row.address ? <p className="mt-3 text-sm leading-5 text-[var(--tp-muted)]">{row.address}</p> : null}
      <div className="mt-4 border-t border-[var(--tp-border)] pt-4">
        <ContactRevealButton propertyId={row.id} initialName={row.ownerName} initialPhone={row.ownerPhone} initialPhoneLast4={row.ownerPhoneLast4} waContext={waContextFor(row.availabilityRaw, row.area || row.premiseName, row.rentPriceRaw)} />
      </div>
    </article>
  );
}
