# Mobile compatibility and one-tap broker calling — implementation plan

**Date:** 08 Sep 2026
**Status:** Decisions D1/D3/D5 resolved; calling UX prototyped and reviewed in §11. D2 (legal) and D4 (calling-hours values) remain open and gate Phase 2.
**Scope:** (a) make the site, and specifically the broker surfaces, properly mobile-compatible; (b) make calling a lead a one-thumb action for a broker on a phone.
**Normative parent:** [`docs/business-suite/mobile-calling-lead-workflow.md`](../business-suite/mobile-calling-lead-workflow.md) — "Final v8 mobile workflow after end-to-end review; **implementation not started**". This document is the plan for implementing it on the Architech side.
**Measurement tool:** `ops/scripts/audit/mobile-audit.mjs` (`pnpm audit:mobile`) — the numbers below are its output against a live `pnpm dev`, not estimates.

---

## 1. Summary

Two questions were asked: how do we make the website mobile-compatible, and how do we make the lead dashboard easy to call from.

The honest answer to the first is that **the public site is already substantially mobile-ready** — a correct viewport, a mobile nav, safe-area handling, 44px touch utilities, scrollable tables, and a gesture-drawer primitive all exist. The mobile problem is concentrated in the **broker surfaces**, which render nothing at all server-side.

The answer to the second is that calling is not a UI problem. **The lead's phone number does not exist after creation.** `Lead` persists `phoneMasked` only; the raw number is discarded at write time. No amount of front-end work produces a `tel:` link from data that was deliberately thrown away. The calling feature is therefore a *data-retention* decision first and a *mobile UX* decision second — and the repository's own governance has already anticipated it, flagged it as an open gap, and specified the workflow in detail.

This plan closes both, in the order the dependencies actually run.

---

## 2. Evidence: measured current state

`pnpm audit:mobile` fetched the server-rendered HTML of 13 routes and applied the CSS rules that decide mobile behaviour.

```text
route                        status  els   tel:  wa.me  overflow  tapRisk  fixedGrid
/                            200     652   0     0      0         0        6
/search/                     200     204   0     0      0         0        0
/buy/                        200     272   0     0      0         0        0
/buy/ahmedabad/              200     185   0     0      0         0        0
/buy/ahmedabad/thaltej/      200     476   0     0      0         0        4
/saved/                      200     94    0     0      0         0        0
/dashboard/                  200     88    0     0      0         0        0
/broker/leads/               200     88    0     0      0         0        0
/broker/dashboard/           200     88    0     0      0         0        0
/broker/agent/               200     88    0     0      0         0        0
/broker/channel/             200     88    0     0      0         0        0
/broker/onboarding/          200     108   0     0      0         0        0
/broker/listings/new/        200     88    0     0      0         0        0
```

Baseline is green: **181 test files, 2029 tests passing** (`pnpm test`).

### 2.1 What already works — do not rebuild it

| Capability | Where | Note |
|---|---|---|
| Correct viewport meta | `app/layout.tsx:58` + Next 16 defaults | Renders `width=device-width, initial-scale=1`. Verified in HTML and against `node_modules/next/dist/lib/metadata/default-metadata.js:23` — the `themeColor`-only export *merges* with the default, it does not replace it. **Not a gap.** |
| Mobile nav | `src/components/architech/Header.tsx:94-103` | Hamburger, `lg:hidden` panel, focus ref on first link. |
| Safe-area insets | `theme.css:817-818`, `:649` | `.safe-bottom`, `.safe-bottom-lg`, `.mobile-discovery-rail` all use `env(safe-area-inset-*)`. |
| Touch target utility | `theme.css:573` | `.touch-44 { min-height:44px; min-width:44px }` — already applied in `StickyBar` and the lead inbox action row. |
| Scrollable tables | `AgentWorkspace.tsx:185`, `AcquisitionQueue.tsx:154,200` | `overflow-x-auto` + `min-w-[760px]` — correct pattern, **0 overflow findings**. |
| Mobile sidebar nav | `AgentWorkspace.tsx:194` | Horizontal-scroll chip rail below `md:`, sticky sidebar above. |
| Gesture drawer | `components/ui/drawer.tsx` (vaul) + `FilterSheet.tsx` | Dynamically imported to protect the bundle budget. Reuse for the post-call sheet. |
| Bottom conversion bar | `StickyBar.tsx` | The exact pattern the mobile call bar should follow. |
| Reduced motion | 15 `prefers-reduced-motion` blocks in `theme.css` | New motion must respect it. |

Responsive prefixes are in real use: **389 `md:`, 89 `lg:`, 77 `sm:`, 6 `xl:`** across 50 of 141 `.tsx` files.

### 2.2 The actual mobile gaps

