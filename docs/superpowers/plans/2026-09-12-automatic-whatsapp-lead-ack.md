# Automatic WhatsApp Lead Acknowledgement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the smallest useful, organization-scoped WhatsApp vertical slice: an active broker organization can connect one company-owned WhatsApp number by QR, save one acknowledgement template, and send at most one durable, auditable acknowledgement for an eligible lead.

**Architecture:** Architech remains the authenticated control plane and owns account, template, lead, dispatch, audit, and webhook state. A server-only Evolution 2.3.7 adapter performs QR, connection-state, and text-send calls against a private self-hosted Evolution deployment; the browser never calls Evolution and never receives provider credentials. Lead creation writes a unique dispatch row in the same Prisma transaction, while a tenant-scoped worker claims rows after commit and records `ACCEPTED`, `FAILED`, `UNKNOWN`, or `SKIPPED` without blindly retrying an ambiguous provider outcome.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.6, Prisma 7.9/PostgreSQL, PostgreSQL RLS, Vitest 4, Node.js worker script, Docker Compose, Evolution API 2.3.7 with Baileys, Redis, and a separate Evolution PostgreSQL database.

**Spec:** `docs/superpowers/specs/2026-09-12-automatic-whatsapp-lead-ack-design.md`

## Global Constraints

- Ship the automatic first acknowledgement only; do not add CRM chat history, inbound chat, media, campaigns, sequences, bulk sends, repeated follow-ups, Meta Cloud API, Chatwoot, or Frappe changes.
- The feature is city-agnostic and available to every broker organization with an exact `MarketplaceSubscription.status = ACTIVE`; do not create a city pilot or city-specific account routing.
- Use one Evolution Baileys account per organization initially; all cities owned by that organization share it.
- The connected number must be company-owned. The connect flow records an explicit broker attestation and does not provide logout, pause, or delete controls in this version; removing the linked device in WhatsApp is the initial disconnect path.
- The QR is rendered in the authenticated Architech broker dashboard. The browser talks only to Architech routes; Evolution’s global key, instance credentials, webhook key, QR payload after display, provider hashes, webhook `apikey`, and raw provider bodies never reach the browser, database, logs, or audit metadata.
- Allow exactly one active acknowledgement template per organization. Version saved templates immutably and render only `{{firstName}}`, `{{brokerName}}`, `{{listingTitle}}`, and `{{city}}`.
- Record one `WhatsAppDispatch` per `(leadId, purpose = "lead-ack")`. Use `PENDING → IN_FLIGHT → ACCEPTED | FAILED | UNKNOWN`, with `SKIPPED` for permanent ineligibility. `ACCEPTED` requires a provider message reference; an ambiguous result becomes `UNKNOWN` and is never automatically resent.
- Keep raw phone and rendered message body out of dispatch rows and generic job payloads. Decrypt the stored phone and render the immutable template only inside the worker, then discard both after the provider call.
- Retain the minimal server-side eligibility gate: `whatsappOptIn` defaults to false, opt-in copy is bounded and stored, and the existing consent-class permission matrix must still permit automated WhatsApp first touch. This is not a new consent-management subsystem.
- Replace the current lead fallback idempotency key that includes raw phone/message with keyed opaque material before real dispatch is enabled. Explicit caller keys remain bounded and validated; server-generated keys contain no customer contact data.
- Every tenant-owned account, template, dispatch, and inbound provider event lookup is organization-scoped. New tenant tables require PostgreSQL RLS, forced RLS, fail-closed policies, and inclusion in `ops/scripts/security/rls-audit.mjs`.
- Use the repository’s server authorization and mutation-safety guards. Resolve organization identity from the signed-in session or listing relation, never from an authority-bearing request field.
- A missing provider configuration or disabled feature flag fails closed and never creates a false connected state. Synthetic local-number activation is a separate operational gate from code readiness.
- Keep the implementation focused: add a dedicated broker WhatsApp component and minimal `AgentWorkspace`/section routing changes rather than growing the existing dashboard file into the feature.
- Commit every task’s independently testable deliverable to `arena/01a093d0-architech`; do not switch branches or modify the approved design spec.

---

## File map and responsibility boundaries

This map is the implementation boundary. Files listed under **Create** are new; files listed under **Modify** must be changed only for the responsibility described here.

### Create

- `db/migrations/202609120001_whatsapp_lead_ack/migration.sql` — tables, enums, indexes, foreign keys, and the lead eligibility columns.
- `db/migrations/202609120002_whatsapp_rls/migration.sql` — RLS enable/force statements and tenant policies for the three new tables.
- `src/lib/whatsapp/contracts.ts` — shared status literals, public response shapes, skip reasons, limits, and placeholder names.
- `src/lib/whatsapp/template.ts` — pure acknowledgement-template validation, placeholder extraction, bounded rendering, and preview values.
- `src/lib/whatsapp/template.test.ts` — template contract and safety tests.
- `src/lib/whatsapp/access.ts` — exact active-subscription and provider-feature gates.
- `src/lib/whatsapp/access.test.ts` — active-plan and fail-closed configuration tests.
- `src/lib/whatsapp/provider.ts` — provider-neutral `WhatsAppProvider` interface and typed provider errors.
- `src/lib/whatsapp/evolution.ts` — server-only Evolution HTTP adapter, timeouts, response allowlisting, and error redaction.
- `src/lib/whatsapp/evolution.test.ts` — mocked-fetch adapter tests.
- `src/lib/whatsapp/store.ts` — tenant-scoped account/template/settings persistence and sanitized delivery summaries.
- `src/lib/whatsapp/store.test.ts` — organization-isolation, versioning, and account-state tests.
- `src/lib/whatsapp/dispatch.ts` — transactional enqueue, atomic claims, state transitions, and dispatch summaries.
- `src/lib/whatsapp/dispatch.test.ts` — idempotency, claim races, skip behavior, and state-machine tests.
- `src/lib/whatsapp/worker.ts` — in-memory-only contact decrypt/render/send path and tenant-scoped outbox processing.
- `src/lib/whatsapp/worker.test.ts` — mock-provider integration tests, including ambiguous timeout no-resend behavior.
- `src/lib/whatsapp/retention.test.ts` — lead-retention and terminal-dispatch privacy tests.
- `src/lib/whatsapp/webhook.ts` — Evolution JWT verification, event normalization, and safe state application.
- `src/lib/whatsapp/webhook.test.ts` — signature, instance ownership, deduplication, and event-mapping tests.
- `src/app/api/broker/whatsapp/route.ts` — authenticated sanitized settings read.
- `src/app/api/broker/whatsapp/connect/route.ts` — active-plan/company-attestation account creation or resume.
- `src/app/api/broker/whatsapp/qr/route.ts` — no-store server-side QR/state poll.
- `src/app/api/broker/whatsapp/status/route.ts` — no-store observed connection-state read.
- `src/app/api/broker/whatsapp/template/route.ts` — active-template read and versioned update.
- `src/app/api/broker/whatsapp/route.test.ts` — route authorization, response-redaction, and no-store contract tests.
- `src/app/api/internal/providers/evolution/webhook/route.ts` — private verified Evolution callback.
- `src/app/api/internal/providers/evolution/webhook/route.test.ts` — raw-body JWT and unknown-instance route tests.
- `src/app/api/internal/scheduled/whatsapp/route.ts` — authenticated recovery/outbox driver.
- `src/components/broker/BrokerWhatsAppPanel.tsx` — focused QR, connection, template, and delivery-status UI.
- `src/components/broker/BrokerWhatsAppPanel.test.ts` — UI source contract and redaction tests.
- `src/screens/ListingPage.test.ts` — public lead opt-in and stable retry idempotency source contract.
- `docker-compose.whatsapp.yml` — local Evolution API 2.3.7, dedicated PostgreSQL, dedicated Redis, private dev exposure, and separate volumes.
- `docker-compose.production-like.yml` — add an opt-in `whatsapp` profile with private Evolution services and no public provider port; keep Evolution data stores separate from Architech’s existing services.
- `ops/scripts/whatsapp/outbox-worker.mjs` — small polling client for the authenticated internal worker route.
- `ops/scripts/whatsapp/outbox-worker.test.mjs` — polling/backoff/secret-header tests without starting a process.
- `docs/broker-suite/local-whatsapp-development.md` — local setup, synthetic-number-only instructions, and manual pilot checklist.

### Modify

- `db/schema.prisma` — add WhatsApp enums/models, lead opt-in fields, and organization/lead relations.
- `src/lib/repositories/server/prisma.ts` — export and extend the manually narrowed Prisma client surface for WhatsApp delegates, transactions, and tenant worker queries.
- `src/lib/repositories/server/tenant.ts` — add a typed Prisma tenant helper while preserving the existing fail-closed `withTenant` contract.
- `src/lib/interop/idempotency.ts` — add a server-keyed lead fallback key and reuse the existing bounded-key/payload-hash helpers.
- `src/lib/leads/lead.ts` — add `whatsappOptIn` and bounded opt-in copy to the lead input/fixture contract without exposing raw contact data.
- `src/lib/leads/server.ts` — use the opaque fallback key, persist the opt-in fields, and enqueue the dispatch inside the lead transaction after the lead and audit rows are created.
- `src/lib/leads/lead.test.ts` — prove default-off opt-in and fixture contract parity.
- `src/lib/leads/server.test.ts` — add Prisma transaction and duplicate-lead dispatch tests.
- `src/lib/auth/roles.ts` — add `broker.whatsapp.read` and `broker.whatsapp.manage`; grant read to broker members and management to broker admins/demo admin.
- `src/lib/auth/auth.test.ts` — verify the new permission matrix.
- `src/lib/auth/live-wired.test.ts` — verify live session permission wiring.
- `src/lib/i18n.ts` — add the English/Hindi one-time WhatsApp opt-in copy used by the public lead form.
- `ops/scripts/security/rls-audit.mjs` — read both RLS migrations and protect `WhatsAppAccount`, `WhatsAppTemplate`, and `WhatsAppDispatch`.
- `src/lib/db-schema.test.ts` — extend static schema/RLS expectations for the new tables and policies.
- `ops/scripts/privacy/purge-expired-leads.mjs` — verify expired/deleted leads cannot leave recoverable WhatsApp contact data or pending dispatches; preserve only bounded non-sensitive audit state when policy calls for a tombstone.
- `src/app/api/leads/route.ts` — keep the public route’s existing shape while accepting the two optional eligibility fields through the typed `LeadInput`.
- `src/screens/ListingPage.tsx` — add the optional, unchecked one-time WhatsApp eligibility checkbox and pass its bounded copy to `/api/leads`.
- `src/app/broker/agent/[section]/page.tsx` — register the `whatsapp` section.
- `src/screens/AgentWorkspace.tsx` — add one nav item, metadata entry, import, and render branch for `BrokerWhatsAppPanel`; do not move provider logic here.
- `src/lib/auth/live-wired.test.ts` — include the new broker permissions in the live session wiring assertions.
- `.env.example` — document server-only provider, worker, feature-gate, and keyed-idempotency variable names with empty secret values.
- `package.json` — add the `whatsapp:worker` script and keep dependencies unchanged unless the pinned source-verified JWT implementation proves a new package is necessary.
- `ops/config/governance/secrets/phase-1-secret-inventory.json` — register new server secrets by name, scope, owner, environments, and rotation period; never add values.
- `ops/config/governance/environments/phase-1-environments.json` — describe private Evolution/worker services and the disabled-by-default activation gate in staging/production readiness metadata.

