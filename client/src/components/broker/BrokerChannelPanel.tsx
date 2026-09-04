"use client";

import Link from "next/link";
import { Archive, ArrowUpRight, Inbox, PhoneCall, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { ListingDraft } from "@/lib/broker/workflow";

function ChannelDeskRule({ label, detail, tone = "brick" }: { label: string; detail?: string; tone?: "brick" | "trust" }) {
  return <div className={`desk-rule desk-rule-${tone}`}><span className="kicker">{label}</span>{detail ? <span className="stamp desk-rule-detail">{detail}</span> : null}</div>;
}

function ChannelEmptyState({ title, body, action, href }: { title: string; body: string; action?: string; href?: string }) {
  return <div className="desk-empty border border-dashed border-ink/20 bg-sand/45 p-8 md:p-10"><div className="flex items-start gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-t-full bg-brick/10 text-brick"><Archive size={19} /></span><div><p className="stamp text-brick">No live records · source gate</p><h3 className="mt-2 font-display text-2xl font-medium tracking-[-0.02em]">{title}</h3><p className="mt-2 max-w-xl text-sm leading-6 ink-2">{body}</p>{action && href ? <Link href={href} className="mt-5 inline-flex items-center gap-2 stamp font-semibold text-brick">{action}<ArrowUpRight size={13} /></Link> : null}</div></div></div>;
}

function ChannelLedgerIntro({ label, detail, body }: { label: string; detail: string; body: string }) {
  return <div className="desk-ledger-intro border-l-2 border-brick pl-5"><ChannelDeskRule label={label} detail={detail} /><p className="mt-3 max-w-2xl text-sm leading-6 ink-2">{body}</p></div>;
}

type BrokerChannelDashboard = { openRequests: number; suggestedMatches: number; activeDeals: number; closedDeals: number; commissionTotalInr: number; erpnextPendingWrites: number; unreadNotifications?: number };
type BrokerChannelRequestRow = { id: string; type: string; status: string; localitySlug: string | null; detailSummary: string; sourceListingId?: string | null; sourceRequirementId?: string | null; expiresAt?: string | null; createdAt?: string | null };
type BrokerChannelRequirementRow = { id: string; citySlug: string; localitySlugs: string[]; propertyType?: string; bhkMin?: number | null; bhkMax?: number | null; areaMinSqft?: number | null; areaMaxSqft?: number | null; budgetMinInr?: number | null; budgetMaxInr?: number | null; createdAt: string };
type BrokerChannelMatchReason = { factor: string; weight: number; points: number; note: string };
type BrokerChannelMatchRow = { id: string; score: number; status: string; reasons?: BrokerChannelMatchReason[]; counterpartyBroker?: { organizationName?: string; businessPhoneMasked?: string | null; waMeLink?: string | null }; counterpartyRequest?: { type?: string; localitySlug?: string | null; detailSummary?: string } };
type BrokerChannelDealRow = { id: string; status: string; closeMode: string; totalCommissionInr: number | null; demandBrokerShareInr: number | null; supplyBrokerShareInr: number | null; erpnextSyncStatus?: string; closedAt?: string | null };
type BrokerChannelNotificationRow = { id: string; title: string; body: string; eventType: string; entityType: string; entityId: string; readAt: string | null; createdAt: string };
type BrokerChannelTab = "publish" | "matches" | "deals" | "notifications" | "maintenance";
type BrokerChannelSplitDraft = { totalCommissionInr: string; demandBrokerShareInr: string; supplyBrokerShareInr: string; closeMode: "DUAL" | "SINGLE" };

function formatInr(value: number | null | undefined) {
  return typeof value === "number" ? `₹${value.toLocaleString("en-IN")}` : "—";
}

function formatDateLabel(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function relativeTime(value?: string | null) {
  if (!value) return "just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "just now";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

function splitIsValid(split: BrokerChannelSplitDraft) {
  const total = Number(split.totalCommissionInr || 0);
  const demand = Number(split.demandBrokerShareInr || 0);
  const supply = Number(split.supplyBrokerShareInr || 0);
  return total > 0 && demand >= 0 && supply >= 0 && demand + supply === total;
}

export function BrokerChannelPanel({ drafts }: { drafts: ListingDraft[] }) {
  const usableListings = drafts.filter((draft) => !["ARCHIVED", "REJECTED", "DUPLICATE"].includes(draft.status));
  const [dashboard, setDashboard] = useState<BrokerChannelDashboard | null>(null);
  const [requests, setRequests] = useState<BrokerChannelRequestRow[]>([]);
  const [matches, setMatches] = useState<BrokerChannelMatchRow[]>([]);
  const [requirements, setRequirements] = useState<BrokerChannelRequirementRow[]>([]);
  const [deals, setDeals] = useState<BrokerChannelDealRow[]>([]);
  const [notifications, setNotifications] = useState<BrokerChannelNotificationRow[]>([]);
  const [splitDrafts, setSplitDrafts] = useState<Record<string, BrokerChannelSplitDraft>>({});
  const [draftType, setDraftType] = useState<"DEMAND" | "SUPPLY">("SUPPLY");
  const [activeTab, setActiveTab] = useState<BrokerChannelTab>("publish");
  const [requestFilter, setRequestFilter] = useState<"ALL" | "DRAFT" | "OPEN" | "EXPIRED">("ALL");
  const [notificationFilter, setNotificationFilter] = useState<"ALL" | "UNREAD">("ALL");
  const [formMessage, setFormMessage] = useState("");
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const loadChannel = useCallback(async () => {
    try {
      const [dashResponse, requestResponse, matchResponse, requirementResponse, dealResponse, notificationResponse] = await Promise.all([
        fetch("/api/broker/channel/dashboard", { cache: "no-store" }),
        fetch("/api/broker/channel/requests", { cache: "no-store" }),
        fetch("/api/broker/channel/matches", { cache: "no-store" }),
        fetch("/api/broker/channel/requirements", { cache: "no-store" }),
        fetch("/api/broker/channel/deals", { cache: "no-store" }),
        fetch("/api/broker/channel/notifications", { cache: "no-store" }),
      ]);
      const [dashPayload, requestPayload, matchPayload, requirementPayload, dealPayload, notificationPayload] = await Promise.all([dashResponse.json(), requestResponse.json(), matchResponse.json(), requirementResponse.json(), dealResponse.json(), notificationResponse.json()]);
      setDashboard(dashPayload.dashboard ?? null);
      setRequests(Array.isArray(requestPayload.requests) ? requestPayload.requests : []);
      setMatches(Array.isArray(matchPayload.matches) ? matchPayload.matches : []);
      setRequirements(Array.isArray(requirementPayload.requirements) ? requirementPayload.requirements : []);
      setDeals(Array.isArray(dealPayload.deals) ? dealPayload.deals : []);
      setNotifications(Array.isArray(notificationPayload.notifications) ? notificationPayload.notifications : []);
    } catch {
      setDashboard(null);
      setRequests([]);
      setMatches([]);
      setRequirements([]);
      setDeals([]);
      setNotifications([]);
    }
  }, []);

  useEffect(() => { void loadChannel(); }, [loadChannel]);

  const submitChannelDraft = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const selectedType = String(form.get("requestType") || draftType) === "DEMAND" ? "DEMAND" : "SUPPLY";
    setDraftType(selectedType);
    const sourceListingId = String(form.get("sourceListingId") || "");
    if (selectedType === "SUPPLY" && !sourceListingId) {
      setFormMessage("Create a listing first, then choose it to generate a broker-channel supply request.");
      return;
    }
    if (selectedType === "DEMAND") {
      const areaMin = Number(form.get("areaMinSqft") || 0);
      const areaMax = Number(form.get("areaMaxSqft") || 0);
      const budgetMin = Number(form.get("budgetMinInr") || 0);
      const budgetMax = Number(form.get("budgetMaxInr") || 0);
      if (!areaMin || !areaMax || areaMax < areaMin) {
        setFormMessage("Enter a valid area range before saving requirement-backed demand.");
        return;
      }
      if (!budgetMin || !budgetMax || budgetMax < budgetMin) {
        setFormMessage("Enter a valid budget range before saving requirement-backed demand.");
        return;
      }
    }
    setActiveAction("save-draft");
    let body: Record<string, unknown> = selectedType === "SUPPLY" ? { type: "SUPPLY", sourceListingId, intent: String(form.get("intent") || "BUY"), cityId: "listing", propertyType: "listing", detailSummary: String(form.get("detailSummary") || "") } : {};
    try {
      if (selectedType === "DEMAND") {
        const requirementResponse = await fetch("/api/broker/channel/requirements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intent: String(form.get("intent") || "BUY").toLowerCase(), citySlug: String(form.get("cityId") || "ahmedabad"), category: "residential", subtype: String(form.get("propertyType") || "APARTMENT"), propertyType: String(form.get("propertyType") || "APARTMENT"), localitySlugs: [String(form.get("localitySlug") || "").trim()].filter(Boolean), role: "buyer", name: String(form.get("buyerName") || "Broker buyer"), phone: String(form.get("buyerPhone") || ""), consentText: "Buyer consent recorded by broker for Architech requirement and broker-channel matching.", bhkMin: Number(form.get("bhkMin") || 0) || null, bhkMax: Number(form.get("bhkMax") || 0) || null, areaMinSqft: Number(form.get("areaMinSqft") || 0), areaMaxSqft: Number(form.get("areaMaxSqft") || 0), budgetMinInr: Number(form.get("budgetMinInr") || 0), budgetMaxInr: Number(form.get("budgetMaxInr") || 0) }) });
        const requirementPayload = await requirementResponse.json().catch(() => ({}));
        if (!requirementResponse.ok || !requirementPayload.ok) { setFormMessage(requirementPayload.errors?.[0] ?? "Could not save buyer requirement."); return; }
        body = { type: "DEMAND", sourceRequirementId: requirementPayload.requirement.id, cityId: "requirement", intent: String(form.get("intent") || "BUY"), propertyType: "requirement", detailSummary: String(form.get("detailSummary") || "") };
      }
      const response = await fetch("/api/broker/channel/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => ({}));
      setFormMessage(response.ok ? (selectedType === "SUPPLY" ? "Listing-backed supply request saved. Publish it to run matching." : "Requirement-backed demand saved. Publish it to run matching.") : (payload.errors?.[0] ?? "Could not save channel draft."));
      if (response.ok) { formElement.reset(); await loadChannel(); }
    } finally {
      setActiveAction(null);
    }
  }, [draftType, loadChannel]);

  const publishRequest = useCallback(async (id: string) => {
    setActiveAction(`publish-${id}`);
    try {
      const response = await fetch(`/api/broker/channel/requests/${encodeURIComponent(id)}/publish`, { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      setFormMessage(response.ok ? `Published. ${payload.matches?.length ?? 0} top matches found.` : (payload.errors?.[0] ?? "Could not publish request."));
      await loadChannel();
      if (response.ok) setActiveTab("matches");
    } finally {
      setActiveAction(null);
    }
  }, [loadChannel]);

  const decideMatch = useCallback(async (id: string, action: "accept" | "reject") => {
    setActiveAction(`${action}-${id}`);
    try {
      const response = await fetch(`/api/broker/channel/matches/${encodeURIComponent(id)}/${action}`, { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      setFormMessage(response.ok ? `Match ${action}ed.` : (payload.errors?.[0] ?? `Could not ${action} match.`));
      await loadChannel();
      if (response.ok && action === "accept") setActiveTab("deals");
    } finally {
      setActiveAction(null);
    }
  }, [loadChannel]);

  const dealAction = useCallback(async (id: string, action: "confirm" | "close" | "cancel") => {
    setActiveAction(`${action}-${id}`);
    try {
      const response = await fetch(`/api/broker/channel/deals/${encodeURIComponent(id)}/${action}`, { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      setFormMessage(response.ok ? `Deal ${action} saved.` : (payload.errors?.[0] ?? `Could not ${action} deal.`));
      await loadChannel();
    } finally {
      setActiveAction(null);
    }
  }, [loadChannel]);

  const saveSplit = useCallback(async (deal: BrokerChannelDealRow) => {
    const draft = splitDrafts[deal.id] ?? { totalCommissionInr: "", demandBrokerShareInr: "", supplyBrokerShareInr: "", closeMode: "DUAL" as const };
    if (!splitIsValid(draft)) {
      setFormMessage("Demand and supply shares must equal the total commission before saving.");
      return;
    }
    setActiveAction(`split-${deal.id}`);
    try {
      const response = await fetch(`/api/broker/channel/deals/${encodeURIComponent(deal.id)}/split`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ totalCommissionInr: Number(draft.totalCommissionInr || 0), demandBrokerShareInr: Number(draft.demandBrokerShareInr || 0), supplyBrokerShareInr: Number(draft.supplyBrokerShareInr || 0), closeMode: draft.closeMode }) });
      const payload = await response.json().catch(() => ({}));
      setFormMessage(response.ok ? "Commission split saved." : (payload.errors?.[0] ?? "Could not save split."));
      await loadChannel();
    } finally {
      setActiveAction(null);
    }
  }, [loadChannel, splitDrafts]);

  const markRead = useCallback(async (id: string) => {
    setActiveAction(`read-${id}`);
    try {
      await fetch(`/api/broker/channel/notifications/${encodeURIComponent(id)}/read`, { method: "POST" });
      await loadChannel();
    } finally {
      setActiveAction(null);
    }
  }, [loadChannel]);

  const markAllRead = useCallback(async () => {
    const unread = notifications.filter((item) => !item.readAt);
    setActiveAction("read-all");
    try {
      await Promise.all(unread.map((item) => fetch(`/api/broker/channel/notifications/${encodeURIComponent(item.id)}/read`, { method: "POST" })));
      setFormMessage(`Marked ${unread.length} notifications read.`);
      await loadChannel();
    } finally {
      setActiveAction(null);
    }
  }, [loadChannel, notifications]);

  const runMaintenance = useCallback(async (action: "expire" | "sync") => {
    setActiveAction(action);
    try {
      const path = action === "expire" ? "/api/broker/channel/maintenance/expire" : "/api/broker/channel/erpnext/sync";
      const response = await fetch(path, { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      setFormMessage(response.ok ? (action === "expire" ? `Expired ${payload.expired ?? 0} requests.` : `ERPNext sync processed ${payload.processed ?? 0} writes.`) : (payload.errors?.[0] ?? "Maintenance action failed."));
      await loadChannel();
    } finally {
      setActiveAction(null);
    }
  }, [loadChannel]);

  const cards = [["Saved requirements", requirements.length, "Buyer briefs with budget, BHK, and area ranges"], ["Open requests", dashboard?.openRequests ?? 0, "Sanitized listing/requirement-backed exchange"], ["Top matches", dashboard?.suggestedMatches ?? 0, "Best 10 pairs by deterministic score"], ["Active deals", dashboard?.activeDeals ?? 0, "Accepted matches in commission workflow"], ["Unread", dashboard?.unreadNotifications ?? notifications.filter((item) => !item.readAt).length, "In-app channel notifications"]] as const;
  const filteredRequests = requestFilter === "ALL" ? requests : requests.filter((request) => request.status === requestFilter);
  const visibleNotifications = notificationFilter === "ALL" ? notifications : notifications.filter((item) => !item.readAt);
  const tabs: Array<{ id: BrokerChannelTab; label: string; count?: number }> = [
    { id: "publish", label: "Publish", count: requests.filter((request) => request.status === "DRAFT").length },
    { id: "matches", label: "Matches", count: matches.length },
    { id: "deals", label: "Deals", count: deals.length },
    { id: "notifications", label: "Notifications", count: notifications.filter((item) => !item.readAt).length },
    { id: "maintenance", label: "Maintenance", count: dashboard?.erpnextPendingWrites ?? 0 },
  ];

  return <>
    <ChannelLedgerIntro label="Privacy-preserving exchange" detail="CHANNEL / 05" body="Supply comes from listings and demand comes from buyer requirements. The channel shows top matching, deal controls, notifications, and ERPNext sync without exposing customer PII." />
    <div className="mt-6 grid gap-3 md:grid-cols-5">{cards.map(([label, value, caption]) => <article key={label} className="border border-ink/12 bg-card p-5"><p className="stamp ink-3">{label}</p><p className="mt-5 index-num text-4xl text-brick">{value}</p><p className="mt-2 text-xs leading-5 ink-3">{caption}</p></article>)}</div>
    <div className="mt-6 flex flex-wrap gap-2 border-b border-ink/12 pb-3" role="tablist" aria-label="Broker channel workflow">{tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className={`touch-44 border px-4 py-3 stamp font-semibold ${activeTab === tab.id ? "border-brick bg-brick text-cream" : "border-ink/12 bg-card ink-2 hover:border-brick/40"}`}>{tab.label}{typeof tab.count === "number" ? <span className="ml-2 rounded-full bg-paper/20 px-2 py-0.5">{tab.count}</span> : null}</button>)}</div>
    {formMessage ? <p aria-live="polite" className="mt-4 border border-ink/12 bg-sand/50 p-3 text-sm ink-2">{formMessage}</p> : null}

    {activeTab === "publish" ? <section className="mt-7 space-y-6">
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <form onSubmit={submitChannelDraft} className={`border p-5 ${draftType === "SUPPLY" ? "border-brick/30 bg-card" : "border-ink/12 bg-card"}`}>
          <div className="flex items-start justify-between gap-4"><div><ChannelDeskRule label="Listing-backed supply" detail="SOURCE / LISTING" /><h2 className="mt-3 font-display text-2xl">Publish supply from an existing listing</h2><p className="mt-2 text-sm leading-6 ink-2">Listing facts remain the source of truth and are refreshed before matching.</p></div><button type="button" onClick={() => setDraftType("SUPPLY")} className="border border-ink/15 px-3 py-2 stamp font-semibold ink-2">Use supply</button></div>
          <input type="hidden" name="requestType" value="SUPPLY" /><input type="hidden" name="intent" value="BUY" />
          <label className="mt-5 block stamp ink-3">Source listing<select name="sourceListingId" className="mt-2 h-11 w-full border border-ink/12 bg-paper px-3 font-sans text-sm normal-case"><option value="">Choose an existing listing</option>{usableListings.map((draft) => <option key={draft.id} value={draft.stableId}>{draft.title} · {draft.localitySlug} · {formatInr(draft.priceInr)}</option>)}</select></label>
          <label className="mt-4 block stamp ink-3">Sanitized note<input name="detailSummary" placeholder="Example: Ready possession family apartment, no contact details" className="mt-2 h-11 w-full border border-ink/12 bg-paper px-3 font-sans text-sm normal-case" /></label>
          <div className="mt-5 flex flex-wrap items-center gap-3"><button disabled={activeAction === "save-draft"} className="btn-sweep min-h-11 px-4 stamp font-semibold text-cream disabled:opacity-55">{activeAction === "save-draft" && draftType === "SUPPLY" ? "Saving..." : "Save supply draft"}</button><Link href="/broker/listings/new" className="border border-brick/30 px-3 py-3 stamp font-semibold text-brick">Create listing</Link></div>
        </form>

        <form onSubmit={submitChannelDraft} className={`border p-5 ${draftType === "DEMAND" ? "border-brick/30 bg-card" : "border-ink/12 bg-card"}`}>
          <div className="flex items-start justify-between gap-4"><div><ChannelDeskRule label="Requirement-backed demand" detail="SOURCE / REQUIREMENT" /><h2 className="mt-3 font-display text-2xl">Save requirement and publish demand</h2><p className="mt-2 text-sm leading-6 ink-2">Buyer contact is saved privately. Only sanitized demand facts enter the broker channel.</p></div><button type="button" onClick={() => setDraftType("DEMAND")} className="border border-ink/15 px-3 py-2 stamp font-semibold ink-2">Use demand</button></div>
          <input type="hidden" name="requestType" value="DEMAND" /><div className="mt-5 grid gap-3 md:grid-cols-2"><label className="stamp ink-3">Intent<select name="intent" className="mt-2 h-11 w-full border border-ink/12 bg-paper px-3 font-sans text-sm normal-case"><option value="BUY">Buy</option><option value="RENT">Rent</option></select></label><label className="stamp ink-3">City<input name="cityId" defaultValue="ahmedabad" className="mt-2 h-11 w-full border border-ink/12 bg-paper px-3 font-sans text-sm normal-case" /></label><label className="stamp ink-3 md:col-span-2">Locality<input name="localitySlug" placeholder="thaltej" className="mt-2 h-11 w-full border border-ink/12 bg-paper px-3 font-sans text-sm normal-case" /></label><label className="stamp ink-3">Property<select name="propertyType" className="mt-2 h-11 w-full border border-ink/12 bg-paper px-3 font-sans text-sm normal-case"><option value="APARTMENT">Apartment</option><option value="VILLA">Villa</option><option value="ROWHOUSE">Rowhouse</option><option value="PLOT">Plot</option></select></label><label className="stamp ink-3">Buyer name<input name="buyerName" className="mt-2 h-11 w-full border border-ink/12 bg-paper px-3 font-sans text-sm normal-case" /></label><label className="stamp ink-3">Buyer phone<input name="buyerPhone" inputMode="tel" className="mt-2 h-11 w-full border border-ink/12 bg-paper px-3 font-sans text-sm normal-case" /></label><label className="stamp ink-3">BHK min<input name="bhkMin" inputMode="numeric" className="mt-2 h-11 w-full border border-ink/12 bg-paper px-3 font-sans text-sm normal-case" /></label><label className="stamp ink-3">BHK max<input name="bhkMax" inputMode="numeric" className="mt-2 h-11 w-full border border-ink/12 bg-paper px-3 font-sans text-sm normal-case" /></label><label className="stamp ink-3">Area min, sqft<input name="areaMinSqft" inputMode="numeric" className="mt-2 h-11 w-full border border-ink/12 bg-paper px-3 font-sans text-sm normal-case" /></label><label className="stamp ink-3">Area max, sqft<input name="areaMaxSqft" inputMode="numeric" className="mt-2 h-11 w-full border border-ink/12 bg-paper px-3 font-sans text-sm normal-case" /></label><label className="stamp ink-3">Budget min, ₹<input name="budgetMinInr" inputMode="numeric" className="mt-2 h-11 w-full border border-ink/12 bg-paper px-3 font-sans text-sm normal-case" /></label><label className="stamp ink-3">Budget max, ₹<input name="budgetMaxInr" inputMode="numeric" className="mt-2 h-11 w-full border border-ink/12 bg-paper px-3 font-sans text-sm normal-case" /></label><label className="stamp ink-3 md:col-span-2">Sanitized note<input name="detailSummary" placeholder="No customer phone, email, raw address, or identifying text" className="mt-2 h-11 w-full border border-ink/12 bg-paper px-3 font-sans text-sm normal-case" /></label></div>
          <button disabled={activeAction === "save-draft"} className="btn-sweep mt-5 min-h-11 px-4 stamp font-semibold text-cream disabled:opacity-55">{activeAction === "save-draft" && draftType === "DEMAND" ? "Saving..." : "Save demand draft"}</button>
        </form>
      </div>

      <section><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-2xl">My channel requests</h2><div className="flex flex-wrap gap-2">{["ALL", "DRAFT", "OPEN", "EXPIRED"].map((filter) => <button key={filter} type="button" onClick={() => setRequestFilter(filter as typeof requestFilter)} className={`border px-3 py-2 stamp font-semibold ${requestFilter === filter ? "border-brick text-brick" : "border-ink/12 ink-2"}`}>{filter.toLowerCase()}</button>)}</div></div><div className="mt-4 grid gap-3 lg:grid-cols-2">{filteredRequests.length ? filteredRequests.map((request) => <article key={request.id} className="border border-ink/12 bg-card p-4"><div className="flex items-center justify-between gap-3"><p className="font-medium">{request.type} · {request.localitySlug ?? "city-wide"}</p><span className={`stamp px-2 py-1 ${request.status === "OPEN" ? "bg-trust/10 text-trust" : "bg-sand ink-2"}`}>{request.status}</span></div><div className="mt-3 flex flex-wrap gap-2"><span className="stamp bg-sand px-2 py-1 ink-2">{request.sourceListingId ? "Listing-backed" : request.sourceRequirementId ? "Requirement-backed" : "Source pending"}</span><span className="stamp bg-sand px-2 py-1 ink-2">Expires {formatDateLabel(request.expiresAt)}</span></div><p className="mt-3 text-sm leading-6 ink-2">{request.detailSummary}</p>{request.status === "DRAFT" ? <button type="button" disabled={activeAction === `publish-${request.id}`} onClick={() => void publishRequest(request.id)} className="mt-3 border border-brick/30 px-3 py-2 stamp font-semibold text-brick disabled:opacity-55">{activeAction === `publish-${request.id}` ? "Publishing..." : "Publish + top match"}</button> : null}</article>) : <ChannelEmptyState title="No channel requests in this view" body="Generate supply from an existing listing, or save a requirement-backed demand brief." />}</div></section>
    </section> : null}

    {activeTab === "matches" ? <section className="mt-7"><div className="flex items-end justify-between"><h2 className="font-display text-2xl">Top suggested matches</h2><span className="stamp ink-3">Top 10 deterministic matches</span></div><div className="mt-4 grid gap-4 lg:grid-cols-2">{matches.length ? matches.map((match) => <article key={match.id} className="border border-ink/12 bg-card p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{match.counterpartyBroker?.organizationName ?? `Match ${match.id}`}</p><p className="mt-1 stamp ink-3">{match.counterpartyRequest?.type ?? "counterparty"} · {match.counterpartyRequest?.localitySlug ?? "city-wide"} · {match.status}</p></div><span className="stamp bg-trust/10 px-3 py-2 text-trust">{match.score}/100</span></div><p className="mt-3 text-sm leading-6 ink-2">{match.counterpartyRequest?.detailSummary ?? "Broker business contact stays separate from customer PII."}</p><div className="mt-3 flex flex-wrap gap-2">{(match.reasons ?? []).map((reason) => <span key={`${match.id}-${reason.factor}`} title={reason.note} className="stamp bg-sand px-2 py-1 ink-2">{reason.factor} +{reason.points}/{reason.weight}</span>)}</div><div className="mt-4 border-t border-ink/10 pt-3"><p className="stamp ink-3">Broker business contact</p>{match.counterpartyBroker?.waMeLink ? <a href={match.counterpartyBroker.waMeLink} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 border border-trust/30 px-3 py-2 stamp font-semibold text-trust"><PhoneCall size={13} /> WhatsApp {match.counterpartyBroker.businessPhoneMasked}</a> : <p className="mt-2 text-sm ink-2">Counterparty business phone is not available yet.</p>}<p className="mt-2 text-xs leading-5 ink-3">Only broker business contact is shown. Customer contact remains private.</p></div>{match.status === "SUGGESTED" ? <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={activeAction === `accept-${match.id}`} onClick={() => void decideMatch(match.id, "accept")} className="border border-trust/30 px-3 py-2 stamp font-semibold text-trust disabled:opacity-55">{activeAction === `accept-${match.id}` ? "Accepting..." : "Accept"}</button><button type="button" disabled={activeAction === `reject-${match.id}`} onClick={() => void decideMatch(match.id, "reject")} className="border border-ink/15 px-3 py-2 stamp font-semibold ink-2 disabled:opacity-55">{activeAction === `reject-${match.id}` ? "Rejecting..." : "Reject"}</button></div> : null}</article>) : <ChannelEmptyState title="No top matches" body="Top matches appear after verified counterparties publish compatible demand or supply." />}</div></section> : null}

    {activeTab === "deals" ? <section className="mt-7"><div className="flex items-end justify-between"><h2 className="font-display text-2xl">Deal workbench</h2><span className="stamp ink-3">{deals.length} deals</span></div><div className="mt-4 grid gap-4 lg:grid-cols-2">{deals.length ? deals.map((deal) => { const split = splitDrafts[deal.id] ?? { totalCommissionInr: String(deal.totalCommissionInr ?? ""), demandBrokerShareInr: String(deal.demandBrokerShareInr ?? ""), supplyBrokerShareInr: String(deal.supplyBrokerShareInr ?? ""), closeMode: (deal.closeMode === "SINGLE" ? "SINGLE" : "DUAL") as "DUAL" | "SINGLE" }; const validSplit = splitIsValid(split); const splitSaved = deal.totalCommissionInr != null && deal.demandBrokerShareInr != null && deal.supplyBrokerShareInr != null; return <article key={deal.id} className="border border-ink/12 bg-card p-5"><div className="flex items-center justify-between gap-3"><div><p className="font-medium">Deal {deal.id}</p><p className="mt-1 stamp ink-3">ERPNext: {deal.erpnextSyncStatus ?? "PENDING"} · Close mode: {deal.closeMode}</p></div><span className="stamp bg-sand px-2 py-1">{deal.status}</span></div><div className="mt-4 grid gap-2 md:grid-cols-5">{["Accepted", "Split", "Confirm", "Close", "ERPNext"].map((step, index) => <span key={step} className={`stamp border px-2 py-2 text-center ${index === 0 || (index === 1 && splitSaved) || (index === 3 && deal.closedAt) || (index === 4 && deal.erpnextSyncStatus === "SUCCESS") ? "border-trust/30 bg-trust/10 text-trust" : "border-ink/12 ink-3"}`}>{step}</span>)}</div><div className="mt-4 grid gap-2 md:grid-cols-4"><input aria-label="Total commission" placeholder="Total" value={split.totalCommissionInr} onChange={(event) => setSplitDrafts((current) => ({ ...current, [deal.id]: { ...split, totalCommissionInr: event.target.value } }))} className="h-10 border border-ink/12 bg-paper px-2 text-sm" /><input aria-label="Demand broker share" placeholder="Demand share" value={split.demandBrokerShareInr} onChange={(event) => setSplitDrafts((current) => ({ ...current, [deal.id]: { ...split, demandBrokerShareInr: event.target.value } }))} className="h-10 border border-ink/12 bg-paper px-2 text-sm" /><input aria-label="Supply broker share" placeholder="Supply share" value={split.supplyBrokerShareInr} onChange={(event) => setSplitDrafts((current) => ({ ...current, [deal.id]: { ...split, supplyBrokerShareInr: event.target.value } }))} className="h-10 border border-ink/12 bg-paper px-2 text-sm" /><select aria-label="Close mode" value={split.closeMode} onChange={(event) => setSplitDrafts((current) => ({ ...current, [deal.id]: { ...split, closeMode: event.target.value as "DUAL" | "SINGLE" } }))} className="h-10 border border-ink/12 bg-paper px-2 text-sm"><option value="DUAL">Dual close</option><option value="SINGLE">Single close</option></select></div><p className={`mt-2 text-xs leading-5 ${validSplit ? "text-trust" : "text-brick"}`}>{validSplit ? "Split is balanced and ready to save." : "Demand + supply shares must equal total commission."}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={!validSplit || activeAction === `split-${deal.id}`} onClick={() => void saveSplit(deal)} className="border border-brick/30 px-3 py-2 stamp font-semibold text-brick disabled:opacity-55">{activeAction === `split-${deal.id}` ? "Saving..." : "Save split"}</button><button type="button" disabled={!splitSaved || activeAction === `confirm-${deal.id}`} onClick={() => void dealAction(deal.id, "confirm")} className="border border-trust/30 px-3 py-2 stamp font-semibold text-trust disabled:opacity-55">{activeAction === `confirm-${deal.id}` ? "Confirming..." : "Confirm"}</button><button type="button" disabled={!splitSaved || activeAction === `close-${deal.id}`} onClick={() => void dealAction(deal.id, "close")} className="border border-trust/30 px-3 py-2 stamp font-semibold text-trust disabled:opacity-55">{activeAction === `close-${deal.id}` ? "Closing..." : "Close"}</button><button type="button" disabled={activeAction === `cancel-${deal.id}`} onClick={() => void dealAction(deal.id, "cancel")} className="border border-ink/15 px-3 py-2 stamp font-semibold ink-2 disabled:opacity-55">{activeAction === `cancel-${deal.id}` ? "Cancelling..." : "Cancel"}</button></div></article>; }) : <ChannelEmptyState title="No active deal workbench" body="Accepted matches appear here with split, confirm, close, cancel, and ERPNext status controls." />}</div></section> : null}

    {activeTab === "notifications" ? <section className="mt-7"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-2xl">Notification inbox</h2><p className="mt-1 text-sm ink-2">In-app alerts for match, deal, split, close, and ERPNext updates.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setNotificationFilter(notificationFilter === "ALL" ? "UNREAD" : "ALL")} className="border border-ink/12 px-3 py-2 stamp font-semibold ink-2">{notificationFilter === "ALL" ? "Show unread" : "Show all"}</button><button type="button" disabled={!notifications.some((item) => !item.readAt) || activeAction === "read-all"} onClick={() => void markAllRead()} className="border border-brick/30 px-3 py-2 stamp font-semibold text-brick disabled:opacity-55">{activeAction === "read-all" ? "Marking..." : "Mark all read"}</button></div></div><div className="mt-4 grid gap-3 md:grid-cols-2">{visibleNotifications.length ? visibleNotifications.map((item) => <article key={item.id} className={`border p-4 ${item.readAt ? "border-ink/12 bg-card" : "border-brick/30 bg-ember/10"}`}><div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-t-full bg-sand text-brick"><Inbox size={15} /></span><div><p className="font-medium">{item.title}</p><p className="mt-1 stamp ink-3">{item.eventType} · {relativeTime(item.createdAt)}</p></div></div>{!item.readAt ? <span className="stamp bg-brick clay-fill px-2 py-1 text-cream">new</span> : null}</div><p className="mt-3 text-sm leading-6 ink-2">{item.body}</p>{!item.readAt ? <button type="button" disabled={activeAction === `read-${item.id}`} onClick={() => void markRead(item.id)} className="mt-3 border border-ink/15 px-3 py-2 stamp font-semibold ink-2 disabled:opacity-55">{activeAction === `read-${item.id}` ? "Saving..." : "Mark read"}</button> : null}</article>) : <ChannelEmptyState title="No channel notifications" body="Match, deal, split, close, and ERPNext updates will appear here." />}</div></section> : null}

    {activeTab === "maintenance" ? <section className="mt-7 grid gap-5 lg:grid-cols-[1fr_0.8fr]"><article className="border border-ink/12 bg-card p-5"><ChannelDeskRule label="Maintenance" detail="ORG-SCOPED" /><h2 className="mt-3 font-display text-2xl">Run safe channel upkeep</h2><p className="mt-2 text-sm leading-6 ink-2">These actions are scoped to your broker organization. They do not expose customer data or run across unrelated organizations.</p><div className="mt-5 flex flex-wrap gap-2"><button type="button" disabled={activeAction === "expire"} onClick={() => void runMaintenance("expire")} className="border border-ink/15 px-3 py-2 stamp font-semibold ink-2 disabled:opacity-55">{activeAction === "expire" ? "Expiring..." : "Expire stale requests"}</button><button type="button" disabled={activeAction === "sync"} onClick={() => void runMaintenance("sync")} className="border border-brick/30 px-3 py-2 stamp font-semibold text-brick disabled:opacity-55">{activeAction === "sync" ? "Syncing..." : "Sync ERPNext closes"}</button></div></article><article className="border border-ember/25 bg-ember/10 p-5"><ShieldCheck size={20} className="text-brick" /><p className="mt-4 stamp text-brick">Source-backed matching</p><p className="mt-2 text-sm leading-6 ink-2">Listings and requirements remain the source of truth. Channel records are sanitized projections, refreshed before matching, and shown as top-scored broker opportunities.</p><p className="mt-3 text-sm leading-6 ink-2">Pending ERPNext writes: {dashboard?.erpnextPendingWrites ?? 0}</p></article></section> : null}
  </>;
}