**M1 — Broker surfaces render an empty shell.** Every `/broker/*` and `/dashboard/` route returns 88 elements: header, footer, and `RequireSession`'s "Checking your session…" spinner (`RequireSession.tsx:60-68`). The lead inbox then fetches client-side (`BrokerLeadInbox.tsx:39-47`). On a phone over mobile data that is **three serial network dependencies before first meaningful content**: JS bundle → session resolve → `/api/broker/leads`. This is the single biggest mobile defect in the product, and it is invisible on desktop broadband.

**M2 — Zero call affordance, anywhere.** `tel:` = 0 and `wa.me` = 0 on all 13 routes. The only `tel:` link in the codebase is `BrokerChannel.tsx:344`, which appears solely after a client-fetched mutual match acceptance — so it never exists in served HTML.

**M3 — Fixed grid columns with no mobile-first base.** 6 findings on `/`, 4 on `/buy/ahmedabad/thaltej/`, all the same pattern: `mt-4 grid grid-cols-3 gap-2 border-t border-ink/12 pt-3` (the `PropertyCard` stat row). Three columns at 360px is ~104px each minus gutters — cramped, and it is on the highest-traffic card in the product.

**M4 — No lead detail route.** `find app -path "*leads*" -name page.tsx` returns only `app/broker/leads/page.tsx`. Everything happens in a list of expanding cards, which is the wrong shape for a thumb and cannot be deep-linked from a notification or WhatsApp.

**M5 — No mobile regression gate in CI.** `playwright.a11y.broker.config.ts` already declares a `chromium-mobile` project on `devices["Pixel 5"]`, but no test asserts horizontal overflow or tap-target size. (Browsers cannot be downloaded in this sandbox, so this gate must be authored and run in CI, not locally.)

---

## 3. The blocker for calling: the number is not stored

This is the crux, and it is deliberate rather than an oversight.

```prisma
// db/schema.prisma:845
model Lead {
  mode        LeadMode   @default(MASKED)   // MASKED | DIRECT_CONSENTED
  phoneMasked String?                       // <-- the only phone column
  consentText String
  ...
}
```

`src/lib/leads/lead.ts:118` writes `phoneMasked: maskPhone(input.phone)` and never persists `input.phone`. `LeadRecord` (the API contract, `lead.ts:31-56`) carries `phoneMasked` and no callable field. The inbox headline states the intent: *"Reach buyers without **burning their number**"* (`BrokerLeadInbox.tsx:88`).

So `tel:` cannot be added at the view layer. Either the retention model changes, or calling is impossible.

### 3.1 Governance has already decided the direction

The plan does not need to invent a privacy posture — three existing artefacts settle it.

**(a) The gap is already logged.** `docs/business-suite/lead-ingestion-contract.md:144`:

> **Architech / website (first-party):** … On the Architech side this rides the existing `lead.created` projection (InteropOutbox) — v8 §9's gaps (**encrypted contact storage**, opaque idempotency material) apply to that path and are tracked there.

**(b) A production-shaped encryption precedent exists.** `Requirement` already stores a callable number safely:

```prisma
// db/schema.prisma:914
phoneCiphertext Bytes
phoneLast4      String @db.VarChar(4)
```

…via versioned AES-256-GCM in `src/lib/requirements.server.ts:69-77` (`ARQ1` magic + 12-byte IV + auth tag + ciphertext), keyed by `ARCHITECH_CONTACT_ENCRYPTION_KEY`, validated as canonical base64 of exactly 32 bytes (`:55-64`). `ARCHITECH_CONTACT_ENCRYPTION_KEY` is already in `.env.example:17` and already in the ops hygiene allowlist (`src/lib/operations/hygiene.ts:17`). **No new secret, no new crypto, no new dependency.**

**(c) The consent predicate already exists and is tested.** `src/lib/interop/lead-ingestion.ts:143-190` defines `CONSENT_CLASSES` with `humanFirstTouch: true` for **all seven** classes, while `automatedWhatsAppFirstTouch` is `false` for `portal-shared` and `aggregator-shared`:

| consentClass | humanFirstTouch | automatedWhatsApp | retention |
|---|---|---|---|
| `first-party-form` | ✅ | ✅ | 180 d |
| `ad-opt-in` | ✅ | ✅ | 180 d |
| `portal-shared` | ✅ | ❌ | 90 d |
| `aggregator-shared` | ✅ | ❌ | 90 d |
| `walk-in-verbal` (+3 more) | ✅ | … | … |

**A human manually dialing is consent-permitted under every class; automation is not.** That is precisely the predicate a Call button needs, and it is already modelled, typed, and covered by `lead-ingestion.test.ts`.

### 3.2 The workflow is already specified

`docs/business-suite/mobile-calling-lead-workflow.md` is normative and unusually complete. Binding constraints carried into this plan verbatim:

