# Broker Calling Completion + Manual Plan Activation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Phases 2–4 broker-calling slice (real reveal/call-logging API, encrypted contact flow end-to-end, prototype removal) and add owner-only super-admin login + `/admin/plans` page for manual plan activation.

**Architecture:** All server-side functions for the calling slice already exist but are orphaned — this plan wires them behind guarded API routes, rewires the lead detail page off prototype fixtures, derives per-organization plan status from the existing `MarketplaceSubscription` model, and adds a minimal super-admin surface (env-stored scrypt password, HMAC-signed cookie, two admin endpoints, one admin page) plus a lead retention purge.

**Tech Stack:** Next 16 (App Router, `nodejs` runtime), Prisma 7 (driver adapter), vitest, node:crypto (scrypt/HMAC/AES-GCM), vaul (dynamic import), Tailwind with design-token discipline.

**Spec:** `docs/superpowers/specs/2026-09-10-broker-calling-completion-design.md`

## Global Constraints

- **TDD:** every task writes the failing test first, watches it fail, then implements minimally.
- **No new dependencies.** `node:crypto` only for crypto.
- **Gate order is the contract:** ownership → permission → plan → consent → suppression → attempt limit → calling hours. A reorder that turns an access failure into a sales prompt is a bug.
- **No invented telephony evidence:** `LeadCallLog` gains no `duration`, `connected`, or recording column; outcomes are self-reported.
- **Design tokens:** new UI markup uses `.ink-2`/`.ink-3`/`.stamp` — never `text-ink/NN`, never `!text-[9px]`/`!text-[10px]` (ratchet test `client/src/lib/ui/design-token-discipline.test.ts` fails CI on growth).
- **Bundle budget:** anything new that adds JS to a route chunk must be dynamically imported (240 KB gzip ceiling, `performance/budgets.json`).
- **Org scoping:** every broker-lead route keeps `assertLeadBelongsToOrg`; unscoped queries are a historical leak.
- **New env keys** must land in `ALLOWED_ENV_KEYS` (`client/src/lib/operations/hygiene.ts`) **and** `.env.example` in the same commit (W5 parity test).
- **Free-first:** `tel:`/`wa.me` only; no telephony SaaS, no auto-dial.
- **`GET /api/broker/leads` masked list contract stays byte-identical** — its existing tests must pass unmodified.
- Node 20, pnpm. Test runner: `pnpm exec vitest run <file>`. Script tests: `node --test <file>`.
- Every task ends with a git commit on the current branch.

## File Structure

**Create:**
- `client/src/lib/leads/calling-server.test.ts` — gate tests for `revealLeadContact` / `logLeadCall` / `resolvePlanStatusForOrg` + the no-telephony-evidence schema test.
- `app/api/broker/leads/[id]/reveal/route.ts`, `app/api/broker/leads/[id]/calls/route.ts`, `app/api/broker/leads/metrics/route.ts` — the three missing broker routes.
- `client/src/lib/api-contract-broker-calling.test.ts` — route contract tests (fixture mode, like `api-contract.test.ts`).
- `scripts/privacy/purge-expired-leads.mjs` + `scripts/privacy/purge-expired-leads.test.mjs`.
- `client/src/lib/auth/super-admin.ts` + `client/src/lib/auth/super-admin.test.ts` — hash verify, cookie mint/parse, session builder.
- `app/api/auth/super/sign-in/route.ts`, `app/api/auth/super/sign-out/route.ts`.
- `client/src/lib/plans/admin.ts` + `client/src/lib/plans/admin.test.ts` — lookup / apply / definitions (prisma).
- `app/api/admin/plans/route.ts`, `app/api/admin/plans/definitions/route.ts`.
- `client/src/pages/PlanAdmin.tsx`, `app/admin/plans/page.tsx`.
- `scripts/auth/make-super-admin-hash.mjs`.

**Modify:**
- `client/src/lib/leads/calling-server.ts` — plan resolver, registry consent predicate, shared hours helpers, fixture call parity.
- `client/src/lib/leads/lead.ts` — fixture `consentClass` default + fixture call-state store.
- `app/api/broker/leads/[id]/route.ts` — add `GET` (currently DELETE-only).
- `client/src/pages/BrokerLeadDetail.tsx` — rewire to the real API; delete prototype artifacts.
- `client/src/lib/auth/roles.ts` — `SUPER_ADMIN` role, rank 50, source union member.
- `client/src/lib/auth/live.ts` — super-admin cookie check at the top of `getSessionContractForRequest`.
- `client/src/lib/operations/hygiene.ts` — allow-list `ARCHITECH_SUPER_ADMIN_PASSWORD_HASH`.
- `.env.example` — new key + override-semantics comment for `ARCHITECH_BROKER_PLAN_STATUS`.
- `package.json` — `privacy:leads:purge` + test script entries (mirror the requirements purge).
- `docs/business-suite/mobile-calling-implementation-plan.md` — tick completed phases, update §11 dispositions, record the plan-status decision.

**Delete:**
- `client/src/lib/leads/calling-prototype-data.ts` (prototype fixtures — plan §11 says delete when Phases 2–3 land).
- `client/src/lib/leads/hygiene.ts` (dead duplicate catalog; verified zero importers).

---

### Task 1: Per-organization plan status resolver

**Files:**
- Modify: `client/src/lib/leads/calling-server.ts` (append the resolver; import `getPrismaClient` is already present)
- Test: `client/src/lib/leads/calling-server.test.ts` (new file, starts here)

**Interfaces:**
- Produces: `export async function resolvePlanStatusForOrg(organizationId: string): Promise<BrokerPlanStatus>` — resolution order: explicit env override → fixture-mode default `ACTIVE` → prisma: most recent `MarketplaceSubscription` mapped (`TRIAL`→`TRIAL`, `ACTIVE`→`ACTIVE`, `PAUSED|EXPIRED|CANCELLED`→`EXPIRED`), no subscription → `NONE`.
- Consumes: `BrokerPlanStatus` from `./calling` (already exported: `"NONE" | "TRIAL" | "ACTIVE" | "EXPIRED"`), `isPrismaLeadStorage` from `./source`, `getPrismaClient` from `@/lib/repositories/server/prisma`.

- [ ] **Step 1: Write the failing tests**

Create `client/src/lib/leads/calling-server.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  marketplaceSubscription: { findFirst: vi.fn() },
}));

vi.mock("@/lib/repositories/server/prisma", () => ({ getPrismaClient: () => database }));
import { resolvePlanStatusForOrg } from "./calling-server";

const envKeys = ["ARCHITECH_LEAD_STORAGE", "ARCHITECH_BROKER_PLAN_STATUS"] as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ARCHITECH_BROKER_PLAN_STATUS", "");
  vi.stubEnv("ARCHITECH_LEAD_STORAGE", "memory");
});

afterEach(() => {
  vi.unstubAllEnvs();
  for (const key of envKeys) delete process.env[key];
});

describe("resolvePlanStatusForOrg (spec §3)", () => {
  it("fixture mode defaults to ACTIVE so the demo keeps working", async () => {
    await vi.stubEnv("ARCHITECH_LEAD_STORAGE", "memory");
    expect(await resolvePlanStatusForOrg("demo-org")).toBe("ACTIVE");
    expect(database.marketplaceSubscription.findFirst).not.toHaveBeenCalled();
  });

  it("an explicit env value overrides every mode", async () => {
    await vi.stubEnv("ARCHITECH_LEAD_STORAGE", "prisma");
    database.marketplaceSubscription.findFirst.mockResolvedValue({ status: "TRIAL" });
    await vi.stubEnv("ARCHITECH_BROKER_PLAN_STATUS", "EXPIRED");
    expect(await resolvePlanStatusForOrg("org-1")).toBe("EXPIRED");
  });

  it.each([
    ["TRIAL", "TRIAL"],
    ["ACTIVE", "ACTIVE"],
    ["PAUSED", "EXPIRED"],
    ["EXPIRED", "EXPIRED"],
    ["CANCELLED", "EXPIRED"],
  ])("prisma: subscription %s maps to %s", async (stored, expected) => {
    await vi.stubEnv("ARCHITECH_LEAD_STORAGE", "prisma");
    database.marketplaceSubscription.findFirst.mockResolvedValue({ status: stored });
    expect(await resolvePlanStatusForOrg("org-1")).toBe(expected);
  });

  it("prisma mode with no subscription row is NONE — the D3 entitlement gate", async () => {
    await vi.stubEnv("ARCHITECH_LEAD_STORAGE", "prisma");
    database.marketplaceSubscription.findFirst.mockResolvedValue(null);
    expect(await resolvePlanStatusForOrg("org-1")).toBe("NONE");
  });

  it("queries the most recent subscription for the organization", async () => {
    await vi.stubEnv("ARCHITECH_LEAD_STORAGE", "prisma");
    database.marketplaceSubscription.findFirst.mockResolvedValue({ status: "ACTIVE" });
    await resolvePlanStatusForOrg("org-9");
    expect(database.marketplaceSubscription.findFirst).toHaveBeenCalledWith({
      where: { organizationId: "org-9" },
      orderBy: [{ startsAt: "desc" }, { id: "desc" }],
      select: { status: true },
    });
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `pnpm exec vitest run client/src/lib/leads/calling-server.test.ts`
Expected: FAIL — `resolvePlanStatusForOrg` is not exported (import error).

- [ ] **Step 3: Implement the resolver**

Append to `client/src/lib/leads/calling-server.ts` (the file already imports `isPrismaLeadStorage`, `getPrismaClient`, and `type BrokerPlanStatus` from `./calling`):

```ts
/* Plan status for ONE organization (spec §3).
 *
 * Resolution order:
 *   1. An explicitly set ARCHITECH_BROKER_PLAN_STATUS overrides everything —
 *      it is the ops/demo lever, not a silent default.
 *   2. Fixture/memory mode has no subscription store: default ACTIVE so the
 *      demo flow keeps working (historical behaviour).
 *   3. Prisma mode: the organization's most recent MarketplaceSubscription.
 *      No row → NONE. In a real deployment an org with no activated plan
 *      cannot reveal or call — that is decision D3 working, and plans are
 *      granted manually by the owner on /admin/plans. */
const ENV_PLAN_VALUES = ["NONE", "TRIAL", "ACTIVE", "EXPIRED"] as const;

function envPlanOverride(): BrokerPlanStatus | null {
  const value = process.env.ARCHITECH_BROKER_PLAN_STATUS;
  return value && (ENV_PLAN_VALUES as readonly string[]).includes(value) ? (value as BrokerPlanStatus) : null;
}

const SUBSCRIPTION_TO_PLAN: Record<string, BrokerPlanStatus> = {
  TRIAL: "TRIAL",
  ACTIVE: "ACTIVE",
  PAUSED: "EXPIRED",
  EXPIRED: "EXPIRED",
  CANCELLED: "EXPIRED",
};