---

## Task 1: Lock the WhatsApp domain contracts and Prisma persistence surface

**Files:**
- Modify: `db/schema.prisma`
- Create: `db/migrations/202609120001_whatsapp_lead_ack/migration.sql`
- Create: `src/lib/whatsapp/contracts.ts`
- Modify: `src/lib/repositories/server/prisma.ts`
- Test: `src/lib/db-schema.test.ts`

**Interfaces:**
- Produces the exact model/status vocabulary consumed by Tasks 2–8.
- Produces `WHATSAPP_DISPATCH_PURPOSE = "lead-ack"`, the four placeholder names, bounded body/render limits, and typed public settings/delivery shapes.
- Produces Prisma delegates for `whatsappAccount`, `whatsappTemplate`, and `whatsappDispatch` on the repository’s narrowed server client.

- [ ] **Step 1: Write the schema contract test before changing the schema.**

Add assertions that the schema text contains the two WhatsApp enums, `Lead.whatsappOptIn Boolean @default(false)`, `Lead.whatsappOptInAt`, `Lead.whatsappOptInText`, the unique `@@unique([leadId, purpose])`, and the three organization relations. Also assert the dispatch model has `expiresAt`, `providerMessageId`, `payloadHash`, `attemptCount`, and no `phone` or `body` field.

Run:

```bash
pnpm vitest run src/lib/db-schema.test.ts
```

Expected: the new assertions fail because the model and relations do not exist.

- [ ] **Step 2: Add the domain enums and model fields to `db/schema.prisma`.**

Add:

```prisma
enum WhatsAppAccountStatus {
  PROVISIONING
  QR_READY
  CONNECTING
  CONNECTED
  DISCONNECTED
  ERROR
}

enum WhatsAppDispatchStatus {
  PENDING
  IN_FLIGHT
  ACCEPTED
  FAILED
  UNKNOWN
  SKIPPED
}
```

Add `whatsappOptIn Boolean @default(false)`, `whatsappOptInAt DateTime?`, and `whatsappOptInText String? @db.VarChar(240)` to `Lead`, plus `whatsappDispatches WhatsAppDispatch[]` to `Lead`.

Add these fields to `WhatsAppAccount`: `id`, `organizationId @unique`, `provider @default("EVOLUTION_BAILEYS") @db.VarChar(32)`, `instanceName @unique @db.VarChar(100)`, `providerInstanceId @db.VarChar(140)`, `status`, `phoneLast4 @db.VarChar(4)`, `connectedAt`, `lastObservedAt`, `lastErrorCode @db.VarChar(64)`, `createdAt`, and `updatedAt`. Use relations to `BrokerOrganization` and `WhatsAppDispatch[]`, indexes on `(organizationId, status)` and `(status, lastObservedAt)`, and do not add QR, webhook key, provider hash, or API-key columns.

Add these fields to `WhatsAppTemplate`: `id`, `organizationId`, `version`, `body @db.VarChar(1200)`, `isActive @default(true)`, `createdById`, and `createdAt`; use `@@unique([organizationId, version])` and `@@index([organizationId, isActive, version])`.

Add these fields to `WhatsAppDispatch`: `id`, `organizationId`, `leadId`, nullable `accountId`, nullable `templateId`, `purpose @default("lead-ack") @db.VarChar(48)`, nullable `templateVersion`, `status`, `skipReason @db.VarChar(64)`, `providerMessageId @db.VarChar(140)`, `payloadHash @db.VarChar(64)`, `attemptCount @default(0)`, `lastErrorCode @db.VarChar(64)`, `nextAttemptAt`, `expiresAt`, `acceptedAt`, `completedAt`, `createdAt`, and `updatedAt`. Use organization/lead/account/template relations with cascade from the lead and organization, `SetNull` for the optional account/template references, `@@unique([leadId, purpose])`, and indexes on `(organizationId, status, nextAttemptAt)`, `(accountId, status)`, and `providerMessageId`.

Add `whatsappAccounts`, `whatsappTemplates`, and `whatsappDispatches` relations to `BrokerOrganization`. Do not add a city relation: city routing is explicitly deferred.

- [ ] **Step 3: Define the shared TypeScript contracts.**

Create `src/lib/whatsapp/contracts.ts` with the same spelling used by Prisma and the API:

```ts
export const WHATSAPP_DISPATCH_PURPOSE = "lead-ack" as const;
export const ALLOWED_ACKNOWLEDGEMENT_PLACEHOLDERS = ["firstName", "brokerName", "listingTitle", "city"] as const;
export const ACKNOWLEDGEMENT_BODY_MAX = 1200;
export const ACKNOWLEDGEMENT_RENDERED_MAX = 1500;
export type WhatsAppAccountStatus = "PROVISIONING" | "QR_READY" | "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "ERROR";
export type WhatsAppDispatchStatus = "PENDING" | "IN_FLIGHT" | "ACCEPTED" | "FAILED" | "UNKNOWN" | "SKIPPED";
export type WhatsAppSkipReason =
  | "NO_ACTIVE_PLAN" | "NO_WHATSAPP_OPT_IN" | "CONSENT_CLASS_BLOCKED"
  | "NO_ACTIVE_TEMPLATE" | "NO_CONNECTED_ACCOUNT" | "LEAD_DELETED"
  | "LEAD_EXPIRED" | "TEMPLATE_VERSION_MISSING" | "INVALID_PHONE"
  | "PROVIDER_DISABLED";
```

Also define `AcknowledgementValues`, the sanitized account/template/settings response types, and `WhatsAppBatchResult` with `scanned`, `claimed`, `accepted`, `failed`, `unknown`, `skipped`, and `pending` counters. Add a `latest` delivery field containing only `{ status, providerMessageId, acceptedAt, completedAt } | null`; the provider message reference is safe to show to the owning broker and is required by the acceptance outcome.

- [ ] **Step 4: Create the migration from the schema and inspect every destructive operation.**

Create `db/migrations/202609120001_whatsapp_lead_ack/migration.sql` using the repository’s migration convention. The SQL must create the enums and tables, add the three lead columns, add foreign keys and indexes, and enforce the unique dispatch key. The dispatch foreign key to `Lead` must be `ON DELETE CASCADE` so the existing lead privacy path cannot leave a pending row referencing a deleted lead.

Inspect the generated SQL before running it:

```bash
git diff -- db/schema.prisma db/migrations/202609120001_whatsapp_lead_ack/migration.sql
```

Expected: no shared Architech database is used for Evolution; the migration contains only Architech control-plane tables and lead fields.

- [ ] **Step 5: Extend the narrowed Prisma type without exposing generated client types to browser code.**

Export the existing `PrismaClientLike` type and add model delegate methods needed by the new server modules. Keep arguments `unknown` at this repository boundary, retain the singleton constructor, and add a transaction signature that passes the same model surface to the callback:

Add this reusable loose delegate and append the three model fields to the existing `PrismaClientLike` without removing its current listing/locality/city/organization/subscription delegates:

```ts
export type PrismaModelDelegate = {
  findMany(args?: unknown): Promise<unknown[]>;
  findFirst(args?: unknown): Promise<unknown | null>;
  findUnique(args?: unknown): Promise<unknown | null>;
  create(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
  updateMany(args: unknown): Promise<{ count: number }>;
  count(args?: unknown): Promise<number>;
};

// Add these members to the existing PrismaClientLike type:
whatsappAccount: PrismaModelDelegate;
whatsappTemplate: PrismaModelDelegate;
whatsappDispatch: PrismaModelDelegate;
$transaction<T>(fn: (tx: PrismaClientLike) => Promise<T>): Promise<T>;
$executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
$queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
```

Use the repository’s existing `getPrismaClient()` singleton and do not import `@prisma/client` from any component or route client bundle.

- [ ] **Step 6: Generate and validate Prisma, then run the contract test.**

Run:

```bash
pnpm db:generate
pnpm db:validate
pnpm vitest run src/lib/db-schema.test.ts
```

Expected: schema validation and generation pass; the new schema assertions pass. Do not commit generated `node_modules` output.

- [ ] **Step 7: Commit the persistence contract.**

```bash
git add db/schema.prisma db/migrations/202609120001_whatsapp_lead_ack/migration.sql src/lib/whatsapp/contracts.ts src/lib/repositories/server/prisma.ts src/lib/db-schema.test.ts
git commit -m "feat: add WhatsApp acknowledgement persistence contract"
```

---

## Task 2: Add tenant RLS and the safe lead eligibility/idempotency contract

**Files:**
- Create: `db/migrations/202609120002_whatsapp_rls/migration.sql`
- Create: `src/lib/interop/idempotency.test.ts`
- Create: `src/lib/leads/server.test.ts`
- Create: `src/lib/whatsapp/dispatch.ts`
- Create: `src/lib/whatsapp/dispatch.test.ts`
- Modify: `ops/scripts/security/rls-audit.mjs`
- Modify: `src/lib/repositories/server/tenant.ts`
- Modify: `src/lib/interop/idempotency.ts`
- Modify: `src/lib/leads/lead.ts`
- Modify: `src/lib/leads/server.ts`
- Modify: `src/app/api/leads/route.ts`
- Modify: `src/screens/ListingPage.tsx`
- Modify: `src/lib/i18n.ts`
- Modify: `.env.example`
- Test: `src/lib/leads/lead.test.ts`
- Test: `src/lib/db-schema.test.ts`

