import { requireTechnoSession } from "@/lib/technoproperty/session";
import { getCallingQueue } from "@/lib/technoproperty/repository";
import { ContactRevealButton } from "@/components/broker/techno/ContactRevealButton";
import { CallOutcomePopover } from "@/components/broker/techno/CallOutcomePopover";
import { Phone, Zap } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CallQueuePage() {
  const session = await requireTechnoSession();
  const orgId = session.organization!.id;
  const userId = session.user.id;
  const rows = await getCallingQueue(orgId, userId, 50);
  return (
    <div className="space-y-5">
      <h1 className="tp-section-title text-2xl">
        <Phone size={22}/> Today&apos;s call queue
        <span className="ml-2 tp-chip tp-chip-green"><Zap size={12}/>{rows.length} fresh unrevealed</span>
      </h1>
      <p className="text-sm text-[var(--tp-muted)]">
        Power-dialer mode: newest listings first. Click to reveal the owner number, dial instantly, and tap an outcome chip — your follow-up is logged without leaving the keyboard.
      </p>
      <div className="space-y-2">
        {rows.length === 0 ? (
          <div className="tp-card tp-empty">You&apos;re all caught up — every fresh listing has been called.</div>
        ) : rows.map((r) => (
          <div key={r.id} className="tp-card flex flex-col gap-3 md:flex-row md:items-start md:gap-4">
            <div className="flex-1">
              <p className="flex items-center gap-2 font-display text-lg font-semibold text-[var(--tp-ink)]">
                {r.premiseName || r.area}
                {r.daysAgo !== null && r.daysAgo <= 1 ? (
                  <span className="tp-chip tp-chip-green">NEW · {r.daysAgo}d</span>
                ) : (
                  <span className="tp-chip tp-chip-slate">{r.daysAgo}d</span>
                )}
              </p>
              <p className="text-sm text-[var(--tp-ink-soft)]">{r.address}</p>
              <p className="text-xs text-[var(--tp-muted)]">{r.rentPriceRaw} · {r.keyInfo} · {r.availabilityRaw}</p>
              {r.note?.text ? (
                <p className="mt-2 rounded-lg bg-[#fff7e6] p-2 text-xs text-[#8a5b0b]">
                  Note: {r.note.text}
                </p>
              ) : null}
            </div>
            <div className="shrink-0">
              <ContactRevealButton
                propertyId={r.id}
                initialName={r.ownerName}
                initialPhone={r.ownerPhone}
                initialPhoneLast4={r.ownerPhoneLast4}
                initialRevealed={r.revealed}
              />
              <CallOutcomePopover propertyId={r.id} initialOutcome={r.currentOutcome} />
            </div>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-[var(--tp-muted)]">
        Tip: press <kbd className="rounded border px-1.5 py-0.5 text-[10px]">c</kbd> from anywhere in the dashboard to jump here.
      </p>
    </div>
  );
}
