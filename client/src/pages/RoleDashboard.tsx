"use client";
/* The dashboard, for all five kinds of person the product serves.
 *
 * Before this, `/dashboard` redirected everyone to `/broker/dashboard/`, which
 * is gated on `broker.dashboard.read` + an organization. Four of the five
 * roles therefore hit "You do not have access to this workspace". This is the
 * surface that replaces that dead end.
 *
 * Composition comes from `lib/dashboard/panels`, persona from
 * `lib/dashboard/persona`. Neither grants anything: every panel loads from an
 * API that runs its own server-side authorisation, and `visiblePanels`
 * withholds a panel whose permission the session lacks rather than rendering
 * it broken and empty.
 *
 * The persona switch is real and deliberate. One household is routinely an
 * owner AND a buyer, and forcing one persona per account would make the
 * product lie about the other. The choice is persisted in the URL so a
 * dashboard view can be linked and reloaded.
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Bookmark,
  CheckCircle2,
  ClipboardList,
  Handshake,
  Inbox,
  Loader2,
  LockKeyhole,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { useSession } from "@/contexts/SessionContext";
import { useSaved } from "@/contexts/SavedContext";
import useTitle from "@/hooks/useTitle";
import {
  PERSONA_META,
  personasForSession,
  resolvePersona,
  type DashboardPersona,
} from "@/lib/dashboard/persona";
import { PANEL_LOCK_REASON, PANEL_META, lockedPanels, visiblePanels, type DashboardPanel } from "@/lib/dashboard/panels";
import { intentLabel, type RequirementRecord } from "@/lib/requirements";
import type { SavedSearchState } from "@/lib/saved-search/saved-search";
import type { ListingDraft } from "@/lib/broker/workflow";

type LeadSummary = { id: string; status?: string; createdAt?: string };

/* One fetch helper for every panel. A panel whose API returns 401/403 must
   render as "not available to you" rather than as an error: a buyer opening
   the owner persona has not done anything wrong. */
async function loadJson<T>(url: string, pick: (payload: Record<string, unknown>) => T, fallback: T): Promise<T> {
  try {
    const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) return fallback;
    const payload = (await response.json()) as Record<string, unknown>;
    if (payload.ok === false) return fallback;
    return pick(payload);
  } catch {
    return fallback;
  }
}

/* The two tab states are built as SEPARATE strings rather than as a ternary
   inside one template literal. A solid `clay-fill` control must not also
   carry a `hover:text-*` state it cannot win, and when both branches live in
   one className string they read as a single set of classes — which is both
   what the contrast guard flags and, in dark mode, a real bug. */
function personaTabClass(active: boolean): string {
  const base = "touch-44 inline-flex items-center gap-2 border px-4 py-2 stamp font-semibold transition";
  if (active) return `${base} clay-fill border-brick bg-brick text-cream`;
  return `${base} border-ink/15 ink-2 hover:border-brick/50 hover:text-brick`;
}

