"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, Link2, LoaderCircle, MessageSquareText, RefreshCw, ShieldCheck, Smartphone, Wifi } from "lucide-react";
import { ACKNOWLEDGEMENT_PREVIEW_VALUES, DEFAULT_ACKNOWLEDGEMENT_BODY, renderAcknowledgementTemplate } from "@/lib/whatsapp/template";
import { ALLOWED_ACKNOWLEDGEMENT_PLACEHOLDERS } from "@/lib/whatsapp/contracts";

type AccountState = "PROVISIONING" | "QR_READY" | "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "ERROR";
type SafeSettings = {
  enabled: boolean;
  canManage?: boolean;
  plan: { status: string; eligible: boolean; reason?: string };
  account: { status: AccountState; connectedAt: string | null; lastObservedAt: string | null; lastErrorCode: string | null } | null;
  template: { id: string; version: number; body: string; createdAt: string } | null;
  placeholders: readonly string[];
  delivery: {
    pending: number;
    inFlight: number;
    accepted: number;
    failed: number;
    unknown: number;
    skipped: number;
    latest: { status: string; providerMessageId: string | null; acceptedAt: string | null; completedAt: string | null } | null;
  };
};

type SafeResponse = { ok?: boolean; errors?: unknown; state?: string; qrDataUrl?: string; status?: string; account?: { status?: string }; template?: SafeSettings["template"]; placeholders?: readonly string[] };

const ACCOUNT_STATE_LABELS: Record<AccountState, string> = {
  PROVISIONING: "PROVISIONING · preparing a private connection",
  QR_READY: "QR_READY · ready to scan",
  CONNECTING: "CONNECTING · waiting for WhatsApp",
  CONNECTED: "CONNECTED · company number linked",
  DISCONNECTED: "DISCONNECTED · link removed or unavailable",
  ERROR: "ERROR · connection needs attention",
};

const REASON_LABELS: Record<string, string> = {
  PROVIDER_DISABLED: "Provider-disabled · WhatsApp automation is not enabled for this environment.",
  NO_ACTIVE_PLAN: "No active plan · an ACTIVE subscription is required before connection or delivery.",
  REAL_NUMBERS_DISABLED: "Provider-disabled · real-number activation is disabled for this environment.",
  QR_EXPIRED: "QR-expired · request a fresh QR and scan it promptly.",
  EMPTY_TEMPLATE: "Empty-template · save an acknowledgement before delivery can begin.",
  NOT_CONNECTED: "DISCONNECTED · connect a company-owned number to continue.",
};

function errorText(payload: SafeResponse, fallback: string): string {
  const first = Array.isArray(payload.errors) ? payload.errors[0] : undefined;
  return typeof first === "string" && first.length < 160 ? first : fallback;
}

function accountStatus(value: unknown): AccountState {
  if (typeof value !== "string") return "ERROR";
  if (value in ACCOUNT_STATE_LABELS) return value as AccountState;
  const normalized = value.toLowerCase();
  if (["open", "connected", "online"].includes(normalized)) return "CONNECTED";
  if (["connecting", "opening"].includes(normalized)) return "CONNECTING";
  if (["qr", "qr_ready", "qrcode", "waiting"].includes(normalized)) return "QR_READY";
  if (["close", "closed", "disconnected"].includes(normalized)) return "DISCONNECTED";
  if (["error", "failed", "failure"].includes(normalized)) return "ERROR";
  return "ERROR";
}

function reasonLabel(reason: string | undefined): string | null {
  return reason ? REASON_LABELS[reason] ?? reason.replaceAll("_", " ") : null;
}

function cardClass(tone = "default") {
  return tone === "dark" ? "border border-ink/12 bg-night p-6 text-cream" : "border border-ink/12 bg-card p-6";
}