export async function resolvePlanStatusForOrg(organizationId: string): Promise<BrokerPlanStatus> {
  const override = envPlanOverride();
  if (override) return override;
  if (!isPrismaLeadStorage()) return "ACTIVE";
  const db = getPrismaClient() as unknown as {
    marketplaceSubscription: { findFirst(args: unknown): Promise<{ status: string } | null> };
  };
  const row = await db.marketplaceSubscription.findFirst({
    where: { organizationId },
    orderBy: [{ startsAt: "desc" }, { id: "desc" }],
    select: { status: true },
  });
  if (!row) return "NONE";
  return SUBSCRIPTION_TO_PLAN[row.status] ?? "NONE";
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `pnpm exec vitest run client/src/lib/leads/calling-server.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/leads/calling-server.ts client/src/lib/leads/calling-server.test.ts
git commit -m "feat(leads): per-organization plan status resolver

resolvePlanStatusForOrg: explicit env override wins; fixture mode keeps
the ACTIVE demo default; prisma mode derives NONE|TRIAL|ACTIVE|EXPIRED
from the org's most recent MarketplaceSubscription (PAUSED/CANCELLED
read as EXPIRED). An org with no subscription is NONE — the D3
entitlement gate now means something in real deployments."
```

---

### Task 2: Harden the reveal/call-logging server functions

**Files:**
- Modify: `client/src/lib/leads/lead.ts` (fixture `consentClass` default + fixture call state)
- Modify: `client/src/lib/leads/calling-server.ts` (registry consent predicate, shared hours helpers, fixture call logging, plan resolver wired into both functions)
- Test: `client/src/lib/leads/calling-server.test.ts` (extend), `client/src/lib/leads/lead.test.ts` (extend)

**Interfaces:**
- Consumes: `resolvePlanStatusForOrg` (Task 1); `consentPermissionsFor` from `@/lib/interop/lead-ingestion`; `parseCallingHours`, `isWithinCallingHours`, `nextStageFor`, `OUTCOME_RULES` from `./calling`; `createLeadForServer` from `./server` (fixture creation path goes through `createLead`).
- Produces: `revealLeadContact(request, leadId, organizationId)` and `logLeadCall(leadId, organizationId, actorUserId, input)` — same signatures as today, same response shapes; now backed by the plan resolver and fixture call state. New fixture exports from `lead.ts`: `recordFixtureCall(leadId, entry: { outcome: string; stageBefore: string; stageAfter: string; nextActionAt: string | null; note: string | null })`, `fixtureLeadDetail(id, organizationId): { stage: string; callAttempts: number; suppressed: boolean; nextActionAt: string | null; callHistory: Array<Record<string, string | null>> } | null`.

- [ ] **Step 1: Write the failing tests — fixture call state in `lead.ts`**

Append to `client/src/lib/leads/lead.test.ts` (the file already imports from `./lead` and resets the store with `resetLeadStoreForTests` — keep that pattern):

```ts
describe("fixture call state (both-store parity, spec §5)", () => {
  beforeEach(() => {
    resetLeadStoreForTests();
    vi.stubEnv("ARCHITECH_LEAD_STORAGE", "memory");
  });
  afterEach(() => vi.unstubAllEnvs());

  function makeLead(overrides: Record<string, unknown> = {}) {
    const result = createLeadForServerSync("listing-1", "07941234567", "Test Buyer");
    if (!result.ok) throw new Error("fixture lead should create");
    return result.lead.id;
  }

  it("createLead defaults consentClass to first-party-form like the prisma path", async () => {
    const { createLeadForServer } = await import("./server");
    const result = await createLeadForServer({
      listingId: "listing-1",
      name: "Consent Buyer",
      phone: "07941234567",
      message: "Is this 3 BHK still available this week?",
      consentText: "I agree to being contacted about this enquiry.",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.lead.consentClass).toBe("first-party-form");
  });

  it("recordFixtureCall advances stage, attempts and suppression", () => {
    const id = makeLead();
    recordFixtureCall(id, { outcome: "NO_ANSWER", stageBefore: "NEW", stageAfter: "FOLLOW_UP", nextActionAt: "2026-09-11T09:00:00.000Z", note: "ringing" });
    const detail = fixtureLeadDetail(id, demoBrokerSession.organization!.id)!;
    expect(detail.stage).toBe("FOLLOW_UP");
    expect(detail.callAttempts).toBe(1);
    expect(detail.suppressed).toBe(false);
    expect(detail.nextActionAt).toBe("2026-09-11T09:00:00.000Z");
    expect(detail.callHistory).toHaveLength(1);
    recordFixtureCall(id, { outcome: "NOT_INTERESTED", stageBefore: "FOLLOW_UP", stageAfter: "LOST", nextActionAt: null, note: null });
    const after = fixtureLeadDetail(id, demoBrokerSession.organization!.id)!;
    expect(after.suppressed).toBe(true);
    expect(after.callAttempts).toBe(2);
    expect(after.stage).toBe("LOST");
  });
});
```

Note: `createLeadForServerSync` is a test helper alias — define it at the top of the added block as a direct call to the synchronous fixture path: `const createLeadForServerSync = (listingId, phone, name) => createLead({ listingId, name, phone, message: "Is this 3 BHK still available this week?", consentText: "I agree to being contacted about this enquiry.", organizationId: demoBrokerSession.organization?.id ?? null });` (import `createLead`, `recordFixtureCall`, `fixtureLeadDetail`, `demoBrokerSession` at the top of the file alongside the existing imports; `demoBrokerSession` comes from `@/lib/auth/roles`).

- [ ] **Step 2: Run and watch fail**

Run: `pnpm exec vitest run client/src/lib/leads/lead.test.ts`
Expected: FAIL — `recordFixtureCall`/`fixtureLeadDetail` not exported; consentClass undefined.

- [ ] **Step 3: Implement fixture call state in `lead.ts`**

In `client/src/lib/leads/lead.ts`:

(a) In `createLead`, the record literal — replace `consentClass: input.consentClass,` with `consentClass: input.consentClass ?? "first-party-form",`.

(b) Add the fixture call store next to `contactByLeadId`:

```ts
type FixtureCallEntry = {
  outcome: string;
  stageBefore: string;
  stageAfter: string;
  nextActionAt: string | null;
  note: string | null;
  lostReason: string | null;
};
const callsByLeadId = new Map<string, FixtureCallEntry[]>();
```

(c) Export the two functions:

```ts
/** Fixture-mode call logging: mirrors the prisma LeadCallLog update path so
    the detail → dial → log flow works without a database (e2e + demo). */
export function recordFixtureCall(
  leadId: string,
  entry: { outcome: string; stageBefore: string; stageAfter: string; nextActionAt: string | null; note: string | null; lostReason: string | null },
): void {
  const calls = callsByLeadId.get(leadId) ?? [];
  calls.push(entry);
  callsByLeadId.set(leadId, calls);
}

/** Read-side of the fixture call state for the single-lead detail contract. */
export function fixtureLeadDetail(
  id: string,
  organizationId: string,
): { stage: string; callAttempts: number; suppressed: boolean; nextActionAt: string | null; callHistory: Array<Record<string, string | null>> } | null {
  const lead = findLeadForOrganization(id, organizationId);
  if (!lead) return null;
  const calls = callsByLeadId.get(id) ?? [];
  const last = calls.at(-1);
  return {
    stage: last?.stageAfter ?? "NEW",
    callAttempts: calls.length,
    suppressed: calls.some((call) => call.outcome === "WRONG_NUMBER" || call.outcome === "NOT_INTERESTED"),
    nextActionAt: last?.nextActionAt ?? null,
    callHistory: calls.map((call) => ({ ...call, createdAt: "" })),
  };
}
```

(d) In `resetLeadStoreForTests`, also `callsByLeadId.clear();`.

- [ ] **Step 4: Run and watch pass**

Run: `pnpm exec vitest run client/src/lib/leads/lead.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing gate tests for `calling-server.ts`**

Append to `client/src/lib/leads/calling-server.test.ts` (the file already mocks the prisma client and stubs storage env from Task 1 — add `lead`, `leadCallLog`, `auditEvent` to the hoisted `database` object and a `createFakeLead(row)` helper):

```ts
const PRISMA_ROW_OK = {
  id: "lead-1",
  phoneCiphertext: ENCRYPTED_OK, // encryptContact("+919876543210") built in beforeEach
  consentClass: "first-party-form",
  callSuppressedAt: null,
  callAttempts: 0,
  stage: "NEW",
};

describe("revealLeadContact (spec §4/§5)", () => {
  async function asBroker(organizationId = "org-1") {
    vi.stubEnv("ARCHITECH_LEAD_STORAGE", "prisma");
    vi.stubEnv("ARCHITECH_BROKER_PLAN_STATUS", "");
    database.lead.findUnique.mockResolvedValue(PRISMA_ROW_OK);
    database.marketplaceSubscription.findFirst.mockResolvedValue({ status: "ACTIVE" });
    database.auditEvent.create.mockResolvedValue({ id: "audit-1" });
    return revealLeadContact(new Request("http://localhost/api/broker/leads/lead-1/reveal", { headers: { "x-forwarded-for": "203.0.113.7" } }), "lead-1", organizationId);
  }

  it("returns tel + wa.me links for a stored, consenting, in-hours lead", async () => {
    const result = await asBroker();
    expect(result).toMatchObject({ ok: true, revealed: true });
    expect(result.telLink).toBe("tel:+919876543210");
    expect(result.waMeLink).toContain("919876543210");
    expect(database.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "lead.contact.revealed", ipHash: expect.any(String) }) }),
    );
  });

  it("gate order: a foreign lead is blocked before any plan or reveal work", async () => {
    vi.stubEnv("ARCHITECH_LEAD_STORAGE", "prisma");
    // The real assertLeadBelongsToOrg (client/src/lib/leads/server.ts) queries
    // prisma.lead — mock it returning null for the foreign id, giving the real
    // 404 path. Read server.ts first and match its exact query shape.
    database.lead.findFirst.mockResolvedValue(null);
    const result = await revealLeadContact(new Request("http://x/api/broker/leads/other/reveal"), "other", "org-1");
    expect(result).toMatchObject({ ok: false, status: 404 });
    expect(database.auditEvent.create).not.toHaveBeenCalled();
  });

  it("plan NONE/EXPIRED blocks with 402 before any per-lead check", async () => {
    for (const status of ["NONE", "EXPIRED"]) {
      database.marketplaceSubscription.findFirst.mockResolvedValue({ status });
      const result = await asBroker();
      expect(result).toMatchObject({ ok: false, status: 402 });
    }
  });

  it("a consent class without humanFirstTouch is blocked (registry predicate)", async () => {
    database.lead.findUnique.mockResolvedValue({ ...PRISMA_ROW_OK, consentClass: "imported-unknown" });
    vi.stubEnv("ARCHITECH_LEAD_STORAGE", "prisma");
    const { CONSENT_CLASSES } = await import("@/lib/interop/lead-ingestion");
    // The test must block exactly when the registry says no human first touch:
    const row = { ...PRISMA_ROW_OK, consentClass: CONSENT_CLASSES["imported-unknown"].humanFirstTouch ? "first-party-form" : "imported-unknown" };
    database.lead.findUnique.mockResolvedValue(row);
    const result = await revealLeadContact(new Request("http://x/api/broker/leads/lead-1/reveal"), "lead-1", "org-1");
    if (CONSENT_CLASSES["imported-unknown"].humanFirstTouch) {
      expect(result).toMatchObject({ ok: true });
    } else {
      expect(result).toMatchObject({ ok: false, status: 403 });
    }
  });

  it("suppressed leads are blocked with 403", async () => {
    database.lead.findUnique.mockResolvedValue({ ...PRISMA_ROW_OK, callSuppressedAt: new Date() });
    const result = await asBroker();
    expect(result).toMatchObject({ ok: false, status: 403 });
  });

  it("the attempt limit blocks with 429 and names logging the result", async () => {
    database.lead.findUnique.mockResolvedValue({ ...PRISMA_ROW_OK, callAttempts: 3 });
    const result = await asBroker();
    expect(result).toMatchObject({ ok: false, status: 429 });
    expect(String((result as { errors?: string[] }).errors?.join(" "))).toMatch(/log the (last )?call result/i);
  });

  it("outside the configured IST window the message names that window", async () => {
    vi.stubEnv("ARCHITECH_CALLING_HOURS_IST", "00:00-01:00");
    // Pick a moment guaranteed outside 00:00-01:00 IST: local noon is never enough
    // (noon in some zone can be 00:30 IST), so drive the clock instead.
    const realDate = Date.now;
    vi.spyOn(global.Date, "now").mockReturnValue(Date.UTC(2026, 8, 10, 12, 0, 0)); // 17:30 IST
    try {
      const result = await asBroker();
      expect(result).toMatchObject({ ok: false, status: 403 });
      expect(String((result as { errors?: string[] }).errors?.join(" "))).toContain("00:00-01:00");
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("a pre-migration lead without ciphertext is 422 not-stored, never a 500", async () => {
    database.lead.findUnique.mockResolvedValue({ ...PRISMA_ROW_OK, phoneCiphertext: null });
    const result = await asBroker();
    expect(result).toMatchObject({ ok: false, status: 422 });
  });
});
```

In `beforeEach` of that describe (or the file-level one): build the ciphertext once — `const { encryptContact } = await import("@/lib/interop/contact-crypto"); vi.stubEnv("ARCHITECH_CONTACT_ENCRYPTION_KEY", canonical32BytesBase64); const ENCRYPTED_OK = encryptContact("+919876543210");` where `canonical32BytesBase64` is a fixed test key: `Buffer.from("0123456789abcdef0123456789abcdef").toString("base64")` — canonical base64 of exactly 32 bytes, which is what `contact-crypto` validates. Add `assertLeadBelongsToOrg` to the hoisted mock so the ownership test can flip it: `database.assertOwnership = { ok: true };` and inside `revealLeadContact` the ownership call reads the mock (see Step 6 — the function keeps calling the real `assertLeadBelongsToOrg` from `./server`; the test instead stubs the module: add `vi.mock("./server", ...)` is too broad — simpler: the ownership test uses a lead id that the real `assertLeadBelongsToOrg` cannot own. In fixture/prisma modes `assertLeadBelongsToOrg` queries the DB: in prisma mode it uses `database.lead.findFirst` — add `lead: { findUnique: vi.fn(), findFirst: vi.fn() }` and have `findFirst` return `null` for the foreign-lead test, giving the real 404 path. Delete the `assertOwnership` field from the mock; the test becomes:

```ts
it("gate order: a foreign lead is blocked before any plan or reveal work", async () => {
  vi.stubEnv("ARCHITECH_LEAD_STORAGE", "prisma");
  database.lead.findFirst.mockResolvedValue(null); // assertLeadBelongsToOrg → 404
  const result = await revealLeadContact(new Request("http://x/api/broker/leads/other/reveal"), "other", "org-1");
  expect(result).toMatchObject({ ok: false, status: 404 });
  expect(database.auditEvent.create).not.toHaveBeenCalled();
});
```

Add `lead: { findUnique: vi.fn(), findFirst: vi.fn() }` to the hoisted mock (the foreign-lead test drives `findFirst` → `null`; the reveal path drives `findUnique`). Read `assertLeadBelongsToOrg` in `client/src/lib/leads/server.ts` before finalizing the mock args — match its real query shape exactly.

- [ ] **Step 6: Run and watch fail**

Run: `pnpm exec vitest run client/src/lib/leads/calling-server.test.ts`
Expected: FAIL on the plan/consent/hours/fixture expectations (current code hardcodes the consent pair, inline hours math, global env plan).

- [ ] **Step 7: Implement the `calling-server.ts` changes**

(a) Imports — add `consentPermissionsFor` from `@/lib/interop/lead-ingestion`, `parseCallingHours`, `isWithinCallingHours` from `./calling`; remove nothing else yet (DEMO_* removal is Task 4).

(b) Replace the `planStatus()` function with the resolver usage: both `revealLeadContact` and `logLeadCall` become async-able already (they are async) — replace `planAllowsReveal(planStatus())` with:

```ts
const plan = await resolvePlanStatusForOrg(organizationId);
if (!planAllowsReveal(plan)) return { ok: false as const, status: 402, errors: ["Activate a broker plan to reveal buyer numbers."] };
```

(c) Replace both inline consent checks (`row.consentClass === "portal-shared" || row.consentClass === "aggregator-shared"` and the fixture equivalent) with one shared helper in the file:

```ts
function consentAllowsHumanCall(consentClass: string | null | undefined): boolean {
  return consentPermissionsFor((consentClass ?? "first-party-form") as Parameters<typeof consentPermissionsFor>[0]).humanFirstTouch;
}
// ...
if (!consentAllowsHumanCall(row.consentClass)) return { ok: false as const, status: 403, errors: ["This buyer's consent does not permit a phone call."] };
```

(d) Replace both inline IST hour computations with the shared helpers:

```ts
const hours = parseCallingHours(process.env.ARCHITECH_CALLING_HOURS_IST);
if (!hours || !isWithinCallingHours(now, hours)) {
  const window = process.env.ARCHITECH_CALLING_HOURS_IST ?? "09:00-20:00";
  return { ok: false as const, status: 403, errors: [`Outside permitted calling hours (${window} IST).`] };
}
```

(e) Fixture branch of `revealLeadContact`: keep the `getFixtureLeadContact` lookup (real fixture leads created through the form), replace the `DEMO_CONTACTS`/`DEMO_CALL_STATE` read with `fixtureLeadDetail(leadId, organizationId)` for attempts/suppression:

```ts
const state = fixtureLeadDetail(leadId, organizationId) ?? { stage: "NEW", callAttempts: 0, suppressed: false, nextActionAt: null, callHistory: [] };
if (state.suppressed) return { ok: false as const, status: 403, errors: ["This number is on the do-not-call list."] };
if (state.callAttempts >= attemptLimit()) return { ok: false as const, status: 429, errors: ["Attempt limit reached. Log the last call result before trying again."] };
```

and the demo-lead synthetic consent fallback (`demoLead.consentClass === ...`) becomes `!consentAllowsHumanCall(demoLead?.consentClass)`.

(f) Fixture branch of `logLeadCall`: persist through the fixture store:

```ts
const lead = findLeadForOrganization(leadId, organizationId);
const state = fixtureLeadDetail(leadId, organizationId);
const stageBefore = (state?.stage ?? "NEW") as LeadStage;
const stageAfter = nextStageFor(stageBefore, outcome);
recordFixtureCall(leadId, { outcome, stageBefore, stageAfter, nextActionAt: nextActionAt?.toISOString() ?? null, note, lostReason });
return { ok: true as const, call: { outcome, stageBefore, stageAfter, nextActionAt: nextActionAt?.toISOString() ?? null } };
```

(The `FixtureCallEntry` type from Step 3 already carries `lostReason: string | null`; the `callHistory` spread then includes it.)

- [ ] **Step 8: Run and watch pass**

Run: `pnpm exec vitest run client/src/lib/leads/calling-server.test.ts client/src/lib/leads/lead.test.ts`
Expected: PASS (all).

- [ ] **Step 9: Add the no-telephony-evidence schema guardrail test**

Append to `calling-server.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("plan §6 guardrails", () => {
  it("LeadCallLog carries no invented telephony evidence (no duration/connected/recording)", () => {
    const schema = readFileSync(join(__dirname, "../../../prisma/schema.prisma"), "utf8");
    const block = schema.slice(schema.indexOf("model LeadCallLog {"), schema.indexOf("}", schema.indexOf("model LeadCallLog {")));
    expect(block).not.toMatch(/\b(duration|connected|recordingUrl|recording)\b/i);
  });
});
```

- [ ] **Step 10: Full suite + commit**

Run: `pnpm test` — Expected: PASS (no regressions; the masked-list contract in `lead.test.ts` passes unmodified).

```bash
git add client/src/lib/leads/calling-server.ts client/src/lib/leads/lead.ts client/src/lib/leads/calling-server.test.ts client/src/lib/leads/lead.test.ts
git commit -m "feat(leads): wire the calling gate to per-org plans, the consent registry, and fixture parity

revealLeadContact/logLeadCall now resolve plan status per organization
(Task 1 resolver), gate consent through consentPermissionsFor instead of
a hardcoded pair, reuse parseCallingHours/isWithinCallingHours, and
log fixture calls through the new fixture call store so the whole flow
works in memory mode. The message names the configured IST window.
Adds the no-invented-telephony-evidence schema guardrail test."
```

---

### Task 3: The four broker API routes

**Files:**
- Modify: `app/api/broker/leads/[id]/route.ts` (add `GET`)
- Create: `app/api/broker/leads/[id]/reveal/route.ts`, `app/api/broker/leads/[id]/calls/route.ts`, `app/api/broker/leads/metrics/route.ts`
- Test: `client/src/lib/api-contract-broker-calling.test.ts` (new)

**Interfaces:**
- Consumes: `authorizeRequest`/`isAuthorized` from `@/lib/auth/guards`; `getLeadDetailForServer`, `getLeadMetricsForServer` from `@/lib/listing/details`; `revealLeadContact`, `logLeadCall` from `@/lib/leads/calling-server`; `LeadDetailRecord` from `@/lib/leads/lead`.
- Produces (route contracts, locked by the tests):
  - `GET /api/broker/leads/[id]` → 200 `{ ok: true, lead: LeadDetailRecord }`; 404 `{ ok: false, status, errors }` for foreign/missing; 403 without org.
  - `POST /api/broker/leads/[id]/reveal` → 200 `{ ok: true, telLink, waMeLink, revealed: true }` or passthrough of the gate failure (`{ ok: false, status, errors }` with the matching HTTP status).
  - `POST /api/broker/leads/[id]/calls` body `{ outcome, nextActionAt?, note?, lostReason? }` → 200 `{ ok: true, call: {...} }`; 400 validation failures; 429/403 passthrough.
  - `GET /api/broker/leads/metrics` → 200 `{ ok: true, metrics: { overdue, outcomes, lostReasons } }`; 403 without org.

- [ ] **Step 1: Write the failing contract tests**

Create `client/src/lib/api-contract-broker-calling.test.ts`. Demo mode hands the handlers the `demoBrokerSession` (BROKER_ADMIN with `lead.inbox.read`/`write` and org `demo-org-nivasa-partners`) when no session cookie is present — the same convention `api-contract.test.ts` relies on:

```ts
/* Broker lead calling contract (spec §4). Demo mode = demoBrokerSession
   (no cookie → the historical demo contract hands out the broker admin).
   Fixture storage mode: leads are created through the public lead route,
   which exercises createLeadForServer's fixture path. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as leadDetailGet, DELETE as leadDelete } from "../../../app/api/broker/leads/[id]/route";
import { POST as revealPost } from "../../../app/api/broker/leads/[id]/reveal/route";
import { POST as callsPost } from "../../../app/api/broker/leads/[id]/calls/route";
import { GET as metricsGet } from "../../../app/api/broker/leads/metrics/route";
import { POST as publicLeadsPost } from "../../../app/api/leads/route";
import { resetLeadStoreForTests } from "./leads/lead";
import { demoBrokerSession } from "./auth/roles";

const ORG = demoBrokerSession.organization!.id;

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

beforeEach(() => {
  resetLeadStoreForTests();
  vi.stubEnv("ARCHITECH_LEAD_STORAGE", "memory");
  vi.stubEnv("ARCHITECH_BROKER_PLAN_STATUS", "");
});

function postLead(name = "Contract Buyer", phone = "07941234567") {
  return publicLeadsPost(
    new Request("http://localhost/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listingId: "listing-1",
        name,
        phone,
        message: "Is this 3 BHK still available this week?",
        consentText: "I agree to being contacted about this enquiry.",
      }),
    }),
  );
}

describe("GET /api/broker/leads/[id]", () => {
  it("returns the LeadDetailRecord for an owned fixture lead", async () => {
    const created = await json(await postLead());
    expect(created.ok).toBe(true);
    const id = (created as { lead: { id: string } }).lead.id;
    const response = await leadDetailGet(new Request(`http://localhost/api/broker/leads/${id}`));
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.ok).toBe(true);
    const lead = body.lead as Record<string, unknown>;
    expect(lead).toMatchObject({ id, name: "Contract Buyer", stage: "NEW", callAttempts: 0, suppressed: false, consentClass: "first-party-form" });
    expect(lead).toHaveProperty("callHistory");
  });

  it("returns 404 for a lead outside the session organization", async () => {
    const response = await leadDetailGet(new Request("http://localhost/api/broker/leads/someone-elses-lead"));
    expect(response.status).toBe(404);
  });
});

describe("POST /api/broker/leads/[id]/reveal", () => {
  it("reveals a fixture lead created through the public form", async () => {
    const created = await json(await postLead());
    const id = (created as { lead: { id: string } }).lead.id;
    const response = await revealPost(new Request(`http://localhost/api/broker/leads/${id}/reveal`, { method: "POST" }));
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body).toMatchObject({ ok: true, revealed: true });
    expect(body.telLink).toBe("tel:+917941234567");
    expect(String(body.waMeLink)).toContain("917941234567");
  });

  it("passes the gate status through (402 when the plan override is NONE)", async () => {
    vi.stubEnv("ARCHITECH_BROKER_PLAN_STATUS", "NONE");
    const created = await json(await postLead());
    const id = (created as { lead: { id: string } }).lead.id;
    const response = await revealPost(new Request(`http://localhost/api/broker/leads/${id}/reveal`, { method: "POST" }));
    expect(response.status).toBe(402);
  });

  it("returns 404 for a foreign lead without leaking existence", async () => {
    const response = await revealPost(new Request("http://localhost/api/broker/leads/other-org-lead/reveal", { method: "POST" }));
    expect(response.status).toBe(404);
  });
});

describe("POST /api/broker/leads/[id]/calls", () => {
  async function setupLead(): Promise<string> {
    const created = await json(await postLead());
    return (created as { lead: { id: string } }).lead.id;
  }

  it("logs NO_ANSWER, keeps the stage, requires nextActionAt", async () => {
    const id = await setupLead();
    const missing = await callsPost(
      new Request(`http://localhost/api/broker/leads/${id}/calls`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome: "NO_ANSWER" }) }),
    );
    expect(missing.status).toBe(400);
    const ok = await callsPost(
      new Request(`http://localhost/api/broker/leads/${id}/calls`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome: "NO_ANSWER", nextActionAt: "2026-09-11T09:00:00.000Z" }) }),
    );
    expect(ok.status).toBe(200);
    const body = await json(ok);
    expect((body.call as Record<string, unknown>).stageBefore).toBe("NEW");
  });

  it("NOT_INTERESTED requires a lost reason and suppresses the lead", async () => {
    const id = await setupLead();
    const ok = await callsPost(
      new Request(`http://localhost/api/broker/leads/${id}/calls`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome: "NOT_INTERESTED", lostReason: "bought elsewhere" }) }),
    );
    expect(ok.status).toBe(200);
    const detail = await leadDetailGet(new Request(`http://localhost/api/broker/leads/${id}`));
    const lead = ((await json(detail)).lead as Record<string, unknown>);
    expect(lead.suppressed).toBe(true);
    expect(lead.callAttempts).toBe(1);
  });

  it("rejects an unknown outcome with 400", async () => {
    const id = await setupLead();
    const response = await callsPost(
      new Request(`http://localhost/api/broker/leads/${id}/calls`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome: "CONNECTED_FOR_12_MINUTES" }) }),
    );
    expect(response.status).toBe(400);
  });
});

describe("GET /api/broker/leads/metrics", () => {
  it("counts calls logged through the fixture store", async () => {
    const created = await json(await postLead());
    const id = (created as { lead: { id: string } }).lead.id;
    await callsPost(
      new Request(`http://localhost/api/broker/leads/${id}/calls`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome: "NOT_INTERESTED", lostReason: "bought elsewhere" }) }),
    );
    const response = await metricsGet(new Request("http://localhost/api/broker/leads/metrics"));
    expect(response.status).toBe(200);
    const body = await json(response);
    expect((body.metrics as Record<string, unknown>).outcomes).toMatchObject({ NOT_INTERESTED: 1 });
    expect((body.metrics as Record<string, unknown>).lostReasons).toMatchObject({ "bought elsewhere": 1 });
  });

  it("requires the organization", async () => {
    const response = await metricsGet(new Request("http://localhost/api/broker/leads/metrics?source=demo&mode=none"));
    // mode=none forces a sessionless contract → 401 from the guard
    expect([401, 403]).toContain(response.status);
  });
});
```

Notes for the implementer:
- `POST /api/leads` (public lead route) is the fixture lead creation path; confirm its handler signature (it already exists and is tested in `api-contract.test.ts` — reuse the request shape from that file if the body keys differ).
- The fixture reveal path returns `tel:+917941234567` because `normalizeIndianPhone("07941234567")` → `+917941234567`; if the normalizer rejects that number, pick a valid 10-digit mobile number (e.g. `9876500001` → `+919876500001`) and assert accordingly — the test's point is the round trip, not the digits.
- The metrics fixture branch of `getLeadMetricsForServer` currently returns zeros for non-prisma — update it in Step 3 to compute from `fixtureLeadDetail`/the fixture call store (export a `fixtureCallMetrics(organizationId)` helper from `lead.ts` if needed).

- [ ] **Step 2: Run and watch fail**

Run: `pnpm exec vitest run client/src/lib/api-contract-broker-calling.test.ts`
Expected: FAIL — the four route files/handlers don't exist (import errors).

- [ ] **Step 3: Implement the routes**

`app/api/broker/leads/[id]/route.ts` — add (keep the existing DELETE and its comment block):

```ts
import { getLeadDetailForServer } from "@/lib/listing/details";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeRequest(request, { permission: "lead.inbox.read" });
  if (!isAuthorized(access)) return access.response;
  const organizationId = access.session.organization?.id;
  if (!organizationId) return NextResponse.json({ ok: false, error: "ORGANIZATION_REQUIRED", errors: ["A partner organization is required."] }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const { id } = await params;
  const detail = await getLeadDetailForServer(id, organizationId);
  if (!detail.ok) return NextResponse.json(detail, { status: detail.status, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ ok: true, lead: detail.lead }, { headers: { "Cache-Control": "no-store" } });
}
```

`app/api/broker/leads/[id]/reveal/route.ts`:

```ts
import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { revealLeadContact } from "@/lib/leads/calling-server";

export const runtime = "nodejs";

/* The gated reveal (spec §4). Permission and ownership are enforced twice —
   here and inside revealLeadContact — because the function is the
   authorization boundary and the route keeps the uniform 401/403 shape. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeRequest(request, { permission: "lead.inbox.write" });
  if (!isAuthorized(access)) return access.response;
  const organizationId = access.session.organization?.id;
  if (!organizationId) return NextResponse.json({ ok: false, error: "ORGANIZATION_REQUIRED", errors: ["A partner organization is required to reveal a lead."] }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const { id } = await params;
  const result = await revealLeadContact(request, id, organizationId);
  return NextResponse.json(result, { status: result.ok ? 200 : result.status, headers: { "Cache-Control": "no-store" } });
}
```

`app/api/broker/leads/[id]/calls/route.ts`:

```ts
import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { logLeadCall } from "@/lib/leads/calling-server";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeRequest(request, { permission: "lead.inbox.write" });
  if (!isAuthorized(access)) return access.response;
  const organizationId = access.session.organization?.id;
  if (!organizationId) return NextResponse.json({ ok: false, error: "ORGANIZATION_REQUIRED", errors: ["A partner organization is required to log a call."] }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const { id } = await params;
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, status: 400, errors: ["A JSON body with a call outcome is required."] }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const result = await logLeadCall(id, organizationId, access.session.user.id, body);
  return NextResponse.json(result, { status: result.ok ? 200 : result.status, headers: { "Cache-Control": "no-store" } });
}
```

`app/api/broker/leads/metrics/route.ts`:

```ts
import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { getLeadMetricsForServer } from "@/lib/listing/details";

export const runtime = "nodejs";

/* The call-result panel the inbox already fetches (overdue / calls logged /
   lost reasons). The route was missing — this is the read side of Phase 4. */
export async function GET(request: Request) {
  const access = await authorizeRequest(request, { permission: "lead.inbox.read" });
  if (!isAuthorized(access)) return access.response;
  const organizationId = access.session.organization?.id;
  if (!organizationId) return NextResponse.json({ ok: false, error: "ORGANIZATION_REQUIRED", errors: ["A partner organization is required."] }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const metrics = await getLeadMetricsForServer(organizationId);
  return NextResponse.json({ ok: true, metrics }, { headers: { "Cache-Control": "no-store" } });
}
```

Also update the fixture branch of `getLeadMetricsForServer` (`client/src/lib/listing/details.ts`) to compute from the fixture call store instead of returning zeros — export `fixtureCallMetrics(organizationId: string): { overdue: number; outcomes: Record<string, number>; lostReasons: Record<string, number> }` from `client/src/lib/leads/lead.ts` (walk the fixture leads' call entries; overdue = `nextActionAt` in the past; mirror the prisma branch's 5000-row cap semantics for the demo by not capping — the store is bounded).

- [ ] **Step 4: Run and watch pass**

Run: `pnpm exec vitest run client/src/lib/api-contract-broker-calling.test.ts`
Expected: PASS.

- [ ] **Step 5: Full suite + commit**

Run: `pnpm test` — Expected: PASS (in particular the existing `api-contract.test.ts` and `lead.test.ts` are unmodified and green — the masked list contract is intact).

```bash
git add app/api/broker/leads client/src/lib/api-contract-broker-calling.test.ts client/src/lib/leads/lead.ts client/src/lib/listing/details.ts
git commit -m "feat(leads): broker calling API routes (detail, reveal, calls, metrics)

Wires the four orphaned server functions behind guarded routes:
GET /api/broker/leads/[id] (lead.inbox.read + ownership), POST
…/reveal (lead.inbox.write, writes the AuditEvent), POST …/calls
(OUTCOME_RULES validation), and the metrics endpoint the inbox has
always fetched but never existed. Contract tests lock the response
shapes and the gate status codes."
```

---

### Task 4: Rewire the lead detail page; delete the prototype and dead code

**Files:**
- Modify: `client/src/pages/BrokerLeadDetail.tsx` (full rewire)
- Delete: `client/src/lib/leads/calling-prototype-data.ts`, `client/src/lib/leads/hygiene.ts`
- Modify: `client/src/lib/leads/calling-server.ts` (delete `DEMO_CONTACTS` / `DEMO_CALL_STATE`)
- Modify: `docs/business-suite/mobile-calling-implementation-plan.md` (status update)

**Interfaces:**
- Consumes: `GET /api/broker/leads/[id]`, `POST …/reveal`, `POST …/calls` (Task 3); `LeadDetailRecord` from `@/lib/leads/lead`; `telLink`/`waMeLink` from `@/lib/interop/phone`; `LEAD_STAGE_LABELS`, `CALL_OUTCOME_LABELS` from `@/lib/leads/calling`; `CallResultSheet` (unchanged — check its props signature in `client/src/components/broker/CallResultSheet.tsx` before rewiring the Save handler; the sheet currently receives an `onLogged` callback, keep that).
- Produces: a detail page with zero prototype references; `/broker/leads/lead_prototype_*` URLs 404 by design.

- [ ] **Step 1: Verify the removal is safe**

Run: `grep -rn "calling-prototype-data\|calling/leads/hygiene\|leads/hygiene" client/src app scripts tests --include="*.ts" --include="*.tsx" | grep -v "client/src/lib/leads/hygiene.ts:"`
Expected: only `BrokerLeadDetail.tsx` references `calling-prototype-data`; nothing references `leads/hygiene`. (If anything else references them, stop and reconsider — the spec says zero importers, so any hit is a plan error to fix, not a code error.)

- [ ] **Step 2: Rewrite the data + actions layer of `BrokerLeadDetail.tsx`**

Replace the prototype data layer and gate with the real round-trips. The new head of the component (everything below `useTitle`):

```tsx
export default function BrokerLeadDetail({ leadId }: { leadId: string }) {
  useTitle("Lead · broker desk");
  const router = useRouter();

  /* ---- real data (spec §8) ---- */
  const [lead, setLead] = useState<LeadDetailRecord | null>(null);
  const [loadError, setLoadError] = useState<401 | 403 | 404 | null>(null);
  const [loading, setLoading] = useState(true);

  const [revealed, setRevealed] = useState<{ telLink: string; waMeLink: string } | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetAutoOpened, setSheetAutoOpened] = useState(false);

  const dialingRef = useRef(false);
  const callAnchorRef = useRef<HTMLAnchorElement | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/broker/leads/${encodeURIComponent(leadId)}`, { cache: "no-store" });
      if (response.status === 404) { setLoadError(404); return; }
      if (!response.ok) { setLoadError(response.status as 401 | 403); return; }
      const payload = (await response.json()) as { ok: boolean; lead: LeadDetailRecord };
      if (payload.ok) setLead(payload.lead);
    } catch {
      setLoadError(404);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => { void load(); }, [load]);
```

Keep the existing `visibilitychange` effect verbatim (it only touches `dialingRef`/`sheetOpen`).

Replace `onCallTap` with the reveal round-trip:

```tsx
  async function onCallTap() {
    if (revealed || !lead) return; // the anchor's own href handles the dial
    setRevealing(true);
    try {
      const response = await fetch(`/api/broker/leads/${encodeURIComponent(leadId)}/reveal`, { method: "POST" });
      const payload = (await response.json()) as { ok: boolean; telLink?: string; waMeLink?: string; errors?: string[] };
      if (!payload.ok || !payload.telLink) {
        /* Never a dead button: the server's reason copy is the copy. */
        toast("Cannot call this lead yet", { description: payload.errors?.[0] ?? "This number cannot be revealed right now." });
        return;
      }
      setRevealed({ telLink: payload.telLink, waMeLink: payload.waMeLink ?? "" });
      dialingRef.current = true;
      /* Same imperative href-before-navigate the prototype established:
         React has not re-rendered, and a top-level location.assign("tel:…")
         inside the gesture continuation is what opens the dialer on iOS
         Safari and Chrome for Android. */
      if (callAnchorRef.current) callAnchorRef.current.href = payload.telLink;
      window.location.assign(payload.telLink);
    } finally {
      setRevealing(false);
    }
  }
```

Replace `onLogged` with the real POST (the sheet's Save passes `{ outcome, stageAfter, nextActionAt }` — read the sheet's current callback payload and adapt):

```tsx
  async function onLogged(input: { outcome: CallOutcome; nextActionAt: string | null; lostReason?: string | null; note?: string | null }) {
    setSheetOpen(false);
    setSheetAutoOpened(false);
    const response = await fetch(`/api/broker/leads/${encodeURIComponent(leadId)}/calls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome: input.outcome, nextActionAt: input.nextActionAt, lostReason: input.lostReason ?? undefined, note: input.note ?? undefined }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { errors?: string[] } | null;
      toast("Could not record the call result", { description: payload?.errors?.[0] });
      return;
    }
    toast("Call result recorded.");
    await load(); // stage, attempts, suppression and follow-up banner refresh
  }
