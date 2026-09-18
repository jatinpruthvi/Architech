import Link from "next/link";
import { getOrgPlanSummary } from "@/lib/plans/plan-status";
import { Bookmark, Phone, FileText, Bell, CreditCard } from "lucide-react";

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

export function ActivityWidgets({ data }: {
  data: {
    shortlistCount: number;
    savedSearchCount: number;
    recentReveals: RecentReveal[];
    recentNotes: RecentNote[];
  };
}) {
  return (
    <div id="notifications" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <article className="tp-card" style={{ background: "linear-gradient(160deg, var(--night) 0%, color-mix(in srgb, var(--brick) 55%, var(--night)) 100%)", color: "var(--cream)", border: "none" }}>
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

      <article id="notes" className="tp-card">
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
