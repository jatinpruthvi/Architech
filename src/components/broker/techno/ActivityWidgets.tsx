import Link from "next/link";
import { Bookmark, Phone, FileText, Bell, CreditCard } from "lucide-react";

function relTime(d: Date): string {
  const ms = Date.now() - new Date(d).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ActivityWidgets({ data }: {
  data: {
    shortlistCount: number;
    savedSearchCount: number;
    recentReveals: any[];
    recentNotes: any[];
  };
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <article className="tp-card" style={{ background: "linear-gradient(160deg,#0b3b6d 0%,#1d6fe0 100%)", color: "#fff", border: "none" }}>
        <span className="tp-chip" style={{ background: "rgba(255,255,255,.15)", color: "#fff" }}>
          <Bell size={12} /> Saved search matches
        </span>
        <p className="tp-kpi-value mt-4" style={{ color: "#fff" }}>{data.savedSearchCount}</p>
        <p className="text-sm text-white/70">new matches</p>
        <p className="mt-4 rounded-lg bg-white/10 p-3 text-xs text-white/80">
          Save filters from Search to see daily matches here.
        </p>
      </article>

      <article className="tp-card">
        <span className="tp-chip tp-chip-green"><Bookmark size={12} /> My shortlist</span>
        <p className="tp-kpi-value mt-4">{data.shortlistCount}</p>
        <p className="text-sm text-[var(--tp-muted)]">saved properties</p>
        <div className="mt-4 space-y-2">
          {data.shortlistCount === 0 ? (
            <p className="text-xs text-[var(--tp-muted)]">Nothing shortlisted yet.</p>
          ) : (
            <Link href="/broker/shortlisted" className="tp-btn tp-btn-ghost !text-xs">Open shortlist →</Link>
          )}
        </div>
      </article>

      <article className="tp-card">
        <span className="tp-chip tp-chip-amber"><Phone size={12} /> Recent contact reveals</span>
        <p className="tp-kpi-value mt-4">{data.recentReveals.length}</p>
        <p className="text-sm text-[var(--tp-muted)]">reveals today</p>
        <ul className="mt-3 space-y-2">
          {data.recentReveals.slice(0, 4).map((r) => (
            <li key={r.id} className="truncate rounded-lg border border-[var(--tp-border)] p-2 text-xs">
              <span className="text-[var(--tp-muted)]">{relTime(r.createdAt)}</span>{" "}
              {r.property?.premiseName || r.property?.address || "Property"}
            </li>
          ))}
          {data.recentReveals.length === 0 ? (
            <p className="text-xs text-[var(--tp-muted)]">No reveals yet today — open the call queue to start dialing.</p>
          ) : (
            <Link href="/broker/call-queue" className="tp-btn tp-btn-ghost !text-xs">
              Open recent →
            </Link>
          )}
        </ul>
      </article>

      <article className="tp-card">
        <span className="tp-chip tp-chip-violet"><FileText size={12} /> My notes</span>
        <p className="tp-kpi-value mt-4">{data.recentNotes.length}</p>
        <p className="text-sm text-[var(--tp-muted)]">noted properties</p>
        <ul className="mt-3 space-y-2">
          {data.recentNotes.slice(0, 4).map((n) => (
            <li key={n.id} className="rounded-lg border border-[var(--tp-border)] p-2 text-xs">
              <p className="truncate font-medium">{n.property?.premiseName || n.property?.address || "Property"}</p>
              <p className="truncate text-[var(--tp-muted)]">{n.text}</p>
            </li>
          ))}
          {data.recentNotes.length === 0 ? (
            <p className="text-xs text-[var(--tp-muted)]">Use the ✎ icon on any row to add a note.</p>
          ) : null}
        </ul>
      </article>
    </div>
  );
}

export function PaymentStrip() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <article className="tp-card flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e0fbf0] text-[#0e8a65]"><CreditCard size={18} /></span>
        <div>
          <p className="text-xs text-[var(--tp-muted)]">Payment status</p>
          <p className="font-semibold text-[var(--tp-ink)]">Active <span className="ml-2 text-xs text-[#0e8a65]">Plan active</span></p>
          <p className="text-xs text-[var(--tp-muted)]">Next payment 28 Feb 2027 · <Link href="/broker/agent" className="text-[var(--tp-accent)]">Receipt</Link></p>
        </div>
      </article>
      <article className="tp-card flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e3f0ff] text-[var(--tp-accent)]"><Bell size={18} /></span>
        <div>
          <p className="font-semibold">No new announcements</p>
          <p className="text-xs text-[var(--tp-muted)]">Important product updates will appear here.</p>
        </div>
      </article>
    </div>
  );
}