- **`tel:` only — "Call from SIM".** §2: *"The custom action uses a standard `tel:` link to open the device dialer… on dual-SIM phones, chooses the company SIM if the operating system prompts."*
- **No paid telephony.** §6 and `docs/broker-suite/decision.md:248` exclude *"Twilio, Exotel, call-recording SaaS, per-minute API"*. **This rules out a masked-number call bridge**, which would otherwise be the privacy-ideal answer.
- **Never invent telephony evidence.** §2: *"A web app cannot reliably know whether a normal cellular call connected, its exact duration or its recording. The employee confirms the result."* → the post-call sheet is **self-reported**, not measured. No `duration`, no `connected` boolean from the platform.
- **Gates before the dialer opens.** §2: voice consent, do-not-call suppression, business calling hours, attempt limit. *"Only the assigned employee, configured backup and manager may reveal/call the number."* *"The platform never auto-dials."*
- **Call outcome ≠ lead stage.** §3 keeps them separate with an explicit mapping table (7 outcomes, 7 stages) so *"not every missed call looks like pipeline movement"*.

### 3.3 The reveal pattern has a working in-repo precedent

`src/lib/channel/publish.ts:180-227` already implements gated contact reveal for the broker channel, and it is tested (`publish.test.ts:200`):

```ts
export type CounterpartyContact = {
  businessPhoneMasked: string;   // ALWAYS present — UI shows something pre-connection
  businessPhoneE164?: string;    // only once connected
  telLink?: string;              // only once connected
  waMeLink?: string;
  connected: boolean;
};
```

The comment at `:18-22` explains the gate: *"the counterparty's business number appears only when BOTH sides accept. A one-sided accept reveals nothing, which stops the channel being scraped for agency phone numbers by anyone willing to click accept on everything."*

**The lead version is the same shape with a different predicate:** masked always, `telLink` only when `humanFirstTouch && permission && !suppressed && withinCallingHours && attempts < limit`.

---

## 4. Decisions required before implementation

**Resolved 08 Sep 2026** — D1, D3 and D5 are decided; D2 and D4 remain open and gate Phase 2.

| # | Decision | Answer |
|---|---|---|
| D1 | Where does the callable number come from? | **Store it encrypted** — `phoneCiphertext` + `phoneLast4` on `Lead`, mirroring `Requirement`. |
| D3 | When is the number revealed? | **Gated on an activated broker plan.** A broker who has not activated a plan cannot view or call; reveal becomes a plan entitlement. _Final mechanism (10 Sep 2026): per-organization via `MarketplaceSubscription`, manual owner activation on `/admin/plans`, `ARCHITECH_BROKER_PLAN_STATUS` as explicit override._ |
| D5 | Scope of the first pass | **Full v8 workflow** — this document's Phases 1–5 plus the parent doc's area routing, WhatsApp number routing, manager funnel and ERPNext projection. |
| D2 | Buyer consent copy | **OPEN — legal/DPDP review.** Blocks Phase 2. |
| D4 | Calling hours + attempt limit values | **OPEN.** Proposed `09:00-20:00` IST and 3 attempts; provisional values are implemented and configurable. |

### D3 expanded: plan-gated reveal

The answer to D3 changes the gate from a pure privacy check into a **commercial entitlement**, and that has consequences worth stating before build:

- **A new plan/subscription model is required.** There is none today: `grep "^model " db/schema.prisma | grep -i "plan\|subscri\|entitle\|billing\|tier"` returns nothing, and no `subscription`/`entitlement` module exists in `src/lib`. The nearest precedent is `BrokerOrganization.verificationStatus`, which gates the channel's contact reveal — a status enum on the organization, not a purchasable plan. `BrokerPlanStatus = NONE | TRIAL | ACTIVE | EXPIRED` is the proposed contract.
- **`EXPIRED` must not destroy data.** A broker who lapses stops *revealing*; leads they already legitimately collected are not deleted. Suppression and retention stay governed by consent class and the purge schedule, never by billing state.
- **`TRIAL` reveals.** The point of a trial is to feel the product; a trial that cannot dial is not a trial.
- **The gate order matters.** Ownership and permission are checked *before* plan status, so a broker who does not own a lead is told that — not sold an upgrade that would not help. This also avoids leaking which leads exist. Pinned by `calling.test.ts`.
- **Payments are out of scope for this document.** Activation is assumed to happen elsewhere; this plan consumes a status, it does not sell one. `non-payment-functionality-audit.md` remains the authority on what is and is not payable.

---

### Original decision framing (superseded where answered above)

**D1 — Retention: store the number, or keep it unrecoverable?**
- **(A) Recommended:** add `phoneCiphertext Bytes?` + `phoneLast4 VarChar(4)?` to `Lead`, mirroring `Requirement`. Free, works offline, uses the existing key and crypto, and makes the `tel:` link real.
- **(B)** Keep masking absolute and adopt a call bridge (Exotel/Twilio masked calling). Preserves the "never burning their number" promise perfectly — but **violates the free-first baseline** in `decision.md:248` and adds per-minute cost.
- (A) is the only option consistent with current governance. Confirm, because (A) **does** weaken the buyer-facing promise and needs the copy in D2 to compensate.

