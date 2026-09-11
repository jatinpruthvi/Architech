"use client";
/* Owner-only plan administration (spec §7). Manual activation is the
   by-design seam in place of a payment gateway: the owner signs in with the
   environment password, enters a buyer's login id, and grants the plan.
   The gate is rendered HERE (not RequireSession) because the super-admin
   session is a separate credential. */

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import LoadingSkeleton from "@/components/architech/LoadingSkeleton";
import useTitle from "@/hooks/useTitle";
import { useSession } from "@/contexts/SessionContext";

type Plan = { id: string; code: string; name: string; monthlyCredits: number; teamSeats: number };
type Subscription = { id: string; status: string; expiresAt: string | null; updatedAt: string; plan: { name: string }; organization: { name: string; slug: string } };
type Lookup =
  | { found: false }
  | {
      found: true;
      user: { name: string; email: string; role: string };
      organization: { id: string; name: string; slug: string; cityId: string | null };
      currentSubscription: { id: string; status: string; expiresAt: string | null; plan: { name: string; code: string } } | null;
    };
type Payload = { ok: true; plans: Plan[]; subscriptions: Subscription[]; lookup?: Lookup };

const STATUS_OPTIONS = ["TRIAL", "ACTIVE", "EXPIRED"] as const;
type StatusOption = (typeof STATUS_OPTIONS)[number];

const FIELD = "w-full border border-ink/18 bg-paper px-3.5 py-3 text-sm text-ink outline-none transition focus:border-brick focus:ring-2 focus:ring-brick/25";
const LABEL = "stamp block mb-2 ink-3";
const PRIMARY_BTN = "clay-fill touch-44 inline-flex items-center justify-center gap-2 bg-brick px-5 py-3 stamp font-semibold text-cream";
const GHOST_BTN = "touch-44 inline-flex items-center justify-center gap-2 border border-ink/18 px-5 py-3 stamp font-semibold ink-2";

function StatusPill({ status }: { status: string }) {
  const tone = status === "ACTIVE" ? "border-trust/40 bg-trust/10 text-trust" : status === "TRIAL" ? "border-ink/20 bg-sand ink-2" : "border-ember/40 bg-ember/10 text-ember";
  return <span className={`stamp inline-flex px-2.5 py-1 font-semibold ${tone}`}>{status.toLowerCase()}</span>;
}

