# Design: Complete the broker calling slice + manual plan activation

**Date:** 2026-09-10
**Status:** Approved direction (chat, 10 Sep 2026); spec review pending
**Normative parents:**
- `docs/business-suite/mobile-calling-implementation-plan.md` (Phases 1–5; this spec completes the Phases 2–4 slice)
- `docs/business-suite/real-estate-listing-access-and-paid-contact-plans.md` (plan-gated contact access; "Broker Pro v1" direction)

## 1. Context

PR #70 merged a prototype of the mobile calling feature. Its own §11 marks what ships and what
is throwaway, and the plan's Phases 2–4 were only partially landed:

**Already in the tree (verified 10 Sep 2026):**
- Prisma: `Lead.phoneCiphertext / phoneLast4 / consentClass / callSuppressedAt / callAttempts`,
  the `LeadCallLog` model + indexes, and the strategy-doc schema
  (`MarketplacePlan`, `MarketplacePlanEntitlement`, `MarketplaceSubscription`, `UsageLedger`,
  `ContactAccessEvent`, `AddressDisclosureRequest`, …) — the latter group has **no code consumers yet**.
- `createLeadForServer` (prisma branch) already persists `phoneCiphertext`
  (`encryptContact`), `phoneLast4`, `consentClass` (default `first-party-form`) and
  `retentionUntil`.
- `client/src/lib/interop/contact-crypto.ts` — shared AES-256-GCM envelope (ARQ1 magic + IV + tag).
- `client/src/lib/leads/calling.ts` — outcomes, stages, §3 outcome→stage mapping, `decideReveal`,
  `planAllowsReveal`, IST calling-hours helpers. 20 tests.
- `client/src/lib/leads/calling-server.ts` — `revealLeadContact()` and `logLeadCall()` implemented
  **but orphaned: no route imports them, no tests**.
- `client/src/lib/listing/details.ts` — `getLeadDetailForServer()` / `getLeadMetricsForServer()`
  implemented **but orphaned: nothing calls them**. The inbox already fetches
  `/api/broker/leads/metrics` (`.catch(() => undefined)`), but **no such route exists**, so the
  call-result metrics panel (overdue follow-ups / calls logged / lost reasons) never renders.
- Detail route `/broker/leads/[id]/` + `BrokerLeadDetail.tsx` + `CallResultSheet.tsx` — but the page
  still runs on `calling-prototype-data.ts` fixtures and a "Prototype controls" panel, and the Call
  action is a 260 ms `setTimeout` instead of the reveal round-trip.

**What is broken/missing (the gap this spec closes):**
1. No `POST /api/broker/leads/[id]/reveal`, no `POST /api/broker/leads/[id]/calls`, no
   `GET /api/broker/leads/[id]` — the real gate and call logging are unreachable. The inbox's
   `/api/broker/leads/metrics` fetch has no route at all, so the call-result metrics panel is dead.