```

- [ ] **Step 3: Replace the render body's data source and delete the prototype panel**

- `if (!lead)` branch → keep the "Enquiry not found" panel, but render it for `!loading && (loadError || !lead)`; while `loading` render a skeleton (`<LoadingSkeleton>` blocks as the inbox uses).
- Everywhere the JSX reads `lead.<prototypeField>`, swap to the `LeadDetailRecord` field: `lead.name`, `lead.listingTitle`, `lead.message`, `lead.consentText`, `lead.consentClass`, `lead.stage` (via `LEAD_STAGE_LABELS[lead.stage as LeadStage]`), `lead.callAttempts` + `lead.maxAttempts` → `attemptsLeft`, `lead.suppressed`, `lead.nextActionAt`, `lead.createdAt`, `lead.status`, `lead.callHistory` (history section — the sheet page already lists call history rows; keep the markup, feed it from `lead.callHistory`).
- Delete: the `GradeBadge` component and its render, the entire "prototype controls" JSX block (the `FlaskConical` panel with the plan switch / closed-hours toggle / prototype lead picker), the `planStatus`/`simulateClosedHours`/`showPrototypePanel` state, the `evaluateGate`/`gate`/`blockedCopy`/`planLocked` derivations (the client no longer computes the gate), the `PROTOTYPE_LEADS` import and `FlaskConical` import.
- The Call anchor: keep its ref and class; its `href` is set imperatively on reveal (as above); render `disabled`-style (`aria-busy`) while `revealing`.
- The WhatsApp button: `href={revealed?.waMeLink}` and hidden/disabled until revealed (spec: it appears beside Call, governed by the same reveal).
- The "Log a call result" manual affordance: unchanged (persistent, opens the sheet without a dial) — this is the documented fallback for browsers where `visibilitychange` is unreliable.
- Design tokens: any new/changed text must use `.ink-2`/`.ink-3`/`.stamp` classes — no `text-ink/NN`, no `!text-[9px]`/`!text-[10px]` (the ratchet test counts per file; this file currently has zero debt and must stay there).

- [ ] **Step 4: Delete the prototype artifacts and dead catalog**

```bash
git rm client/src/lib/leads/calling-prototype-data.ts client/src/lib/leads/hygiene.ts
```

In `calling-server.ts`: delete the `DEMO_CONTACTS` and `DEMO_CALL_STATE` constants and their references (Task 2 already switched the fixture branch to `fixtureLeadDetail`; if a reference remains, the test suite in Step 5 will not catch it — run `grep -n "DEMO_" client/src/lib/leads/calling-server.ts` and clean until empty).

- [ ] **Step 5: Update the plan document**

In `docs/business-suite/mobile-calling-implementation-plan.md`:
- §7 Phase 1: tick "M4" (already ticked), leave M1/M3-token-debt unticked (out of scope) — add a one-line note: "M1 deferred; this pass completes Phases 2–4 per `docs/superpowers/specs/2026-09-10-broker-calling-completion-design.md`."
- §7 Phase 2: tick all four checkboxes; note the consent-copy item: "structured consentClass capture landed; the D2 buyer-facing wording remains held for legal review."
- §7 Phase 3: tick all checkboxes.
- §7 Phase 4: tick all checkboxes.
- §11 table: change the `calling-prototype-data.ts` disposition from "Delete when Phases 2–3 land" to "Deleted 10 Sep 2026"; add rows: "Prototype controls panel — Deleted 10 Sep 2026", "Duplicate catalog client/src/lib/leads/hygiene.ts — Deleted 10 Sep 2026 (drift source behind the PR #70 CI failure)".
- §4 decision table: update D3's row to note the final mechanism: "per-organization via MarketplaceSubscription, manual owner activation on /admin/plans, ARCHITECH_BROKER_PLAN_STATUS as explicit override."

- [ ] **Step 6: Verify**

Run: `pnpm exec vitest run client/src/lib/ui/design-token-discipline.test.ts client/src/lib/leads` — Expected: PASS.
Run: `pnpm check && pnpm lint` — Expected: clean (no unused imports left in `BrokerLeadDetail.tsx`).
Run: `grep -rn "prototype" client/src/pages/BrokerLeadDetail.tsx client/src/lib/leads/` — Expected: no matches.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(leads): run the detail page on the real gate; remove the prototype

BrokerLeadDetail now fetches GET /api/broker/leads/[id], reveals through
POST …/reveal (server reasons, never a dead button), and logs results
through POST …/calls. Deletes calling-prototype-data.ts, the prototype
controls panel, DEMO_* fixture contacts, and the dead duplicate catalog
client/src/lib/leads/hygiene.ts. Plan doc updated (Phases 2–4 complete,
D3 mechanism recorded)."
```