export default function PlanAdmin() {
  useTitle("Plans · owner");
  const { session, status, refresh, signOut } = useSession();
  const authorized = session?.permissions.includes("admin.plans.read") ?? false;

  const [data, setData] = useState<Payload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fixtureMode, setFixtureMode] = useState(false);

  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [finding, setFinding] = useState(false);
  const [planId, setPlanId] = useState("");
  const [statusSel, setStatusSel] = useState<StatusOption>("ACTIVE");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [newPlan, setNewPlan] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/plans", { cache: "no-store" });
      if (response.status === 503) {
        setFixtureMode(true);
        return;
      }
      if (!response.ok) {
        setLoadError("The plan ledger could not be loaded.");
        return;
      }
      const payload = (await response.json()) as Payload;
      setData(payload);
      setPlanId((current) => current || payload.plans[0]?.id || "");
    } catch {
      setLoadError("The plan ledger could not be loaded.");
    }
  }, []);

  useEffect(() => {
    if (authorized) void load();
  }, [authorized, load]);

  async function onSignIn() {
    if (!password) {
      setSignInError("Enter the owner password.");
      return;
    }
    setSigningIn(true);
    setSignInError(null);
    try {
      const response = await fetch("/api/auth/super/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (response.ok) {
        setPassword("");
        await refresh(); // the session contract resolves the super-admin cookie
        return;
      }
      const payload = (await response.json().catch(() => null)) as { errors?: string[] } | null;
      setSignInError(payload?.errors?.[0] ?? "Sign-in failed.");
    } finally {
      setSigningIn(false);
    }
  }

  async function onFind() {
    if (!email.trim()) return;
    setFinding(true);
    setSaveError(null);
    try {
      const response = await fetch(`/api/admin/plans?lookup=${encodeURIComponent(email.trim())}`, { cache: "no-store" });
      if (!response.ok) {
        setLookup({ found: false });
        return;
      }
      const payload = (await response.json()) as Payload;
      setLookup(payload.lookup ?? { found: false });
    } finally {
      setFinding(false);
    }
  }

  async function onSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch("/api/admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          planId: planId || undefined,
          status: statusSel,
          expiresAt: statusSel === "EXPIRED" ? null : expiresAt || null,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; errors?: string[]; previousStatus?: string | null } | null;
      if (!response.ok || !payload?.ok) {
        setSaveError(response.status === 404 ? "No organization found for that login id." : payload?.errors?.[0] ?? "Could not save the plan.");
        return;
      }
      toast(payload.previousStatus ? "Plan updated." : "Plan granted.", {
        description: `Status is now ${statusSel.toLowerCase()}${statusSel !== "EXPIRED" && expiresAt ? ` until ${expiresAt}` : ""}.`,
      });
      await load();
      setLookup(null);
      setExpiresAt("");
    } finally {
      setSaving(false);
    }
  }

  async function onCreatePlan() {
    if (!newPlan.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const response = await fetch("/api/admin/plans/definitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newPlan.trim() }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; errors?: string[] } | null;
      if (!response.ok) {
        setCreateError(response.status === 409 ? "A plan with that name already exists." : payload?.errors?.[0] ?? "Could not create the plan.");
        return;
      }
      toast("Plan created.");
      setNewPlan("");
      await load();
    } finally {
      setCreating(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="container py-14 md:py-20">
        <div className="max-w-[720px] space-y-5">
          <LoadingSkeleton className="h-5 w-40" label="Loading" />
          <LoadingSkeleton className="h-12 w-64" label="Loading" />
          <LoadingSkeleton className="h-64 w-full" label="Loading" />
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="container py-14 md:py-20">
        <div className="mx-auto max-w-[420px]">
          <p className="kicker text-brick">Owner surface</p>
          <h1 className="display mt-6 text-4xl">Owner sign-in</h1>
          {session ? (
            <p className="mt-4 text-[15px] leading-7 ink-2">
              This surface is reserved for the owner. You are signed in as {session.user.name} ({session.user.role.toLowerCase()}).{" "}
              <button type="button" className="stamp font-semibold text-brick underline underline-offset-4" onClick={() => void signOut()}>
                Sign out
              </button>
            </p>
          ) : (
            <p className="mt-4 text-[15px] leading-7 ink-2">Enter the deployment&rsquo;s owner password to manage broker plans.</p>
          )}
          <form
            className="mt-8"
            onSubmit={(event) => {
              event.preventDefault();
              void onSignIn();
            }}
          >
            <label className={LABEL} htmlFor="owner-password">
              Owner password
            </label>
            <input id="owner-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className={FIELD} />
            {signInError && (
              <p role="alert" className="mt-3 border-l-2 border-ember bg-ember/8 px-3 py-2.5 text-xs leading-5 text-ember">
                {signInError}
              </p>
            )}
            <button type="submit" disabled={signingIn || !password} className={`${PRIMARY_BTN} mt-4 w-full disabled:opacity-60`}>
              <KeyRound size={15} aria-hidden="true" /> {signingIn ? "Checking…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (fixtureMode) {
    return (
      <div className="container py-14 md:py-20">
        <div className="mx-auto max-w-[560px] border-l-4 border-ember bg-sand/50 p-7">
          <p className="stamp text-ember">Not available in fixture mode</p>
          <p className="mt-3 text-[15px] leading-7 ink-2">
            Plan administration needs the database deployment (ARCHITECH_DATA_SOURCE=prisma). In memory mode there is no plan ledger to
            grant against.
          </p>
        </div>
      </div>
    );
  }

  const plans = data?.plans ?? [];
  const subscriptions = data?.subscriptions ?? [];
  const foundLookup = lookup?.found ? lookup : null;

  return (
    <div className="container py-14 md:py-20">
      <p className="kicker text-brick">Owner surface</p>
      <h1 className="display mt-6 text-4xl">Broker plans</h1>
      <p className="mt-4 max-w-[640px] text-[15px] leading-7 ink-2">
        Grant and manage calling plans by login id. Activation is manual by design — no payment gateway. Every change is written to the
        audit ledger with the previous status.
      </p>

      {loadError && !data && <p role="alert" className="mt-6 border-l-2 border-ember bg-ember/8 px-3 py-2.5 text-xs leading-5 text-ember">{loadError}</p>}

      {/* grant / update */}
      <section className="mt-10 border border-ink/12 bg-card p-6">
        <h2 className="stamp ink-3">Grant or update a plan</h2>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <label className={LABEL} htmlFor="plan-lookup">
              Buyer login id (email)
            </label>
            <input id="plan-lookup" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="owner@firm.in" className={FIELD} />
          </div>
          <button type="button" onClick={() => void onFind()} disabled={finding || !email.trim()} className={`${GHOST_BTN} disabled:opacity-60`}>
            <Search size={15} aria-hidden="true" /> {finding ? "Finding…" : "Find"}
          </button>
        </div>

        {lookup !== null && lookup.found === false && (
          <p className="mt-4 border-l-2 border-ink/20 bg-sand/60 px-3 py-2.5 text-xs leading-5 ink-2">No organization found for that login id.</p>
        )}

        {foundLookup && (
          <div className="mt-5 border-t border-ink/12 pt-5">
            <p className="text-sm font-medium text-ink">
              {foundLookup.organization.name} <span className="stamp ml-1 ink-3">@{foundLookup.organization.slug}</span>
            </p>
            <p className="mt-1 text-xs leading-5 ink-2">
              {foundLookup.currentSubscription
                ? `Current: ${foundLookup.currentSubscription.plan.name} · ${foundLookup.currentSubscription.status.toLowerCase()}${
                    foundLookup.currentSubscription.expiresAt ? ` · expires ${foundLookup.currentSubscription.expiresAt.slice(0, 10)}` : ""
                  }`
                : "No plan yet."}
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <label className={LABEL} htmlFor="plan-select">
                  Plan
                </label>
                <select id="plan-select" value={planId} onChange={(event) => setPlanId(event.target.value)} className={FIELD}>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="plan-status">
                  Status
                </label>
                <select id="plan-status" value={statusSel} onChange={(event) => setStatusSel(event.target.value as StatusOption)} className={FIELD}>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option.toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="plan-expires">
                  Expires <span className="ink-3">optional</span>
                </label>
                <input id="plan-expires" type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} disabled={statusSel === "EXPIRED"} className={`${FIELD} disabled:opacity-50`} />
              </div>
            </div>

            {saveError && (
              <p role="alert" className="mt-4 border-l-2 border-ember bg-ember/8 px-3 py-2.5 text-xs leading-5 text-ember">
                {saveError}
              </p>
            )}
            <button type="button" onClick={() => void onSave()} disabled={saving || !planId} className={`${PRIMARY_BTN} mt-5 disabled:opacity-60`}>
              {saving ? "Saving…" : "Save plan"}
            </button>
          </div>
        )}
      </section>

      {/* current subscriptions */}
      <section className="mt-10">
        <h2 className="stamp ink-3">Current subscriptions</h2>
        {subscriptions.length === 0 ? (
          <p className="mt-3 text-sm ink-2">No subscriptions yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-ink/15">
                  <th className="stamp py-2.5 pr-4 ink-3">Organization</th>
                  <th className="stamp py-2.5 pr-4 ink-3">Plan</th>
                  <th className="stamp py-2.5 pr-4 ink-3">Status</th>
                  <th className="stamp py-2.5 pr-4 ink-3">Expires</th>
                  <th className="stamp py-2.5 ink-3">Updated</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((row) => (
                  <tr key={row.id} className="border-b border-ink/8">
                    <td className="py-3 pr-4 text-sm text-ink">
                      {row.organization.name} <span className="stamp ink-3">@{row.organization.slug}</span>
                    </td>
                    <td className="py-3 pr-4 text-sm ink-2">{row.plan.name}</td>
                    <td className="py-3 pr-4">
                      <StatusPill status={row.status} />
                    </td>
                    <td className="py-3 pr-4 text-sm ink-2">{row.expiresAt ? row.expiresAt.slice(0, 10) : "—"}</td>
                    <td className="py-3 text-sm ink-3">{row.updatedAt.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* create plan */}
      <section className="mt-10 border border-dashed border-ink/20 p-6">
        <h2 className="stamp ink-3">New plan definition</h2>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <label className={LABEL} htmlFor="new-plan">
              Plan name
            </label>
            <input id="new-plan" value={newPlan} onChange={(event) => setNewPlan(event.target.value)} placeholder="Brokerage Team" className={FIELD} />
          </div>
          <button type="button" onClick={() => void onCreatePlan()} disabled={creating || !newPlan.trim()} className={`${GHOST_BTN} disabled:opacity-60`}>
            <Plus size={15} aria-hidden="true" /> {creating ? "Creating…" : "Create plan"}
          </button>
        </div>
        {createError && (
          <p role="alert" className="mt-3 border-l-2 border-ember bg-ember/8 px-3 py-2.5 text-xs leading-5 text-ember">
            {createError}
          </p>
        )}
      </section>
    </div>
  );
}