2. The detail page renders prototype data; prototype artifacts must be deleted (plan §11).
3. Plan status is one global env value — the approved decision is **per-organization** plan state.
4. No lead retention purge (requirements have one; leads don't).
5. Reveal gate hardcodes a two-value consent check instead of the consent registry predicate.
6. Dead duplicate catalog `client/src/lib/leads/hygiene.ts` (imported by nothing) — the drift source
   behind the PR #70 CI failure.
7. **Owner requirement (new):** no payment gateway. Plan activation is manual: the owner logs in as
   a **super admin (password only)** and, from an admin page, enters a broker's login ID (the org
   admin's email) to grant/update their plan.

## 2. Decisions (approved)

| # | Decision | Answer |
|---|---|---|
| S1 | Scope | Calling slice (Phases 2–4) + manual plan activation. **Out:** M1 mobile shell, M5 a11y CI gate, Phase 5 notification deep-links, strategy-doc entitlement/usage/relay machinery, payments. |
| S2 | D2 consent copy | **Held.** Mechanics land (store `consentClass`, gate reveal on it); the buyer-facing "a verified broker may call you" wording waits on legal/DPDP review. No form copy change in this pass. |
| S3 | Plan status | **Per-organization**, derived from the existing `MarketplaceSubscription` model. `ARCHITECH_BROKER_PLAN_STATUS` becomes an explicit override (ops/demo lever), not a silent default in prisma mode. |
| S4 | Plan activation | Manual, owner-only: super-admin password login + `/admin/plans` page. No payment gateway, no subscription self-service. |
| S5 | Super-admin credential | Password verified against an **env-stored scrypt hash** (`ARCHITECH_SUPER_ADMIN_PASSWORD_HASH`). Plaintext never enters the repo, DB, or demo roster. Owner sets it via a generator script into deployment env. |

## 3. Plan status — per-organization (S3)

New helper in `calling-server.ts`:

```ts
export async function resolvePlanStatusForOrg(organizationId: string): Promise<BrokerPlanStatus>
```

Resolution order:
1. **Env override wins when explicitly set** — `ARCHITECH_BROKER_PLAN_STATUS ∈ {NONE, TRIAL, ACTIVE, EXPIRED}`
   applies to every org in every mode. (Demo lever; documented in `.env.example`.)
2. **Fixture/memory mode** (no DB): default `ACTIVE` (preserves current demo behaviour).
3. **Prisma mode:** the org's most recent `MarketplaceSubscription` (by `startsAt` desc, then `id`
   desc): `TRIAL` → `TRIAL`, `ACTIVE` → `ACTIVE`, `PAUSED | EXPIRED | CANCELLED` → `EXPIRED`.
   **No subscription row → `NONE`.**