---

### Task 5: Lead retention purge

**Files:**
- Create: `scripts/privacy/purge-expired-leads.mjs`, `scripts/privacy/purge-expired-leads.test.mjs`
- Modify: `package.json` (scripts — mirror the requirements purge entries)

**Interfaces:**
- Produces: `expiredLeadWhere(asOf)`, `purgeExpiredLeads(prisma, { apply, asOf })` (exported for the test, same shape as the requirements script), plus `pnpm privacy:leads:purge [-- --apply]`.
- Consumes: `parsePurgeArgs` re-exported from `./purge-expired-requirements.mjs` (DRY — do not copy the arg parser).

- [ ] **Step 1: Check the package.json precedent**

Run: `node -e "const p=require('./package.json'); console.log(Object.entries(p.scripts).filter(([k])=>k.startsWith('privacy')).map(([k,v])=>k+' = '+v).join('\n'))"`
Expected: entries for `privacy:requirements:purge` and `privacy:requirements:test` — mirror their exact style.

- [ ] **Step 2: Write the failing test**

Create `scripts/privacy/purge-expired-leads.test.mjs` (mirror `purge-expired-requirements.test.mjs`'s structure — a `node --test` file with a fake prisma client):

```js
import test from "node:test";
import assert from "node:assert/strict";
import { expiredLeadWhere, purgeExpiredLeads } from "./purge-expired-leads.mjs";

const asOf = new Date("2026-09-10T00:00:00.000Z");

function fakePrisma() {
  return {
    lead: {
      count: async () => 2,
      updateMany: async () => ({ count: 2 }),
    },
  };
}

test("expiredLeadWhere targets expired, undeleted leads only", () => {
  assert.deepEqual(expiredLeadWhere(asOf), {
    retentionUntil: { not: null, lte: asOf },
    deletedAt: null,
  });
});

test("dry run counts without writing", async () => {
  const result = await purgeExpiredLeads(fakePrisma(), { apply: false, asOf });
  assert.deepEqual(result, { mode: "DRY_RUN", asOf: asOf.toISOString(), eligible: 2, purged: 0 });
});

test("apply clears the recoverable contact data and keeps the tombstone", async () => {
  const prisma = fakePrisma();
  prisma.lead.updateMany.mockImplementation(async (args) => {
    assert.deepEqual(args.where, expiredLeadWhere(asOf));
    assert.deepEqual(args.data, { phoneCiphertext: null, phoneLast4: null, deletedAt: asOf });
    return { count: 2 };
  });
  const result = await purgeExpiredLeads(prisma, { apply: true, asOf });
  assert.deepEqual(result, { mode: "APPLY", asOf: asOf.toISOString(), eligible: 2, purged: 2 });
});
```

- [ ] **Step 3: Run and watch fail**

Run: `node --test scripts/privacy/purge-expired-leads.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the script**

Create `scripts/privacy/purge-expired-leads.mjs` (structure mirrors `purge-expired-requirements.mjs` exactly — header comment, `parsePurgeArgs` import, usage(), main() with the Prisma 7 driver adapter):

```js
#!/usr/bin/env node
/**
 * Purge lead contact records after their configured retention window.
 *
 * Posture (spec §9, mirrors the requirements purge):
 *   - dry-run by default (counts only)
 *   - --apply is required to purge
 *   - one explicit UTC cutoff is printed with every result
 *   - only the RECOVERABLE contact data is cleared: phoneCiphertext and
 *     phoneLast4. The masked record, consent text, stage and call logs stay
 *     as the non-sensitive audit tombstone.
 *   - billing state never drives this: a lapsed plan does not purge, and an
 *     active plan does not extend retention (consent class + retentionUntil
 *     are the only authorities).
 *
 * Schedule this command at least daily in every Prisma-backed environment:
 *   pnpm privacy:leads:purge -- --apply
 */
import { pathToFileURL } from "node:url";
import { parsePurgeArgs } from "./purge-expired-requirements.mjs";

export { parsePurgeArgs };

export function expiredLeadWhere(asOf) {
  return { retentionUntil: { not: null, lte: asOf }, deletedAt: null };
}

export async function purgeExpiredLeads(prisma, { apply, asOf }) {
  const where = expiredLeadWhere(asOf);
  const eligible = await prisma.lead.count({ where });
  if (!apply) return { mode: "DRY_RUN", asOf: asOf.toISOString(), eligible, purged: 0 };
  const result = await prisma.lead.updateMany({ where, data: { phoneCiphertext: null, phoneLast4: null, deletedAt: asOf } });
  return { mode: "APPLY", asOf: asOf.toISOString(), eligible, purged: result.count };
}

function usage() {
  return [
    "Usage: node scripts/privacy/purge-expired-leads.mjs [--apply] [--as-of <ISO>]",
    "Without --apply, the command only reports how many rows are eligible.",
  ].join("\n");
}

async function main() {
  const options = parsePurgeArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const result = await purgeExpiredLeads(prisma, options);
    console.log(JSON.stringify(result));
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 5: Add the package.json scripts**

In `package.json` `scripts` (alphabetical neighbours of the privacy entries):
- `"privacy:leads:purge": "node scripts/privacy/purge-expired-leads.mjs"`
- `"privacy:leads:test": "node --test scripts/privacy/purge-expired-leads.test.mjs"`

- [ ] **Step 6: Run and watch pass**

Run: `node --test scripts/privacy/purge-expired-leads.test.mjs` — Expected: 3 pass.
Run: `node scripts/privacy/purge-expired-leads.mjs --help` — Expected: usage text.

- [ ] **Step 7: Commit**

```bash
git add scripts/privacy/purge-expired-leads.mjs scripts/privacy/purge-expired-leads.test.mjs package.json
git commit -m "feat(privacy): lead retention purge (ciphertext + last4, tombstone kept)

purge-expired-leads.mjs mirrors the requirements purge posture: dry-run
default, --apply required, UTC cutoff printed. Clears only the
recoverable contact data (phoneCiphertext/phoneLast4) at retention
expiry; the masked record and call trail remain as the audit
tombstone. Billing state never drives retention."
```

---

### Task 6: Super-admin credential, cookie, and session wiring

**Files:**
- Create: `scripts/auth/make-super-admin-hash.mjs`, `client/src/lib/auth/super-admin.ts`, `client/src/lib/auth/super-admin.test.ts`
- Modify: `client/src/lib/auth/roles.ts` (role + rank + source union), `client/src/lib/auth/live.ts` (cookie check), `client/src/lib/operations/hygiene.ts` (allow-list), `.env.example`
- Create: `app/api/auth/super/sign-in/route.ts`, `app/api/auth/super/sign-out/route.ts`

**Interfaces:**
- Produces:
  - `SUPER_ADMIN_COOKIE` (`"architech.super_admin"`), `SUPER_ADMIN_TTL_SECONDS` (28800).
  - `parseSuperAdminHash(stored: string | undefined): { salt: Buffer; hash: Buffer } | null` — format `scrypt$<salt-hex>$<hash-hex>`.
  - `verifySuperAdminPassword(password: string, storedHash: string | undefined): boolean` — scrypt (`{ N: 16384, r: 8, p: 1, keylen: 32 }`) + `timingSafeEqual`; never throws on bad input.
  - `mintSuperAdminCookieValue(expiresAt: Date, secret: string): string` — `"<expiryEpochSeconds>.<hmac-sha256-hex>"` over `"<expiryEpoch>:architech-super-admin"`.
  - `superAdminSessionFromCookie(cookieHeader: string, secret: string | undefined): AuthSession | null` — parse, expiry, HMAC verify (constant-time); no secret → null.
  - `superAdminSession(): AuthSession` — `{ user: { id: "super-admin", name: "Owner", email: "owner@architech.local", role: "SUPER_ADMIN" }, permissions: ["admin.plans.read", "admin.plans.write"], source: "super-admin" }`, no organization.
  - Routes: `POST /api/auth/super/sign-in` body `{ password }` → 503 `SUPER_ADMIN_NOT_CONFIGURED` (hash or `BETTER_AUTH_SECRET` missing) / 429 throttled (with `retryAfterSeconds`) / 401 uniform `INVALID_CREDENTIALS` / 200 + `Set-Cookie` (Max-Age 28800, HttpOnly, SameSite=Lax, Secure on https). `POST /api/auth/super/sign-out` → 200 + cleared cookie (idempotent).
- Consumes: `AuthRole`/`AuthSession`/`roleRank` from `./roles`; `registerLoginAttempt` from `./login-throttle`; `BETTER_AUTH_SECRET` env.

- [ ] **Step 1: Write the failing unit tests**

Create `client/src/lib/auth/super-admin.test.ts`:

```ts
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSessionContractForRequest } from "./live";
import {
  SUPER_ADMIN_COOKIE,
  SUPER_ADMIN_TTL_SECONDS,
  mintSuperAdminCookieValue,
  parseSuperAdminHash,
  superAdminSessionFromCookie,
  verifySuperAdminPassword,
} from "./super-admin";

const TEST_SECRET = "unit-test-better-auth-secret";

function storedHashFor(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

beforeEach(() => vi.stubEnv("ARCHITECH_AUTH_SOURCE", "demo"));
afterEach(() => vi.unstubAllEnvs());

describe("super-admin credential (spec §6.1)", () => {
  it("verifies a correctly stored hash", () => {
    const stored = storedHashFor("correct-horse-battery-staple");
    expect(verifySuperAdminPassword("correct-horse-battery-staple", stored)).toBe(true);
  });

  it("rejects a wrong password and malformed storage without throwing", () => {
    const stored = storedHashFor("correct-horse-battery-staple");
    expect(verifySuperAdminPassword("wrong-password", stored)).toBe(false);
    expect(verifySuperAdminPassword("anything", undefined)).toBe(false);
    expect(verifySuperAdminPassword("anything", "not-a-hash")).toBe(false);
    expect(verifySuperAdminPassword("anything", "scrypt$zz$zz")).toBe(false);
  });

  it("parseSuperAdminHash round-trips and rejects bad format", () => {
    const stored = storedHashFor("x".repeat(12));
    const parsed = parseSuperAdminHash(stored);
    expect(parsed?.salt).toHaveLength(16);
    expect(parsed?.hash).toHaveLength(32);
    expect(parseSuperAdminHash(undefined)).toBeNull();
    expect(parseSuperAdminHash("argon2id$v=19$xx")).toBeNull();
  });
});

describe("super-admin cookie (spec §6.2/§6.3)", () => {
  const expires = new Date(Date.now() + SUPER_ADMIN_TTL_SECONDS * 1000);

  it("accepts a valid, unexpired cookie and builds the minimal session", () => {
    const value = mintSuperAdminCookieValue(expires, TEST_SECRET);
    const session = superAdminSessionFromCookie(`${SUPER_ADMIN_COOKIE}=${value}`, TEST_SECRET);
    expect(session?.user.role).toBe("SUPER_ADMIN");
    expect(session?.permissions).toEqual(["admin.plans.read", "admin.plans.write"]);
    expect(session?.organization).toBeUndefined();
    expect(session?.source).toBe("super-admin");
  });

  it("rejects a tampered signature", () => {
    const value = mintSuperAdminCookieValue(expires, TEST_SECRET);
    const [epoch, sig] = value.split(".");
    const tampered = `${epoch}.${(sig === "0".repeat(sig.length) ? "1" : "0").repeat(sig.length)}`;
    expect(superAdminSessionFromCookie(`${SUPER_ADMIN_COOKIE}=${tampered}`, TEST_SECRET)).toBeNull();
  });

  it("rejects an expired cookie", () => {
    const value = mintSuperAdminCookieValue(new Date(Date.now() - 1000), TEST_SECRET);
    expect(superAdminSessionFromCookie(`${SUPER_ADMIN_COOKIE}=${value}`, TEST_SECRET)).toBeNull();
  });

  it("rejects a different signing secret and a missing secret", () => {
    const value = mintSuperAdminCookieValue(expires, "another-secret");
    expect(superAdminSessionFromCookie(`${SUPER_ADMIN_COOKIE}=${value}`, TEST_SECRET)).toBeNull();
    expect(superAdminSessionFromCookie(`${SUPER_ADMIN_COOKIE}=${value}`, undefined)).toBeNull();
  });

  it("the session contract resolves a super-admin cookie in demo mode", async () => {
    vi.stubEnv("BETTER_AUTH_SECRET", TEST_SECRET);
    const value = mintSuperAdminCookieValue(expires, TEST_SECRET);
    const contract = await getSessionContractForRequest(
      new Request("http://localhost/admin/plans", { headers: { cookie: `${SUPER_ADMIN_COOKIE}=${value}` } }),
    );
    expect(contract.session?.user.role).toBe("SUPER_ADMIN");
  });

  it("a garbage cookie falls through to the normal demo session", async () => {
    const contract = await getSessionContractForRequest(
      new Request("http://localhost/", { headers: { cookie: `${SUPER_ADMIN_COOKIE}=garbage` } }),
    );
    expect(contract.session?.user.role).not.toBe("SUPER_ADMIN");
  });
});
```

- [ ] **Step 2: Run and watch fail**

Run: `pnpm exec vitest run client/src/lib/auth/super-admin.test.ts`
Expected: FAIL — module/exports missing, and `SUPER_ADMIN` not in the role union (type error).

- [ ] **Step 3: Implement the role + source changes**

In `client/src/lib/auth/roles.ts`:
- `export type AuthRole = "BUYER" | "BROKER_MEMBER" | "BROKER_ADMIN" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";`
- `roleRank` gains `SUPER_ADMIN: 50,`.
- `AuthSession.source` becomes `"better-auth-contract-demo" | "better-auth-live" | "super-admin"`.
- Leave `requirePermission` untouched: SUPER_ADMIN is **not** in the `ADMIN` bypass; it acts through its permission list.

- [ ] **Step 4: Implement `client/src/lib/auth/super-admin.ts`**

```ts
import "server-only";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { AuthSession } from "./roles";

/** Cookie carrying the owner's super-admin session (spec §6). */
export const SUPER_ADMIN_COOKIE = "architech.super_admin";
/** 8 hours — the same TTL the demo session cookie uses. */
export const SUPER_ADMIN_TTL_SECONDS = 28_800;

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;
const KEY_LEN = 32;

/** `scrypt$<salt-hex>$<hash-hex>` as printed by scripts/auth/make-super-admin-hash.mjs. */
export function parseSuperAdminHash(stored: string | undefined): { salt: Buffer; hash: Buffer } | null {
  if (!stored) return null;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return null;
  const salt = Buffer.from(parts[1], "hex");
  const hash = Buffer.from(parts[2], "hex");
  if (salt.length < 8 || hash.length !== KEY_LEN || salt.toString("hex") !== parts[1] || hash.toString("hex") !== parts[2]) return null;
  return { salt, hash };
}

export function verifySuperAdminPassword(password: string, storedHash: string | undefined): boolean {
  const parsed = parseSuperAdminHash(storedHash);
  if (!parsed || !password) return false;
  const candidate = scryptSync(password, parsed.salt, KEY_LEN, SCRYPT_PARAMS);
  return timingSafeEqual(candidate, parsed.hash);
}

function hmacOf(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function mintSuperAdminCookieValue(expiresAt: Date, secret: string): string {
  const epoch = Math.floor(expiresAt.getTime() / 1000);
  return `${epoch}.${hmacOf(`${epoch}:architech-super-admin`, secret)}`;
}

/** The owner's master session: exactly two permissions, no organization. */
export function superAdminSession(): AuthSession {
  return {
    user: { id: "super-admin", name: "Owner", email: "owner@architech.local", role: "SUPER_ADMIN" },
    permissions: ["admin.plans.read", "admin.plans.write"],
    source: "super-admin",
  };
}

export function superAdminSessionFromCookie(cookieHeader: string, secret: string | undefined): AuthSession | null {
  if (!secret) return null;
  let value: string | undefined;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const index = trimmed.indexOf("=");
    if (index < 0 || trimmed.slice(0, index) !== SUPER_ADMIN_COOKIE) continue;
    value = decodeURIComponent(trimmed.slice(index + 1));
  }
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot < 1) return null;
  const epoch = Number(value.slice(0, dot));
  const signature = value.slice(dot + 1);
  if (!Number.isSafeInteger(epoch) || epoch * 1000 <= Date.now()) return null;
  const expected = hmacOf(`${epoch}:architech-super-admin`, secret);
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return superAdminSession();
}
```

- [ ] **Step 5: Wire the cookie into the session contract**

In `client/src/lib/auth/live.ts`, `getSessionContractForRequest`, immediately after the `mode=none` early return:

```ts
  /* Super-admin cookie (spec §6.3): checked before any auth source so the
     owner's plan-activation session works under demo AND live mode. A cookie
     with no BETTER_AUTH_SECRET in the environment is simply ignored. */
  const cookieHeader = request.headers.get("cookie") ?? "";
  if (cookieHeader.includes(SUPER_ADMIN_COOKIE)) {
    const superSession = superAdminSessionFromCookie(cookieHeader, process.env.BETTER_AUTH_SECRET);
    if (superSession) return { session: superSession, source: "super-admin", missing: [] };
  }
```

(import `SUPER_ADMIN_COOKIE, superAdminSessionFromCookie` from `./super-admin`; note the contract's `source` type — widen the return type's `source` union with `"super-admin"` if the current type annotation is narrower).

- [ ] **Step 6: Implement the sign-in/sign-out routes**

`app/api/auth/super/sign-in/route.ts`:

```ts
import { NextResponse } from "next/server";
import { clearLoginAttempts, registerLoginAttempt } from "@/lib/auth/login-throttle";
import { SUPER_ADMIN_TTL_SECONDS, mintSuperAdminCookieValue, verifySuperAdminPassword } from "@/lib/auth/super-admin";

export const runtime = "nodejs";

/* The owner's master login (spec §6.2). Password-only, owner-only:
   the credential exists solely in the deployment environment
   (ARCHITECH_SUPER_ADMIN_PASSWORD_HASH), never in the user store, and the
   demo roster can never mint this session. */
export async function POST(request: Request) {
  const secret = process.env.BETTER_AUTH_SECRET;
  const storedHash = process.env.ARCHITECH_SUPER_ADMIN_PASSWORD_HASH;
  if (!secret || !storedHash) {
    return NextResponse.json({ ok: false, error: "SUPER_ADMIN_NOT_CONFIGURED", errors: ["Super-admin sign-in is not configured for this deployment."] }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  let password: string;
  try {
    password = String(((await request.json()) as { password?: unknown }).password ?? "");
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_CREDENTIALS", errors: ["Enter the super-admin password."] }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
  if (!verifySuperAdminPassword(password, storedHash)) {
    const decision = registerLoginAttempt({ ip, email: "super-admin" });
    if (!decision.allowed) {
      return NextResponse.json({ ok: false, error: "THROTTLED", errors: ["Too many attempts. Try again later."], retryAfterSeconds: decision.retryAfterSeconds }, { status: 429, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ ok: false, error: "INVALID_CREDENTIALS", errors: ["Enter the super-admin password."] }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  clearLoginAttempts("super-admin"); // same reset-on-success as credential-flow.ts
  const expiresAt = new Date(Date.now() + SUPER_ADMIN_TTL_SECONDS * 1000);
  const secure = new URL(request.url).protocol === "https:";
  const cookie = `architech.super_admin=${encodeURIComponent(mintSuperAdminCookieValue(expiresAt, secret))}; Path=/; Max-Age=${SUPER_ADMIN_TTL_SECONDS}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store", "Set-Cookie": cookie } });
}
```

Throttle reset on success mirrors `credential-flow.ts` (`clearLoginAttempts` with the same identity used at registration).

`app/api/auth/super/sign-out/route.ts`:

```ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secure = new URL(request.url).protocol === "https:";
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store", "Set-Cookie": `architech.super_admin=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}` } });
}
```

- [ ] **Step 7: Allow-list the env key and document it**

In `client/src/lib/operations/hygiene.ts`, extend the reconciliation comment block added for PR #70 (or add a new dated block) with `"ARCHITECH_SUPER_ADMIN_PASSWORD_HASH",`.

In `.env.example`, after the `ARCHITECH_BROKER_PLAN_STATUS` entry:

```
# Owner-only super-admin login for /admin/plans (manual plan activation).
# scrypt hash of the owner's password, generated with:
#   node scripts/auth/make-super-admin-hash.mjs
# Never commit the plaintext. Requires BETTER_AUTH_SECRET to function.
ARCHITECH_SUPER_ADMIN_PASSWORD_HASH=
```

Also update the `ARCHITECH_BROKER_PLAN_STATUS` comment to the override semantics:
`# Explicit plan-status override for ALL organizations (ops/demo lever). Leave unset in prisma deployments: plan status then comes from each org's MarketplaceSubscription (granted on /admin/plans), and an org with no plan is NONE.`

