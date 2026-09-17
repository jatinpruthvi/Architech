"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Share2, MessageCircle, Image as ImageIcon, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { NoteEditor } from "./NoteEditor";
import { ContactRevealButton } from "./ContactRevealButton";
import { ShortlistToggle } from "./ShortlistToggle";
import { categoryLabel } from "@/lib/technoproperty/categories";

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

function Pagination({ page, perPage, total, basePath }: { page: number; perPage: number; total: number; basePath: string }) {
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
  const qs = (p: number) => {
    const params = new URLSearchParams({ page: String(p), perPage: String(perPage) });
    return `${basePath}?${params.toString()}`;
  };
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--tp-muted)]">
      <div>
        Showing {(page - 1) * perPage + 1} to {Math.min(total, page * perPage)} of {total.toLocaleString("en-IN")} entries
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2">
          <select
            className="tp-input !py-1 !px-2 !text-sm"
            defaultValue={perPage}
            onChange={(e) => {
              window.location.href = `${basePath}?perPage=${e.target.value}&page=1`;
            }}
          >
            {[25, 50, 100].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          entries per page
        </label>
        <div className="tp-pagination">
          <Link href={qs(1)} aria-label="First" className="tp-page-btn" aria-disabled={page === 1}>
            <ChevronsLeft size={14} />
          </Link>
          <Link href={qs(Math.max(1, page - 1))} aria-label="Prev" className="tp-page-btn" aria-disabled={page === 1}>
            <ChevronLeft size={14} />
          </Link>
          {pageNumbers.map((n, i) =>
            n === "…" ? (
              <span key={`e${i}`} className="px-1 text-[var(--tp-muted)]">…</span>
            ) : (
              <Link key={n} href={qs(n)} className={`tp-page-btn ${n === page ? "active" : ""}`}>
                {n}
              </Link>
            ),
          )}
          <Link href={qs(Math.min(totalPages, page + 1))} aria-label="Next" className="tp-page-btn" aria-disabled={page === totalPages}>
            <ChevronRight size={14} />
          </Link>
          <Link href={qs(totalPages)} aria-label="Last" className="tp-page-btn" aria-disabled={page === totalPages}>
            <ChevronsRight size={14} />
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
}: {
  rows: PropertyRow[];
  total: number;
  page: number;
  perPage: number;
  basePath?: string;
}) {
  if (total === 0) {
    return (
      <div className="tp-empty tp-card">
        No properties found for this filter. Run a crawl or adjust filters.
      </div>
    );
  }
  return (
    <>
      <div className="tp-table">
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
                      <button className="tp-action-btn share" title="Share" data-tp-action="share" onClick={(e) => e.preventDefault()}><Share2 size={14} /></button>
                      <button className="tp-action-btn whatsapp" title="WhatsApp" data-tp-action="whatsapp" onClick={(e) => e.preventDefault()}><MessageCircle size={14} /></button>
                      <button className={`tp-action-btn gallery ${r.hasGallery ? "" : "opacity-30"}`} title={r.hasGallery ? "Gallery" : "No gallery"} data-tp-action="gallery" disabled={!r.hasGallery}><ImageIcon size={14} /></button>
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
                  <td><ContactRevealButton propertyId={r.id} initialName={r.ownerName} initialPhone={r.ownerPhone} initialPhoneLast4={r.ownerPhoneLast4} /></td>
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
      <Pagination page={page} perPage={perPage} total={total} basePath={basePath} />
      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-[var(--tp-muted)]">
        <span className="tp-legend"><span className="tp-legend-swatch" style={{ background: "#fff2d4" }} /> Premium property</span>
        <span className="tp-legend"><span className="tp-legend-swatch" style={{ background: "#e0fbf0" }} /> Fresh (today)</span>
        <span className="tp-legend"><span className="tp-legend-swatch" style={{ background: "#e8eef5" }} /> Sold / Rented out</span>
      </div>
    </>
  );
}

function AddressCell({ address }: { address: string | null }) {
  const full = address || "";
  if (full.length <= 80) return <span>{full}</span>;
  return (
    <span>
      {full.slice(0, 80)}…{" "}
      <button className="font-semibold text-[var(--tp-accent)]" onClick={(e) => {
        const btn = e.currentTarget;
        const span = btn.parentElement;
        if (span) span.textContent = full;
      }}>read more</button>
    </span>
  );
}
