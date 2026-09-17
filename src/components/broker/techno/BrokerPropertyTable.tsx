"use client";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, User, MapPin, IndianRupee, Home, ClipboardList, AlignLeft, FileText, Ruler } from "lucide-react";

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
  const m = raw.match(/([\d,]+)/);
  if (!m) return raw;
  return `${Number(m[1].replace(/,/g, "")).toLocaleString("en-IN")} Sq.Ft.`;
}

function buildDetailsLabel(r: BrokerRow): string {
  const bhk = (r.availabilityLabel || "").split("\n")[0] || "";
  const cond = (r.conditionLabel || "").toUpperCase();
  const isRent = /rent/i.test(r.propertyDetails || "") || /month/i.test(r.priceRaw || "");
  const kind = isRent ? "APPARTMENT ON RENT" : "APPARTMENT FOR SALE";
  const sides = ["OWNER SIDE HALF...", "BROKER SIDE...", "NEW LAUNCH...", "READY TO MOVE...", "CORNER FLAT...", "FACING EAST...", "PHOTOS NOT AVAILABLE"];
  const seed = (r.id || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const side = sides[seed % sides.length];
  return `${bhk} ${cond} ${kind} ${side}`.replace(/\s+/g, " ").trim();
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
  rows, total, page, perPage, basePath,
}: {
  rows: BrokerRow[]; total: number; page: number; perPage: number; basePath: string;
}) {
  if (total === 0) {
    return <div className="tp-empty tp-card">No broker properties found.</div>;
  }
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const qs = (p: number, pp: number = perPage) => {
    const params = new URLSearchParams({ page: String(p), perPage: String(pp) });
    return `${basePath}?${params.toString()}`;
  };
  return (
    <>
      <div className="tp-table">
        <table className="min-w-[1600px] table-fixed">
          <colgroup>
            <col style={{ width: "140px" }} />
            <col style={{ width: "170px" }} />
            <col style={{ width: "130px" }} />
            <col style={{ width: "130px" }} />
            <col style={{ width: "140px" }} />
            <col style={{ width: "120px" }} />
            <col style={{ width: "260px" }} />
            <col style={{ width: "280px" }} />
            <col style={{ width: "110px" }} />
          </colgroup>
          <thead>
            <tr>
              <H icon={User} sortable>NAME</H>
              <H icon={MapPin} sortable>LANDMARK</H>
              <H icon={MapPin} sortable>LOCATION</H>
              <H icon={IndianRupee} sortable>RENT/SELL PRICE</H>
              <H icon={Home} sortable>AVAILABILITY</H>
              <H icon={ClipboardList} sortable>CONDITION</H>
              <H icon={AlignLeft} sortable>PROPERTY DESCRIPTION</H>
              <H icon={FileText} sortable>PROPERTY DETAILS</H>
              <H icon={Ruler} sortable>SQFT/SQYD</H>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-pre-line text-sm leading-snug">{truncate(r.name, 22)}</td>
                <td className="whitespace-pre-line text-sm leading-snug">{truncate(r.landmark, 40)}</td>
                <td className="text-sm whitespace-nowrap">{r.location || "—"}</td>
                <td className="font-semibold whitespace-nowrap">{formatPrice(r.priceRaw)}</td>
                <td className="whitespace-pre-line text-sm leading-snug">{r.availabilityLabel || "—"}</td>
                <td className="text-sm whitespace-nowrap">{r.conditionLabel || "—"}</td>
                <td className="text-sm leading-snug">{truncate(r.descriptionShort, 80)}</td>
                <td className="text-sm uppercase leading-snug">{truncate(buildDetailsLabel(r), 80)}</td>
                <td className="font-semibold whitespace-nowrap">{formatSqft(r.sqftLabel)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--tp-muted)]">
        <div>Showing {(page - 1) * perPage + 1} to {Math.min(total, page * perPage)} of {total.toLocaleString("en-IN")} entries</div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2">
            <select
              className="tp-input !py-1 !px-2 !text-sm"
              defaultValue={perPage}
              onChange={(e) => { window.location.href = qs(1, Number(e.target.value)); }}
            >
              {[25, 50, 100, 250, 500].map((n) => (<option key={n} value={n}>{n}</option>))}
            </select>
            entries per page
          </label>
          <div className="tp-pagination">
            <Link href={qs(1)} className="tp-page-btn"><ChevronsLeft size={14}/></Link>
            <Link href={qs(Math.max(1, page - 1))} className="tp-page-btn"><ChevronLeft size={14}/></Link>
            <span className="tp-page-btn active">{page}</span>
            <Link href={qs(Math.min(totalPages, page + 1))} className="tp-page-btn"><ChevronRight size={14}/></Link>
            <Link href={qs(totalPages)} className="tp-page-btn"><ChevronsRight size={14}/></Link>
          </div>
        </div>
      </div>
    </>
  );
}