**D2 — Buyer consent copy.** If D1=(A), the enquiry form must state that a broker may call. Today `consentText` is free text validated only at ≥12 characters (`lead.ts:87`). Proposal: replace with a structured `consentClass` from the existing registry, plus explicit "a verified broker may call you on this number" wording shown at capture. **This is a legal/DPDP review item**, and `lead-ingestion-contract.md:159` already defers final retention numbers to legal.

**D3 — Reveal timing: on-demand or pre-revealed?**
- **(A) Recommended:** on-demand. The list endpoint keeps returning masked-only (contract unchanged, zero regression risk). A separate `POST /api/broker/leads/[id]/reveal` performs the gate checks, writes `lead.contact.revealed` to `AuditEvent`, and returns the `telLink` once.
- **(B)** pre-reveal in the list — faster UX, but every list load exposes every number and makes the audit trail meaningless (a reveal nobody acted on looks identical to one that produced a call). Scraping risk is exactly what `publish.ts:18` warns about.

**D4 — Calling hours and attempt limit values.** Proposed env: `ARCHITECH_CALLING_HOURS_IST=09:00-20:00`, `ARCHITECH_LEAD_CALL_ATTEMPT_LIMIT=3`. The workflow doc mandates both gates but sets no numbers.

**D5 — Scope of this pass.** Full v8 §7 order (9 steps, incl. area routing, manager funnel, ERPNext) or the **calling + mobile slice** (§5 below: M1–M5 + Call from SIM + result sheet)? This plan is written for the slice, with the rest left to the parent doc.

---

## 5. Recommended architecture

Assuming D1=(A), D3=(A).

### 5.1 Data

```prisma
model Lead {
  phoneMasked     String?
  phoneCiphertext Bytes?    @db.ByteA   // NEW — mirrors Requirement.phoneCiphertext
  phoneLast4      String?   @db.VarChar(4) // NEW — searchable/sortable without decrypting
  consentClass    String?   @db.VarChar(32) // NEW — key into CONSENT_CLASSES
  callSuppressedAt DateTime?  // NEW — DNC: wrong number / not interested
  callAttempts    Int       @default(0) // NEW — attempt-limit gate
  callLogs        LeadCallLog[]
}

model LeadCallLog {          // NEW — the workflow doc's "manual CRM Call Log"
  id          String   @id @default(cuid())
  leadId      String
  actorUserId String?
  organizationId String?
  outcome     String   @db.VarChar(32)  // the 7 §3 outcomes; NO duration, NO connected flag
  note        String?  @db.VarChar(500)
  stageBefore String   @db.VarChar(32)
  stageAfter  String   @db.VarChar(32)
  nextActionAt DateTime?
  createdAt   DateTime @default(now())
  lead        Lead     @relation(fields: [leadId], references: [id], onDelete: Cascade)
  @@index([leadId, createdAt])
  @@index([organizationId, nextActionAt])   // overdue-follow-up query
}
```

`outcome` stays a bounded `VarChar` with a code-level union, not a Prisma enum — the workflow doc's outcome list is explicitly expected to grow ("Real Estate profile can show **Site Visit Scheduled**"), and enum migrations are avoidable churn.

Ciphertext is nullable: **existing leads have no recoverable number** and must degrade to "number not available for this lead" rather than a broken button. Backfill is impossible by construction — the number was never stored — and that is fine; it only affects pre-migration rows.

### 5.2 Reveal gate (server-only)

New `src/lib/leads/contact.ts`, deliberately shaped like `publish.ts`'s `counterpartyContact()`:

```ts
export type LeadContact = {
  phoneMasked: string;      // always
  telLink?: string;         // only when revealed
  waMeLink?: string;
  revealed: boolean;
  blockedReason?: "NOT_OWNED" | "NO_PERMISSION" | "PLAN_REQUIRED" | "CONSENT_CLASS"
                | "SUPPRESSED" | "NOT_STORED" | "OUTSIDE_HOURS" | "ATTEMPT_LIMIT";
};
```

Implemented as `decideReveal()` in `src/lib/leads/calling.ts`. The order of checks is the contract — ownership and permission first, then the plan, then per-lead facts — and is pinned by `calling.test.ts` so a reorder cannot silently turn an access failure into a sales prompt.

