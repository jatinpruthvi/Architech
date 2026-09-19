import type { CSSProperties } from "react";
import Link from "next/link";
import { getOrgPlanSummary } from "@/lib/plans/plan-status";
import { Bookmark, Phone, FileText, Bell, CreditCard } from "lucide-react";

/* Stagger index for the `.tp-rise` entrance (theme.css). */
const rise = (i: number): CSSProperties => ({ "--tp-i": i }) as CSSProperties;

function relTime(d: Date): string {
  const ms = Date.now() - new Date(d).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

type ActivityProperty = { premiseName: string | null; address: string | null } | null;
type RecentReveal = { id: string; createdAt: Date; property?: ActivityProperty };
type RecentNote = { id: string; text: string; property?: ActivityProperty };
type SavedSearchView = {
  id: string;
  name: string;
  filters: { category?: string; q?: string; premium?: string; rented?: string };
  newMatches: number;
};

/** Re-open the search in the workspace; the `savedSearch` param makes the
 *  results page mark it as seen, so "new matches" resets and re-counts. */
function savedSearchHref(s: SavedSearchView): string {
  const base = (s.filters.category ?? "All") === "All" ? "/broker/owners" : `/broker/owners/${s.filters.category}`;
  const params = new URLSearchParams();
  if (s.filters.q) params.set("q", s.filters.q);
  if (s.filters.premium === "1") params.set("premium", "1");
  if (s.filters.rented === "1") params.set("rented", "1");
  params.set("savedSearch", s.id);
  return `${base}?${params.toString()}`;
}

export function ActivityWidgets({ data }: {
  data: {
    shortlistCount: number;
    savedSearches: SavedSearchView[];
    recentReveals: RecentReveal[];
    recentNotes: RecentNote[];
  };
}) {
  const totalNewMatches = data.savedSearches.reduce((sum, s) => sum + s.newMatches, 0);
  const matches = [...data.savedSearches].sort((a, b) => b.newMatches - a.newMatches);
  return (
    <div id="notifications" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <article className="tp-card tp-rise" style={{ background: "linear-gradient(160deg, var(--night) 0%, color-mix(in srgb, var(--brick) 55%, var(--night)) 100%)", color: "var(--cream)", border: "none", ...rise(0) }}>
        <span className="tp-chip" style={{ background: "rgba(255,255,255,.15)", color: "#fff" }}>
          <Bell size={12} /> Saved search matches
        </span>
        <p className="tp-kpi-value mt-4" style={{ color: "#fff" }}>{totalNewMatches}</p>
        <p className="text-sm text-white/70">{totalNewMatches === 1 ? "new match" : "new matches"}</p>
        {data.savedSearches.length === 0 ? (
          <p className="mt-4 rounded-lg bg-white/10 p-3 text-xs text-white/80">
            Save filters from any inventory list ("Save this search") to see new matches here.
          </p>
        ) : (
          <ul role="list" className="mt-4 space-y-1.5">
            {matches.slice(0, 4).map((s) => (
              <li key={s.id}>
                <Link href={savedSearchHref(s)} className="block truncate rounded-lg bg-white/10 p-2 text-xs text-white/90 transition hover:bg-white/20">
                  <span className="font-bold">{s.newMatches > 0 ? `${s.newMatches} new · ` : ""}{s.name}</span>
                  {s.newMatches > 0 ? <span className="ml-1">→</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="tp-card tp-rise" style={rise(1)}>
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

      <article className="tp-card tp-rise" style={rise(2)}>
        <span className="tp-chip tp-chip-amber"><Phone size={12} /> Recent contact reveals</span>
        <p className="tp-kpi-value mt-4">{data.recentReveals.length}</p>
        <p className="text-sm text-[var(--tp-muted)]">reveals today</p>
        <ul role="list" className="mt-3 space-y-2">
          {data.recentReveals.slice(0, 4).map((r) => (
            <li key={r.id} className="truncate rounded-lg border border-[var(--tp-border)] p-2 text-xs">
              <span className="text-[var(--tp-muted)]">{relTime(r.createdAt)}</span>{" "}
              {r.property?.premiseName || r.property?.address || "Property"}
            </li>
          ))}
          {data.recentReveals.length === 0 ? (
            <li className="text-xs text-[var(--tp-muted)]">No reveals yet today — open the call queue to start dialing.</li>
          ) : (
            <li>
              <Link href="/broker/call-queue" className="tp-btn tp-btn-ghost !text-xs">
                Open recent →
              </Link>
            </li>
          )}
        </ul>
      </article>

      <article id="notes" className="tp-card tp-rise" style={rise(3)}>
        <span className="tp-chip tp-chip-violet"><FileText size={12} /> My notes</span>
        <p className="tp-kpi-value mt-4">{data.recentNotes.length}</p>
        <p className="text-sm text-[var(--tp-muted)]">noted properties</p>
        <ul role="list" className="mt-3 space-y-2">
          {data.recentNotes.slice(0, 4).map((n) => (
            <li key={n.id} className="rounded-lg border border-[var(--tp-border)] p-2 text-xs">
              <p className="truncate font-medium">{n.property?.premiseName || n.property?.address || "Property"}</p>
              <p className="truncate text-[var(--tp-muted)]">{n.text}</p>
            </li>
          ))}
          {data.recentNotes.length === 0 ? (
            <li className="text-xs text-[var(--tp-muted)]">Use the Note action on any property to add one.</li>
          ) : null}
        </ul>
      </article>
    </div>
  );
}

export async function PaymentStrip({ orgId }: { orgId: string }) {
  const plan = await getOrgPlanSummary(orgId);
  const statusMeta = {
    ACTIVE: { label: "Active", chip: "tp-tint-green" },
    TRIAL: { label: "Trial", chip: "tp-tint-amber" },
    EXPIRED: { label: "Expired", chip: "tp-tint-rose" },
    NONE: { label: "No plan", chip: "tp-tint-rose" },
  }[plan.status];
  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const nextLine = plan.renewsAt
    ? `Next payment ${fmt(new Date(plan.renewsAt))}`
    : plan.expiresAt
      ? `Valid till ${fmt(new Date(plan.expiresAt))}`
      : plan.status === "NONE"
        ? "Ask the platform admin to activate a plan."
        : "Renewal date appears once billing is set up.";
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <article className="tp-card flex items-center gap-3">
        <span className="tp-tint-green grid h-10 w-10 place-items-center rounded-xl"><CreditCard size={18} /></span>
        <div>
          <p className="text-xs text-[var(--tp-muted)]">Payment status</p>
          <p className="font-semibold text-[var(--tp-ink)]">
            {statusMeta.label}
            <span className={`${statusMeta.chip} ml-2 rounded px-1.5 py-0.5 text-xs`}>{plan.planName ?? "Plan"}</span>
          </p>
          <p className="text-xs text-[var(--tp-muted)]">{nextLine}</p>
        </div>
      </article>
      <article className="tp-card flex items-center gap-3">
        <span className="tp-tint-blue grid h-10 w-10 place-items-center rounded-xl"><Bell size={18} /></span>
        <div>
          <p className="font-semibold">No new announcements</p>
          <p className="text-xs text-[var(--tp-muted)]">Important product updates will appear here.</p>
        </div>
      </article>
    </div>
  );
}