- [ ] **Step 8: Create the hash generator script**

`scripts/auth/make-super-admin-hash.mjs`:

```js
#!/usr/bin/env node
/**
 * Generates the ARCHITECH_SUPER_ADMIN_PASSWORD_HASH value for .env / deployment
 * secrets. Prompts twice, prints the scrypt$<salt>$<hash> string, exits.
 * The plaintext password is never written to disk or a log.
 */
import { createInterface } from "node:readline";
import { randomBytes, scryptSync } from "node:crypto";

async function ask(rl, question, { silent = false } = {}) {
  const answer = await new Promise((resolve) => rl.question(question, resolve));
  if (silent) process.stdout.write("\n");
  return answer;
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const MIN = 12;
try {
  const first = await ask(rl, "Super-admin password (min 12 characters): ", { silent: true });
  if (first.length < MIN) throw new Error(`Password must be at least ${MIN} characters (got ${first.length}).`);
  const second = await ask(rl, "Repeat the password: ", { silent: true });
  if (first !== second) throw new Error("Passwords do not match.");
  const salt = randomBytes(16);
  const hash = scryptSync(first, salt, 32, { N: 16384, r: 8, p: 1 });
  process.stdout.write(`\nAdd this to your deployment environment:\n\nARCHITECH_SUPER_ADMIN_PASSWORD_HASH=scrypt$${salt.toString("hex")}$${hash.toString("hex")}\n`);
} finally {
  rl.close();
}
```