Reuses `normalizeIndianPhone`, `telLink`, `waMeLink` from `@/lib/interop/phone` (E.164 canonical, already load-bearing for ERPNext exact-match identity per that file's header comment) and `consentPermissionsFor` from `@/lib/interop/lead-ingestion`. **The UI never computes a gate** — it renders `blockedReason`.

### 5.3 API

| Route | Change |
|---|---|
| `GET /api/broker/leads` | **Unchanged contract.** Still masked-only. |
| `POST /api/broker/leads/[id]/reveal` | NEW. `lead.inbox.write` + `assertLeadBelongsToOrg` (the same ownership gate `reply/route.ts:26` uses). Runs the §5.2 gate, writes `lead.contact.revealed` to `AuditEvent` with `ipHash`, returns `{ telLink, waMeLink }`. Increments nothing yet. |
| `POST /api/broker/leads/[id]/calls` | NEW. Records the self-reported outcome, increments `callAttempts`, applies the §3 outcome→stage mapping, sets `callSuppressedAt` on `wrong-number`/`not-interested`, requires `nextActionAt` for no-answer/busy and a lost reason for not-interested. |
| `GET /api/broker/leads/[id]` | NEW. Single lead for the detail route, org-scoped. |

All three must implement **both** stores behind the existing `isPrismaLeadStorage()` branch (`src/lib/leads/source.ts:11`), because `.env.example` defaults to `fixture`/`memory`. Skipping the fixture path would leave the feature untestable locally and break `tests/e2e`.

### 5.4 Mobile UX

**Lead detail route** `app/broker/leads/[id]/page.tsx` (fixes M4). Full-screen, one lead, thumb-anchored action bar:

```
┌─────────────────────────┐
│ ← Inbox        hot · 82 │
│ Priya Shah              │
│ Thaltej 3 BHK · L-4471  │
│ ─────────────────────── │
│ Message …               │
│ Consent: first-party …  │
│ History: created → ack  │
│                         │
│ ─────────────────────── │
│  ◉ Call    ▢ WhatsApp   │  ← .safe-bottom, 56px, full-bleed
│        Log a call result │
└─────────────────────────┘
```

- The bar reuses `StickyBar.tsx`'s construction: `fixed inset-x-0 bottom-0 z-40`, `.safe-bottom container`, `touch-44`.
- **Call** = `<a href={telLink}>` rendered only after a successful reveal round-trip. Tapping it: `reveal()` → on success render/assign the `tel:` href and let the same tap navigate → on `blockedReason`, show the reason in a toast instead of a dead button. Two-tap worst case, one-tap once revealed in-session (cache the reveal in component state).
- Returning from the dialer fires `visibilitychange` → open the **Log call result** vaul drawer. This is the doc's "post-return result sheet", and `visibilitychange` is the only honest signal available: it says *the user came back*, never *the call connected*.
- Sheet: outcome radio group (7 values) → conditional required field (retry time / follow-up time / lost reason) → optional note → Save → `POST …/calls`.
- **List view** stays a scannable list but each row gets a trailing 44px call button that deep-links to the detail route — not a reveal, so no audit noise from scrolling.
- Overdue follow-ups sort first (`@@index([organizationId, nextActionAt])`), per §2 "overdue follow-ups first".

**M1 fix — stop shipping an empty shell.** Two options, in order of value:
1. Server-render the *structure* — move the header/kicker/heading and a skeleton list into the RSC so the first paint is a page, not a spinner. Keep the data fetch client-side. Cheap, no auth model change.
2. Fetch leads in the server component under the session and pass as props. Better, but `RequireSession` is documented as *"a navigation guard, not an authorisation boundary"* — the authoritative check stays in `authorizeRequest()` inside the API, so a server-side fetch must go through the same guarded path rather than reading Prisma directly.

Recommend (1) now, (2) as a follow-up. Either way the spinner must not be the first paint on mobile data.

**M3 fix** — `PropertyCard` stat row: `grid-cols-3` → `grid-cols-2 sm:grid-cols-3` (or keep 3 but drop to `gap-1.5` and `text-[11px]` at the base). Verify against `design-token-discipline.test.ts` — see §6.

---

## 6. Guardrails this work must not break

These are enforced by existing automated checks and will fail CI if ignored.

| Guard | Mechanism | Consequence for this plan |
|---|---|---|
| **Design-token ratchet** | `src/lib/ui/design-token-discipline.test.ts` + `design-token-baseline.json` | `BrokerLeadInbox.tsx` is locked at `{alphaText:14, microText:5, nanoText:5}`, `AgentWorkspace.tsx` at `{38,18,4}`. Counts **may only go down**. New mobile UI must use the `.ink-2`/`.ink-3` semantic tokens (`theme.css:1143-1144`, per-theme values at `:1148`/`:1160`) — **not** `text-ink/60`, and **not** `!text-[9px]`. Rewriting the inbox is a chance to pay debt down; re-lock with `node src/lib/ui/design-token-baseline.cjs --write` only after it decreases. |
| **Bundle budget** | `ops/config/performance/budgets.json` — default 240 KB gzip first-load | The call sheet, drawer, and any new icons must be **dynamically imported**, exactly as `FilterSheet.tsx:2-9` documents. Do not add a phone-formatting library; `interop/phone.ts` is deliberately dependency-free and its header explains why libphonenumber was rejected. |
| **Org scoping** | `assertLeadBelongsToOrg`, `listActiveLeads(organizationId)` mandatory arg | `lead.ts:158-166` makes an unscoped call a **compile error** on purpose — a past bug leaked every broker's pipeline to every other broker. Every new query keeps this. |
| **No invented telephony evidence** | workflow doc §2 | `LeadCallLog` has no `duration`, no `connected`, no `recordingUrl`. Outcome is self-reported. A test should assert the columns do not exist. |
| **Free-first baseline** | `docs/broker-suite/decision.md:248` | No Twilio/Exotel/SMS SaaS. `tel:` only. |
| **Secrets hygiene** | `src/lib/operations/hygiene.ts`, `pnpm secrets:audit` | Reuse `ARCHITECH_CONTACT_ENCRYPTION_KEY`; new vars must be added to `.env.example` **and** the hygiene allowlist, or the audit fails. |
| **Production activation gates** | `pnpm production:plan:audit` | New env vars and any fixture-only path must be declared, per the `bounded-state` comment at `lead.ts:57-62`. |

---

## 7. Phased delivery

Each phase is independently shippable and leaves `pnpm quality` green.

### Phase 0 — Measurement harness (½ day)
- [x] `ops/scripts/audit/mobile-audit.mjs` + `pnpm audit:mobile` (written; produced §2)
- [x] Add a `package.json` entry alongside `audit:contrast`
- [ ] **BLOCKED in sandbox** — add overflow + tap-target assertions to `tests/a11y-broker` under the existing `chromium-mobile` / Pixel 5 project (M5). No browser binary available and Playwright's download is network-blocked; author for CI.
- [x] Record the baseline table in this doc so regressions are diffs, not opinions

### Phase 1 — Mobile shell fixes, no data change (1–2 days)
- [ ] M1: server-render broker page structure + skeleton (all 6 routes) — **highest value; also unblocks measuring authenticated surfaces (§11.1)**

  _M1 deferred; this pass completes Phases 2–4 per `docs/superpowers/specs/2026-09-10-broker-calling-completion-design.md`._
- [ ] M3: `PropertyCard` grid mobile-first
- [x] M4: `/broker/leads/[id]/` detail route — **prototyped, see §11**
- [x] Sticky bottom action bar with WhatsApp — **prototyped; rewired in PR #72 — the call action now reveals through the server's reveal endpoint, never from fixtures**
- [ ] Pay down `BrokerLeadInbox` token debt (currently 9/14 alphaText, 5/5 microText, 3/5 nanoText — the microText budget is exactly full, so any edit there must not add a `!text-[10px]`)
- **Exit:** `pnpm audit:mobile` shows ≥200 elements on broker routes, 0 fixedGrid findings, token counts down.

### Phase 2 — Encrypted contact storage (2–3 days) *(needs D1, D2)*
- [x] Migration: `phoneCiphertext`, `phoneLast4`, `consentClass` on `Lead`
- [x] Extract `requirements.server.ts`'s AES-GCM envelope into a shared `lib/interop/contact-crypto.ts` (one implementation, two callers — do **not** copy-paste the cipher)
- [x] Write ciphertext on lead creation in **both** stores
- [x] Structured `consentClass` capture on the enquiry form + reviewed copy
  _Structured `consentClass` capture landed (defaults to `first-party-form`, registry-gated reveal); the D2 buyer-facing wording remains held for legal review._
- [x] Purge: extend `ops/scripts/privacy/purge-expired-requirements.mjs` posture to leads — ciphertext deleted at retention expiry, tombstone kept
  _Landed as `ops/scripts/privacy/purge-expired-leads.mjs` (mirrors the posture, reuses its `parsePurgeArgs`; dry-run default, `--apply` required) — shipped in PR #72._
- **Exit:** round-trip test (encrypt → decrypt → `telLink`), erasure drill, `pnpm db:validate`.

### Phase 3 — Gated reveal + Call from SIM (2–3 days) *(needs D3, D4)*
- [x] `lib/leads/contact.ts` gate, modelled on `publish.ts:counterpartyContact` _(shipped as `lib/leads/calling.ts` + `calling-server.ts`)_
- [x] `POST …/reveal` with `AuditEvent` write
- [x] `tel:` button on detail route; `blockedReason` surfaced as copy, never a dead button
- [x] Calling-hours + attempt-limit + suppression enforcement, all server-side
- [x] Unit tests mirroring `publish.test.ts` / `server.test.ts:210`
- **Exit:** every gate has a test that asserts the *blocked* path; masked list contract provably unchanged.

### Phase 4 — Post-call result sheet (2 days)
- [x] `LeadCallLog` model + migration
- [x] vaul sheet on `visibilitychange`, dynamically imported
- [x] §3 outcome→stage mapping as a pure tested function
- [x] Required next-action / lost-reason validation
- [ ] Overdue-follow-up sort on the list _(out of the approved spec's scope; the metrics panel shows the overdue count)_
- **Exit:** a no-answer call leaves the stage unchanged and schedules a retry; a not-interested call suppresses the number permanently.

### Phase 5 — WhatsApp + manager view (2 days, optional per D5)
- [x] `waMeLink` beside Call, gated on `automatedWhatsAppFirstTouch` **only if** the touch is human-initiated (it is — the broker taps it), so `humanFirstTouch` governs
  _Shipped with the reveal in PR #72 — the wa.me link appears beside Call, governed by the same humanFirstTouch-gated reveal._
- [ ] Overdue follow-ups, call outcomes by employee, lost reasons
- [ ] Deep link from `buyer-notifications` into the detail route

### Deferred to the parent doc
Area/WhatsApp-number routing (§4), ERPNext projection (§5), Evolution transport, PWA installability. Not in this slice.

---

## 8. Verification

```bash
pnpm quality                 # check + lint + test + db:validate  (baseline: 2029 pass)
pnpm audit:mobile            # §2 table; must improve, never regress
pnpm audit:contrast          # new tokens must hold AA in both themes
pnpm test:perf               # bundle budget after Phase 1/4 dynamic imports
pnpm secrets:audit           # Phase 2 key handling
pnpm production:plan:audit   # new env vars declared
pnpm test:a11y:broker        # Pixel 5 project — needs CI (no browser in sandbox)
```

New tests, following existing conventions:
- `lib/leads/contact.test.ts` — each gate predicate blocked and allowed
- `lib/interop/contact-crypto.test.ts` — envelope round-trip, wrong-key rejection, malformed-ciphertext rejection
- `lib/leads/call-log.test.ts` — outcome→stage mapping table, exactly as §3 specifies
- extend `lib/leads/lead.test.ts` — masked list contract unchanged after Phase 2
- a negative test asserting `LeadCallLog` has no duration/connected column

---

## 9. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Storing the number weakens the buyer promise** the inbox headline makes | High | D2 consent copy at capture; on-demand reveal only (D3); per-reveal audit; retention purge; **legal sign-off is a gate on Phase 2, not a follow-up** |
| Existing leads have no ciphertext → inconsistent UX | Medium | `blockedReason: "NOT_STORED"` renders as "number not available for this older enquiry", never a broken button |
| `visibilitychange` doesn't fire on all Android browsers when returning from the dialer | Medium | Sheet is also reachable manually via a persistent "Log a call result" affordance; never auto-assume an outcome |
| Dual-SIM: the OS may dial from a personal SIM | Low | Documented in §2 of the parent doc as an OS prompt we cannot control; company-SIM guidance belongs in broker onboarding copy |
| Token-debt ratchet blocks the inbox rewrite | Medium | Budgeted in Phase 1: use `.ink-2`/`.ink-3`, re-lock the baseline **downward** |
| Fixture/prisma divergence | Medium | Every store function implements both branches; a test asserts parity of the returned contract shape |
| Broker calls outside permitted hours in another timezone | Low | Gate evaluates in IST explicitly (`ARCHITECH_CALLING_HOURS_IST`), not server-local time |

---

## 10. What this plan deliberately does not do

- **No auto-dialing, no predictive dialer, no click-to-call bridge.** Prohibited by `decision.md:248` and by workflow §2.
- **No call recording, duration, or connected-state inference.** The platform cannot know; inventing it would be fabricated evidence.
- **No change to `GET /api/broker/leads`.** The masked list contract stays byte-identical.
- **No new dependency for phone handling.** `interop/phone.ts` stays dependency-free by design.
- **No offline promise.** Parent doc §2: *"It still needs internet; do not promise offline operation."*

---

## 11. Prototype status (08 Sep 2026)

**Status (10 Sep 2026):** Phases 2–4 are complete per `docs/superpowers/specs/2026-09-10-broker-calling-completion-design.md` (shipped via PR #72): encrypted contact storage with structured consent-class capture, the server-side gated reveal with `tel:`/`wa.me` links and per-reveal audit, post-call result logging with the §3 outcome→stage mapping and suppression, and the lead retention purge. M1 (server-rendered broker shell), M3, the M5 browser a11y assertions, and Phase 5's manager view + deep link remain — the wa.me link beside Call shipped with the reveal. Plan activation is manual by the owner via `/admin/plans` (no payment gateway, by owner decision); an org without an activated plan resolves to plan status `NONE` and cannot reveal or call.

Built so the calling ergonomics can be felt on a phone **before** committing to the data model. The gate logic and page shape are the things that ship; only the data source is throwaway.

| Artefact | Path | Disposition |
|---|---|---|
| Calling domain logic — outcomes, stages, §3 mapping, reveal gate, IST calling hours | `src/lib/leads/calling.ts` | **Ships.** Pure and server-safe; Phase 3 moves `decideReveal` behind the reveal endpoint. |
| Tests for the above (20) | `src/lib/leads/calling.test.ts` | **Ships.** |
| Prototype fixtures — 5 leads covering hot / follow-up-due / attempt-limit / suppressed / not-stored | `src/lib/leads/calling-prototype-data.ts` | **Deleted 10 Sep 2026** — fixture mode runs the real lead store + call parity instead. |
| Prototype controls panel (plan switch / closed-hours toggle / lead picker) | `src/screens/BrokerLeadDetail.tsx` | **Deleted 10 Sep 2026** — the server is the only gate authority. |
| Duplicate catalog (env allow-list drift source behind the PR #70 CI failure) | `src/lib/leads/hygiene.ts` | **Deleted 10 Sep 2026** — `operations/hygiene.ts` is the single catalog. |
| Post-call result sheet (vaul drawer, dynamically imported) | `src/components/broker/CallResultSheet.tsx` | **Ships.** |
| Lead detail surface + thumb-anchored call bar | `src/screens/BrokerLeadDetail.tsx` | **Ships**, minus the prototype control panel. |
| Route `/broker/leads/[id]/` | `app/broker/leads/[id]/page.tsx` | **Ships.** Fixes M4. |
| Inbox row → detail link + primary Call action | `src/screens/BrokerLeadInbox.tsx` | **Ships.** |
| Measurement harness, `pnpm audit:mobile` | `ops/scripts/audit/mobile-audit.mjs` | **Ships.** Produced §2. |

Verified: `tsc --noEmit` clean; `eslint` clean on every new/changed file; **2052 tests pass** (baseline was 2029); the design-token ratchet passes with the new files at **zero** debt — no `text-ink/NN`, no `!text-[10px]`, no `!text-[9px]`, using `.ink-2`/`.ink-3`/`.stamp` instead. The `clay-fill` dark-mode contract and the env-catalog allow-list are both satisfied.

Two rules were implemented rather than merely documented, because they are the ones a prototype tends to get wrong:

- **No invented telephony evidence.** The sheet opens on `visibilitychange` after the broker returns from the dialer and says so explicitly ("You came back from the dialer. We do not know whether the call connected"). There is no duration field, no connected flag, no recording reference — and the sheet is also reachable manually, because `visibilitychange` does not fire reliably on every Android browser when returning from a native dialer.
- **Never a dead button.** Every blocked state renders its reason (`REVEAL_BLOCKED_COPY`) with a CTA where one exists, so a plan-locked broker sees *"Calling is part of a partner plan"* rather than a button that does nothing.

### 11.1 Blocked in this environment

These are sandbox limits, not design problems. Each is marked rather than papered over.

| Blocked | Why | Unblocks where |
|---|---|---|
| **Real-viewport verification** | No Chromium/Firefox binary present and `playwright install chromium` fails — the download is network-blocked. So overflow, tap-target size and the actual rendered layout at 360 px are **not** empirically confirmed; §2 rests on static CSS-rule analysis of served HTML. | CI, via the existing `chromium-mobile` / `devices["Pixel 5"]` project in `playwright.a11y.broker.config.ts`. Phase 0 adds the overflow + tap-target assertions. |
| **Measuring authenticated broker surfaces** | `ops/scripts/audit/mobile-audit.mjs` reads served HTML, and every `/broker/*` route serves only the `RequireSession` shell — 88 elements, "Checking your session…". The new detail page therefore reports 88 too, so the audit **cannot yet see the very surface it exists to check**. | Either the M1 fix (server-render the page structure, which makes the content appear in HTML and become measurable) or a session-aware audit mode that authenticates first. M1 is the better answer: it fixes the user-facing problem and the measurement blind spot at once. |
| **Actual dialing** | No telephony in a sandbox, and `tel:` behaviour — iOS vs Android, dual-SIM prompt selection, returning to the tab — needs a physical handset. | Device testing per parent doc §7 step 9 (Android, iPhone, dual-SIM). |
| **Phase 2 onward** | Gated on D2 (legal/DPDP review of consent copy) and D4 (calling-hours and attempt-limit values). | Legal review; D4 has provisional defaults already implemented. |
| **Plan/subscription model** | Does not exist anywhere in the schema (§4 D3 expanded). The prototype takes plan status from local state. | A modelling decision that precedes Phase 3; interacts with `non-payment-functionality-audit.md`. |

### 11.2 To review the prototype

`pnpm dev`, then open `/broker/leads/lead_prototype_hot/` on a phone-sized viewport (DevTools device mode is sufficient for layout; the dial itself needs a handset). Demo auth is on via `ARCHITECH_AUTH_SOURCE=demo`, so the session resolves without credentials.

A **"Prototype controls"** panel at the foot of the page switches plan status (`ACTIVE / TRIAL / EXPIRED / NONE`), simulates closed calling hours, and jumps between the five fixture leads. It exists so every blocked state can be reviewed without waiting for the entitlement API — **and it is not part of the product**; it is removed in Phase 3.