**Interfaces:**
- Produces `buildLeadIdempotencyKey(input: { listingId: string; normalizedPhone: string; normalizedMessage: string }, secret?: string): string` and `validateCallerIdempotencyKey(raw: string, secret?: string): string`.
- Produces `LeadInput.whatsappOptIn?: boolean` and `LeadInput.whatsappOptInText?: string`; a missing flag is false.
- Produces `enqueueLeadWhatsAppAcknowledgement(tx, input): Promise<void>` in `src/lib/whatsapp/dispatch.ts`; the lead transaction calls it only after `dbLead` and its audit row exist.
- Preserves the current public lead response and fixture-mode behavior except for the new non-sensitive opt-in fields.

- [ ] **Step 1: Write failing tests for RLS coverage, keyed fallback keys, and default-off opt-in.**

Add tests that:

```ts
it("does not put phone or message text in the server-generated key", () => {
  const key = buildLeadIdempotencyKey({
    listingId: "listing-1",
    normalizedPhone: "+919876543210",
    normalizedMessage: "Please call me tomorrow",
  }, "test-secret");
  expect(key).toMatch(/^lead\.v1\.[a-f0-9]{64}$/);
  expect(key).not.toContain("9876543210");
  expect(key).not.toContain("Please");
});

it("hashes a caller retry token before persisting it", () => {
  const key = validateCallerIdempotencyKey("+919876543210", "test-secret");
  expect(key).toMatch(/^lead\.client\.v1\.[a-f0-9]{64}$/);
  expect(key).not.toContain("9876543210");
});

it("defaults automated WhatsApp eligibility off", () => {
  const result = createLead(validInputWithoutWhatsappFields);
  expect(result.ok && result.lead.whatsappOptIn).toBe(false);
});
```

Add static RLS assertions for the second migration and the three new table names. Add a Prisma-path transaction mock that expects a dispatch enqueue attempt once for a genuinely new lead and zero times for a duplicate lead. Add a source contract test for `ListingPage.tsx` that expects an unchecked `name="whatsappOptIn"` checkbox, a request body containing `whatsappOptIn` and `whatsappOptInText`, and a reusable `useRef` idempotency key rather than a new key on every retry.

Run the focused tests and expect them to fail because the helper, fields, migration, opt-in form wiring, and enqueue hook do not exist.

- [ ] **Step 2: Add a keyed, bounded lead fallback key.**

In `src/lib/interop/idempotency.ts`, use HMAC-SHA-256 with a purpose-specific server secret. The implementation must normalize the message before hashing and use an unambiguous delimiter:

```ts
export function buildLeadIdempotencyKey(
  input: { listingId: string; normalizedPhone: string; normalizedMessage: string },
  secret = process.env.ARCHITECH_IDEMPOTENCY_HMAC_KEY,
): string {
  if (!secret) throw new IdempotencyKeyError("ARCHITECH_IDEMPOTENCY_HMAC_KEY is required for server-generated lead keys.");
  const material = [input.listingId, input.normalizedPhone, input.normalizedMessage.trim().toLowerCase()].join("\u0000");
  return `lead.v1.${createHmac("sha256", secret).update(material).digest("hex")}`;
}

export function validateCallerIdempotencyKey(raw: string, secret = process.env.ARCHITECH_IDEMPOTENCY_HMAC_KEY): string {
  const value = raw.trim();
  if (!value || value.length > IDEMPOTENCY_KEY_MAX || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new IdempotencyKeyError("caller idempotency key is empty, oversized, or contains control characters.");
  }
  if (!secret) throw new IdempotencyKeyError("ARCHITECH_IDEMPOTENCY_HMAC_KEY is required for caller keys.");
  return `lead.client.v1.${createHmac("sha256", secret).update(value).digest("hex")}`;
}
```

Keep `buildIdempotencyKey` and `payloadHash` unchanged for existing integrations. In fixture-only mode, use a clearly named non-production fixture secret when no environment secret is present; in Prisma lead mode, missing `ARCHITECH_IDEMPOTENCY_HMAC_KEY` must fail closed rather than persist an unsafe fallback.

Add `ARCHITECH_IDEMPOTENCY_HMAC_KEY=` to `.env.example` and keep it server-only in the secrets inventory task.

- [ ] **Step 3: Add minimal opt-in fields and validation to both lead stores.**

Extend `LeadInput` and `LeadRecord` with:

```ts
whatsappOptIn?: boolean;
whatsappOptInAt?: string;
whatsappOptInText?: string;
```

Treat `whatsappOptIn` as false unless it is exactly true. When true, require a trimmed `whatsappOptInText` between 12 and 240 characters, reject control characters, and store the capture time server-side rather than trusting a client timestamp. The fixture record may expose the boolean and bounded copy; never expose the raw phone or rendered message through this addition.

Update fixture reset/create behavior and test fixtures so existing lead tests continue to exercise the default-off path. The fixture `createLead` must also call the keyed helper (with its clearly named fixture-only secret) for omitted keys, so the in-memory `LeadRecord.idempotencyKey` never contains raw phone/message text.

- [ ] **Step 4: Add the public lead checkbox without changing the existing consent flow.**

In `src/screens/ListingPage.tsx`, keep the existing required Architech storage/contact checkbox and add a separate optional checkbox with no `defaultChecked`:

```tsx
<label>
  <input name="whatsappOptIn" type="checkbox" />
  <span>{t.listing.whatsappOptInText}</span>
</label>
```

Read `form.get("whatsappOptIn") === "on"` and send the exact displayed copy as `whatsappOptInText`. Keep one generated idempotency key in a `useRef` for the lifetime of the open submission dialog and reuse it across a network retry; clear it only after a successful response. A double-click is already disabled while the request is in flight, and a retry after an ambiguous network failure must hit the same database lead. Add English and Hindi strings under `listing` in `src/lib/i18n.ts` explaining that this permits one acknowledgement about this enquiry, is not a campaign, and can be declined. Do not make the checkbox required or preselect it. Add `src/screens/ListingPage.test.ts` source assertions for unchecked/default-off markup, stable retry idempotency, and the request fields.

- [ ] **Step 5: Replace the Prisma fallback and wire the transactional enqueue seam.**

In `createLeadForServer`, normalize the phone first, derive `phoneForStorage` as before, and choose the key as follows:

```ts
const key = input.idempotencyKey?.trim()
  ? validateCallerIdempotencyKey(input.idempotencyKey)
  : buildLeadIdempotencyKey({
      listingId: listing.id,
      normalizedPhone: phoneForStorage,
      normalizedMessage: input.message,
    });
```

The caller key validator must reject empty values, control characters, and values longer than `IDEMPOTENCY_KEY_MAX`, then return a keyed opaque value such as `lead.client.v1.<64-hex-digest>` rather than persisting the caller’s string. This prevents a malicious or accidental phone number supplied as an idempotency key from entering the lead row or logs. The client key is only a retry token; it must never derive WhatsApp provider identity.

Persist `whatsappOptIn`, `whatsappOptInAt`, and `whatsappOptInText` on the lead. Within the existing `$transaction`, perform the lead create, audit create, and then call:

```ts
await enqueueLeadWhatsAppAcknowledgement(tx, {
  leadId: dbLead.id,
  organizationId: listing.brokerOrgId ?? null,
  whatsappOptIn: input.whatsappOptIn === true,
  whatsappOptInText: input.whatsappOptInText?.trim() ?? null,
  consentClass: input.consentClass ?? "first-party-form",
  expiresAt: new Date(Date.now() + 15 * 60 * 1000),
});
```

The dispatch helper must not call Evolution. If the lead has no owning organization, it returns without a dispatch. A duplicate lead path returns the existing contract and never emits or enqueues again. Pass the already-normalized opaque `key` into `dbLeadContract` and the fixture contract so the public record never reconstructs the old raw phone/message fallback. Keep the existing `emitLeadEvent` notification spine separate; it is not the WhatsApp queue.

- [ ] **Step 6: Add the tenant Prisma helper and RLS migration.**

Keep `withTenant` as the sanctioned transaction-scoped GUC setter, import `PrismaClientLike` with `import type`, and add a typed helper for model delegates:

```ts
export async function withTenantPrisma<T>(
  client: PrismaClientLike,
  organizationId: string,
  work: (tx: PrismaClientLike) => Promise<T>,
): Promise<T> {
  return withTenant(client, organizationId, (tx) => work(tx as PrismaClientLike));
}
```

Create `db/migrations/202609120002_whatsapp_rls/migration.sql` with `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`, and select/insert/update/delete policies for `WhatsAppAccount`, `WhatsAppTemplate`, and `WhatsAppDispatch`. Each policy must compare the quoted `"organizationId"` column with `architech_current_org_id()` in both `USING` and `WITH CHECK` clauses:

```sql
ALTER TABLE "WhatsAppAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WhatsAppAccount" FORCE ROW LEVEL SECURITY;
CREATE POLICY "WhatsAppAccount_tenant_select" ON "WhatsAppAccount"
  FOR SELECT USING ("organizationId" = architech_current_org_id());
CREATE POLICY "WhatsAppAccount_tenant_write" ON "WhatsAppAccount"
  FOR INSERT WITH CHECK ("organizationId" = architech_current_org_id());
CREATE POLICY "WhatsAppAccount_tenant_update" ON "WhatsAppAccount"
  FOR UPDATE USING ("organizationId" = architech_current_org_id())
  WITH CHECK ("organizationId" = architech_current_org_id());
CREATE POLICY "WhatsAppAccount_tenant_delete" ON "WhatsAppAccount"
  FOR DELETE USING ("organizationId" = architech_current_org_id());
```

Repeat the same fail-closed shape for `WhatsAppTemplate` and `WhatsAppDispatch`. Do not add a wildcard or bypass policy. The worker will enumerate organization ids from the existing organization table and enter one tenant transaction at a time.

- [ ] **Step 7: Implement the transactional dispatch enqueue seam.**