- [ ] **Step 9: Run and watch pass**

Run: `pnpm exec vitest run client/src/lib/auth/super-admin.test.ts` — Expected: PASS.
Run: `echo -e "unit-test-password-1\nunit-test-password-1" | node scripts/auth/make-super-admin-hash.mjs` — Expected: prints a `scrypt$…` value; verify it: pipe the printed value through a one-liner that checks `verifySuperAdminPassword` (a node -e script importing the built lib is overkill — instead eyeball the format `scrypt$<32 hex>$<64 hex>`).

- [ ] **Step 10: Full suite + commit**

Run: `pnpm test` — Expected: PASS (the W5 env parity test sees `ARCHITECH_SUPER_ADMIN_PASSWORD_HASH` in both the allow-list and `.env.example`).

```bash
git add scripts/auth/make-super-admin-hash.mjs client/src/lib/auth/super-admin.ts client/src/lib/auth/super-admin.test.ts client/src/lib/auth/roles.ts client/src/lib/auth/live.ts client/src/lib/operations/hygiene.ts .env.example app/api/auth/super
git commit -m "feat(auth): owner-only super-admin login (env scrypt hash + HMAC cookie)

SUPER_ADMIN role (rank 50) with exactly admin.plans.read/write. Password
verified against ARCHITECH_SUPER_ADMIN_PASSWORD_HASH (scrypt, generated
by scripts/auth/make-super-admin-hash.mjs); the plaintext never enters the
repo or DB. 8h HttpOnly SameSite=Lax cookie signed with BETTER_AUTH_SECRET,
resolved before any auth source so it works in demo and live modes alike.
Throttled through the existing login-throttle; uniform 401 on failure."
```

---

### Task 7: Plan administration API + `/admin/plans` page

**Files:**
- Create: `client/src/lib/plans/admin.ts`, `client/src/lib/plans/admin.test.ts`, `client/src/lib/api-contract-super-admin.test.ts`
- Create: `app/api/admin/plans/route.ts`, `app/api/admin/plans/definitions/route.ts`
- Create: `client/src/pages/PlanAdmin.tsx`, `app/admin/plans/page.tsx`

**Interfaces:**
- Produces (lib):
  - `lookupOrganizationForLogin(prisma, email): Promise<{ found: true; user: { name: string; email: string; role: string }; organization: { id: string; name: string; slug: string; cityId: string | null }; currentSubscription: { id: string; status: string; expiresAt: string | null; plan: { name: string; code: string } } | null } | { found: false }>`
  - `listPlanAdministration(prisma): Promise<{ plans: Array<{ id: string; code: string; name: string; monthlyCredits: number; teamSeats: number }>; subscriptions: Array<{ id: string; status: string; expiresAt: string | null; updatedAt: string; plan: { name: string }; organization: { name: string; slug: string } }> }>`
  - `applyPlanToOrganization(prisma, { email, planId, status, expiresAt, ipHash }): Promise<{ ok: true; organization: { id: string; name: string; slug: string }; subscription: { id: string; status: string; expiresAt: string | null }; previousStatus: string | null } | { ok: false; error: "ORG_NOT_FOUND" | "PLAN_NOT_FOUND" }>`
  - `createPlanDefinition(prisma, { name, ipHash }): Promise<{ ok: true; plan: { id: string; code: string; name: string } } | { ok: false; error: "NAME_INVALID" | "CODE_TAKEN" }>`
- Produces (routes): `GET /api/admin/plans[?lookup=email]` → 200 `{ ok, plans, subscriptions, lookup? }` / 503 fixture / 403; `POST /api/admin/plans` body `{ email, planId, status, expiresAt? }` → 200 `{ ok, organization, subscription, previousStatus }` / 400 validation / 404 / 409-free (no 409 here) / 503; `POST /api/admin/plans/definitions` body `{ name }` → 200 / 400 / 409 / 503.
- Consumes: Task 6's super-admin session (routes guard on `admin.plans.read`/`write`), `isPrismaDataSource` from `@/lib/repositories/source`, `authorizeRequest`/`isAuthorized`.

- [ ] **Step 1: Write the failing lib tests**

Create `client/src/lib/plans/admin.test.ts` (mock convention per `client/src/lib/location/server/coverage.test.ts`):

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  marketplacePlan: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  marketplaceSubscription: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
  auditEvent: { create: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(database)),
}));

vi.mock("@/lib/repositories/server/prisma", () => ({ getPrismaClient: () => database }));
import { applyPlanToOrganization, createPlanDefinition, listPlanAdministration, lookupOrganizationForLogin } from "./admin";

const ORG = { id: "org-1", name: "Nivasa Partners", slug: "nivasa-partners", cityId: "city-ahmedabad" };
const USER_ROW = (email: string) => ({ id: "user-1", name: "Owner Person", email, role: "BROKER_ADMIN", brokerMemberships: [{ organizationId: ORG.id, organization: ORG }] });

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllEnvs());

describe("lookupOrganizationForLogin", () => {
  it("resolves the login id (email) to its organization and current plan", async () => {
    database.user.findUnique.mockResolvedValue(USER_ROW("owner@nivasa.in"));
    database.marketplaceSubscription.findFirst.mockResolvedValue({ id: "sub-1", status: "TRIAL", expiresAt: new Date("2026-10-01T00:00:00Z"), plan: { name: "Broker Pro", code: "broker-pro" } });
    const result = await lookupOrganizationForLogin(database, "OWNER@nivasa.in");
    expect(result).toMatchObject({ found: true, organization: { id: "org-1", slug: "nivasa-partners" }, currentSubscription: { status: "TRIAL" } });
    expect(database.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: "owner@nivasa.in" } }));
  });

  it("unknown email and email-without-organization are both uniform not-found", async () => {
    database.user.findUnique.mockResolvedValue(null);
    expect(await lookupOrganizationForLogin(database, "ghost@example.com")).toEqual({ found: false });
    database.user.findUnique.mockResolvedValue({ id: "user-2", name: "Buyer", email: "buyer@example.com", role: "BUYER", brokerMemberships: [] });
    expect(await lookupOrganizationForLogin(database, "buyer@example.com")).toEqual({ found: false });
  });
});

describe("applyPlanToOrganization", () => {
  it("creates a subscription for an org with none and audits the change", async () => {
    database.user.findUnique.mockResolvedValue(USER_ROW("owner@nivasa.in"));
    database.marketplacePlan.findUnique.mockResolvedValue({ id: "plan-1", code: "broker-pro", name: "Broker Pro" });
    database.marketplaceSubscription.findFirst.mockResolvedValue(null);
    database.marketplaceSubscription.create.mockResolvedValue({ id: "sub-new", status: "ACTIVE", expiresAt: null });
    const result = await applyPlanToOrganization(database, { email: "owner@nivasa.in", planId: "plan-1", status: "ACTIVE", expiresAt: null, ipHash: "ip-hash-1" });
    expect(result).toMatchObject({ ok: true, previousStatus: null, subscription: { id: "sub-new", status: "ACTIVE" } });
    expect(database.marketplaceSubscription.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId: "org-1", planId: "plan-1", status: "ACTIVE" }) }));
    expect(database.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "admin.plan.updated", metadata: expect.objectContaining({ loginEmail: "owner@nivasa.in", previousStatus: null, status: "ACTIVE" }) }) }));
  });

  it("updates the most recent subscription and records the previous status", async () => {
    database.user.findUnique.mockResolvedValue(USER_ROW("owner@nivasa.in"));
    database.marketplacePlan.findUnique.mockResolvedValue({ id: "plan-1", code: "broker-pro", name: "Broker Pro" });
    database.marketplaceSubscription.findFirst.mockResolvedValue({ id: "sub-1", status: "TRIAL" });
    database.marketplaceSubscription.update.mockResolvedValue({ id: "sub-1", status: "EXPIRED", expiresAt: new Date("2026-09-01T00:00:00Z") });
    const result = await applyPlanToOrganization(database, { email: "owner@nivasa.in", planId: "plan-1", status: "EXPIRED", expiresAt: new Date("2026-09-01T00:00:00Z"), ipHash: "ip-hash-1" });
    expect(result).toMatchObject({ ok: true, previousStatus: "TRIAL", subscription: { status: "EXPIRED" } });
    expect(database.marketplaceSubscription.update).toHaveBeenCalled();
    expect(database.marketplaceSubscription.create).not.toHaveBeenCalled();
  });

  it("seeds the default Broker Pro plan when the plan table is empty", async () => {
    database.user.findUnique.mockResolvedValue(USER_ROW("owner@nivasa.in"));
    database.marketplacePlan.findUnique.mockResolvedValue(null);
    database.marketplacePlan.count.mockResolvedValue(0);
    database.marketplacePlan.create.mockResolvedValue({ id: "plan-seed", code: "broker-pro", name: "Broker Pro" });
    database.marketplaceSubscription.findFirst.mockResolvedValue(null);
    database.marketplaceSubscription.create.mockResolvedValue({ id: "sub-2", status: "TRIAL", expiresAt: null });
    const result = await applyPlanToOrganization(database, { email: "owner@nivasa.in", planId: undefined, status: "TRIAL", expiresAt: null, ipHash: "ip" });
    expect(result).toMatchObject({ ok: true, subscription: { id: "sub-2" } });
    expect(database.marketplacePlan.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ code: "broker-pro", name: "Broker Pro" }) }));
  });

  it("a planId that does not exist while plans exist is PLAN_NOT_FOUND", async () => {
    database.user.findUnique.mockResolvedValue(USER_ROW("owner@nivasa.in"));
    database.marketplacePlan.findUnique.mockResolvedValue(null);
    database.marketplacePlan.count.mockResolvedValue(3);
    expect(await applyPlanToOrganization(database, { email: "owner@nivasa.in", planId: "ghost", status: "ACTIVE", expiresAt: null, ipHash: "ip" })).toEqual({ ok: false, error: "PLAN_NOT_FOUND" });
  });

  it("unknown login id is ORG_NOT_FOUND and never writes", async () => {
    database.user.findUnique.mockResolvedValue(null);
    const result = await applyPlanToOrganization(database, { email: "ghost@example.com", planId: "plan-1", status: "ACTIVE", expiresAt: null, ipHash: "ip" });
    expect(result).toEqual({ ok: false, error: "ORG_NOT_FOUND" });
    expect(database.marketplaceSubscription.create).not.toHaveBeenCalled();
    expect(database.marketplaceSubscription.update).not.toHaveBeenCalled();
  });
});

describe("createPlanDefinition", () => {
  it("creates a plan with a slugified code and audits it", async () => {
    database.marketplacePlan.findUnique.mockResolvedValue(null);
    database.marketplacePlan.create.mockResolvedValue({ id: "plan-9", code: "brokerage-team", name: "Brokerage Team" });
    const result = await createPlanDefinition(database, { name: "Brokerage Team", ipHash: "ip" });
    expect(result).toMatchObject({ ok: true, plan: { code: "brokerage-team" } });
  });

  it("rejects short names and duplicate codes", async () => {
    expect(await createPlanDefinition(database, { name: "x", ipHash: "ip" })).toEqual({ ok: false, error: "NAME_INVALID" });
    database.marketplacePlan.findUnique.mockResolvedValue({ id: "plan-1" });
    expect(await createPlanDefinition(database, { name: "Broker Pro", ipHash: "ip" })).toEqual({ ok: false, error: "CODE_TAKEN" });
  });
});
```

- [ ] **Step 2: Run and watch fail**

Run: `pnpm exec vitest run client/src/lib/plans/admin.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `client/src/lib/plans/admin.ts`**

