"use client";

import Link from "next/link";
import {
  AlignLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  FileText,
  Home,
  IndianRupee,
  MapPin,
  Ruler,
  User,
} from "lucide-react";
import { InventoryEmptyState } from "./InventoryEmptyState";
import { ResponsiveDataView } from "./ResponsiveDataView";
import { buildPaginationUrl } from "./list-controls";

export interface BrokerRow {
  id: string;
  category: string;
  datePosted: Date | null;
  name: string | null;
  landmark: string | null;
  location: string | null;
  priceRaw: string | null;
  availabilityLabel: string | null;
  conditionLabel: string | null;
  descriptionShort: string | null;
  propertyDetails: string | null;
  sqftLabel: string | null;
  daysAgo: number | null;
}

function truncate(s: string | null, n: number): string {
  if (!s) return "—";
  if (s.length <= n) return s;
  return s.slice(0, n) + "...";
}

function formatPrice(raw: string | null): string {
  if (!raw) return "—";
  const numStr = raw.replace(/[^\d]/g, "");
  const num = Number(numStr);
  if (!num) return raw;
  if (num >= 10000000) return `${(num / 10000000).toFixed(2).replace(/\.?0+$/, "")} Cr`;
  if (num >= 100000) return `${(num / 100000).toFixed(2).replace(/\.?0+$/, "")} L`;
  return `${(num / 1000).toFixed(2)} Thd`;
}

function formatSqft(raw: string | null): string {
  if (!raw) return "—";
  const match = raw.match(/([\d,]+)/);
  if (!match) return raw;
  return `${Number(match[1].replace(/,/g, "")).toLocaleString("en-IN")} Sq.Ft.`;
}

function buildDetailsLabel(r: BrokerRow): string {
  const bhk = (r.availabilityLabel || "").split("\n")[0] || "";
  const condition = (r.conditionLabel || "").toUpperCase();
  const isRent = /rent/i.test(r.propertyDetails || "") || /month/i.test(r.priceRaw || "");
  const kind = isRent ? "APARTMENT ON RENT" : "APARTMENT FOR SALE";
  return `${bhk} ${condition} ${kind}`.replace(/\s+/g, " ").trim();
}

const H = ({ icon: Icon, children, sortable }: { icon: typeof User; children: React.ReactNode; sortable?: boolean }) => (
  <th>
    <span className="inline-flex items-center gap-1">
      {sortable ? <span className="text-[var(--tp-accent)]">↕</span> : null}
      <Icon size={13} /> {children}
    </span>
  </th>
);