Create `src/lib/whatsapp/dispatch.ts` with the enqueue function needed by the lead transaction. It must use only the passed Prisma transaction and these input fields:

```ts
export type LeadWhatsAppEnqueueInput = {
  leadId: string;
  organizationId: string | null;
  whatsappOptIn: boolean;
  whatsappOptInText: string | null;
  consentClass: string;
  expiresAt: Date;
};

export async function enqueueLeadWhatsAppAcknowledgement(
  tx: PrismaClientLike,
  input: LeadWhatsAppEnqueueInput,
): Promise<void>;
```

Look up the latest organization subscription by `startsAt desc, id desc` and accept only literal `ACTIVE`; look up the active template by highest version; and read the organization’s one account. Create one `SKIPPED` row with a bounded `skipReason` for a permanent gate failure, or one `PENDING` row with `accountId`, `templateId`, `templateVersion`, and `expiresAt` when the worker can continue. A temporary `PROVISIONING`, `QR_READY`, or `CONNECTING` account remains pending; a missing/disconnected/error account is skipped. Use the existing consent registry’s `automatedWhatsAppFirstTouch` permission. Never read or write phone ciphertext/body fields here and never call the provider. Catch only the unique `(leadId, purpose)` race as a no-op; surface unrelated database errors so the lead transaction rolls back.

- [ ] **Step 8: Update the static/live RLS audit.**

Replace the single `MIGRATION` constant with an ordered `RLS_MIGRATIONS` list containing `db/migrations/202609030004_row_level_security/migration.sql` and `db/migrations/202609120002_whatsapp_rls/migration.sql`. Read and concatenate both files for helper/policy checks, while checking each table against the database’s live `relrowsecurity` and `relforcerowsecurity` flags. Add `WhatsAppAccount`, `WhatsAppTemplate`, and `WhatsAppDispatch` to `PROTECTED_TABLES`.

Keep the existing AuditEvent append-only checks and the live unset-GUC zero-row check. Add static checks that each new table has a tenant policy and that the new migration does not contain a policy using `TRUE` as its tenant predicate.

- [ ] **Step 9: Run the RLS and focused lead/idempotency tests.**

Run:

```bash
pnpm vitest run src/lib/db-schema.test.ts src/lib/leads/lead.test.ts src/lib/leads/server.test.ts src/lib/interop/idempotency.test.ts src/lib/whatsapp/dispatch.test.ts
pnpm security:rls
```

Expected: the new keyed-key, default-off, duplicate-enqueue, schema, and static RLS assertions pass. With no `DATABASE_URL`, the RLS command may report static checks only; a live database run is required before rollout.

- [ ] **Step 10: Commit tenant and eligibility foundations.**

```bash
git add db/migrations/202609120002_whatsapp_rls/migration.sql ops/scripts/security/rls-audit.mjs src/lib/repositories/server/tenant.ts src/lib/interop/idempotency.ts src/lib/leads/lead.ts src/lib/leads/server.ts src/app/api/leads/route.ts src/screens/ListingPage.tsx src/screens/ListingPage.test.ts src/lib/i18n.ts .env.example src/lib/leads/lead.test.ts src/lib/leads/server.test.ts src/lib/interop/idempotency.test.ts src/lib/whatsapp/dispatch.ts src/lib/whatsapp/dispatch.test.ts src/lib/db-schema.test.ts
git commit -m "feat: add tenant RLS and safe WhatsApp lead eligibility"
```

---

## Task 3: Implement template validation and the exact active-plan gate

**Files:**
- Create: `src/lib/whatsapp/template.ts`
- Create: `src/lib/whatsapp/template.test.ts`
- Create: `src/lib/whatsapp/access.ts`
- Create: `src/lib/whatsapp/access.test.ts`

**Interfaces:**
- Produces `validateAcknowledgementTemplate(body: unknown): { ok: true; body: string; placeholders: string[] } | { ok: false; errors: string[] }`.
- Produces `renderAcknowledgementTemplate(body: string, values: AcknowledgementValues): string`.
- Produces `resolveWhatsAppPlanGate(organizationId: string): Promise<{ ok: true; status: "ACTIVE" } | { ok: false; status: 402 | 503; reason: "NO_ACTIVE_PLAN" | "PROVIDER_DISABLED" | "REAL_NUMBERS_DISABLED" }>`.
- Produces `DEFAULT_ACKNOWLEDGEMENT_BODY` and the only four allowed placeholder names for the UI and route responses.

- [ ] **Step 1: Write failing pure tests for template safety and plan semantics.**

Cover these cases:

```ts
expect(validateAcknowledgementTemplate("Hi {{firstName}} from {{brokerName}}.")).toMatchObject({ ok: true });
expect(validateAcknowledgementTemplate("Hi {{phone}}.")).toMatchObject({ ok: false });
expect(validateAcknowledgementTemplate("{{firstName}}".repeat(1000)).toMatchObject({ ok: false });
expect(validateAcknowledgementTemplate("hello\u0000there")).toMatchObject({ ok: false });
expect(renderAcknowledgementTemplate("Hi {{firstName}}", { firstName: "Asha", brokerName: "Nivasa Partners", listingTitle: "Garden Court", city: "Ahmedabad" })).toBe("Hi Asha");
```

Mock `resolvePlanStatusForOrg` and assert only `ACTIVE` returns `ok: true` when both feature flags and all provider configuration are present; `TRIAL`, `EXPIRED`, `NONE`, `PAUSED` as resolved by the existing resolver, missing provider configuration, a false feature flag, and a false real-number gate do not pass. Do not add a plan entitlement lookup: the subscription gate is status-only.

Run the tests and expect them to fail because the pure module and gate do not exist.

- [ ] **Step 2: Define bounded template constants and the default copy.**

Use these exact limits and default body:

```ts
export const ALLOWED_ACKNOWLEDGEMENT_PLACEHOLDERS = [
  "firstName",
  "brokerName",
  "listingTitle",
  "city",
] as const;
export const ACKNOWLEDGEMENT_BODY_MAX = 1200;
export const ACKNOWLEDGEMENT_RENDERED_MAX = 1500;
export const DEFAULT_ACKNOWLEDGEMENT_BODY =
  "Hi {{firstName}}, this is {{brokerName}}. We received your enquiry for {{listingTitle}} in {{city}}. Our team will contact you shortly. Reply STOP to opt out.";
```

Normalize line endings to `\n`, trim leading/trailing whitespace, permit ordinary spaces/newlines/tabs, and reject all other C0 controls. Extract placeholders with one deterministic regular expression, reject unknown names, and reject a body with no visible non-whitespace content. Return sorted unique placeholder names for stable tests and API output.

- [ ] **Step 3: Implement safe rendering and preview values.**

`renderAcknowledgementTemplate` must validate the stored body before rendering, normalize each replacement value to a single-line bounded display string, strip control characters, and throw a typed template error if a replacement would exceed the rendered limit. It must replace only the four exact placeholders and never evaluate expressions, links, HTML, or arbitrary braces.

Define preview values in the module:

```ts
export const ACKNOWLEDGEMENT_PREVIEW_VALUES = {
  firstName: "Asha",
  brokerName: "Nivasa Partners",
  listingTitle: "Garden Court",
  city: "Ahmedabad",
} as const;
```

Use the same renderer for the dashboard preview and the worker; do not create a second client-side interpolation implementation.

- [ ] **Step 4: Implement the plan/provider feature gate.**

`resolveWhatsAppPlanGate` calls `resolvePlanStatusForOrg`. It returns `NO_ACTIVE_PLAN` with status 402 unless the result is exactly `ACTIVE`. It then requires `ARCHITECH_WHATSAPP_ENABLED === "true"`, `ARCHITECH_WHATSAPP_REAL_NUMBERS_ENABLED === "true"`, and non-empty `ARCHITECH_EVOLUTION_API_URL`, `ARCHITECH_EVOLUTION_API_KEY`, `ARCHITECH_EVOLUTION_WEBHOOK_JWT_KEY`, and `ARCHITECH_EVOLUTION_WEBHOOK_URL`; a missing feature flag returns `PROVIDER_DISABLED`, a false real-number gate returns `REAL_NUMBERS_DISABLED`, and missing provider values return `PROVIDER_DISABLED`, all with status 503. Do not use an entitlement name, city, organization slug, or client-provided plan value.

Use the gate in server services, not only in UI routes, so a worker cannot send simply because a row was previously pending.

- [ ] **Step 5: Run pure tests and commit the template/gate slice.**

```bash
pnpm vitest run src/lib/whatsapp/template.test.ts src/lib/whatsapp/access.test.ts
pnpm check
```

Expected: all template and exact-status tests pass; TypeScript accepts the exported contracts.

```bash
git add src/lib/whatsapp/contracts.ts src/lib/whatsapp/template.ts src/lib/whatsapp/template.test.ts src/lib/whatsapp/access.ts src/lib/whatsapp/access.test.ts src/lib/plans/plan-status.ts
git commit -m "feat: add WhatsApp template and active-plan gates"
```

---

## Task 4: Build and test the server-only Evolution adapter

**Files:**
- Create: `src/lib/whatsapp/provider.ts`
- Create: `src/lib/whatsapp/evolution.ts`
- Create: `src/lib/whatsapp/evolution.test.ts`

**Interfaces:**
- Produces this provider-neutral interface for account and worker services:

```ts
export type WhatsAppProvider = {
  createInstance(input: {
    instanceName: string;
    webhookUrl: string;
    webhookJwtKey: string;
    events: string[];
  }): Promise<{ providerInstanceId: string | null; state: string }>;
  getQr(input: { instanceName: string }): Promise<{ state: string; qrDataUrl?: string }>;
  getConnectionState(input: { instanceName: string }): Promise<{ state: string }>;
  sendText(input: { instanceName: string; number: string; text: string }): Promise<{ providerMessageId: string | null }>;
};
```
- Produces typed definitive/ambiguous/disabled provider errors with bounded safe codes.
- Keeps `getEvolutionProvider()` server-only and unavailable to browser modules.

- [ ] **Step 1: Write mocked-fetch tests for every Evolution operation.**

Mock `globalThis.fetch` and assert the adapter calls only the verified 2.3.7 paths:

```text
POST /instance/create
GET  /instance/connect/:instanceName
GET  /instance/connectionState/:instanceName
POST /message/sendText/:instanceName
```