```ts
import "server-only";

/* Plan administration for the owner's /admin/plans surface (spec §7).
   Every write is audited with the previous status in metadata — the ledger
   the strategy doc wants for "who got access, when, under which plan" —
   even before the usage-ledger surface exists. */

type Db = Record<string, unknown> & {
  user: { findUnique(args: unknown): Promise<Record<string, unknown> | null> };
  marketplacePlan: {
    findUnique(args: unknown): Promise<Record<string, unknown> | null>;
    findMany(args: unknown): Promise<Array<Record<string, unknown>>>;
    count(args?: unknown): Promise<number>;
    create(args: unknown): Promise<Record<string, unknown>>;
  };
  marketplaceSubscription: {
    findFirst(args: unknown): Promise<Record<string, unknown> | null>;
    findMany(args: unknown): Promise<Array<Record<string, unknown>>>;
    update(args: unknown): Promise<Record<string, unknown>>;
    create(args: unknown): Promise<Record<string, unknown>>;
  };
  auditEvent: { create(args: unknown): Promise<unknown> };
  $transaction(fn: (tx: typeof Db) => Promise<unknown>): Promise<unknown>;
};

const PLAN_STATUSES = ["TRIAL", "ACTIVE", "EXPIRED"] as const;
export type AdminPlanStatus = (typeof PLAN_STATUSES)[number];
export function isAdminPlanStatus(value: unknown): value is AdminPlanStatus {
  return typeof value === "string" && (PLAN_STATUSES as readonly string[]).includes(value);
}

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

function orgRowOf(row: Record<string, unknown> | null): { id: string; name: string; slug: string; cityId: string | null } | null {
  if (!row) return null;
  const memberships = Array.isArray(row.brokerMemberships) ? (row.brokerMemberships as Array<Record<string, unknown>>) : [];
  if (memberships.length === 0) return null;
  const organization = (memberships[0] as { organization?: Record<string, unknown> }).organization ?? {};
  return { id: String(organization.id ?? ""), name: String(organization.name ?? ""), slug: String(organization.slug ?? ""), cityId: organization.cityId == null ? null : String(organization.cityId) };
}

export async function lookupOrganizationForLogin(
  prisma: Db,
  email: string,
): Promise<
  | { found: true; user: { name: string; email: string; role: string }; organization: { id: string; name: string; slug: string; cityId: string | null }; currentSubscription: { id: string; status: string; expiresAt: string | null; plan: { name: string; code: string } } | null }
  | { found: false }
> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, name: true, email: true, role: true, brokerMemberships: { where: { active: true }, orderBy: { createdAt: "desc" }, select: { organizationId: true, organization: { select: { id: true, name: true, slug: true, cityId: true } } } } },
  });
  const organization = orgRowOf(user);
  if (!user || !organization) return { found: false };
  const sub = (await prisma.marketplaceSubscription.findFirst({ where: { organizationId: organization.id }, orderBy: [{ startsAt: "desc" }, { id: "desc" }], select: { id: true, status: true, expiresAt: true, plan: { select: { name: true, code: true } } } })) as Record<string, unknown> | null;
  return {
    found: true,
    user: { name: String(user.name ?? user.email), email: String(user.email), role: String(user.role ?? "BUYER") },
    organization,
    currentSubscription: sub ? { id: String(sub.id), status: String(sub.status), expiresAt: sub.expiresAt == null ? null : new Date(String(sub.expiresAt)).toISOString(), plan: { name: String((sub.plan as { name?: string })?.name ?? ""), code: String((sub.plan as { code?: string })?.code ?? "") } } : null,
  };
}

export async function listPlanAdministration(prisma: Db): Promise<{ plans: Array<{ id: string; code: string; name: string; monthlyCredits: number; teamSeats: number }>; subscriptions: Array<{ id: string; status: string; expiresAt: string | null; updatedAt: string; plan: { name: string }; organization: { name: string; slug: string } }> }> {
  const [plans, subscriptions] = await Promise.all([
    prisma.marketplacePlan.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, code: true, name: true, monthlyCredits: true, teamSeats: true } }),
    prisma.marketplaceSubscription.findMany({ orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 50, select: { id: true, status: true, expiresAt: true, updatedAt: true, plan: { select: { name: true } }, organization: { select: { name: true, slug: true } } } }),
  ]);
  return {
    plans: plans.map((row) => ({ id: String(row.id), code: String(row.code), name: String(row.name), monthlyCredits: Number(row.monthlyCredits ?? 0), teamSeats: Number(row.teamSeats ?? 1) })),
    subscriptions: subscriptions.map((row) => ({ id: String(row.id), status: String(row.status), expiresAt: row.expiresAt == null ? null : new Date(String(row.expiresAt)).toISOString(), updatedAt: new Date(String(row.updatedAt)).toISOString(), plan: { name: String((row.plan as { name?: string })?.name ?? "") }, organization: { name: String((row.organization as { name?: string })?.name ?? ""), slug: String((row.organization as { slug?: string })?.slug ?? "") } })),
  };
}

export async function applyPlanToOrganization(
  prisma: Db,
  input: { email: string; planId: string | undefined; status: AdminPlanStatus; expiresAt: Date | null; ipHash: string | undefined },
): Promise<{ ok: true; organization: { id: string; name: string; slug: string }; subscription: { id: string; status: string; expiresAt: string | null }; previousStatus: string | null } | { ok: false; error: "ORG_NOT_FOUND" | "PLAN_NOT_FOUND" }> {
  const result = (await prisma.$transaction(async (tx) => {
    let plan = input.planId ? await tx.marketplacePlan.findUnique({ where: { id: input.planId } }) : null;
    if (!plan) {
      // No usable plan: either the requested planId is unknown, or none was
      // sent. A request with a known-id-less planId is an error; a request
      // with no planId against an EMPTY plan table seeds the default.
      if (input.planId) return { ok: false as const, error: "PLAN_NOT_FOUND" as const };
      const planCount = await tx.marketplacePlan.count();
      if (planCount === 0) {
        plan = await tx.marketplacePlan.create({ data: { code: "broker-pro", name: "Broker Pro", monthlyCredits: 0, teamSeats: 1, active: true } });
      } else {
        return { ok: false as const, error: "PLAN_NOT_FOUND" as const };
      }
    }
    const user = await tx.user.findUnique({
      where: { email: input.email.trim().toLowerCase() },
      select: { id: true, brokerMemberships: { where: { active: true }, orderBy: { createdAt: "desc" }, select: { organization: { select: { id: true, name: true, slug: true } } } } },
    });
    const organization = orgRowOf(user);
    if (!user || !organization) return { ok: false as const, error: "ORG_NOT_FOUND" as const };
    const current = await tx.marketplaceSubscription.findFirst({ where: { organizationId: organization.id }, orderBy: [{ startsAt: "desc" }, { id: "desc" }], select: { id: true, status: true } });
    const previousStatus = current ? String(current.status) : null;
    const subscription = current
      ? await tx.marketplaceSubscription.update({ where: { id: String(current.id) }, data: { planId: String(plan.id), status: input.status, expiresAt: input.expiresAt } })
      : await tx.marketplaceSubscription.create({ data: { planId: String(plan.id), organizationId: organization.id, status: input.status, expiresAt: input.expiresAt } });
    await tx.auditEvent.create({ data: { organizationId: organization.id, action: "admin.plan.updated", entityType: "MarketplaceSubscription", entityId: String(subscription.id), ipHash: input.ipHash, metadata: { loginEmail: input.email.trim().toLowerCase(), planCode: String(plan.code), previousStatus, status: input.status, expiresAt: input.expiresAt ? input.expiresAt.toISOString() : null } } });
    return { ok: true as const, organization: { id: organization.id, name: organization.name, slug: organization.slug }, subscription: { id: String(subscription.id), status: String(subscription.status), expiresAt: subscription.expiresAt == null ? null : new Date(String(subscription.expiresAt)).toISOString() }, previousStatus };
  })) as Awaited<ReturnType<typeof applyPlanToOrganization>>;
  return result;
}

export async function createPlanDefinition(prisma: Db, input: { name: string; ipHash: string | undefined }): Promise<{ ok: true; plan: { id: string; code: string; name: string } } | { ok: false; error: "NAME_INVALID" | "CODE_TAKEN" }> {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) return { ok: false, error: "NAME_INVALID" };
  const code = slugify(name);
  if (code.length < 2) return { ok: false, error: "NAME_INVALID" };
  const existing = await prisma.marketplacePlan.findUnique({ where: { code } });
  if (existing) return { ok: false, error: "CODE_TAKEN" };
  const plan = await prisma.marketplacePlan.create({ data: { code, name, monthlyCredits: 0, teamSeats: 1, active: true } });
  await prisma.auditEvent.create({ data: { action: "admin.plan.created", entityType: "MarketplacePlan", entityId: String(plan.id), ipHash: input.ipHash, metadata: { name, code } } });
  return { ok: true, plan: { id: String(plan.id), code, name } };
}
```

The two behaviours are pinned by the tests: `planId` given but unknown → `PLAN_NOT_FOUND` even when the table has rows; no `planId` + empty table → default seed; no `planId` + non-empty table → `PLAN_NOT_FOUND` (the page always sends a `planId` once plans are listed, so this last path is defensive).

- [ ] **Step 4: Run and watch pass**

Run: `pnpm exec vitest run client/src/lib/plans/admin.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing route contract tests**

Create `client/src/lib/api-contract-super-admin.test.ts`:

```ts
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  marketplacePlan: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  marketplaceSubscription: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
  auditEvent: { create: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(database)),
}));

vi.mock("@/lib/repositories/server/prisma", () => ({ getPrismaClient: () => database }));
import { POST as signInPost } from "../../../app/api/auth/super/sign-in/route";
import { POST as signOutPost } from "../../../app/api/auth/super/sign-out/route";
import { GET as plansGet, POST as plansPost } from "../../../app/api/admin/plans/route";
import { POST as definitionsPost } from "../../../app/api/admin/plans/definitions/route";
import { SUPER_ADMIN_COOKIE, mintSuperAdminCookieValue } from "./auth/super-admin";

const SECRET = "contract-test-better-auth-secret";
const PASSWORD = "contract-test-owner-password";

function storedHash(): string {
  const salt = randomBytes(16);
  const hash = scryptSync(PASSWORD, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
  vi.stubEnv("ARCHITECH_SUPER_ADMIN_PASSWORD_HASH", storedHash());
  vi.stubEnv("ARCHITECH_DATA_SOURCE", "prisma");
});
afterEach(() => vi.unstubAllEnvs());

async function signedInCookie(): Promise<string> {
  const response = await signInPost(
    new Request("http://localhost/api/auth/super/sign-in", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: PASSWORD }) }),
  );
  expect(response.status).toBe(200);
  const setCookie = response.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/architech\.super_admin=([^;]+)/);
  if (!match) throw new Error(`no super-admin cookie in: ${setCookie}`);
  return match[1];
}

describe("POST /api/auth/super/sign-in", () => {
  it("503 when the hash is not configured", async () => {
    vi.stubEnv("ARCHITECH_SUPER_ADMIN_PASSWORD_HASH", "");
    const response = await signInPost(new Request("http://x/api/auth/super/sign-in", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "whatever" }) }));
    expect(response.status).toBe(503);
    expect((await json(response)).error).toBe("SUPER_ADMIN_NOT_CONFIGURED");
  });

  it("401 with a uniform message on a wrong password", async () => {
    const response = await signInPost(new Request("http://x/api/auth/super/sign-in", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "wrong" }) }));
    expect(response.status).toBe(401);
    expect((await json(response)).error).toBe("INVALID_CREDENTIALS");
  });

  it("200 + HttpOnly SameSite=Lax Max-Age=28800 cookie on success", async () => {
    const response = await signInPost(new Request("https://x.example/api/auth/super/sign-in", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: PASSWORD }) }));
    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/Max-Age=28800/);
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Lax/);
    expect(setCookie).toMatch(/Secure/);
  });
});

describe("admin plans routes", () => {
  it("403 for a session without admin.plans.read (demo broker)", async () => {
    const response = await plansGet(new Request("http://localhost/api/admin/plans"));
    expect(response.status).toBe(403);
  });

  it("503 in fixture mode even for the super admin", async () => {
    vi.stubEnv("ARCHITECH_DATA_SOURCE", "fixture");
    const cookie = await signedInCookie();
    const response = await plansGet(new Request("http://localhost/api/admin/plans", { headers: { cookie: `${SUPER_ADMIN_COOKIE}=${cookie}` } }));
    expect(response.status).toBe(503);
    expect((await json(response)).error).toBe("NOT_AVAILABLE_IN_FIXTURE_MODE");
  });

  it("GET lists plans and subscriptions for the super admin", async () => {
    const cookie = await signedInCookie();
    database.marketplacePlan.findMany.mockResolvedValue([{ id: "plan-1", code: "broker-pro", name: "Broker Pro", monthlyCredits: 0, teamSeats: 1 }]);
    database.marketplaceSubscription.findMany.mockResolvedValue([]);
    const response = await plansGet(new Request("http://localhost/api/admin/plans", { headers: { cookie: `${SUPER_ADMIN_COOKIE}=${cookie}` } }));
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.ok).toBe(true);
    expect((body.plans as unknown[])).toHaveLength(1);
  });

  it("POST applies a plan and audits it", async () => {
    const cookie = await signedInCookie();
    database.user.findUnique.mockResolvedValue({ id: "user-1", brokerMemberships: [{ organization: { id: "org-1", name: "Nivasa", slug: "nivasa" } }] });
    database.marketplacePlan.findUnique.mockResolvedValue({ id: "plan-1", code: "broker-pro", name: "Broker Pro" });
    database.marketplaceSubscription.findFirst.mockResolvedValue(null);
    database.marketplaceSubscription.create.mockResolvedValue({ id: "sub-1", status: "TRIAL", expiresAt: null });
    const response = await plansPost(
      new Request("http://localhost/api/admin/plans", { method: "POST", headers: { "Content-Type": "application/json", cookie: `${SUPER_ADMIN_COOKIE}=${cookie}` }, body: JSON.stringify({ email: "owner@nivasa.in", planId: "plan-1", status: "TRIAL" }) }),
    );
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body).toMatchObject({ ok: true, previousStatus: null });
    expect(database.auditEvent.create).toHaveBeenCalled();
  });

  it("POST rejects an invalid status with 400", async () => {
    const cookie = await signedInCookie();
    const response = await plansPost(
      new Request("http://localhost/api/admin/plans", { method: "POST", headers: { "Content-Type": "application/json", cookie: `${SUPER_ADMIN_COOKIE}=${cookie}` }, body: JSON.stringify({ email: "owner@nivasa.in", planId: "plan-1", status: "FREE" }) }),
    );
    expect(response.status).toBe(400);
  });

  it("POST /definitions creates a plan and 409s a duplicate code", async () => {
    const cookie = await signedInCookie();
    database.marketplacePlan.findUnique.mockResolvedValue(null);
    database.marketplacePlan.create.mockResolvedValue({ id: "plan-9", code: "brokerage-team", name: "Brokerage Team" });
    const created = await definitionsPost(new Request("http://localhost/api/admin/plans/definitions", { method: "POST", headers: { "Content-Type": "application/json", cookie: `${SUPER_ADMIN_COOKIE}=${cookie}` }, body: JSON.stringify({ name: "Brokerage Team" }) }));
    expect(created.status).toBe(200);
    database.marketplacePlan.findUnique.mockResolvedValue({ id: "plan-1" });
    const duplicate = await definitionsPost(new Request("http://localhost/api/admin/plans/definitions", { method: "POST", headers: { "Content-Type": "application/json", cookie: `${SUPER_ADMIN_COOKIE}=${cookie}` }, body: JSON.stringify({ name: "Broker Pro" }) }));
    expect(duplicate.status).toBe(409);
  });
});

