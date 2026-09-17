"use client";
import { useEffect, useState } from "react";
import { Phone, MessageCircle, Loader2 } from "lucide-react";

export function ContactRevealButton({
  propertyId,
  brokerListingId,
  listingType = "owner",
  initialRevealed = false,
  initialName,
  initialPhone,
  initialPhoneLast4,
  onRevealed,
}: {
  propertyId?: string;
  brokerListingId?: string;
  listingType?: "owner" | "broker";
  initialRevealed?: boolean;
  initialName?: string | null;
  initialPhone?: string | null;
  initialPhoneLast4?: string | null;
  onRevealed?: () => void;
}) {
  const [state, setState] = useState<{
    revealed: boolean;
    name: string | null;
    phone: string | null;
    error: string | null;
  }>({
    revealed: initialRevealed || !!initialPhone,
    name: initialName ?? null,
    phone: initialPhone ?? null,
    error: null,
  });
  const [busy, setBusy] = useState(false);

  // If server hands us the decrypted number, we're already revealed — skip the button.
  useEffect(() => {
    if (initialPhone && !state.phone) {
      setState((s) => ({ ...s, revealed: true, phone: initialPhone! }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPhone]);

  async function reveal() {
    if (state.revealed || busy) return;
    setBusy(true);
    setState((s) => ({ ...s, error: null }));
    try {
      const res = await fetch("/api/broker/technoproperty/reveal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ propertyId, brokerListingId, listingType }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setState((s) => ({ ...s, error: (data && data.error) || "REVEAL_FAILED" }));
      } else {
        setState({ revealed: true, name: data.ownerName ?? initialName ?? null, phone: data.phone, error: null });
        onRevealed?.();
      }
    } catch {
      setState((s) => ({ ...s, error: "NETWORK" }));
    } finally {
      setBusy(false);
    }
  }

  // Auto-reveal on mount is NOT needed here because call-queue passes initialPhone
  // decrypted on the server (no extra click). Other pages pass no initialPhone and
  // continue to require an explicit click — the tradeoff is an audit trail per
  // reveal rather than silently logging every page view.

  if (state.error) {
    return (
      <button className="tp-contact-pill" onClick={reveal}>Retry</button>
    );
  }

  if (!state.revealed) {
    return (
      <button
        type="button"
        data-tp-action="reveal"
        className={`tp-contact-pill ${state.revealed ? "revealed" : ""}`}
        onClick={reveal}
        disabled={busy}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : null}
        {busy ? "Revealing…" : "Contact Details"}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1" data-tp-revealed="true">
      {state.name ? (
        <span className="text-sm font-semibold text-[var(--tp-ink)]">{state.name}</span>
      ) : null}
      <div className="flex items-center gap-2">
        {state.phone ? (
          <>
            <a
              href={`tel:${state.phone}`}
              data-tp-action="call"
              className="tp-contact-pill revealed"
            >
              <Phone size={12} /> {state.phone}
            </a>
            <a
              href={`https://wa.me/91${state.phone}?text=${encodeURIComponent("Hi, regarding your property on Techno Property…")}`}
              target="_blank"
              rel="noreferrer"
              data-tp-action="whatsapp"
              className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
              title="WhatsApp"
              aria-label="WhatsApp"
            >
              <MessageCircle size={14} />
            </a>
          </>
        ) : (
          <span className="text-xs text-[var(--tp-muted)]">
            ••••••{initialPhoneLast4 ?? "••••"}
          </span>
        )}
      </div>
    </div>
  );
}