Assert that every request carries the server-only Evolution API key, the send body is `{ number, text }`, and the returned values contain only `providerInstanceId`, `state`, `qrDataUrl`, or `providerMessageId`. Include responses containing `hash`, `token`, `apikey`, QR metadata, and nested raw errors; assert none appears in the returned object or thrown message. Include an AbortError/network rejection test classified as ambiguous for `sendText`, and a 400/401/404 test classified as definitive with codes such as `PROVIDER_AUTH`, `INSTANCE_NOT_FOUND`, or `PROVIDER_REJECTED`.

Run the focused test and expect it to fail because the interface and adapter are absent.

- [ ] **Step 2: Add the provider interface and safe error type.**

In `provider.ts`, define the interface above plus:

```ts
export type WhatsAppProviderErrorKind = "DEFINITIVE" | "AMBIGUOUS" | "DISABLED";
export class WhatsAppProviderError extends Error {
  constructor(readonly kind: WhatsAppProviderErrorKind, readonly code: string) {
    super(code);
    this.name = "WhatsAppProviderError";
  }
}
```

The code must be a fixed bounded value, not an upstream body, URL, phone, message, credential, or instance hash.

- [ ] **Step 3: Implement the Evolution adapter against the pinned source contract.**

Mark the module `server-only`. Read `ARCHITECH_EVOLUTION_API_URL`, `ARCHITECH_EVOLUTION_API_KEY`, `ARCHITECH_EVOLUTION_WEBHOOK_JWT_KEY`, and the feature flag only on the server. Apply a finite `AbortSignal.timeout` to every call, set `apikey` and `Content-Type` headers server-side, and parse JSON through an allowlist.

For `createInstance`, send `integration: "WHATSAPP-BAILEYS"`, `qrcode: true`, the opaque instance name, the private webhook URL, the four required event names (`QRCODE_UPDATED`, `CONNECTION_UPDATE`, `SEND_MESSAGE`, `SEND_MESSAGE_UPDATE`), and the exact 2.3.7 webhook JWT configuration fields verified from the pinned source. Never return the provider’s `hash` or instance credentials.

For `getQr`, accept a provider QR data URL only for the current response. Do not persist it, include it in an error, or log it. For `getConnectionState`, map the provider state string without claiming `CONNECTED` unless the provider says so. For `sendText`, require a returned provider message id to produce a non-null reference; a successful HTTP response with no id is ambiguous, not accepted.

- [ ] **Step 4: Run adapter tests and check import boundaries.**

```bash
pnpm vitest run src/lib/whatsapp/evolution.test.ts
pnpm check
rg -n "@/lib/whatsapp/evolution" src/components src/screens src/app --glob '*.tsx' --glob '*.ts'
```

Expected: tests pass, TypeScript passes, and the import search returns no browser/component import of the concrete adapter.

- [ ] **Step 5: Commit the provider boundary.**

```bash
git add src/lib/whatsapp/provider.ts src/lib/whatsapp/evolution.ts src/lib/whatsapp/evolution.test.ts
 git commit -m "feat: add server-only Evolution WhatsApp adapter"
```

---

## Task 5: Add tenant-scoped account/template persistence and broker API routes

**Files:**
- Create: `src/lib/whatsapp/store.ts`
- Create: `src/lib/whatsapp/store.test.ts`
- Create: `src/app/api/broker/whatsapp/route.ts`
- Create: `src/app/api/broker/whatsapp/connect/route.ts`
- Create: `src/app/api/broker/whatsapp/qr/route.ts`
- Create: `src/app/api/broker/whatsapp/status/route.ts`
- Create: `src/app/api/broker/whatsapp/template/route.ts`
- Create: `src/app/api/broker/whatsapp/route.test.ts`
- Modify: `src/lib/auth/roles.ts`
- Modify: `src/lib/auth/auth.test.ts` or `src/lib/auth/live-wired.test.ts`

**Interfaces:**
- Produces `readWhatsAppSettings(organizationId: string): Promise<WhatsAppSettingsResponse>`.
- Produces `connectWhatsAppAccount(input: { organizationId: string; actorUserId: string; companyOwnedAcknowledged: boolean }): Promise<{ ok: true; account: { status: WhatsAppAccountStatus }; seededTemplate: boolean } | { ok: false; status: number; reason: string }>`.
- Produces `readWhatsAppQr(organizationId: string): Promise<{ state: string; qrDataUrl?: string }>` and `refreshWhatsAppConnectionState(organizationId: string): Promise<{ status: WhatsAppAccountStatus; phoneLast4: string | null; lastObservedAt: string }>`.
- Produces `saveWhatsAppTemplate(input: { organizationId: string; actorUserId: string; body: string }): Promise<{ ok: true; template: { id: string; version: number; body: string } } | { ok: false; status: number; errors: string[] }>`.
- All route organization ids come from `access.session.organization.id`; request bodies cannot choose a tenant.

- [ ] **Step 1: Write route and store tests before implementation.**

Use hoisted Prisma/provider mocks in the repository’s existing Vitest style. Cover:

- no session returns 401;
- a broker member can read but cannot connect or edit (`broker.whatsapp.read` versus `broker.whatsapp.manage`);
- a broker admin without `ACTIVE` plan receives 402 and the provider is not called;
- a connect request with `{ companyOwnedAcknowledged: false }` receives 400;
- a session from organization B cannot read organization A’s settings even if it supplies A’s id in JSON or query text;
- a template save creates version 1, then version 2, deactivating version 1 in one transaction;
- two concurrent template saves produce distinct monotonic versions under the database transaction;
- QR and all settings responses carry `Cache-Control: no-store` and contain no provider key/hash/webhook key.

Run the route/store test and expect it to fail because the permissions, store, and routes do not exist.

- [ ] **Step 2: Add the WhatsApp permissions with the existing role semantics.**

Add `broker.whatsapp.read` and `broker.whatsapp.manage` to `roles.ts`. Grant read to `BROKER_MEMBER`; grant both to `BROKER_ADMIN` and the demo broker admin; do not grant management to members. Keep `ADMIN`’s existing bypass semantics. Assert the matrix in the existing auth test rather than introducing a second authorization mechanism.

- [ ] **Step 3: Implement tenant-scoped settings reads and safe account state mapping.**

`readWhatsAppSettings` must run model reads inside `withTenantPrisma`. Return only:

```ts
{
  enabled: boolean;
  plan: { status: "ACTIVE" | "TRIAL" | "EXPIRED" | "NONE"; eligible: boolean; reason?: string };
  account: null | {
    status: WhatsAppAccountStatus;
    phoneLast4: string | null;
    connectedAt: string | null;
    lastObservedAt: string | null;
    lastErrorCode: string | null;
  };
  template: null | { id: string; version: number; body: string; createdAt: string };
  placeholders: readonly string[];
  delivery: {
    pending: number;
    inFlight: number;
    accepted: number;
    failed: number;
    unknown: number;
    skipped: number;
    latest: null | { status: WhatsAppDispatchStatus; providerMessageId: string | null; acceptedAt: string | null; completedAt: string | null };
  };
}
```

Do not return `instanceName`, `providerInstanceId`, QR values, raw error text, lead ids, phone numbers, or message bodies from delivery rows. A template body is intentionally visible to that organization’s authorized broker because it is their configured copy.

- [ ] **Step 4: Implement connect/resume with company ownership attestation.**

`connectWhatsAppAccount` first applies `resolveWhatsAppPlanGate`, then validates `companyOwnedAcknowledged === true`. Under the organization transaction, get or create one opaque instance name such as `wa_<random base32 token>` that contains no slug, name, phone, email, or lead id. If no account exists, create a `PROVISIONING` row before calling Evolution; if the provider call fails, mark `ERROR` with a safe code and do not expose the raw response.

Call `createInstance` only on the server. Store the allowlisted provider instance id and mapped state. Seed version 1 with `DEFAULT_ACKNOWLEDGEMENT_BODY` if the organization has no active template, using the same transaction and immutable version rule. Write an `AuditEvent` with action `whatsapp.account.connected` or `whatsapp.account.connection_failed`, actor, organization, safe state, and `companyOwned: true`; never place the provider response in metadata. Template PUT writes `whatsapp.template.updated` with version and actor only; QR initiation writes `whatsapp.qr.requested` with state only.

If an account already exists, resume by checking its state rather than creating a second Evolution instance. There is no logout, pause, delete, or orphan-cleanup button.

- [ ] **Step 5: Implement QR/status/template routes with server-only provider calls.**

Use `authorizeRequest` with the exact permissions and `runtime = "nodejs"` in every route. The route behavior is:

```text
GET  /api/broker/whatsapp          -> read settings, no-store
POST /api/broker/whatsapp/connect  -> validate ownership acknowledgement, no-store
GET  /api/broker/whatsapp/qr       -> call Evolution server-side, return state/short-lived qrDataUrl, no-store
GET  /api/broker/whatsapp/status   -> call Evolution server-side, persist safe mapped state, no-store
GET  /api/broker/whatsapp/template -> return active template and allowed placeholders, no-store
PUT  /api/broker/whatsapp/template -> validate body, version it, no-store
```

The QR handler must not cache, log, persist, or place the QR in a URL. A disconnected or expired QR returns an explicit state rather than a false `CONNECTED` result. Template PUT must reject an inactive plan before writing.

- [ ] **Step 6: Run route/store/auth tests and commit the control-plane routes.**

```bash
pnpm vitest run src/lib/whatsapp/store.test.ts src/app/api/broker/whatsapp/route.test.ts src/lib/auth/auth.test.ts src/lib/auth/live-wired.test.ts
pnpm check
```

Expected: all organization-isolation, authorization, versioning, no-store, and redaction assertions pass.

```bash
git add src/lib/whatsapp/store.ts src/lib/whatsapp/store.test.ts src/app/api/broker/whatsapp src/lib/auth/roles.ts src/lib/auth/auth.test.ts src/lib/auth/live-wired.test.ts
 git commit -m "feat: add broker WhatsApp account and template routes"
```

---

## Task 6: Implement the durable dispatch state machine and worker

