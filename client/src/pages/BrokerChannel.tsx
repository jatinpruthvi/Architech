"use client";
/* Broker channel — post what you need, offer what you have, and be matched.

   The screen is built around the listing anchor. An offer is not typed out; it
   is chosen from the agency's own live listings, and the counterparty's card
   links straight to that listing's public page so they judge real photos and
   RERA status rather than a retyped summary.

   Contact numbers appear only when the server sends one, which it does only
   after both sides accept. There is no client-side hiding to get wrong. */
import { BadgeCheck, Building2, Check, ExternalLink, Handshake, Inbox, Phone, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import useTitle from "@/hooks/useTitle";

type Offerable = {
  id: string;
  lifecycle: string;
  propertyType: string;
  priceInr: number;
  bhk: number | null;
  areaSqft: number | null;
  mediaCount: number;
  verification: string | null;
  cityId: string;
  localityId: string | null;
  offerable: boolean;
};

type ChannelRequest = {
  id: string;
  type: "DEMAND" | "SUPPLY";
  intent: "BUY" | "RENT";
  status: string;
  listingId: string | null;
  cityId: string;
  localityId: string | null;
  propertyType: string;
  budgetMinInr: number | null;
  budgetMaxInr: number | null;
  bhkMin: number | null;
  bhkMax: number | null;
  brokerNote: string | null;
  expiresAt: string;
  matchCount: number;
};

type MatchReason = { factor: string; weight: number; points: number; note: string };

type MatchView = {
  id: string;
  score: number;
  band: string;
  reasons: MatchReason[];
  side: "DEMAND" | "SUPPLY";
  viewState: string;
  viewLabel: string;
  listing: {
    id: string; propertyType: string; priceInr: number; bhk: number | null;
    areaSqft: number | null; mediaCount: number; verification: string | null; href: string;
  } | null;
  requirement: {
    budgetMinInr: number | null; budgetMaxInr: number | null; bhkMin: number | null;
    bhkMax: number | null; localityId: string | null; propertyType: string; brokerNote: string | null;
  } | null;
  contact: {
    organizationName: string;
    verificationStatus: string;
    businessPhoneMasked: string;
    businessPhoneE164?: string;
    telLink?: string;
    waMeLink?: string;
    connected: boolean;
  };
};

/** Indian money reads in lakh and crore; ₹11,000,000 does not. */
function formatInr(value: number | null): string {
  if (value == null) return "—";
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2).replace(/\.00$/, "")} Cr`;
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(2).replace(/\.00$/, "")} L`;
  return `₹${value.toLocaleString("en-IN")}`;
}

function budgetRange(min: number | null, max: number | null): string {
  if (min && max) return `${formatInr(min)} – ${formatInr(max)}`;
  if (max) return `up to ${formatInr(max)}`;
  if (min) return `${formatInr(min)}+`;
  return "Any budget";
}

function bhkRange(min: number | null, max: number | null): string {
  if (min && max) return min === max ? `${min} BHK` : `${min}–${max} BHK`;
  if (min) return `${min}+ BHK`;
  if (max) return `up to ${max} BHK`;
  return "Any size";
}

function ScoreBadge({ score, band }: { score: number; band: string }) {
  const tone = band === "STRONG" ? "text-ember bg-ember/10" : band === "GOOD" ? "text-brick bg-brick/10" : "ink-2 bg-sand";
  return <span className={`stamp-sm px-2 py-1 font-semibold ${tone}`}>{band.toLowerCase()} · {score}</span>;
}

function StatePill({ label, state }: { label: string; state: string }) {
  const tone = state === "CONNECTED" ? "text-trust bg-trust/10"
    : state === "AWAITING_YOU" ? "text-brick bg-brick/10"
    : state === "REJECTED" ? "ink-3 bg-sand" : "ink-2 bg-sand";
  return <span className={`stamp-sm px-2 py-1 font-semibold ${tone}`}>{label}</span>;
}