export function BrokerPropertyTable({
  rows,
  total,
  page,
  perPage,
  basePath,
  currentSearch = "",
}: {
  rows: BrokerRow[];
  total: number;
  page: number;
  perPage: number;
  basePath: string;
  currentSearch?: string;
}) {
  if (total === 0) {
    return (
      <InventoryEmptyState
        title="No broker properties match this search"
        description="Clear the search or explore the owner inventory while this category updates."
        clearHref={basePath}
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const qs = (nextPage: number, nextPerPage: number = perPage) =>
    buildPaginationUrl(basePath, currentSearch, nextPage, nextPerPage);
  const pagination = (
    <div className="tp-pagination-wrap mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--tp-muted)]">
      <div>Showing {(page - 1) * perPage + 1} to {Math.min(total, page * perPage)} of {total.toLocaleString("en-IN")} entries</div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-h-11 items-center gap-2">
          <select aria-label="Entries per page" className="tp-input min-h-11 !px-2 !py-1 !text-sm" defaultValue={perPage} onChange={(event) => { window.location.href = qs(1, Number(event.target.value)); }}>
            {[25, 50, 100, 250, 500].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <span>per page</span>
        </label>
        <div className="tp-pagination">
          <Link href={qs(1)} aria-label="First page" className="tp-page-btn tp-page-edge" aria-disabled={page === 1} tabIndex={page === 1 ? -1 : undefined}><ChevronsLeft size={16} /></Link>
          <Link href={qs(Math.max(1, page - 1))} aria-label="Previous page" className="tp-page-btn" aria-disabled={page === 1} tabIndex={page === 1 ? -1 : undefined}><ChevronLeft size={16} /></Link>
          <span className="tp-page-btn active" aria-current="page">{page}</span>
          <Link href={qs(Math.min(totalPages, page + 1))} aria-label="Next page" className="tp-page-btn" aria-disabled={page === totalPages} tabIndex={page === totalPages ? -1 : undefined}><ChevronRight size={16} /></Link>
          <Link href={qs(totalPages)} aria-label="Last page" className="tp-page-btn tp-page-edge" aria-disabled={page === totalPages} tabIndex={page === totalPages ? -1 : undefined}><ChevronsRight size={16} /></Link>
        </div>
      </div>
    </div>
  );

  return (
    <ResponsiveDataView
      cardsLabel="Broker property cards"
      cards={
        <div className="space-y-3">
          {rows.map((row) => <BrokerCard key={row.id} row={row} />)}
          {pagination}
        </div>
      }
      table={
        <>
          <div className="tp-table overflow-x-auto" role="region" aria-label="Broker property table. Swipe horizontally to see all columns.">
            <table className="min-w-[1600px] table-fixed">
              <colgroup>
                <col style={{ width: "140px" }} /><col style={{ width: "170px" }} /><col style={{ width: "130px" }} />
                <col style={{ width: "130px" }} /><col style={{ width: "140px" }} /><col style={{ width: "120px" }} />
                <col style={{ width: "260px" }} /><col style={{ width: "280px" }} /><col style={{ width: "110px" }} />
              </colgroup>
              <thead>
                <tr>
                  <H icon={User} sortable>NAME</H><H icon={MapPin} sortable>LANDMARK</H><H icon={MapPin} sortable>LOCATION</H>
                  <H icon={IndianRupee} sortable>RENT/SELL PRICE</H><H icon={Home} sortable>AVAILABILITY</H>
                  <H icon={ClipboardList} sortable>CONDITION</H><H icon={AlignLeft} sortable>PROPERTY DESCRIPTION</H>
                  <H icon={FileText} sortable>PROPERTY DETAILS</H><H icon={Ruler} sortable>SQFT/SQYD</H>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-pre-line text-sm leading-snug">{truncate(r.name, 22)}</td>
                    <td className="whitespace-pre-line text-sm leading-snug">{truncate(r.landmark, 40)}</td>
                    <td className="whitespace-nowrap text-sm">{r.location || "—"}</td>
                    <td className="whitespace-nowrap font-semibold">{formatPrice(r.priceRaw)}</td>
                    <td className="whitespace-pre-line text-sm leading-snug">{r.availabilityLabel || "—"}</td>
                    <td className="whitespace-nowrap text-sm">{r.conditionLabel || "—"}</td>
                    <td className="text-sm leading-snug">{truncate(r.descriptionShort, 80)}</td>
                    <td className="text-sm uppercase leading-snug">{truncate(buildDetailsLabel(r), 80)}</td>
                    <td className="whitespace-nowrap font-semibold">{formatSqft(r.sqftLabel)}</td>
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

function BrokerCard({ row }: { row: BrokerRow }) {
  const location = row.location || row.landmark || "Ahmedabad";
  return (
    <article className="tp-mobile-card" aria-label={`${row.name || "Broker"} property in ${location}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--tp-muted)]">Broker property</p>
          <h2 className="mt-1 font-display text-lg font-bold text-[var(--tp-ink)]">{row.name || "Broker listing"}</h2>
        </div>
        {row.daysAgo !== null ? <span className={`tp-chip ${row.daysAgo <= 1 ? "tp-chip-green" : "tp-chip-slate"}`}>{row.daysAgo === 0 ? "Today" : `${row.daysAgo}d ago`}</span> : null}
      </div>
      <p className="mt-2 flex items-start gap-2 text-sm text-[var(--tp-ink-soft)]"><MapPin size={16} className="mt-0.5 shrink-0 text-[var(--tp-accent)]" />{[row.landmark, row.location].filter(Boolean).join(", ") || "Location not listed"}</p>
      <dl className="mt-4 grid grid-cols-2 gap-2">
        <CardFact icon={<IndianRupee size={15} />} label="Price" value={formatPrice(row.priceRaw)} />
        <CardFact icon={<Ruler size={15} />} label="Area" value={formatSqft(row.sqftLabel)} />
        <CardFact icon={<Home size={15} />} label="Availability" value={row.availabilityLabel || "Confirm"} />
        <CardFact icon={<ClipboardList size={15} />} label="Condition" value={row.conditionLabel || "Not listed"} />
      </dl>
      <div className="mt-3 rounded-xl bg-[#f6f9fd] p-3 text-sm leading-5 text-[var(--tp-ink-soft)]">
        <p className="font-semibold text-[var(--tp-ink)]">{buildDetailsLabel(row)}</p>
        <p className="mt-1">{row.descriptionShort || "No additional description."}</p>
      </div>
    </article>
  );
}

function CardFact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f6f9fd] p-3">
      <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--tp-muted)]">{icon}{label}</dt>
      <dd className="mt-1 whitespace-pre-line text-sm font-semibold leading-5 text-[var(--tp-ink)]">{value}</dd>
    </div>
  );
}
