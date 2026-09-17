"use client";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Phone, User, MapPin, IndianRupee, Home, Calendar,
} from "lucide-react";
import { ContactRevealButton } from "./ContactRevealButton";

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
  rows, total, page, perPage, basePath,
}: {
  rows: RequirementRow[]; total: number; page: number; perPage: number; basePath: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const qs = (p: number) => {
    const params = new URLSearchParams({ page: String(p), perPage: String(perPage) });
    return `${basePath}?${params.toString()}`;
  };
  if (total === 0) {
    return <div className="tp-card tp-empty">No matching requirements.</div>;
  }
  return (
    <>
      <div className="tp-table">
        <table className="min-w-[900px]">
          <thead>
            <tr>
              <th><span className="inline-flex items-center gap-1"><Calendar size={13}></Calendar> Posted</span></th>
              <th><span className="inline-flex items-center gap-1"><User size={13}></User> Seeker</span></th>
              <th><span className="inline-flex items-center gap-1"><Home size={13}></Home> Requirement</span></th>
              <th><span className="inline-flex items-center gap-1"><MapPin size={13}></MapPin> Area</span></th>
              <th><span className="inline-flex items-center gap-1"><IndianRupee size={13}></IndianRupee> Budget</span></th>
              <th>Contact</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="tp-date">
                  {formatDate(r.datePosted)}
                  {r.daysAgo !== null ? (
                    <>
                      <br />
                      <span className="text-[10px] font-semibold">{r.daysAgo}d</span>
                    </>
                  ) : null}
                </td>
                <td className="text-sm">{r.ownerName || "Buyer/Tenant"}</td>
                <td className="text-sm">{r.availabilityRaw || "3 BHK"}</td>
                <td className="text-sm">{r.area || r.premiseName || "—"}</td>
                <td className="font-semibold whitespace-nowrap">{r.rentPriceRaw || "—"}</td>
                <td>
                  <ContactRevealButton
                    propertyId={r.id}
                    initialName={r.ownerName}
                    initialPhone={r.ownerPhone}
                    initialPhoneLast4={r.ownerPhoneLast4}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--tp-muted)]">
        <div>Showing {(page - 1) * perPage + 1}–{Math.min(total, page * perPage)} of {total.toLocaleString("en-IN")} requirements</div>
        <div className="tp-pagination">
          <Link href={qs(1)} className="tp-page-btn"><ChevronsLeft size={14}></ChevronsLeft></Link>
          <Link href={qs(Math.max(1, page - 1))} className="tp-page-btn"><ChevronLeft size={14}></ChevronLeft></Link>
          <span className="tp-page-btn active">{page}</span>
          <Link href={qs(Math.min(totalPages, page + 1))} className="tp-page-btn"><ChevronRight size={14}></ChevronRight></Link>
          <Link href={qs(totalPages)} className="tp-page-btn"><ChevronsRight size={14}></ChevronsRight></Link>
        </div>
      </div>
    </>
  );
}