export default function BrokerChannel() {
  useTitle("Broker channel");
  const [requests, setRequests] = useState<ChannelRequest[]>([]);
  const [offerable, setOfferable] = useState<Offerable[]>([]);
  const [matches, setMatches] = useState<MatchView[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"matches" | "post">("matches");
  const [mode, setMode] = useState<"SUPPLY" | "DEMAND">("SUPPLY");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [requestsResponse, matchesResponse] = await Promise.all([
        /* Cost-audit P1.1: honour the endpoints' private 15 s cache TTL. */
        fetch("/api/broker/channel/requests"),
        fetch("/api/broker/channel/matches"),
      ]);
      const requestsPayload = await requestsResponse.json();
      const matchesPayload = await matchesResponse.json();
      setRequests(Array.isArray(requestsPayload.requests) ? requestsPayload.requests : []);
      setOfferable(Array.isArray(requestsPayload.offerable) ? requestsPayload.offerable : []);
      setMatches(Array.isArray(matchesPayload.matches) ? matchesPayload.matches : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const publish = async (body: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      const response = await fetch("/api/broker/channel/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        // Every gate failure is already a sentence naming the fix.
        toast(payload.errors?.[0] ?? "Could not publish.", {
          description: payload.errors?.length > 1 ? payload.errors.slice(1).join(" ") : undefined,
        });
        return;
      }
      const created = payload.matcher?.created ?? 0;
      toast(created > 0 ? `Published — ${created} match${created === 1 ? "" : "es"} found.` : "Published to the channel.", {
        description: created > 0 ? "Review them in Matches." : "You will be notified when a match appears.",
      });
      setTab("matches");
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const respond = async (matchId: string, action: "accept" | "reject") => {
    const response = await fetch(`/api/broker/channel/matches/${encodeURIComponent(matchId)}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      toast(payload.errors?.[0] ?? "Could not respond.");
      return;
    }
    setMatches((current) => current.map((m) => (m.id === matchId ? payload.match : m)));
    toast(
      payload.connected ? "Connected — contact details unlocked." : action === "accept" ? "Accepted." : "Declined.",
      {
        description: payload.connected
          ? "You can now call the counterparty directly."
          : action === "accept" ? "Waiting for the other agency to accept." : undefined,
      },
    );
  };

  const closeRequest = async (id: string) => {
    const response = await fetch(`/api/broker/channel/requests/${encodeURIComponent(id)}/close`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      toast(payload.errors?.[0] ?? "Could not withdraw.");
      return;
    }
    toast("Withdrawn from the channel.");
    await load();
  };

  const liveOfferable = useMemo(() => offerable.filter((l) => l.offerable), [offerable]);
  const blockedOfferable = useMemo(() => offerable.filter((l) => !l.offerable), [offerable]);
  const awaitingYou = matches.filter((m) => m.viewState === "AWAITING_YOU").length;

  return (
    <div className="bg-paper pt-[78px] text-ink">
      <section className="border-b border-ink/12 bg-sand/70 py-14 md:py-20">
        <div className="container">
          <p className="kicker text-brick">Broker operations · Channel</p>
          <h1 className="display mt-6 max-w-[820px] text-[clamp(40px,6vw,80px)]">
            Trade inventory with brokers who <em className="text-brick">actually have the buyer</em>.
          </h1>
          <p className="mt-6 max-w-[620px] text-base leading-8 ink-2">
            Offer a live listing or post what your buyer needs. Matches are scored against real inventory —
            photos, RERA status and locality — and contact is exchanged only when both agencies accept.
          </p>
        </div>
      </section>

      <section className="container py-14 md:py-20">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/12 pb-4">
          <div className="flex gap-6">
            {([["matches", `Matches${awaitingYou ? ` · ${awaitingYou}` : ""}`], ["post", "Post to channel"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`stamp font-semibold ${tab === key ? "text-brick underline underline-offset-8" : "ink-3 hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => void load()} className="stamp font-semibold text-brick underline underline-offset-4">
            Refresh
          </button>
        </div>

        {loading && <p className="mt-8 text-sm ink-2">Loading the channel…</p>}

        {!loading && tab === "matches" && (
          <MatchList matches={matches} onRespond={respond} />
        )}

        {!loading && tab === "post" && (
          <PostPanel
            mode={mode}
            setMode={setMode}
            offerable={liveOfferable}
            blocked={blockedOfferable}
            submitting={submitting}
            onPublish={publish}
          />
        )}

        {!loading && (
          <MyRequests requests={requests} onClose={closeRequest} />
        )}
      </section>
    </div>
  );
}

function MatchList({ matches, onRespond }: { matches: MatchView[]; onRespond: (id: string, action: "accept" | "reject") => Promise<void> }) {
  if (matches.length === 0) {
    return (
      <div className="mt-10 border border-ink/15 bg-card p-10 text-center">
        <Inbox size={28} className="mx-auto ink-3" />
        <p className="mt-4 font-display text-xl font-medium">No matches yet</p>
        <p className="mt-2 text-sm ink-2">Post a requirement or offer a listing, and matches will appear here.</p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      {matches.map((match) => (
        <article key={match.id} className="border border-ink/15 bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="stamp-sm ink-3">
                {match.side === "DEMAND" ? "A listing for your requirement" : "A buyer for your listing"}
              </p>
              <p className="mt-1 font-display text-lg font-medium leading-tight">{match.contact.organizationName}</p>
            </div>
            <div className="flex items-center gap-2">
              <ScoreBadge score={match.score} band={match.band} />
              <StatePill label={match.viewLabel} state={match.viewState} />
            </div>
          </div>

          {match.listing && (
            <div className="mt-5 border-l-2 border-brick pl-4">
              <p className="stamp-sm ink-3 flex items-center gap-1.5"><Building2 size={11} /> The listing</p>
              <p className="mt-1 text-sm text-foreground">
                {match.listing.bhk ? `${match.listing.bhk} BHK · ` : ""}
                {match.listing.propertyType.toLowerCase()} · {formatInr(match.listing.priceInr)}
                {match.listing.areaSqft ? ` · ${match.listing.areaSqft.toLocaleString("en-IN")} sq ft` : ""}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {match.listing.verification && (
                  <span className="stamp-sm text-trust flex items-center gap-1"><BadgeCheck size={11} /> {match.listing.verification.replace(/_/g, " ").toLowerCase()}</span>
                )}
                <span className="stamp-sm ink-3">{match.listing.mediaCount} photo{match.listing.mediaCount === 1 ? "" : "s"}</span>
                {/* The anchor: judge the real listing, not a retyped summary. */}
                <a href={match.listing.href} target="_blank" rel="noreferrer"
                   className="stamp-sm font-semibold text-brick underline underline-offset-4 flex items-center gap-1">
                  Open the listing <ExternalLink size={10} />
                </a>
              </div>
            </div>
          )}

          {match.requirement && (
            <div className="mt-5 border-l-2 border-brick pl-4">
              <p className="stamp-sm ink-3 flex items-center gap-1.5"><Search size={11} /> What they need</p>
              <p className="mt-1 text-sm text-foreground">
                {bhkRange(match.requirement.bhkMin, match.requirement.bhkMax)} ·{" "}
                {match.requirement.propertyType.toLowerCase()} ·{" "}
                {budgetRange(match.requirement.budgetMinInr, match.requirement.budgetMaxInr)}
              </p>
              {match.requirement.brokerNote && (
                <p className="mt-2 text-sm leading-6 ink-2">{match.requirement.brokerNote}</p>
              )}
            </div>
          )}

          {match.reasons.length > 0 && (
            <div className="mt-5">
              <p className="stamp-sm ink-3">Why this scored {match.score}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {match.reasons.map((reason) => (
                  <span key={reason.factor} className="stamp-sm border border-ink/15 px-2 py-1 ink-2">
                    {reason.note} · {reason.points}/{reason.weight}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 border-t border-ink/12 pt-5">
            <p className="stamp-sm ink-3 flex items-center gap-1.5"><Phone size={11} /> Contact</p>
            {match.contact.connected && match.contact.businessPhoneE164 ? (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="font-mono text-sm text-foreground">{match.contact.businessPhoneE164}</span>
                {match.contact.telLink && (
                  <a href={match.contact.telLink} className="stamp-sm font-semibold text-brick underline underline-offset-4">Call</a>
                )}
                {match.contact.waMeLink && (
                  <a href={match.contact.waMeLink} target="_blank" rel="noreferrer"
                     className="stamp-sm font-semibold text-brick underline underline-offset-4">WhatsApp</a>
                )}
              </div>
            ) : (
              <p className="mt-2 font-mono text-sm ink-2">
                {match.contact.businessPhoneMasked}
                <span className="ml-2 font-sans text-xs ink-3">— unlocked when both agencies accept</span>
              </p>
            )}
          </div>

          {match.viewState === "AWAITING_YOU" && (
            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={() => void onRespond(match.id, "accept")}
                      className="btn-sweep btn-solid touch-44 px-4 py-2 stamp-sm font-semibold text-cream">
                <span className="flex items-center gap-2"><Handshake size={12} /> Accept and share contact</span>
              </button>
              <button onClick={() => void onRespond(match.id, "reject")}
                      className="touch-44 inline-flex items-center gap-1.5 px-3 py-2 stamp-sm font-semibold ink-2 hover:text-brick">
                <X size={12} /> Decline
              </button>
            </div>
          )}
          {match.viewState === "AWAITING_THEM" && (
            <p className="mt-5 stamp-sm ink-3 flex items-center gap-1.5">
              <Check size={12} /> You accepted. Waiting for the other agency.
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

function PostPanel({
  mode, setMode, offerable, blocked, submitting, onPublish,
}: {
  mode: "SUPPLY" | "DEMAND";
  setMode: (mode: "SUPPLY" | "DEMAND") => void;
  offerable: Offerable[];
  blocked: Offerable[];
  submitting: boolean;
  onPublish: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [listingId, setListingId] = useState("");
  const [intent, setIntent] = useState<"BUY" | "RENT">("BUY");
  const [note, setNote] = useState("");
  const [cityId, setCityId] = useState("ahmedabad");
  const [localityId, setLocalityId] = useState("");
  const [propertyType, setPropertyType] = useState("APARTMENT");
  const [budgetMaxInr, setBudgetMaxInr] = useState("");
  const [budgetMinInr, setBudgetMinInr] = useState("");
  const [bhkMin, setBhkMin] = useState("");
  const [bhkMax, setBhkMax] = useState("");

  const field = "mt-1 w-full border border-ink/20 bg-paper px-3 py-2 text-sm text-ink focus:border-brick focus:outline-none";
  const label = "stamp-sm ink-3";

  return (
    <div className="mt-8 border border-ink/15 bg-card p-6">
      <div className="flex gap-3">
        {([["SUPPLY", "I have a property"], ["DEMAND", "I have a buyer"]] as const).map(([key, text]) => (
          <button key={key} onClick={() => setMode(key)}
                  className={`touch-44 px-4 py-2 stamp-sm font-semibold ${mode === key ? "bg-night text-cream" : "border border-ink/20 ink-2"}`}>
            {text}
          </button>
        ))}
      </div>

      {mode === "SUPPLY" ? (
        <div className="mt-6 space-y-4">
          <p className="text-sm leading-6 ink-2">
            Choose one of your live listings. The counterparty sees its real photos and verification,
            which is what makes the match worth acting on.
          </p>
          <div>
            <label className="block">
              <span className={label}>Listing</span>
              <select value={listingId} onChange={(event) => setListingId(event.target.value)} className={field}>
              <option value="">Select a listing…</option>
              {offerable.map((listing) => (
              <option key={listing.id} value={listing.id}>
              {listing.bhk ? `${listing.bhk} BHK · ` : ""}{listing.propertyType.toLowerCase()} · {formatInr(listing.priceInr)} · {listing.mediaCount} photos
              </option>
              ))}
              </select>
            </label>
            {offerable.length === 0 && (
              <p className="mt-2 text-xs ink-2">
                You have no listings ready to offer. A listing must be live with at least one photo.
              </p>
            )}
            {blocked.length > 0 && (
              // Naming why a listing is unavailable beats it silently missing.
              <p className="mt-2 text-xs ink-3">
                {blocked.length} listing{blocked.length === 1 ? " is" : "s are"} not offerable yet — publish them and add a photo first.
              </p>
            )}
          </div>
          <div>
            <label className="block">
              <span className={label}>Intent</span>
              <select value={intent} onChange={(event) => setIntent(event.target.value as "BUY" | "RENT")} className={field}>
              <option value="BUY">For sale</option>
              <option value="RENT">For rent</option>
              </select>
            </label>
          </div>
          <NoteField note={note} setNote={setNote} field={field} label={label} />
          <button
            disabled={submitting || !listingId}
            onClick={() => void onPublish({ type: "SUPPLY", listingId, intent, brokerNote: note })}
            className="btn-sweep btn-solid touch-44 px-5 py-2.5 stamp-sm font-semibold text-cream disabled:cursor-not-allowed disabled:opacity-50"
          >
            Offer on the channel
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <p className="text-sm leading-6 ink-2">
            Describe what your buyer wants. Never include their name or number — the note is screened,
            and contact is exchanged between agencies only.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block">
                <span className={label}>City</span>
                <input value={cityId} onChange={(event) => setCityId(event.target.value)} className={field} placeholder="ahmedabad" />
              </label>
            </div>
            <div>
              <label className="block">
                <span className={label}>Locality (optional)</span>
                <input value={localityId} onChange={(event) => setLocalityId(event.target.value)} className={field} placeholder="thaltej" />
              </label>
            </div>
            <div>
              <label className="block">
                <span className={label}>Property type</span>
                <select value={propertyType} onChange={(event) => setPropertyType(event.target.value)} className={field}>
                  {["APARTMENT", "VILLA", "ROWHOUSE", "PENTHOUSE", "PLOT"].map((type) => (
                    <option key={type} value={type}>{type.toLowerCase()}</option>
                  ))}
                </select>
              </label>
            </div>
            <div>
              <label className="block">
                <span className={label}>Intent</span>
                <select value={intent} onChange={(event) => setIntent(event.target.value as "BUY" | "RENT")} className={field}>
                  <option value="BUY">Looking to buy</option>
                  <option value="RENT">Looking to rent</option>
                </select>
              </label>
            </div>
            <div>
              <label className="block">
                <span className={label}>Budget from (₹)</span>
                <input value={budgetMinInr} onChange={(event) => setBudgetMinInr(event.target.value)} className={field} inputMode="numeric" placeholder="8000000" />
              </label>
            </div>
            <div>
              <label className="block">
                <span className={label}>Budget up to (₹)</span>
                <input value={budgetMaxInr} onChange={(event) => setBudgetMaxInr(event.target.value)} className={field} inputMode="numeric" placeholder="12000000" />
              </label>
            </div>
            <div>
              <label className="block">
                <span className={label}>BHK from</span>
                <input value={bhkMin} onChange={(event) => setBhkMin(event.target.value)} className={field} inputMode="numeric" placeholder="3" />
              </label>
            </div>
            <div>
              <label className="block">
                <span className={label}>BHK up to</span>
                <input value={bhkMax} onChange={(event) => setBhkMax(event.target.value)} className={field} inputMode="numeric" placeholder="3" />
              </label>
            </div>
          </div>
          <NoteField note={note} setNote={setNote} field={field} label={label} />
          <button
            disabled={submitting || !budgetMaxInr}
            onClick={() => void onPublish({
              type: "DEMAND", intent, cityId, localityId, propertyType,
              budgetMinInr, budgetMaxInr, bhkMin, bhkMax, brokerNote: note,
            })}
            className="btn-sweep btn-solid touch-44 px-5 py-2.5 stamp-sm font-semibold text-cream disabled:cursor-not-allowed disabled:opacity-50"
          >
            Post the requirement
          </button>
        </div>
      )}
    </div>
  );
}

function NoteField({ note, setNote, field, label }: { note: string; setNote: (v: string) => void; field: string; label: string }) {
  return (
    <div>
      <label className="block">
        <span className={label}>Note to other brokers (optional)</span>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={500} className={field}
        placeholder="Ready to move, loan pre-approved, flexible on possession date" />
      </label>
      <p className="mt-1 text-xs ink-3">
        {note.length}/500 · No phone numbers, emails or customer names.
      </p>
    </div>
  );
}

function MyRequests({ requests, onClose }: { requests: ChannelRequest[]; onClose: (id: string) => Promise<void> }) {
  if (requests.length === 0) return null;
  const live = requests.filter((r) => r.status === "OPEN" || r.status === "MATCHED");

  return (
    <div className="mt-14">
      <h2 className="font-display text-2xl font-medium tracking-[-0.02em]">
        Your channel posts <span className="text-brick">{live.length}</span>
      </h2>
      <div className="mt-6 space-y-3">
        {requests.map((request) => (
          <div key={request.id} className="flex flex-wrap items-center justify-between gap-4 border border-ink/15 bg-card px-5 py-4">
            <div>
              <p className="stamp-sm ink-3">
                {request.type === "SUPPLY" ? "Offering" : "Requirement"} · {request.intent.toLowerCase()} · {request.status.toLowerCase()}
              </p>
              <p className="mt-1 text-sm text-foreground">
                {request.type === "SUPPLY"
                  ? `Listing ${request.listingId}`
                  : `${bhkRange(request.bhkMin, request.bhkMax)} · ${request.propertyType.toLowerCase()} · ${budgetRange(request.budgetMinInr, request.budgetMaxInr)}`}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="stamp-sm ink-3">
                {request.matchCount} match{request.matchCount === 1 ? "" : "es"}
              </span>
              {(request.status === "OPEN" || request.status === "MATCHED") && (
                <button onClick={() => void onClose(request.id)}
                        className="stamp-sm font-semibold ink-2 underline underline-offset-4 hover:text-brick">
                  Withdraw
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