export function BrokerWhatsAppPanel() {
  const [settings, setSettings] = useState<SafeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [ownershipAcknowledged, setOwnershipAcknowledged] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrState, setQrState] = useState("");
  const [templateDraft, setTemplateDraft] = useState(DEFAULT_ACKNOWLEDGEMENT_BODY);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/broker/whatsapp", { cache: "no-store" });
      const payload = await response.json() as SafeSettings & SafeResponse;
      if (!response.ok) throw new Error(errorText(payload, "WhatsApp settings are unavailable."));
      setSettings(payload);
      if (payload.template?.body) setTemplateDraft(payload.template.body);
      if (payload.account && ["PROVISIONING", "QR_READY", "CONNECTING"].includes(payload.account.status)) setQrOpen(true);
    } catch (error) {
      setMessage(error instanceof Error && error.message.length < 160 ? error.message : "WhatsApp settings are unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadSettings(); }, [loadSettings]);

  const updateAccount = useCallback((status: AccountState) => {
    setSettings((current) => current ? { ...current, account: current.account ? { ...current.account, status } : { status, connectedAt: null, lastObservedAt: null, lastErrorCode: null } } : current);
  }, []);

  const readQr = useCallback(async () => {
    try {
      const response = await fetch("/api/broker/whatsapp/qr", { cache: "no-store" });
      const payload = await response.json() as SafeResponse;
      if (!response.ok) throw new Error(errorText(payload, "The QR could not be loaded."));
      const state = typeof payload.state === "string" ? payload.state : "";
      setQrState(state);
      if (typeof payload.qrDataUrl === "string" && payload.qrDataUrl.startsWith("data:image/")) setQrDataUrl(payload.qrDataUrl);
      const normalized = accountStatus(payload.status ?? state);
      if (normalized === "CONNECTED") {
        updateAccount(normalized);
        setQrOpen(false);
        setQrDataUrl(null);
        setMessage("WhatsApp is connected. The linked number is company-owned and ready for eligible acknowledgements.");
      }
    } catch (error) {
      setMessage(error instanceof Error && error.message.length < 160 ? error.message : "The QR could not be loaded.");
    }
  }, [updateAccount]);

  const readStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/broker/whatsapp/status", { cache: "no-store" });
      const payload = await response.json() as SafeResponse;
      if (!response.ok) return;
      const normalized = accountStatus(payload.status);
      updateAccount(normalized);
      if (normalized === "CONNECTED") {
        setQrOpen(false);
        setQrDataUrl(null);
        setMessage("WhatsApp is connected. The linked number is company-owned and ready for eligible acknowledgements.");
      }
    } catch {
      // The next bounded poll will retry; do not echo provider details into the dashboard.
    }
  }, [updateAccount]);

  useEffect(() => {
    if (!qrOpen || settings?.account?.status === "CONNECTED" || !settings?.enabled) return;
    let cancelled = false;
    const poll = () => {
      if (cancelled) return;
      void readQr();
      void readStatus();
    };
    poll();
    const timer = window.setInterval(poll, 3_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [qrOpen, readQr, readStatus, settings?.account?.status, settings?.enabled]);

  const connect = useCallback(async () => {
    if (!ownershipAcknowledged || !settings?.enabled) return;
    setBusy("connect");
    setMessage("");
    try {
      const response = await fetch("/api/broker/whatsapp/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyOwnedAcknowledged: true }) });
      const payload = await response.json() as SafeResponse;
      if (!response.ok) throw new Error(errorText(payload, "The company-owned WhatsApp number could not be connected."));
      setQrOpen(true);
      setQrDataUrl(null);
      setQrState("PROVISIONING");
      updateAccount(accountStatus(payload.status ?? "PROVISIONING"));
      setMessage("Connection prepared. Scan the QR from WhatsApp Linked devices.");
      await readQr();
    } catch (error) {
      setMessage(error instanceof Error && error.message.length < 160 ? error.message : "The company-owned WhatsApp number could not be connected.");
    } finally {
      setBusy(null);
    }
  }, [ownershipAcknowledged, readQr, settings?.enabled, updateAccount]);

  const saveTemplate = useCallback(async () => {
    setBusy("template");
    setMessage("");
    try {
      const response = await fetch("/api/broker/whatsapp/template", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: templateDraft }) });
      const payload = await response.json() as SafeResponse;
      if (!response.ok) throw new Error(errorText(payload, "The acknowledgement template could not be saved."));
      if (payload.template) setSettings((current) => current ? { ...current, template: payload.template! } : current);
      setMessage("Acknowledgement template saved as a new version.");
    } catch (error) {
      setMessage(error instanceof Error && error.message.length < 160 ? error.message : "The acknowledgement template could not be saved.");
    } finally {
      setBusy(null);
    }
  }, [templateDraft]);

  const preview = useMemo(() => {
    try {
      return renderAcknowledgementTemplate(templateDraft, ACKNOWLEDGEMENT_PREVIEW_VALUES);
    } catch {
      return "Preview appears after the four allowed placeholders and message text validate.";
    }
  }, [templateDraft]);

  const account = settings?.account;
  const status = account?.status ?? "DISCONNECTED";
  const reason = reasonLabel(settings?.plan.reason) ?? (!settings?.template && settings?.enabled ? REASON_LABELS.EMPTY_TEMPLATE : null);
  const qrExpired = qrOpen && !qrDataUrl && (qrState === "QR_READY" || qrState === "EXPIRED");
  const placeholders = settings?.placeholders?.length ? settings.placeholders : ALLOWED_ACKNOWLEDGEMENT_PLACEHOLDERS;
  const canManage = settings?.canManage === true;

  if (loading && !settings) return <div className="border border-ink/12 bg-card p-8" role="status">Loading WhatsApp controls…</div>;

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 border-b border-ink/12 pb-6 md:flex-row md:items-end md:justify-between">
      <div><p className="kicker text-brick">Private company channel · 01</p><h2 className="mt-3 font-display text-4xl font-medium tracking-[-0.03em]">One acknowledgement, safely delivered.</h2><p className="mt-3 max-w-2xl text-sm leading-7 ink-2">Connect the company-owned WhatsApp number, scan a short-lived QR, and configure the single acknowledgement sent after an eligible lead is created.</p></div>
      <button type="button" onClick={() => void loadSettings()} className="inline-flex min-h-11 items-center gap-2 border border-ink/15 px-4 stamp font-semibold text-brick" disabled={loading}><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh</button>
    </div>

    {message ? <p role="status" aria-live="polite" className="border border-ink/12 bg-sand/55 p-3 text-sm ink-2">{message}</p> : null}
    {reason ? <p role="status" className="border border-trust/25 bg-trust/10 p-4 text-sm ink-2">{reason}</p> : null}

    <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <article className={cardClass()}>
        <div className="flex items-start justify-between gap-4"><div><p className="stamp ink-2">Connection</p><h3 className="mt-2 font-display text-2xl">Company-owned number</h3></div><Smartphone size={22} className="text-brick" /></div>
        <p className="mt-4 text-sm leading-6 ink-2">The broker company confirms control of the number. WhatsApp itself remains the source of truth for linked devices.</p>
        <div className="mt-5 flex items-center gap-3 border-y border-ink/10 py-4"><Wifi size={17} className={status === "CONNECTED" ? "text-trust" : "text-brick"} /><span className="text-sm font-medium">{ACCOUNT_STATE_LABELS[status]}</span></div>
        {canManage ? <>
          <label className="mt-5 flex items-start gap-3 text-sm leading-6 ink-2"><input type="checkbox" checked={ownershipAcknowledged} onChange={(event) => setOwnershipAcknowledged(event.target.checked)} className="mt-1 h-4 w-4 accent-brick" />I confirm this WhatsApp number is owned and controlled by the broker company.</label>
          <button type="button" onClick={() => void connect()} disabled={!settings?.enabled || !ownershipAcknowledged || busy === "connect"} className="mt-5 inline-flex min-h-11 items-center gap-2 bg-brick clay-fill px-4 stamp font-semibold text-cream disabled:cursor-not-allowed"><Link2 size={14} />{busy === "connect" ? "Preparing…" : status === "CONNECTED" ? "Refresh connection" : "Connect WhatsApp"}</button>
        </> : <p className="mt-5 text-sm ink-2">Read-only workspace access. An organization administrator manages this connection.</p>}
        {qrOpen && status !== "CONNECTED" ? <div className="mt-6 border border-brick/20 bg-sand/45 p-5"><div className="flex items-start gap-3"><ShieldCheck size={18} className="mt-0.5 text-brick" /><div><p className="font-medium">Scan from WhatsApp Linked devices</p><p className="mt-1 text-sm leading-6 ink-2">Open WhatsApp Settings → Linked devices → Link a device, then scan this QR before it expires. Keep the scan inside the Architech dashboard.</p></div></div>{qrDataUrl ? <img src={qrDataUrl} alt="Short-lived WhatsApp connection QR" className="mx-auto mt-5 h-56 w-56 border border-ink/15 bg-white p-2" /> : <p className="mt-5 text-center stamp text-brick">{qrExpired ? REASON_LABELS.QR_EXPIRED : "QR_READY · requesting a short-lived QR…"}</p>}</div> : null}
      </article>

      <article className={cardClass("dark")}><div className="flex items-start justify-between gap-4"><div><p className="stamp text-cream">Delivery status</p><h3 className="mt-2 font-display text-2xl">Safe delivery ledger</h3></div><MessageSquareText size={22} className="text-ember" /></div><p className="mt-4 text-sm leading-6 text-cream">Only bounded counts and provider state are shown here. Customer contact data and message text stay out of the dashboard.</p><div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">{[["Pending", settings?.delivery.pending ?? 0], ["In flight", settings?.delivery.inFlight ?? 0], ["Accepted", settings?.delivery.accepted ?? 0], ["Failed", settings?.delivery.failed ?? 0], ["Unknown", settings?.delivery.unknown ?? 0], ["Skipped", settings?.delivery.skipped ?? 0]].map(([label, value]) => <div key={label} className="border border-cream/12 p-3"><p className="stamp text-cream">{label}</p><p className="mt-3 index-num text-3xl text-ember">{value}</p></div>)}</div>{settings?.delivery.latest?.providerMessageId ? <p className="mt-5 border-t border-cream/12 pt-4 text-xs text-cream">Latest provider reference: <span className="font-mono text-cream">{settings.delivery.latest.providerMessageId}</span></p> : <p className="mt-5 border-t border-cream/12 pt-4 text-xs text-cream">No provider acceptance reference yet.</p>}</article>
    </section>

    <section className={cardClass()}><div className="flex items-start justify-between gap-4"><div><p className="stamp ink-2">Acknowledgement template</p><h3 className="mt-2 font-display text-2xl">One active message version</h3></div><CheckCircle2 size={22} className="text-trust" /></div><p className="mt-3 text-sm leading-6 ink-2">Allowed placeholders are shared with the server renderer: {placeholders.map((placeholder) => <code key={placeholder} className="mx-1 rounded bg-sand px-1.5 py-0.5 text-xs">{`{{${placeholder}}}`}</code>)}</p><div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]"><div><label htmlFor="whatsapp-acknowledgement" className="stamp ink-2">Message body</label><textarea id="whatsapp-acknowledgement" value={templateDraft} onChange={(event) => setTemplateDraft(event.target.value)} readOnly={!canManage} maxLength={1200} rows={8} className="mt-2 w-full border border-ink/15 bg-paper p-4 text-sm leading-6 outline-none focus:border-brick read-only:opacity-70" /><div className="mt-2 flex justify-between stamp ink-2"><span>Saved version {settings?.template?.version ?? "—"}</span><span>{templateDraft.length}/1200</span></div>{canManage ? <button type="button" onClick={() => void saveTemplate()} disabled={busy === "template" || !settings?.enabled || !templateDraft.trim()} className="mt-4 inline-flex min-h-11 items-center gap-2 border border-brick px-4 stamp font-semibold text-brick disabled:cursor-not-allowed">{busy === "template" ? <LoaderCircle size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}Save new version</button> : <p className="mt-4 text-xs ink-2">Only an organization administrator can create a new version.</p>}</div><div className="border border-ink/10 bg-sand/45 p-5"><p className="stamp ink-2">Server-shared preview</p><p className="mt-4 whitespace-pre-wrap text-sm leading-7 ink-2">{preview}</p><p className="mt-6 border-t border-ink/10 pt-4 text-xs leading-5 ink-2">Preview values are synthetic. The worker renders again after eligibility checks and does not persist the rendered body.</p></div></div></section>

    {!settings?.template ? <p role="status" className="flex items-center gap-2 text-sm ink-2"><CircleAlert size={15} className="text-brick" />{REASON_LABELS.EMPTY_TEMPLATE}</p> : null}
  </div>;
}