Behaviour change, deliberate: in a real deployment, an org with no activated plan **cannot reveal or
call** (the plan's D3 entitlement gate, which the global env default of `ACTIVE` had neutred). The
owner grants plans through §6. `.env.example` documents both mechanisms.

`resolvePlanStatusForOrg` is called inside `revealLeadContact` / `logLeadCall` (both already receive
`organizationId`), keeping routes thin. Gate order is unchanged and stays pinned by tests:
**ownership → permission → plan → consent → suppression → attempt limit → calling hours.**

## 4. API surface

All routes: `export const runtime = "nodejs"`, guarded by `authorizeRequest` + org ownership,
`Cache-Control: no-store` on all responses.

| Route | Guard | Delegates to (existing, orphaned) |
|---|---|---|
| `GET /api/broker/leads/[id]` | `lead.inbox.read` + `assertLeadBelongsToOrg` | `getLeadDetailForServer` (foreign lead → 404, indistinguishable from missing) |
| `POST /api/broker/leads/[id]/reveal` | `lead.inbox.write` + ownership | `revealLeadContact` (writes `lead.contact.revealed` AuditEvent with `ipHash`) |
| `POST /api/broker/leads/[id]/calls` | `lead.inbox.write` + ownership | `logLeadCall` (validates outcome/next-action/lost-reason per `OUTCOME_RULES`) |
| `GET /api/broker/leads/metrics` | `lead.inbox.read` + organization required | `getLeadMetricsForServer` — the route the inbox **already calls**; without it the call-result panel (overdue / calls logged / lost reasons) never renders |

`GET` joins the existing `app/api/broker/leads/[id]/route.ts` (currently DELETE-only).

Response shapes stay as implemented: reveal → `{ ok, telLink, waMeLink, revealed }` or
`{ ok: false, status, errors: [user-facing reason] }`; calls → `{ ok, call: { outcome, stageBefore,
stageAfter, nextActionAt, … } }`; detail → `{ ok, lead: LeadDetailRecord }`.

## 5. `calling-server.ts` hardening

1. **Consent predicate from the registry:** replace the hardcoded
   `consentClass === "portal-shared" || "aggregator-shared"` with
   `!consentPermissionsFor(consentClass ?? "first-party-form").humanFirstTouch`
   (`@/lib/interop/lead-ingestion`). Future consent classes get correct behaviour for free.
2. **Reuse the shared hours helpers:** `parseCallingHours` + `isWithinCallingHours` from `calling.ts`
   (deletes the inline UTC+330 math and the hardcoded "09:00–20:00 IST" copy — the copy renders the
   configured window).
3. **NOT_STORED mapping:** prisma row without `phoneCiphertext` (pre-migration leads) → 422
   "number not available for this enquiry" (kept); fixture lead without a stored contact → same.
4. **Fixture parity:** fixture `createLead` defaults `consentClass` to `first-party-form`
   (prisma branch already does), and the fixture store gains call state — a `callLogs` map plus
   stage/attempts/suppression/nextAction updates — mirroring the existing `updateLeadStatus` pattern,
   so the full flow (detail → reveal → dial → log → stage change) works in default `fixture` mode
   (local dev + e2e). Both-store parity is a plan guardrail (§6 of the plan doc).
5. **Delete** `DEMO_CONTACTS` / `DEMO_CALL_STATE` (prototype-only demo data) once the page is rewired.

## 6. Super admin login (S4, S5)

### 6.1 Credential

- Env key `ARCHITECH_SUPER_ADMIN_PASSWORD_HASH` in the form `scrypt$<salt-hex>$<hash-hex>`
  (node:crypto `scrypt`, `SCRYPT_PARAMS` = { N: 16384, r: 8, p: 1, keylen: 32 }).
- Generator: `scripts/auth/make-super-admin-hash.mjs` — prompts locally, prints the value, exits.
  The plaintext password is typed once into a terminal and into the deployment env; it is never
  committed or stored.
- Password policy: **minimum 12 characters** (stricter than the 8-char user sign-in floor — this is
  the owner's master credential). Enforced by the generator; the verifier does not re-check length
  (only the hash matters).
- Sign-in requires **both** the hash and `BETTER_AUTH_SECRET` (the cookie HMAC key); either missing
  → 503 `SUPER_ADMIN_NOT_CONFIGURED`. Super admin is a live-deployment facility: the demo roster in
  `demo-accounts.ts` is untouched and can never produce a super-admin session.

### 6.2 Routes

| Route | Behaviour |
|---|---|
| `POST /api/auth/super/sign-in` | Body `{ password }`. 503 if not configured. Throttled via the existing `login-throttle` (identity `super-admin`, per-IP bucket; 429 + `retryAfterSeconds` when locked). Verify: `scrypt(password, salt)` → `timingSafeEqual`. On success: `Set-Cookie: architech_super_admin=<expiryEpoch>.<hmac-sha256(BETTER_AUTH_SECRET, expiryEpoch + ":" + "architech-super-admin")>; Max-Age=28800; HttpOnly; SameSite=Lax; Secure (on https)` — 8 h, matching the demo session TTL precedent. On failure: uniform 401 message (no user-existence/password oracle beyond the 503 configured-state, which is not sensitive). |
| `POST /api/auth/super/sign-out` | Clears the cookie (idempotent; works regardless of current session). |

Static segments win over the existing `app/api/auth/[...all]` catch-all, so no routing conflict.

### 6.3 Session

- New role `SUPER_ADMIN` in `AuthRole`, `roleRank` 50 (above `ADMIN`).
- Super-admin session: `user: { id: "super-admin", name: "Owner", email: "owner@architech.local",
  role: "SUPER_ADMIN" }`, **no organization**, `permissions: ["admin.plans.read", "admin.plans.write"]`,
  `source: "super-admin"` (the `AuthSession.source` union gains this member).
- `getSessionContractForRequest` checks the super-admin cookie **first** (after the `mode=none` test
  param): valid signature + unexpired → super-admin session, regardless of auth source mode. This
  works under `ARCHITECH_AUTH_SOURCE=demo` and `better-auth` alike.
- `requirePermission`'s existing `ADMIN` role-bypass does **not** apply to `SUPER_ADMIN`; the role
  holds exactly its permission list (minimal surface — it cannot walk broker/moderation surfaces).
- The production demo-auth gate is unaffected: the gate refuses only source
  `better-auth-contract-demo` in production without the escape-hatch flag; `super-admin` passes it —
  the owner must be able to activate plans in production.

## 7. Plan administration page `/admin/plans` (S4)

**Route:** `app/admin/plans/page.tsx` (noindex, `force-dynamic`) + `client/src/pages/PlanAdmin.tsx`.

**Gate (custom — `RequireSession` redirects to `/login`, which is wrong for this surface):**
- Session lacks `admin.plans.read` → render the super-admin sign-in panel (password field →
  `POST /api/auth/super/sign-in` → reload).
- Signed in as a non-super-admin → "no access" panel (no hint that a super-admin exists beyond the
  surface itself).
- `admin.plans.read` present → the administration UI.

**Panels:**
1. **Grant / update a plan** — enter the broker's login ID (the org admin's email) → "Find" →
   resolution `user.findUnique(email) → active brokerMemberships → organization`. Shows org name,
   slug, current plan (name, status, expiry) if any. Controls: plan (dropdown of
   `MarketplacePlan.active`), status (`TRIAL | ACTIVE | EXPIRED`), optional expiry date
   (required-for-meaning on `TRIAL`/`ACTIVE` is a soft hint, not a hard gate — a plan without
   expiry stays active until changed). Save → `POST /api/admin/plans`.
2. **Current subscriptions** — table of the 50 most recent `MarketplaceSubscription` rows joined to
   org (org name, plan name, status, expiresAt, updatedAt). Read-only.
3. **Create a plan** — name input → `POST /api/admin/plans/definitions`. Plan definitions auto-seed:
   on the first `POST /api/admin/plans` against an empty `MarketplacePlan` table, the transaction
   creates a default `Broker Pro` plan (code `broker-pro`, `monthlyCredits 0`, `teamSeats 1`) before
   writing the subscription, so the owner can activate plans before creating any definition.

**API (prisma mode only; fixture mode → 503 `NOT_AVAILABLE_IN_FIXTURE_MODE`):**

| Route | Guard | Behaviour |
|---|---|---|
| `GET /api/admin/plans?lookup=<email>` | `admin.plans.read` | `{ plans, subscriptions: [latest 50] }` (+ when `lookup`: `{ user: { name, email, role }, organization: { id, name, slug, cityId }, currentSubscription } \| { found: false }`). Lookup errors are uniform ("No organization found for that login id") — no distinction between unknown email and email-without-org. |
| `POST /api/admin/plans` | `admin.plans.write` | Body `{ email, planId, status: TRIAL|ACTIVE|EXPIRED, expiresAt?: ISO }`. `$transaction`: ensure plan (default-seed per above) → find org by email → **update** the org's most recent subscription or **create** one → `AuditEvent { action: "admin.plan.updated", organizationId, entityType: "MarketplaceSubscription", entityId, metadata: { loginEmail, planCode, previousStatus, status, expiresAt } }` (with `ipHash`). Response: the resulting `{ organization, subscription }`. |
| `POST /api/admin/plans/definitions` | `admin.plans.write` | Body `{ name }` (2–80 chars). Creates `MarketplacePlan { code: slugified-name (unique on collision → 409), name, monthlyCredits: 0, teamSeats: 1, active: true }` + `admin.plan.created` AuditEvent (org-less). |

Mutations go through `authorizeRequest` (→ `enforceMutationSafety` CSRF gate) exactly like the
broker routes. Every mutation is audited with the previous status in metadata — the ledger the
strategy doc wants for "who got access, when, under which plan" exists from day one, even before
the usage-ledger surface is built.

## 8. Lead detail page rewire

Surgical; keeps the shipped page shape, copy system, and interaction model.

1. **Data:** on mount `fetch /api/broker/leads/[id]` (loading skeleton; 404/403 keep the existing
   "not in your organization" panel). `LeadDetailRecord` drives identity, consent, stage,
   attempts, follow-up banner, call history.
2. **Call action:** tap → `POST …/reveal`. Success → same imperative `tel:` href mechanism already
   implemented on the anchor (href set before `location.assign`, iOS/Android-safe), plus `waMeLink`
   into the WhatsApp button. Failure → toast with the **server's** reason text; the button never
   goes dead. The client no longer evaluates the gate — it renders the answer (the page header
   comment already prescribes exactly this).
3. **Result sheet:** unchanged `visibilitychange` behaviour + manual affordance; Save →
   `POST …/calls` → on success refetch the detail (stage/attempts/suppression update).
4. **Delete:** the Prototype controls panel and its state, `GradeBadge` (grade/score is
   prototype-only — real data has no grade), `calling-prototype-data.ts`, the `FlaskConical` import.
5. **New markup** stays inside the design-token discipline (`.ink-2`/`.ink-3`/`.stamp`; no
   `text-ink/NN`, no `!text-[9/10px]`) so the ratchet baseline does not grow.

## 9. Lead retention purge

`scripts/privacy/purge-expired-leads.mjs` (+ `purge-expired-leads.test.mjs`), mirroring the
`purge-expired-requirements.mjs` posture and cron gating:

- Scope: `retentionUntil < now` **and** `deletedAt IS NULL`.
- Action: `phoneCiphertext = NULL`, `phoneLast4 = NULL`, `deletedAt = now`. The masked record,
  consent text, stage, and call logs remain as the non-sensitive audit tombstone (the retention
  promise is about the recoverable number, not the business trail).
- `EXPIRED`/lapsed plans never drive this — suppression and retention stay governed by consent and
  the purge schedule, never by billing state (plan doc §4 D3).
- Dry-run flag + affected-count output, same as the requirements script.

## 10. Cleanup and doc drift

- Delete `client/src/lib/leads/hygiene.ts` (dead duplicate of the operations catalog; the drift
  source behind the PR #70 CI failure). Verified: zero importers.
- Delete prototype artifacts per §8.4.
- **Update `docs/business-suite/mobile-calling-implementation-plan.md`:** tick the now-complete
  Phase 2/3/4 boxes, update §11 dispositions (prototype files *deleted*), and record the plan-status
  decision (per-org via `MarketplaceSubscription` + manual owner activation, env override) under §4
  D3. No schema changes means no migration section.

## 11. Testing (TDD — failing test before each change)

| Area | Tests |
|---|---|
| `resolvePlanStatusForOrg` | env override wins; fixture default ACTIVE; prisma: TRIAL/ACTIVE pass through, PAUSED/EXPIRED/CANCELLED → EXPIRED, no subscription → NONE. |
| `calling-server` gates | **Gate order:** foreign lead blocked with NOT_OWNED even when plan is ACTIVE. Each block path: plan (NONE/EXPIRED → 402), consent class (registry predicate — a class with `humanFirstTouch: false` blocks), suppression (403), attempt limit (429), calling hours (403, using the configured window in the message), not stored (422). Success: tel/waMe links for the stored E.164; AuditEvent written with `ipHash` and `channel: "tel"`. |
| Routes (api-contract style, fixture mode) | `GET …/[id]`: 200 shape (`LeadDetailRecord` fields), 404 foreign, 403 no-org. `POST …/reveal`: 200 (links + revealed), 402/403/429/422/404 paths, org scoping. `POST …/calls`: 200 with `OUTCOME_RULES` mapping (no-answer keeps stage + requires `nextActionAt`; not-interested suppresses + requires `lostReason`; invalid outcome 400), fixture call-state updates visible on subsequent `GET`. `GET …/metrics`: 200 `{ ok, metrics: { overdue, outcomes, lostReasons } }`, 403 no-org; counts reflect fixture call logs written by the calls route. |
| Super admin | Hash generator round-trip (script output verifies); sign-in: 503 unconfigured (hash or secret missing), 401 wrong password (uniform message), 429 after throttle, 200 + Set-Cookie attributes (HttpOnly/SameSite/Max-Age/Secure-on-https); session contract: valid cookie → SUPER_ADMIN session in **both** demo and live modes; tampered/expired cookie → treated as absent; sign-out clears; `timingSafeEqual` used (no early-exit compare in source — pinned by test on behaviour, not pattern). |
| Plan admin API | Fixture mode → 503. Lookup: found (org + current subscription), unknown/unaffiliated → uniform not-found. POST: creates subscription for org with none; updates most recent for org with one; default `Broker Pro` seed on empty plan table; AuditEvent `admin.plan.updated` with previous status; EXPIRED status blocks reveal (integration with §3). Definitions: create, duplicate code 409, name validation. |
| Purge | Dry-run counts without writes; expiry sweep nulls ciphertext/last4 + sets `deletedAt`, keeps masked tombstone; unexpired rows untouched; lapsed-plan state irrelevant (row with EXPIRED-org plan still purges on retention expiry). |
| Guardrails (plan §6) | Negative test: `LeadCallLog` block in `prisma/schema.prisma` contains no `duration` and no `connected`/`recording` column (no invented telephony evidence). Masked-list contract unchanged: existing `lead.test.ts` suite passes unmodified. Env parity: `ARCHITECH_SUPER_ADMIN_PASSWORD_HASH` present in `ALLOWED_ENV_KEYS` and `.env.example` (W5 test enforces). |
| Regression | Full `pnpm test`; `pnpm check`; `pnpm lint`; `pnpm db:validate` (no schema change expected); `audit:contrast`; `test:perf` (bundle budget — page loses prototype markup, net shrink expected); `secrets:audit`; `production:plan:audit`; e2e in fixture mode. |

## 12. Environment surface

| Key | New? | Purpose |
|---|---|---|
| `ARCHITECH_BROKER_PLAN_STATUS` | existing | Now an **explicit override** (documented as such in `.env.example`). |
| `ARCHITECH_LEAD_CALL_ATTEMPT_LIMIT`, `ARCHITECH_CALLING_HOURS_IST`, `ARCHITECH_LEAD_RETENTION_DAYS` | existing | Unchanged. |
| `ARCHITECH_SUPER_ADMIN_PASSWORD_HASH` | **new** | scrypt hash of the owner's super-admin password. Added to `ALLOWED_ENV_KEYS` + `.env.example` (commented example + pointer to the generator script). |
| `BETTER_AUTH_SECRET` | existing | Also the super-admin cookie HMAC key; required for super admin to function. |

## 13. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Prisma deployments with existing leads but no subscriptions lose calling until the owner activates plans | High (intended) | That is the D3 entitlement gate working; the owner's first act is `/admin/plans`. `.env.example` documents the env override as the migration lever if a fleet must keep calling while plans are seeded. |
| Super-admin cookie secret reuse (`BETTER_AUTH_SECRET`) couples two facilities | Low | If the secret is rotated, both better-auth sessions and super-admin sessions re-login — acceptable; a dedicated secret would be a second key to lose. |
| Email → org lookup ambiguity (user in 0/2 orgs) | Low | 0 → uniform not-found; >1 → take the most recent active membership (deterministic: `createdAt` desc), shown to the owner before save so a wrong org is caught at review, not after. |
| Plan admin page is prisma-only; a demo-mode owner gets a 503 | Medium (documented) | The sign-in panel works in any mode, but the administration UI shows a clear "plan administration needs the database deployment" state in fixture mode rather than a dead form. |
| Prototype demo URLs (`/broker/leads/lead_prototype_hot/`) 404 after deletion | Low | Documented in the plan doc update; the demo path is now: submit a real enquiry in fixture mode → it appears in the inbox with a stored contact. |
| Fixture call-state map grows without bound (memory mode) | Low | Bounded demo by design (documented bounded-state pattern); same posture as the existing fixture lead store. |

## 14. Non-goals (explicit)

- No payment gateway, no plan self-service, no credit metering/`UsageLedger` consumption, no
  relay-call/WhatsApp-relay transport (strategy doc Phases 3–7 stay deferred; the schema they need
  already exists).
- No M1 server-rendered broker shells, no M5 a11y mobile gate (CI-only, sandbox-blocked).
- No Phase 5 buyer-notification deep links, no manager analytics beyond the existing inbox metrics.
- No D2 consent-copy change (held for legal), no D4 value change (09:00–20:00 IST / 3 attempts
  remain the configured defaults).
- No changes to `GET /api/broker/leads` (masked list contract stays byte-identical).

## 15. Delivery

One branch, ordered so each step leaves the suite green (TDD throughout):
1. Tests + `resolvePlanStatusForOrg`; env-override semantics.
2. `calling-server` hardening (registry consent predicate, shared hours helpers, fixture parity) with gate-order tests.
3. The four broker routes (detail, reveal, calls, and the orphaned metrics endpoint the inbox
   already calls) + api-contract tests.
4. Detail page rewire; prototype + dead-code deletion; plan doc update.
5. Lead purge script + tests.
6. Super-admin credential (generator script, sign-in/out, session wiring) + tests.
7. Plan admin API + page + tests.
8. Full verification pass (§11 regression list) + `.env.example`/allowlist polish.