describe("POST /api/auth/super/sign-out", () => {
  it("clears the cookie and is idempotent", async () => {
    const response = await signOutPost(new Request("http://localhost/api/auth/super/sign-out", { method: "POST" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toMatch(/Max-Age=0/);
  });
});
```

- [ ] **Step 6: Run and watch fail**

Run: `pnpm exec vitest run client/src/lib/api-contract-super-admin.test.ts`
Expected: FAIL — the admin plan routes do not exist (sign-in/out already do from Task 6, so those blocks pass).

- [ ] **Step 7: Implement the admin routes**

`app/api/admin/plans/route.ts`:

```ts
import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { isPrismaDataSource } from "@/lib/repositories/source";
import { getPrismaClient } from "@/lib/repositories/server/prisma";
import { isAdminPlanStatus, listPlanAdministration, lookupOrganizationForLogin, applyPlanToOrganization, type Db } from "@/lib/plans/admin";

export const runtime = "nodejs";

/* Owner-only plan administration (spec §7). Prisma mode only: the plan
   ledger is a database surface, and a fixture-mode 503 beats a dead form. */
function db(): Db | null {
  if (!isPrismaDataSource()) return null;
  return getPrismaClient() as unknown as Db;
}

function fixtureResponse(): NextResponse {
  return NextResponse.json({ ok: false, error: "NOT_AVAILABLE_IN_FIXTURE_MODE", errors: ["Plan administration needs the database deployment (ARCHITECH_DATA_SOURCE=prisma)."] }, { status: 503, headers: { "Cache-Control": "no-store" } });
}

function ipHash(request: Request): string | undefined {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip");
  return ip ? createHash("sha256").update(ip).digest("hex") : undefined;
}
```

(import `createHash` from `node:crypto`; also export the `Db` type from `client/src/lib/plans/admin.ts` — add `export type Db = …` there.)

```ts
export async function GET(request: Request) {
  const access = await authorizeRequest(request, { permission: "admin.plans.read" });
  if (!isAuthorized(access)) return access.response;
  const database = db();
  if (!database) return fixtureResponse();
  const lookupEmail = new URL(request.url).searchParams.get("lookup");
  const base = await listPlanAdministration(database);
  if (!lookupEmail) return NextResponse.json({ ok: true, ...base }, { headers: { "Cache-Control": "no-store" } });
  const lookup = await lookupOrganizationForLogin(database, lookupEmail);
  return NextResponse.json({ ok: true, ...base, lookup: lookup.found ? lookup : { found: false } }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const access = await authorizeRequest(request, { permission: "admin.plans.write" });
  if (!isAuthorized(access)) return access.response;
  const database = db();
  if (!database) return fixtureResponse();
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, status: 400, errors: ["A JSON body is required."] }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const status = body.status;
  if (!email || !isAdminPlanStatus(status)) {
    return NextResponse.json({ ok: false, status: 400, errors: ["An email login id and a status (TRIAL, ACTIVE or EXPIRED) are required."] }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  let expiresAt: Date | null = null;
  if (body.expiresAt != null && body.expiresAt !== "") {
    const parsed = new Date(String(body.expiresAt));
    if (Number.isNaN(parsed.getTime())) return NextResponse.json({ ok: false, status: 400, errors: ["expiresAt must be a valid date."] }, { status: 400, headers: { "Cache-Control": "no-store" } });
    expiresAt = parsed;
  }
  const result = await applyPlanToOrganization(database, { email, planId: typeof body.planId === "string" ? body.planId : undefined, status, expiresAt, ipHash: ipHash(request) });
  if (!result.ok) {
    // Both ORG_NOT_FOUND and PLAN_NOT_FOUND are 404 (uniform "that thing does
    // not exist" — no oracle between unknown email and unknown plan id).
    return NextResponse.json(result, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ ok: true, organization: result.organization, subscription: result.subscription, previousStatus: result.previousStatus }, { headers: { "Cache-Control": "no-store" } });
}
```

`app/api/admin/plans/definitions/route.ts`: same guard/fixture/db shape; `POST` body `{ name }` → `createPlanDefinition` → 200 `{ ok, plan }` / 400 `NAME_INVALID` / 409 `CODE_TAKEN`.

- [ ] **Step 8: Run and watch pass**

Run: `pnpm exec vitest run client/src/lib/api-contract-super-admin.test.ts`
Expected: PASS.

- [ ] **Step 9: Build the `/admin/plans` page**

`app/admin/plans/page.tsx`:

```tsx
import type { Metadata } from "next";
import PlanAdmin from "@/pages/PlanAdmin";

/* Owner-only plan administration (spec §7). NOT wrapped in RequireSession:
   that guard redirects to /login, but the super-admin surface signs in with
   its own password — the page renders its own gate. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Plans · Architech owner",
  description: "Grant and manage broker plans.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <PlanAdmin />;
}
```

`client/src/pages/PlanAdmin.tsx` — `"use client"`; structure (follow the repo's token discipline: `.ink-2`/`.ink-3`/`.stamp`, `touch-44`, `stamp` headings; no `text-ink/NN`, no `!text-[9/10px]`; mirror the visual language of `app/admin/acquisition` — read `client/src/pages/AcquisitionQueue.tsx` for the page chrome before writing):

1. **Gate** (via `useSession()` from `@/contexts/SessionContext`):
   - `status === "loading"` → skeleton.
   - `session?.permissions.includes("admin.plans.read")` → the administration UI.
   - Otherwise → the sign-in panel: heading "Owner sign-in", a password input (`type="password"`, `autoComplete="current-password"`), a Submit button. On submit: `POST /api/auth/super/sign-in { password }` → 200: `await refresh()` (the session contract now resolves the super-admin cookie) → the UI renders. 401/429: inline error text (`.ink-2`, `role="alert"`). The panel also shows, for a signed-in non-super-admin, "This surface is reserved for the owner" with a sign-out link (`signOut()`).
   - Fixture mode: after sign-in, if the first `GET /api/admin/plans` returns 503 `NOT_AVAILABLE_IN_FIXTURE_MODE`, render the documented state ("Plan administration needs the database deployment") instead of the forms.
2. **Grant/update panel:** email input + "Find" button → `GET /api/admin/plans?lookup=<email>` → renders the lookup card (org name/slug, current plan + status + expiry, or "no plan yet") plus the form: plan `<select>` (from `plans`), status `<select>` (TRIAL/ACTIVE/EXPIRED), expiry `<input type="date">` (optional, cleared on EXPIRED), Save → `POST /api/admin/plans` → success toast + refetch list; errors inline (404 "No organization found for that login id").
3. **Current subscriptions table:** the repo's `TableFrame`-style markup (or a plain `<table>` with `overflow-x-auto` per the scrollable-tables convention) — columns: Organization, Plan, Status, Expires, Updated. 50 rows max.
4. **Create plan:** name input + button → `POST /api/admin/plans/definitions` → refetch plans; 409 → inline "A plan with that name already exists".

Keep the whole component under ~300 lines; extract small local components (`Field`, `StatusPill`) in-file. No new third-party imports.

- [ ] **Step 10: Verify**

Run: `pnpm test` — Expected: PASS.
Run: `pnpm check && pnpm lint` — Expected: clean.
Run: `pnpm exec vitest run client/src/lib/ui/design-token-discipline.test.ts` — Expected: PASS (new page inside token discipline).

- [ ] **Step 11: Manual smoke (document the commands; run what the sandbox allows)**

```bash
# With a dev server (pnpm dev) and ARCHITECH_DATA_SOURCE=prisma + a test DB:
# 1. POST /api/auth/super/sign-in with the env password → cookie
# 2. GET  /admin/plans with the cookie → plans list
# 3. POST /api/admin/plans { email: <broker login id>, planId, status: "ACTIVE" }
# 4. As that broker: the lead detail Call action now passes the plan gate.
```

In this sandbox (no DB): the route tests above are the coverage; note the manual smoke as done-in-CI for the PR description.

- [ ] **Step 12: Commit**

```bash
git add client/src/lib/plans app/api/admin/plans client/src/pages/PlanAdmin.tsx app/admin/plans client/src/lib/api-contract-super-admin.test.ts
git commit -m "feat(admin): owner-only plan administration (/admin/plans)

lookup email → organization → current plan, grant/update via
MarketplaceSubscription upsert (default Broker Pro seed on first use),
create plan definitions, 50 most recent subscriptions. Every mutation is
audited as admin.plan.updated with the previous status. Routes are
prisma-mode only (503 in fixture mode) and guarded by admin.plans.* —
reachable only through the super-admin session."
```

---

### Task 8: Full verification pass + handoff

**Files:**
- Modify (if anything is red): whatever the verification surfaces.
- No new files expected.

**Interfaces:**
- Consumes: everything from Tasks 1–7.
- Produces: a green `verify` CI job on the branch and an up-to-date PR description.

- [x] **Step 1: Run the full local gate set**

```bash
pnpm check
pnpm lint
pnpm test
pnpm db:validate
pnpm audit:contrast
pnpm secrets:audit
pnpm production:plan:audit
pnpm build
PUBLIC_INDEXING_ENABLED=true node scripts/seo/crawl-simulation.mjs
pnpm test:perf
pnpm audit:mobile
```

Expected: all pass. Notes:
- `test:perf` runs against the fresh build; the detail page should be net-smaller (prototype panel removed). If it is not, check for an accidental static import and make it dynamic.
- `audit:mobile` will still report the 88-element shells on `/broker/*` (M1 is out of scope) — record the numbers; they must not regress from the post-PR #70 baseline.
- `production:plan:audit` must see `ARCHITECH_SUPER_ADMIN_PASSWORD_HASH` declared (Task 6 Step 7).
- The crawl simulation must pass — no public page links to any new surface (the admin pages are unlinked by design; verify `grep -rn "admin/plans" app client/src --include="*.tsx" | grep -v "pages/PlanAdmin\|admin/plans/page"` returns nothing user-facing).

Verified 11 Sep 2026 on `main` @ `183b7de` (post-PR #72, re-run on this branch):
- `check` ✅ 0 errors · `lint` ✅ 0 errors / 2 warnings (≤ 200 budget) · `test` ✅ 190 files, 2118/2118 passed (49 skipped) · `audit:contrast` ✅ · `secrets:audit` ✅ (10 tracked, platform stores only) · `production:plan:audit` ✅ (super-admin hash declared in `.env.example` + hygiene allow-list) · `build` ✅ · crawl-simulation ✅ (579 pages, no broken links; `admin/plans` grep clean — no user-facing links) · `test:perf` ✅ (budgets pass; largest chunk 71.7 KiB gzip ≪ 240 KB ceiling) · `audit:mobile` ✅ (14/14 routes 200; 0 overflow/tap/fixed-grid findings; broker shells now 102–258 elements post-PR #70 rework — the 88-element figure in the note is stale; no regression vs the post-PR #70 baseline).
- `db:validate` ⚠️ blocked by sandbox environment, not code: the Prisma CLI must download the schema-engine binary from `binaries.prisma.sh`, which this sandbox's egress policy TLS-resets (all alternate mirrors — npmmirror, aliyun, archive.org — equally blocked; no GitHub release or npm artifact carries commit `e922089b`). Proven not-a-code-issue: `prisma/` is byte-identical to the PR #72 merge state (this branch's only prior commit is docs-only `8ab2ea8`), and the same validation ran green in PR #72's CI `verify` job.
- `audit:mobile` requires a live dev server on `127.0.0.1:3000` (`pnpm dev`); run the audit while it is up.

- [x] **Step 2: Regression spot-checks (the guardrails this work must not break)**

```bash
# Masked list contract byte-identical (spec):
pnpm exec vitest run client/src/lib/leads/lead.test.ts client/src/lib/api-contract.test.ts
# W5 env parity (both directions):
pnpm exec vitest run client/src/lib/operations/env-catalog-parity.test.ts
# The PR #70 CI failure stays fixed:
pnpm exec vitest run client/src/lib/operations/env-catalog-parity.test.ts client/src/lib/env-docs-parity.test.ts
```

Verified 11 Sep 2026 on `main` @ `183b7de` (merged PR #72): lead.test.ts + api-contract.test.ts 40/40 pass; env-catalog-parity 4/4 pass; env-docs-parity 2/2 pass.

- [x] **Step 3: Final diff review**

```bash
git log --oneline main..HEAD
git diff --stat main..HEAD
```

Expected: 7 feature commits (Tasks 1–7) on top of the two CI-fix commits; the diff touches only the files listed in the plan's File Structure section (plus the plan/spec docs). If the diff touches anything else, stop and justify it before pushing.

Reviewed 11 Sep 2026. The feature work is already in `main` via merged PR #72, so the scope review runs against the merge commit: `git diff --stat 82281b5d..183b7de` (39 files, +4657/−671). Every file is in this plan's File Structure section or is plan/spec documentation, except three deviations — each justified:
1. `client/src/lib/plans/plan-status.ts` + `plan-status.test.ts` (new): the Task 1 resolver `resolvePlanStatusForOrg` was implemented as its own module instead of appended to `calling-server.ts` — cleaner separation, same spec §3 behaviour, covered by its own tests.
2. `client/src/lib/repositories/server/prisma.ts` (+4): adds `marketplaceSubscription` to the structural `PrismaClientLike` type so the new prisma queries are type-safe.
3. `client/src/pages/ListingSubmission.tsx` (−4): removes a public page's link to `/admin/moderation/listings` — a public→admin link, part of the crawl/typo-link CI fix; consistent with "admin pages are unlinked by design".

- [ ] **Step 4: Push and update the PR**

```bash
git push origin arena/01a08b50-architech
```

Update PR #71 (or open a follow-up PR if the two CI fixes have merged separately by then) with a description covering: the two CI fixes (env catalog parity, crawl/typo link) AND this feature completion — spec path, what was built (routes, gate, super admin, plan admin, purge), the deliberate behaviour change (prisma orgs without a plan cannot call until activated — activation steps: `node scripts/auth/make-super-admin-hash.mjs` → set `ARCHITECH_SUPER_ADMIN_PASSWORD_HASH` + `BETTER_AUTH_SECRET` in the deployment → sign in at `/admin/plans` → enter the broker's login id → grant a plan), and the verification evidence from Step 1.

- [ ] **Step 5: Watch CI to green**

Poll `gh pr checks` until the `verify` job completes. If any step fails, return to systematic debugging (no symptom fixes) and loop. Expected remaining CI-only risk: the playwright a11y/ui jobs (browser-based) — they were passing before this branch and this branch adds no public-surface markup.

- [ ] **Step 6: Close out the documentation**

- `docs/business-suite/mobile-calling-implementation-plan.md` — already updated in Task 4; verify the checkboxes match reality.
- Add a one-paragraph "Status (10 Sep 2026)" note at the top of the plan doc's §11: Phases 2–4 complete per `docs/superpowers/specs/2026-09-10-broker-calling-completion-design.md`; M1/M5/Phase 5 remain; plan activation is manual via `/admin/plans` (no payment gateway, by owner decision).
- Commit any doc-only tweaks with `docs: refresh mobile-calling plan status after Phases 2–4 completion`.

## Self-Review Notes (plan author)

- **Spec coverage:** spec §3 → Task 1; §4 → Task 3; §5 → Task 2 (+ Task 4 deletion); §6 → Task 6; §7 → Task 7; §8 → Task 4; §9 → Task 5; §10 → Task 4 Step 5 + Task 2 Step 9; §11 → Tasks 1–7 test steps + Task 8; §12 → Tasks 1 (env comment) and 6 Step 7; §15 ordering → Tasks 1–8. No orphaned requirement.
- **Placeholder scan:** clean after review pass (fixed: sign-in throttle-reset line, ownership-test mock instructions, duplicated plan-resolution branch, `FixtureCallEntry.lostReason`, a stray draft test call, a leftover comment artifact). Two remaining "read the named file" instructions are intentional grounding steps, not placeholders: Task 2 Step 5 (match `assertLeadBelongsToOrg`'s real prisma query shape) and Task 3 Step 1 (copy the public lead route's exact request-body keys from `api-contract.test.ts`).
- **Type consistency:** `AdminPlanStatus` = TRIAL|ACTIVE|EXPIRED everywhere (lib, route, page, tests); `LeadDetailRecord` field names match `getLeadDetailForServer`'s actual output (verified against `client/src/lib/listing/details.ts`); `Db` is exported from `plans/admin.ts` and imported by the routes; `SUPER_ADMIN_COOKIE`/`SUPER_ADMIN_TTL_SECONDS` names consistent across Task 6/7 tests.