**Files:**
- Modify: `src/lib/whatsapp/dispatch.ts`
- Modify: `src/lib/whatsapp/dispatch.test.ts`
- Create: `src/lib/whatsapp/worker.ts`
- Create: `src/lib/whatsapp/worker.test.ts`
- Modify: `src/lib/leads/server.ts`
- Modify: `src/lib/whatsapp/store.ts`
- Modify: `src/lib/interop/contact-crypto.ts` only to reuse its existing `decryptContact` export; do not change encryption format

**Interfaces:**
- Produces `enqueueLeadWhatsAppAcknowledgement(tx, input): Promise<void>` for the lead transaction.
- Produces `processWhatsAppDispatchBatch(input: { organizationId: string; limit?: number; now?: Date }): Promise<WhatsAppBatchResult>`.
- Produces `processWhatsAppOutbox(input: { limit?: number; now?: Date }): Promise<WhatsAppBatchResult>` for the internal route.
- Produces `markWhatsAppDispatchFromProvider(input: { organizationId: string; accountId: string; providerMessageId: string; state: "ACCEPTED" | "FAILED" }): Promise<void>` for verified webhook events.

- [ ] **Step 1: Extend dispatch tests and write failing worker tests around the state machine.**

Use a fake `WhatsAppProvider` and hoisted Prisma delegates. Cover:

```text
new eligible lead       -> one PENDING row
same lead/purpose again -> unique conflict/no second row
no opt-in               -> SKIPPED(NO_WHATSAPP_OPT_IN), provider calls 0
TRIAL/no subscription   -> SKIPPED(NO_ACTIVE_PLAN), provider calls 0
disconnected account   -> SKIPPED(NO_CONNECTED_ACCOUNT), provider calls 0
QR/CONNECTING account   -> PENDING until expiresAt, provider calls 0
valid row                -> IN_FLIGHT -> ACCEPTED with providerMessageId
provider definitive 4xx -> FAILED with bounded code
provider timeout        -> UNKNOWN, second worker call provider calls 0
accepted row replay     -> no provider call
foreign organization    -> no row read/update/send
lead deleted/expired    -> SKIPPED, decrypt calls 0
```

Assert the worker loads the lead’s referenced `templateId`/`templateVersion`, not the organization’s current active template, so a later template save cannot change an already-created dispatch.

Run the focused tests and expect only the new worker/claim cases to fail because processing and provider-boundary behavior do not exist yet; the transactional enqueue cases from Task 2 must remain green.

- [ ] **Step 2: Implement transactional enqueue and safe initial skip decisions.**

`enqueueLeadWhatsAppAcknowledgement` creates one row for an organization-owned lead. It records `purpose: "lead-ack"`, `leadId`, `organizationId`, and `expiresAt`; it never records phone, rendered copy, or a generic JSON payload. Use the tenant transaction passed by the lead write.

Initial decisions must be auditable and deterministic:

```ts
if (!input.whatsappOptIn) return createSkipped("NO_WHATSAPP_OPT_IN");
if (!consentPermissionsFor(input.consentClass).automatedWhatsAppFirstTouch) return createSkipped("CONSENT_CLASS_BLOCKED");
if (!activeSubscriptionInTransaction) return createSkipped("NO_ACTIVE_PLAN");
if (!activeTemplate) return createSkipped("NO_ACTIVE_TEMPLATE");
if (!account) return createSkipped("NO_CONNECTED_ACCOUNT");
if (account.status === "QR_READY" || account.status === "CONNECTING" || account.status === "PROVISIONING") return createPending(account, template);
if (account.status !== "CONNECTED") return createSkipped("NO_CONNECTED_ACCOUNT");
return createPending(account, template);
```

Store `accountId`, `templateId`, and `templateVersion` only when those rows exist. Use the single unique `(leadId, purpose)` constraint as the race arbiter; do not perform a provider call or a second “check then send” in the lead transaction.

- [ ] **Step 3: Implement atomic claims and bounded in-flight recovery.**

For one organization, select due `PENDING` rows ordered by `createdAt`, then claim each with a conditional `updateMany` inside a transaction:

```ts
const claimed = await tx.whatsappDispatch.updateMany({
  where: {
    id,
    status: "PENDING",
    OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
  },
  data: { status: "IN_FLIGHT", attemptCount: { increment: 1 } },
});
if (claimed.count !== 1) return { claimed: false };
```

Never reclaim an old `IN_FLIGHT` row for another provider call. A recovery pass marks an `IN_FLIGHT` row older than the bounded provider timeout window as `UNKNOWN` with `lastErrorCode: "WORKER_CRASH_AMBIGUOUS"`; it does not resend it. `SKIPPED`, `FAILED`, `UNKNOWN`, and `ACCEPTED` rows are terminal for the automatic acknowledgement.

- [ ] **Step 4: Implement the worker’s re-check, decrypt, render, and send order.**

After the claim, load the row and related lead/account/template under the same organization scope. Re-check, in order: exact `ACTIVE` subscription and provider feature/real-number gates, lead ownership/deletion/retention, `whatsappOptIn`, consent-class automated permission, account ownership and `CONNECTED` status, and the saved template version. Mark permanent failures, including a disabled provider, `SKIPPED` before touching `phoneCiphertext`.

Only after every gate passes:

```ts
const e164 = decryptContact(lead.phoneCiphertext);
const normalized = normalizeIndianPhone(e164);
if (!normalized.ok) return markSkipped("INVALID_PHONE");
const text = renderAcknowledgementTemplate(template.body, {
  firstName: safeFirstName(lead.name),
  brokerName: organization.name,
  listingTitle: listing.title,
  city: listing.city.name,
});
const payloadHashValue = payloadHash({ purpose: "lead-ack", templateVersion: template.version, number: normalized.e164, text });
const result = await provider.sendText({ instanceName: account.instanceName, number: normalized.e164.replace(/\D/g, ""), text });
```

The decrypted number and rendered `text` must be local variables in this function only. Do not put either into the dispatch update, logger context, thrown error, audit metadata, or scheduled-job payload. Store only the safe payload hash. A provider response with no message reference is `UNKNOWN`; a network timeout is `UNKNOWN`; a definitive pre-send error is `FAILED`; a provider reference is required for `ACCEPTED`. Every transition writes an append-only `AuditEvent` with organization, dispatch id, purpose, destination state, attempt count, and bounded error/skip code only; it never writes phone, rendered text, provider request bodies, or provider credentials.

- [ ] **Step 5: Implement tenant-scoped batch processing and safe delivery summaries.**

`processWhatsAppDispatchBatch` uses `withTenantPrisma` for one organization. `processWhatsAppOutbox` reads only organization ids from the unprotected `BrokerOrganization` table, then calls the tenant batch function one organization at a time. It must never query all dispatch rows on an unset RLS connection.

Return counters only:

```ts
{ scanned: number; claimed: number; accepted: number; failed: number; unknown: number; skipped: number; pending: number }
```

`getWhatsAppDeliverySummary` returns counts grouped by status plus the newest status row’s safe `providerMessageId`, `acceptedAt`, and `completedAt` for the current tenant; it never returns lead ids, customer fields, instance names, or message bodies.

- [ ] **Step 6: Run worker tests and commit the durable dispatch slice.**

```bash
pnpm vitest run src/lib/whatsapp/dispatch.test.ts src/lib/whatsapp/worker.test.ts src/lib/leads/server.test.ts
pnpm check
```

Expected: duplicate claims produce one provider call; ambiguous timeout produces `UNKNOWN` and no second call; no disallowed eligibility path calls the provider; and successful sends store a provider reference without raw phone/body fields.

```bash
git add src/lib/whatsapp/dispatch.ts src/lib/whatsapp/dispatch.test.ts src/lib/whatsapp/worker.ts src/lib/whatsapp/worker.test.ts src/lib/leads/server.ts src/lib/whatsapp/store.ts
 git commit -m "feat: add durable one-time WhatsApp dispatch worker"
```

---

## Task 7: Add verified Evolution webhooks and the internal worker driver

**Files:**
- Create: `src/lib/whatsapp/webhook.ts`
- Create: `src/lib/whatsapp/webhook.test.ts`
- Create: `src/app/api/internal/providers/evolution/webhook/route.ts`
- Create: `src/app/api/internal/providers/evolution/webhook/route.test.ts`
- Create: `src/app/api/internal/scheduled/whatsapp/route.ts`

**Interfaces:**
- Produces `verifyEvolutionWebhookRequest(rawBody: string, authorization: string | null): EvolutionWebhookEvent`.
- Produces `applyEvolutionWebhookEvent(event: EvolutionWebhookEvent): Promise<void>`.
- Produces an internal POST driver that accepts only the server-side worker secret and returns the safe batch counters.

- [ ] **Step 1: Write failing JWT/event tests.**

Test the raw-body verifier with a locally generated HS256 JWT and assert it rejects:

- missing or malformed `Bearer` header;
- an algorithm other than HS256;
- an invalid signature;
- expired tokens;
- bodies over the fixed request-size limit;
- malformed JSON or missing instance/event identity.

Test event mapping for `QRCODE_UPDATED`, `CONNECTION_UPDATE`, `SEND_MESSAGE`, and `SEND_MESSAGE_UPDATE`. Include an unknown instance and an event whose provider message id belongs to a different organization; both must be rejected without a state update. Include duplicate `(provider, externalId)` events and assert the second is a no-op.

Run the focused test and expect it to fail because the verifier and route do not exist.

- [ ] **Step 2: Implement raw-body JWT verification without persisting credentials.**

Use Node `crypto` HMAC-SHA-256 and timing-safe comparison so the implementation does not add a JWT dependency for one symmetric webhook key. Read `ARCHITECH_EVOLUTION_WEBHOOK_JWT_KEY` only on the server. Verify `alg`, `exp`, a reasonable `iat` window, and the signature over the exact base64url header/payload bytes. Parse only the bounded event shape after verification.

Normalize provider events to:

```ts
export type EvolutionWebhookEvent = {
  externalId?: string;
  eventType: "QRCODE_UPDATED" | "CONNECTION_UPDATE" | "SEND_MESSAGE" | "SEND_MESSAGE_UPDATE";
  instanceName: string;
  providerMessageId?: string;
  connectionState?: string;
};
```

Use the provider event id when present and deduplicate it through `InteropInboundEvent`. For send events, require a safe provider message id when no event id exists. For QR/connection events with no provider id, apply the state idempotently without inserting a dedupe row; repeated state observations are harmless. Never derive a persistent id from a raw webhook body that may contain customer data. Ignore inbound-message event types after shape validation; do not store message bodies.