function PanelShell({
  panel,
  count,
  children,
}: {
  panel: DashboardPanel;
  count: number;
  children: React.ReactNode;
}) {
  const meta = PANEL_META[panel];
  return (
    <section className="border border-ink/12 bg-card p-6 md:p-7" aria-labelledby={`panel-${panel}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-ink/10 pb-4">
        <h2 id={`panel-${panel}`} className="font-display text-2xl tracking-[-0.02em]">
          {meta.title}
        </h2>
        <span className="stamp ink-3">{count === 0 ? "Empty" : `${count} ${count === 1 ? "item" : "items"}`}</span>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function PanelLocked({ panel }: { panel: DashboardPanel }) {
  const meta = PANEL_META[panel];
  const reason = meta.permission ? PANEL_LOCK_REASON[meta.permission] : undefined;
  return (
    <section className="border border-ink/12 bg-card p-6 md:p-7" aria-labelledby={`panel-${panel}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-ink/10 pb-4">
        <h2 id={`panel-${panel}`} className="font-display text-2xl tracking-[-0.02em]">{meta.title}</h2>
        <span className="stamp ink-3">Not set up yet</span>
      </div>
      <div className="mt-5 flex items-start gap-3 border border-dashed border-ink/20 bg-sand/40 p-5">
        <LockKeyhole size={18} className="mt-0.5 shrink-0 text-brick" aria-hidden="true" />
        <div>
          <p className="text-sm leading-6 ink-2">{reason?.body ?? "This part of your dashboard is not available on your account yet."}</p>
          <Link href={reason?.href ?? "/broker/onboarding/"} className="mt-3 inline-flex items-center gap-2 stamp font-semibold text-brick">
            {reason?.actionLabel ?? "Find out how"} <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function PanelEmpty({ panel }: { panel: DashboardPanel }) {
  const meta = PANEL_META[panel];
  return (
    <div className="border border-dashed border-ink/20 bg-sand/40 p-6">
      <h3 className="font-display text-lg">{meta.emptyTitle}</h3>
      <p className="mt-2 max-w-xl text-sm leading-6 ink-2">{meta.emptyBody}</p>
      <Link href={meta.href} className="mt-4 inline-flex items-center gap-2 stamp font-semibold text-brick">
        {meta.actionLabel} <ArrowUpRight size={12} />
      </Link>
    </div>
  );
}

function Row({ title, meta, href }: { title: string; meta: string; href?: string }) {
  const inner = (
    <>
      <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
      <span className="stamp ink-3">{meta}</span>
    </>
  );
  return (
    <li className="flex items-center gap-3 border-b border-ink/8 py-3 last:border-0">
      {href ? (
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 hover:text-brick">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </li>
  );
}

export default function RoleDashboard() {
  const { status, session } = useSession();
  const { saved } = useSaved();
  const router = useRouter();
  const searchParams = useSearchParams();

  const available = useMemo(() => personasForSession(session), [session]);
  const persona: DashboardPersona = useMemo(
    () => resolvePersona(session, searchParams.get("as")),
    [session, searchParams],
  );
  const personaMeta = PERSONA_META[persona];
  useTitle(`Dashboard · ${personaMeta.label}`);

  const panels = useMemo(
    () => visiblePanels(persona, session?.permissions ?? []),
    [persona, session],
  );
  /* Panels this persona has but this session cannot load. Shown as locked
     with the reason, never silently dropped or rendered misleadingly empty. */
  const locked = useMemo(
    () => lockedPanels(persona, session?.permissions ?? []),
    [persona, session],
  );
  /* Whether this account can actually reach the listing form, which is
     organization-scoped. Drives the header CTA so it never points at a wall. */
  const canList = (session?.permissions ?? []).includes("listing.draft.create");

  const [requirements, setRequirements] = useState<RequirementRecord[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearchState[]>([]);
  const [drafts, setDrafts] = useState<ListingDraft[]>([]);
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [loading, setLoading] = useState(true);

  /* Only fetch what the visible panels actually need. An owner dashboard must
     not call the lead inbox when the panel is withheld — it would be a
     guaranteed 403 in the network log and an alarming thing to find there. */
  const needs = useMemo(() => new Set(panels), [panels]);

  const load = useCallback(async () => {
    setLoading(true);
    const jobs: Array<Promise<unknown>> = [];
    if (needs.has("requirements")) {
      jobs.push(
        loadJson("/api/requirements/", (p) => (Array.isArray(p.requirements) ? (p.requirements as RequirementRecord[]) : []), []).then(setRequirements),
      );
    }
    if (needs.has("saved-searches")) {
      jobs.push(
        loadJson("/api/saved-searches/", (p) => (Array.isArray(p.savedSearches) ? (p.savedSearches as SavedSearchState[]) : []), []).then(setSavedSearches),
      );
    }
    if (needs.has("my-listings")) {
      jobs.push(
        loadJson("/api/broker/listings/", (p) => (Array.isArray(p.drafts) ? (p.drafts as ListingDraft[]) : []), []).then(setDrafts),
      );
    }
    if (needs.has("enquiries")) {
      jobs.push(
        loadJson("/api/broker/leads/", (p) => (Array.isArray(p.leads) ? (p.leads as LeadSummary[]) : []), []).then(setLeads),
      );
    }
    await Promise.all(jobs);
    setLoading(false);
  }, [needs]);

  useEffect(() => {
    void load();
  }, [load]);

  const switchPersona = (next: DashboardPersona) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("as", next);
    router.replace(`/dashboard/?${params.toString()}`, { scroll: false });
  };

  /* "Next steps" is the only panel that reasons across the others. It is what
     makes the dashboard a dashboard rather than four lists side by side. */
  const nextSteps = useMemo(() => {
    const steps: Array<{ label: string; href: string }> = [];
    if (needs.has("requirements") && requirements.length === 0) {
      steps.push({ label: "Tell us what you are looking for", href: "/requirements/" });
    }
    if (needs.has("my-listings") && drafts.length === 0) {
      steps.push({ label: "List your first property", href: "/broker/listings/new/" });
    }
    /* ACTIVE is the only publicly visible state. ARCHIVED, REJECTED and
       DUPLICATE are terminal — nagging about those would be noise — so the
       prompt covers only the ones the person can actually move forward. */
    const actionable = drafts.filter((draft) => draft.status === "DRAFT" || draft.status === "CHANGES_REQUESTED").length;
    if (actionable > 0) {
      steps.push({ label: `${actionable} ${actionable === 1 ? "listing needs" : "listings need"} your attention before going live`, href: "/broker/agent/my-listings/" });
    }
    const inReview = drafts.filter((draft) => draft.status === "IN_REVIEW").length;
    if (inReview > 0) {
      steps.push({ label: `${inReview} ${inReview === 1 ? "listing is" : "listings are"} in review`, href: "/broker/agent/my-listings/" });
    }
    if (needs.has("saved-properties") && saved.length === 0) {
      steps.push({ label: "Shortlist a property to compare later", href: "/search/" });
    }
    if (needs.has("enquiries") && leads.length > 0) {
      steps.push({ label: `${leads.length} ${leads.length === 1 ? "enquiry" : "enquiries"} waiting for a reply`, href: "/broker/leads/" });
    }
    if (personaMeta.side !== "demand" && session?.organization?.verificationStatus === "DEMO") {
      steps.push({ label: "Get verified so your listings carry a trust badge", href: "/broker/onboarding/" });
    }
    return steps;
  }, [needs, requirements, drafts, saved, leads, personaMeta, session]);

  if (status === "loading") {
    return (
      <div className="bg-paper pt-[78px] text-ink">
        <div className="container flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite">
          <Loader2 size={22} className="animate-spin text-brick" aria-hidden="true" />
          <span className="sr-only">Loading your dashboard…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page-transition bg-paper pt-[78px] text-ink">
      <header className="border-b border-ink/12 bg-sand/65">
        <div className="container py-8 md:py-10">
          <p className="kicker text-brick">Your dashboard</p>
          <h1 className="display mt-3 text-[clamp(32px,4.6vw,60px)]">
            {session?.user.name ? `Welcome back, ${session.user.name.split(" ")[0]}` : "Welcome"}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 ink-2">{personaMeta.tagline}</p>

          {/* Persona switch. Rendered as tabs because it changes the view, not
              the account: nothing here alters what the person may do. */}
          <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Dashboard view">
            {available.map((option) => {
              const active = option === persona;
              return (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => switchPersona(option)}
                  className={personaTabClass(active)}
                >
                  {PERSONA_META[option].label}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/requirements/" className="inline-flex min-h-11 items-center gap-2 border border-ink/15 px-4 stamp font-semibold text-brick">
              <ClipboardList size={14} /> New requirement
            </Link>
            {personaMeta.side !== "demand" ? (
              /* Point at onboarding, not the submission form, when the account
                 cannot actually reach it. The form is gated on an
                 organization, so an un-onboarded owner clicking "List a
                 property" previously hit a wall with no explanation. */
              <Link href={canList ? "/broker/listings/new/" : "/broker/onboarding/"} className="clay-fill btn-sweep inline-flex min-h-11 items-center gap-2 bg-brick px-4 stamp font-semibold text-cream">
                <Plus size={14} /> {canList ? "List a property" : "Get set up to list"}
              </Link>
            ) : (
              <Link href="/search/" className="clay-fill btn-sweep inline-flex min-h-11 items-center gap-2 bg-brick px-4 stamp font-semibold text-cream">
                <ArrowUpRight size={14} /> Browse properties
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="container grid gap-5 py-8 md:py-12 lg:grid-cols-2">
        {loading ? (
          <div className="lg:col-span-2 flex items-center gap-3 border border-ink/12 bg-card p-6" role="status" aria-live="polite">
            <Loader2 size={18} className="animate-spin text-brick" aria-hidden="true" />
            <span className="text-sm ink-2">Loading your dashboard…</span>
          </div>
        ) : null}

        {!loading && locked.map((panel) => <PanelLocked key={panel} panel={panel} />)}

        {!loading && panels.map((panel) => {
          if (panel === "next-steps") {
            return (
              <div key={panel} className="lg:col-span-2">
                <PanelShell panel={panel} count={nextSteps.length}>
                  {nextSteps.length === 0 ? (
                    <div className="flex items-center gap-3 border border-trust/25 bg-trust/8 p-5">
                      <CheckCircle2 size={18} className="text-trust" aria-hidden="true" />
                      <p className="text-sm ink-2">{PANEL_META["next-steps"].emptyBody}</p>
                    </div>
                  ) : (
                    <ul role="list" className="grid gap-2 sm:grid-cols-2">
                      {nextSteps.map((step) => (
                        <li key={step.href + step.label}>
                          <Link href={step.href} className="flex items-center justify-between gap-3 border border-ink/12 bg-sand/40 px-4 py-3 text-sm hover:border-brick/50 hover:text-brick">
                            <span className="min-w-0 flex-1">{step.label}</span>
                            <ArrowUpRight size={14} aria-hidden="true" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </PanelShell>
              </div>
            );
          }

          if (panel === "requirements") {
            return (
              <PanelShell key={panel} panel={panel} count={requirements.length}>
                {requirements.length === 0 ? <PanelEmpty panel={panel} /> : (
                  <ul role="list">
                    {requirements.slice(0, 6).map((item) => (
                      <Row
                        key={item.id}
                        title={`${intentLabel(item.intent)} · ${item.subtype}`}
                        meta={`${item.citySlug} · ${item.status}`}
                      />
                    ))}
                  </ul>
                )}
              </PanelShell>
            );
          }

          if (panel === "saved-properties") {
            return (
              <PanelShell key={panel} panel={panel} count={saved.length}>
                {saved.length === 0 ? <PanelEmpty panel={panel} /> : (
                  <div className="border border-ink/12 bg-sand/40 p-5">
                    <p className="flex items-center gap-2 text-sm ink-2">
                      <Bookmark size={16} className="text-brick" aria-hidden="true" />
                      {saved.length} {saved.length === 1 ? "property" : "properties"} shortlisted.
                    </p>
                    <Link href="/saved/" className="mt-3 inline-flex items-center gap-2 stamp font-semibold text-brick">
                      Open shortlist <ArrowUpRight size={12} />
                    </Link>
                  </div>
                )}
              </PanelShell>
            );
          }

          if (panel === "saved-searches") {
            return (
              <PanelShell key={panel} panel={panel} count={savedSearches.length}>
                {savedSearches.length === 0 ? <PanelEmpty panel={panel} /> : (
                  <ul role="list">
                    {savedSearches.slice(0, 6).map((item) => (
                      <Row
                        key={item.id}
                        title={item.query || "All properties"}
                        meta={item.notify ? "Alerts on" : "Alerts off"}
                        href="/saved-searches/"
                      />
                    ))}
                  </ul>
                )}
              </PanelShell>
            );
          }

          if (panel === "my-listings") {
            return (
              <PanelShell key={panel} panel={panel} count={drafts.length}>
                {drafts.length === 0 ? <PanelEmpty panel={panel} /> : (
                  <ul role="list">
                    {drafts.slice(0, 6).map((draft) => (
                      <Row key={draft.id} title={draft.title} meta={String(draft.status).replaceAll("_", " ")} />
                    ))}
                  </ul>
                )}
              </PanelShell>
            );
          }

          if (panel === "enquiries") {
            return (
              <PanelShell key={panel} panel={panel} count={leads.length}>
                {leads.length === 0 ? <PanelEmpty panel={panel} /> : (
                  <div className="border border-ink/12 bg-sand/40 p-5">
                    <p className="flex items-center gap-2 text-sm ink-2">
                      <Inbox size={16} className="text-brick" aria-hidden="true" />
                      {leads.length} {leads.length === 1 ? "enquiry" : "enquiries"}. Contact details stay masked until consent is recorded.
                    </p>
                    <Link href="/broker/leads/" className="mt-3 inline-flex items-center gap-2 stamp font-semibold text-brick">
                      Open lead inbox <ArrowUpRight size={12} />
                    </Link>
                  </div>
                )}
              </PanelShell>
            );
          }

          if (panel === "channel") {
            return (
              <PanelShell key={panel} panel={panel} count={0}>
                <div className="border border-ink/12 bg-sand/40 p-5">
                  <p className="flex items-center gap-2 text-sm ink-2">
                    <Handshake size={16} className="text-brick" aria-hidden="true" />
                    Trade requirements and available property with verified partners.
                  </p>
                  <Link href="/broker/channel/" className="mt-3 inline-flex items-center gap-2 stamp font-semibold text-brick">
                    Open channel <ArrowUpRight size={12} />
                  </Link>
                </div>
              </PanelShell>
            );
          }

          // verification
          const verified = session?.organization?.verificationStatus;
          const isVerified = verified === "VERIFIED_PARTNER" || verified === "RERA_VERIFIED";
          return (
            <PanelShell key={panel} panel={panel} count={isVerified ? 1 : 0}>
              {isVerified ? (
                <div className="flex items-center gap-3 border border-trust/25 bg-trust/8 p-5">
                  <ShieldCheck size={18} className="text-trust" aria-hidden="true" />
                  <p className="text-sm ink-2">{session?.organization?.name} · {verified.replaceAll("_", " ")}</p>
                </div>
              ) : (
                <PanelEmpty panel={panel} />
              )}
            </PanelShell>
          );
        })}
      </main>
    </div>
  );
}
