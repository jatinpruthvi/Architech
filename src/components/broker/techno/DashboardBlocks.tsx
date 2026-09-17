import { CountCard, MiniCountCard } from "./CountCard";
import { categoryLabel, chipFor } from "@/lib/technoproperty/categories";
import Link from "next/link";
import { Home, Building2, UsersRound, TrendingUp, Plus, Calendar, LayoutGrid, Phone, Eye } from "lucide-react";

export function UpdatesBlock({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; count: number }[];
}) {
  return (
    <div className="tp-card tp-card-accent">
      <h3 className="tp-kpi-label mb-3 text-[var(--tp-ink)]">{title}</h3>
      <div className="grid grid-cols-5 gap-2">
        {rows.map((r) => (
          <MiniCountCard
            key={r.key}
            label={categoryLabel(r.key).replace("Residential ", "Res ")
              .replace("Commercial ", "Com ")}
            value={r.count}
            tone={chipFor(r.key)}
          />
        ))}
        <MiniCountCard label="Total Properties" value={rows.reduce((a, r) => a + r.count, 0)} tone="slate" />
      </div>
    </div>
  );
}

export function CategoryMiniGrid({
  rows,
}: {
  rows: { key: string; count: number }[];
}) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
      {rows.map((r) => (
        <MiniCountCard
          key={r.key}
          label={categoryLabel(r.key)}
          value={r.count}
          tone={chipFor(r.key)}
        />
      ))}
    </div>
  );
}

export function CallingQueueEmpty() {
  return (
    <p className="mt-4 text-sm text-[var(--tp-muted)]">
      Nothing to call right now — all fresh listings have been revealed.
    </p>
  );
}

export async function CallingQueue({
  orgId,
  userId,
  rows,
}: {
  orgId: string;
  userId: string;
  rows: {
    id: string;
    address: string | null;
    premiseName: string | null;
    area: string | null;
    rentPriceRaw: string | null;
    ownerName: string | null;
    ownerPhone: string | null;
    ownerPhoneLast4: string | null;
    hasOwnerPhone: boolean;
    daysAgo: number | null;
  }[];
}) {
  if (rows.length === 0) return <CallingQueueEmpty />;
  // Import client component dynamically to avoid pulling it into RSC graph
  const { ContactRevealButton } = await import("./ContactRevealButton");
  return (
    <div className="mt-4 divide-y divide-[var(--tp-border)]">
      {rows.map((r) => (
        <div key={r.id} className="flex items-start gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[var(--tp-ink)]">{r.premiseName || r.area || "Property"}</p>
            <p className="truncate text-sm text-[var(--tp-ink-soft)]">{r.address}</p>
            <p className="text-xs text-[var(--tp-muted)]">
              {r.rentPriceRaw}
              {r.daysAgo !== null && r.daysAgo <= 1 ? (
                <span className="ml-2 rounded bg-[#e0fbf0] px-1.5 py-0.5 text-[10px] font-semibold text-[#0e8a65]">NEW</span>
              ) : null}
            </p>
          </div>
          <ContactRevealButton
            propertyId={r.id}
            initialName={r.ownerName}
            initialPhone={r.ownerPhone}
            initialPhoneLast4={r.ownerPhoneLast4}
            initialRevealed={!!r.ownerPhone}
          />
        </div>
      ))}
      <div className="pt-3">
        <Link href="/broker/call-queue" className="tp-btn tp-btn-primary">
          <Phone size={14} /> Open full call queue
        </Link>
      </div>
    </div>
  );
}