- [ ] **Step 3: Apply events through tenant-scoped account/dispatch updates.**

Resolve `WhatsAppAccount` by opaque `instanceName` without bypassing RLS: enumerate organization ids from `BrokerOrganization`, inspect `WhatsAppAccount` inside one `withTenantPrisma` transaction per organization, stop at the single matching row, and then apply the event in that same organization scope. Never issue an unset-GUC `findUnique({ where: { instanceName } })`. Map QR/connection events to `QR_READY`, `CONNECTING`, `CONNECTED`, `DISCONNECTED`, or `ERROR`; update only safe timestamps, `phoneLast4` when the provider supplies a verified phone identifier, and bounded error codes.

For send events, require a provider message id and update only the dispatch whose `accountId`, `organizationId`, and `providerMessageId` match. A matching provider event may reconcile `UNKNOWN` to `ACCEPTED`, but it must never cause a new send. Insert the dedupe row into `InteropInboundEvent` under the resolved tenant before changing state. Write a safe `whatsapp.provider.event` audit entry for each applied connection/send transition. Do not allow an instance name or provider message id from the request to select another organization.

- [ ] **Step 4: Add the private webhook route and authenticated worker route.**

The webhook route must use `request.text()`, reject a body over 128 KiB before parsing, pass the exact body plus `authorization` to the verifier, return 401/400 for invalid input, and return a generic 204/200 for a verified replay. Never log the raw body.

The scheduled route must require `x-architech-worker-secret` matching `ARCHITECH_WHATSAPP_WORKER_SECRET` with a timing-safe comparison, reject missing/invalid secrets with 401, accept only POST, call `processWhatsAppOutbox({ limit: 25 })`, and return counters with `Cache-Control: no-store`. It must not accept an organization id from the caller.

- [ ] **Step 5: Run webhook/route tests and commit the callback boundary.**

```bash
pnpm vitest run src/lib/whatsapp/webhook.test.ts src/app/api/internal/providers/evolution/webhook/route.test.ts
pnpm check
```

Expected: only verified, tenant-mapped events update state; replays are no-ops; provider secrets and bodies are absent from responses/errors.

```bash
git add src/lib/whatsapp/webhook.ts src/lib/whatsapp/webhook.test.ts src/app/api/internal/providers/evolution/webhook src/app/api/internal/scheduled/whatsapp/route.ts
 git commit -m "feat: verify Evolution webhooks and worker callbacks"
```

---

## Task 8: Add the local self-hosted Evolution stack and operational gates

**Files:**
- Create: `docker-compose.whatsapp.yml`
- Modify: `docker-compose.production-like.yml`
- Create: `ops/scripts/whatsapp/outbox-worker.mjs`
- Create: `ops/scripts/whatsapp/outbox-worker.test.mjs`
- Create: `docs/broker-suite/local-whatsapp-development.md`
- Modify: `.env.example`
- Modify: `package.json`
- Modify: `ops/config/governance/secrets/phase-1-secret-inventory.json`
- Modify: `ops/config/governance/environments/phase-1-environments.json`

**Interfaces:**
- Produces the local command `pnpm whatsapp:worker`.
- Produces a separate Evolution PostgreSQL volume, Redis namespace/service, and Evolution API service; Architech’s application database is never reused.
- Produces an operational checklist that keeps real-number activation disabled until the provider/image/source/license/privacy/canary gates are explicitly approved.

- [ ] **Step 1: Write worker polling tests.**

Test a single poll with a mocked `fetch` and assert the script sends a POST to `${WHATSAPP_WORKER_TARGET_URL}/api/internal/scheduled/whatsapp` with `x-architech-worker-secret`, uses no browser URL, and does not print response bodies or secrets. Test a 401 response and a network failure; both must use bounded backoff rather than a tight unbounded loop. Test `--once` for deterministic local verification.

- [ ] **Step 2: Add the pinned separate Evolution Compose file.**

Create `docker-compose.whatsapp.yml` with:

- Evolution API `2.3.7` pinned to the verified architecture digest resolved for the release, not a floating `latest` or a tag-only production image;
- a dedicated PostgreSQL 16 service and named volume used only by Evolution;
- a dedicated Redis 7 service/namespace and named volume/configuration used only by Evolution;
- Evolution exposed to the host only on a loopback development port, with the Architech server using the service name internally;
- no Evolution Manager service;
- telemetry off, broad CORS off, instance exposure off, and redacted/minimal logs;
- no public production Evolution port and no browser-facing provider URL.

Add the same Evolution services to `docker-compose.production-like.yml` behind a `whatsapp` profile, with separate named Evolution PostgreSQL/Redis volumes and `expose` rather than a host `ports` mapping. The local-only file may bind Evolution to loopback for QR development; the production-like profile must not publish Evolution externally. Both Compose files must pass their respective `config` commands without reusing Architech’s application database.

The Compose file must pass `docker compose -f docker-compose.whatsapp.yml config` without requiring an Architech database. Record the exact image digest and source commit `cd800f2976e1e5b682fbf86a01ee4d85ae61f370` in the development document.

- [ ] **Step 3: Add the polling worker and package script.**

Implement `ops/scripts/whatsapp/outbox-worker.mjs` with a default one-second interval, `--once`, bounded exponential backoff capped at 30 seconds, and clean SIGTERM/SIGINT exit. Require `WHATSAPP_WORKER_TARGET_URL` and `ARCHITECH_WHATSAPP_WORKER_SECRET`; never use `NEXT_PUBLIC_*` provider values. Add:

```json
"whatsapp:worker": "node ops/scripts/whatsapp/outbox-worker.mjs"
```

The worker is a driver only; all claims, decrypt/render/send logic, and tenant scope remain in Architech server code.

- [ ] **Step 4: Register environment names and disabled-by-default gates.**

Add these empty server-only variables to `.env.example`:

```dotenv
ARCHITECH_WHATSAPP_ENABLED=false
ARCHITECH_WHATSAPP_REAL_NUMBERS_ENABLED=false
ARCHITECH_EVOLUTION_API_URL=http://127.0.0.1:8080
ARCHITECH_EVOLUTION_API_KEY=
ARCHITECH_EVOLUTION_WEBHOOK_JWT_KEY=
ARCHITECH_EVOLUTION_WEBHOOK_URL=
ARCHITECH_WHATSAPP_WORKER_SECRET=
ARCHITECH_IDEMPOTENCY_HMAC_KEY=
WHATSAPP_WORKER_TARGET_URL=http://127.0.0.1:3000
```

Register provider/API/webhook/worker/idempotency secrets in the secret inventory as server scope with staging/production owners and rotation periods. Add private Evolution API, dedicated Evolution PostgreSQL, dedicated Evolution Redis, and WhatsApp outbox worker to the staging/production service descriptions, while keeping the feature activation status disabled until the separate operational gates are approved. Do not add any secret value to source control.

- [ ] **Step 5: Document the synthetic manual pilot.**

The development document must give exact commands:

```bash
docker compose -f docker-compose.whatsapp.yml up -d
docker compose -f docker-compose.whatsapp.yml ps
pnpm db:migrate
pnpm whatsapp:worker -- --once
```

It must instruct an operator to use a non-critical company-owned test number, scan the QR from WhatsApp Linked devices in the Architech dashboard, create a synthetic opted-in lead, verify exactly one provider acceptance, post the duplicate lead request, remove the linked device, and inspect logs/database for absence of raw phone, QR, provider keys, and rendered message body. It must explicitly say that removing the linked device is the first disconnect mechanism and that the dashboard has no logout/pause/delete controls.

- [ ] **Step 6: Run operational checks and commit local setup.**

```bash
node --test ops/scripts/whatsapp/outbox-worker.test.mjs
pnpm secrets:audit
pnpm env:audit
docker compose -f docker-compose.whatsapp.yml config
docker compose -f docker-compose.production-like.yml --profile whatsapp config
```

Expected: both stacks are syntactically valid and Evolution data stores are separate; secrets audits see names only; environment metadata remains disabled by default.

```bash
git add docker-compose.whatsapp.yml docker-compose.production-like.yml ops/scripts/whatsapp docs/broker-suite/local-whatsapp-development.md .env.example package.json ops/config/governance/secrets/phase-1-secret-inventory.json ops/config/governance/environments/phase-1-environments.json
 git commit -m "ops: add local Evolution WhatsApp stack and worker driver"
```

---

## Task 9: Add the broker dashboard QR/template/status experience

**Files:**
- Create: `src/components/broker/BrokerWhatsAppPanel.tsx`
- Create: `src/components/broker/BrokerWhatsAppPanel.test.ts`
- Modify: `src/screens/AgentWorkspace.tsx`
- Modify: `src/app/broker/agent/[section]/page.tsx`

**Interfaces:**
- Consumes the sanitized settings/QR/status/template route contracts from Tasks 5 and 7.
- Produces the `whatsapp` workspace section at `/broker/agent/whatsapp`.
- Does not import `evolution.ts`, access provider URLs, receive instance names/keys, or render customer phone/message data.

- [ ] **Step 1: Write the component contract test.**

Read the component source as the existing `BrokerChannelPanel.test.ts` does and assert it contains:

- a named `BrokerWhatsAppPanel` export;
- `fetch("/api/broker/whatsapp"` and the connect/template/QR/status route paths;
- company-owned acknowledgement copy and WhatsApp Linked devices scan instructions;
- explicit labels for `PROVISIONING`, `QR_READY`, `CONNECTING`, `CONNECTED`, `DISCONNECTED`, `ERROR`, provider-disabled, no-active-plan, QR-expired, and empty-template states;
- no `localhost`, `127.0.0.1`, `apikey`, `jwt`, `hash`, `instanceName`, or raw phone field;
- no `logout`, `pause`, or `delete` action.

Run the test and expect it to fail because the component and route wiring do not exist.

- [ ] **Step 2: Implement the connection panel and QR polling.**

Create a client component with loading/error state and three focused panels:

1. **Connection:** show a `Connect WhatsApp` button only when management permission/active-plan state allows it; require a checked company-owned acknowledgement before POST; after connect, poll `/api/broker/whatsapp/qr` only while the account is not connected, with a bounded interval and cancellation on unmount; render the short-lived QR data URL returned by Architech and instructions to scan from WhatsApp **Settings → Linked devices → Link a device**.
2. **Acknowledgement template:** show the active version/body, allowed placeholder help, controlled textarea, preview rendered from the server-shared four-value contract, and a save/version action. Display route validation errors without echoing provider errors.
3. **Delivery status:** show only status counts, safe last-observed/provider-state labels, and the latest provider message reference when present; never show customer numbers, bodies, lead ids, instance names, or cross-organization rows.

Do not add lifecycle buttons beyond connect/resume. A disconnect is represented by Evolution’s observed state after the broker removes the linked device.

- [ ] **Step 3: Wire the focused section into the workspace.**

In `AgentWorkspace.tsx`, add `"whatsapp"` to `AgentSection`, add one nav item and `deskMeta` entry, import `BrokerWhatsAppPanel`, and add one render branch. Keep the existing dashboard data hooks unchanged. In the section page, add `"whatsapp"` to the static `sections` array so `/broker/agent/whatsapp` is accepted.

- [ ] **Step 4: Run UI contracts and TypeScript.**

```bash
pnpm vitest run src/components/broker/BrokerWhatsAppPanel.test.ts
pnpm check
```

Expected: the component exposes all explicit state copy, uses only relative Architech URLs, and compiles without moving server-only modules into the client bundle.

- [ ] **Step 5: Commit the broker UI.**

```bash
git add src/components/broker/BrokerWhatsAppPanel.tsx src/components/broker/BrokerWhatsAppPanel.test.ts src/screens/AgentWorkspace.tsx src/app/broker/agent/'[section]'/page.tsx
 git commit -m "feat: add broker WhatsApp dashboard section"
```

---

## Task 10: Finish privacy retention, integration coverage, and fresh verification

**Files:**
- Modify: `ops/scripts/privacy/purge-expired-leads.mjs`
- Modify: `ops/scripts/privacy/purge-expired-leads.test.mjs`
- Create: `src/lib/whatsapp/retention.test.ts`
- Modify: `src/lib/leads/lead.test.ts`
- Modify: `src/lib/leads/server.test.ts`
- Modify: `src/lib/dashboard/tenant-isolation.test.ts`
- Modify: `docs/broker-suite/local-whatsapp-development.md` for final pilot evidence

**Interfaces:**
- Confirms lead deletion/retention cannot leave a usable phone ciphertext or a sendable dispatch.
- Confirms route, worker, webhook, and tenant isolation behavior together without adding CRM functionality.

- [ ] **Step 1: Add the retention failure tests.**

Use the existing purge helper’s fake Prisma client to assert that an expired lead clears `phoneCiphertext` and `phoneLast4`, marks the lead deleted, and either cascades/deletes its dispatch or marks it terminally non-sendable in the same transaction. Assert a deleted lead cannot be claimed even if a stale dispatch row exists. Assert no purge output includes a phone, template body, or provider identifier.

- [ ] **Step 2: Make the purge path explicit for WhatsApp state.**

Preserve the existing lead tombstone behavior, but ensure the Prisma schema cascade and/or purge transaction removes pending/in-flight WhatsApp dispatch state before the worker can load the lead. If a non-sensitive terminal audit row is retained, keep only organization id, dispatch id, purpose, status, bounded reason, and timestamps. Never retain rendered text or decrypted contact material.

- [ ] **Step 3: Add the mock-provider vertical integration suite.**

Exercise this complete sequence with two organizations and a fake provider:

```text
create org A active + connected + template v1
create org B active + connected + template v1
create opted-in lead on A -> one A dispatch
run two A workers concurrently -> exactly one provider call
create duplicate lead POST -> same lead contract, no new dispatch
send provider acceptance -> A dispatch ACCEPTED with provider ref
create lead on B -> B instance/body only
read A settings as B -> 403/empty, never A data
set A account disconnected -> next A lead SKIPPED, provider calls unchanged
make provider call timeout -> UNKNOWN, rerun -> no second call
save A template v2 -> existing dispatch still renders v1
```

Assert all fake-provider calls use the expected organization account and sanitized number/text only inside the worker boundary; assert persisted rows contain no raw phone or rendered body.

- [ ] **Step 4: Run the complete targeted verification set.**

```bash
pnpm vitest run \
  src/lib/whatsapp \
  src/app/api/broker/whatsapp/route.test.ts \
  src/app/api/internal/providers/evolution/webhook/route.test.ts \
  src/lib/leads/lead.test.ts \
  src/lib/leads/server.test.ts \
  src/lib/interop/idempotency.test.ts \
  src/lib/auth/auth.test.ts \
  src/lib/auth/live-wired.test.ts \
  ops/scripts/privacy/purge-expired-leads.test.mjs
pnpm check
pnpm lint --max-warnings 200
pnpm db:validate
pnpm security:rls
pnpm secrets:audit
pnpm env:audit
git diff --check
```

Expected: targeted tests, type-check, lint, schema validation, static RLS, secret, and environment audits pass. Any live-database RLS failure must be fixed before the feature is considered ready; do not waive it by changing the audit list.

- [ ] **Step 5: Run the manual synthetic pilot from a clean local state.**

Follow `docs/broker-suite/local-whatsapp-development.md` with `ARCHITECH_WHATSAPP_ENABLED=true`, `ARCHITECH_WHATSAPP_REAL_NUMBERS_ENABLED=true` only in the isolated synthetic environment, and an `ACTIVE` test subscription. Record evidence for:

- QR appears only in the Architech broker dashboard;
- the company-owned test number becomes connected;
- one template version saves and previews;
- one eligible lead yields one provider acceptance and one handset message;
- duplicate lead submission yields no second dispatch/message;
- non-active subscription, missing opt-in, disconnected account, expired lead, and cross-organization access produce no provider send;
- linked-device removal changes the account to disconnected and blocks later sends;
- logs and database inspection contain no raw phone, QR, provider key/hash, webhook `apikey`, or rendered message body.

- [ ] **Step 6: Commit privacy and verification coverage.**

```bash
git add ops/scripts/privacy/purge-expired-leads.mjs ops/scripts/privacy/purge-expired-leads.test.mjs src/lib/whatsapp src/lib/leads/lead.test.ts src/lib/leads/server.test.ts src/lib/dashboard/tenant-isolation.test.ts docs/broker-suite/local-whatsapp-development.md
git commit -m "test: verify WhatsApp privacy and one-time delivery"
```

---

## Self-review checklist before execution handoff

The plan is complete only after this review is performed against the approved design at `docs/superpowers/specs/2026-09-12-automatic-whatsapp-lead-ack-design.md`.

### Spec coverage

- Goal and boundary: Tasks 5, 6, 9, and 10 implement one acknowledgement only; no task adds CRM chat, inbound storage, campaigns, or city routing.
- Evolution topology and source contract: Tasks 4 and 8 keep Evolution private, server-only, pinned to 2.3.7, with separate PostgreSQL/Redis and no Manager.
- Connect/QR flow: Tasks 5, 7, 8, and 9 cover active plan, company attestation, opaque instance, QR polling, webhook connection state, dashboard rendering, and no lifecycle controls.
- Template flow: Tasks 3, 5, 6, and 9 cover the four placeholders, bounded immutable versions, default body, preview, and worker version pinning.
- Lead transaction and dispatch: Tasks 2 and 6 cover the opt-in gate, consent-class safety predicate, same-transaction unique row, atomic claim, worker re-check, and no synchronous provider call.
- At-most-once behavior: Task 6 covers `ACCEPTED`, definitive `FAILED`, ambiguous `UNKNOWN`, stale in-flight conversion, no blind retry, provider reference requirement, and duplicate uniqueness.
- Webhooks: Task 7 covers raw-body JWT verification, instance ownership, event deduplication, safe connection/send updates, and ignored inbound bodies.
- Organization scope/RLS: Tasks 1, 2, 5, 6, 7, and 10 cover schema relations, tenant GUC, forced policies, worker organization iteration, route session scope, and cross-organization tests.
- Privacy/retention: Tasks 2, 6, 7, 8, and 10 cover no raw dispatch payloads, in-memory decrypt/render, redaction, lead purge, and manual inspection.
- UI and all cities: Task 9 adds only the focused broker section; no city-specific condition is introduced.
- Verification and handoff: Task 10 runs type-check, lint, tests, schema/RLS/security audits, and the synthetic manual pilot.

### Type/signature consistency

- `WhatsAppProvider` is defined once in Task 4 and consumed by Tasks 5–7 and the worker fake.
- `resolveWhatsAppPlanGate` is defined in Task 3 and is used by account routes, template mutation, and the worker; the same exact `ACTIVE` query is used inside the lead transaction’s enqueue decision so RLS/transaction scope is preserved.
- `enqueueLeadWhatsAppAcknowledgement` is named consistently in Task 2 and Task 6 and accepts the transaction plus the exact lead eligibility input shown in Task 2.
- `processWhatsAppDispatchBatch` and `processWhatsAppOutbox` are defined in Task 6 and called by the scheduled route in Task 7 and polling driver in Task 8.
- `WhatsAppDispatchStatus` and skip reasons originate in `contracts.ts`; Prisma enum values and public counter keys use the same spelling.
- `withTenantPrisma` is added in Task 2 and is the only model-query path used by account/template, dispatch, worker, and webhook tenant operations.
- Template validation/rendering is one pure implementation shared by the API/store, preview, and worker; no client duplicate exists.

### Placeholder and scope review

- Every task names concrete files, signatures, test commands, expected failures or passes, and commit commands.
- No task asks for a generic unspecified implementation, a browser-to-provider call, a raw provider response, or a city-specific pilot.
- No task adds logout, pause, delete, CRM history, campaigns, bulk sending, repeated follow-ups, or Frappe code.
- The only operationally unresolved value is the actual verified SHA-256 image digest for the pinned Evolution 2.3.7 release; Task 8 requires resolving and recording that concrete digest before the Compose file is accepted, rather than accepting a tag-only image.

After this checklist is satisfied, run `git diff --check`, inspect the complete plan for unresolved markers, and commit the plan itself.

```bash
git add docs/superpowers/plans/2026-09-12-automatic-whatsapp-lead-ack.md
git commit -m "docs: plan automatic WhatsApp lead acknowledgement"
```
