# Broker Suite — Requirements, Architecture & Tooling Decision

**Date:** 01 Sep 2026
**Status:** ✅ Requirements confirmed; tooling recommendation finalized (not yet implemented).
**Scope:** Everything decided across the CRM / channel / accounting / chat exploration, in one document. Supersedes the earlier scattered notes (`crm-tooling-decision.md`, `open-source-stack-integration.md`, `broker-suite-requirements.md`, `broker-suite-architecture-options.md`, `broker-suite-build-vs-adopt.md`).

> **How to use this document (for an AI agent or engineer):** this file is the working brief for the "Broker Suite" — a set of broker/agent-facing capabilities to be added *around* the existing Architech application. Read §2 (context) to understand the existing system, §5 (requirements) for *what* to build, §6–8 for *why* the tooling/architecture was chosen, and §9–10 for *how* (proposed data model, sync contract, matching rules — these are sketches to validate, not final code). The next concrete artifact to produce is the detailed technical design described in §13.

---

## 1. TL;DR

1. Architech is a **multi-tenant platform serving many brokers**; each broker has its own login and a small team (≤ 20 employees).
2. Three capabilities are required: **Lead Management CRM**, **Brokers Channel** (cross-broker buy/sell matching), and **simple Accounting** (no GST filing / e-invoicing for now).
3. **Recommended approach: adopt Twenty CRM (self-hosted, TypeScript/PostgreSQL) for the broker CRM + channel + simple HR/accounting**, with a **one-way lead sync from Architech** (consent + phone-masking stay in Architech).
4. **Adopt Frappe (ERPNext + Frappe HR + India Compliance) later**, only when real payroll (PF/ESI/TDS) or GST accounting is needed.
5. Chat tools (Mattermost/Zulip) and project-management tools (Vikunja/Taiga/Huly/Focalboard) are **not part of the solution** for now.

---

## 2. Context — what Architech already is

### 2.1 Product

Architech is a premium, India-wide **real-estate discovery platform** (Ahmedabad-first). Public users search/browse listings, RERA-verified projects, and localities; they submit **enquiries (leads)** and **buyer requirement briefs**. It is the **public listing website** and the **source of leads** for brokers. All listings/statistics/RERA in the prototype are **illustrative demo data** pending verified sources.

### 2.2 Current tech stack (verified from repo)

| Layer | Choice |
|---|---|
| Framework | **Next.js 16** App Router (SSR/SSG) |
| Language | **TypeScript** (React 19) |
| Database / ORM | **PostgreSQL** + **Prisma 7** (`@prisma/adapter-pg`) |
| Auth | **better-auth** (users, roles, sessions; 2FA/passkeys planned) |
| UI | **Tailwind CSS v4** + **shadcn/ui** (Radix primitives), Lucide icons |
| Maps | MapLibre GL + OSM |
| Misc | pino logging, Sentry, Playwright (a11y), Vitest (unit), pnpm workspace |

### 2.3 Existing broker/lead assets (directly relevant to this brief)

The repo **already contains** a broker side and lead pipeline — this is important: the Broker Suite *extends* this, it does not start from zero.

**Prisma models (from `prisma/schema.prisma`):**

| Model | Key fields (relevant here) | Meaning |
|---|---|---|
| `BrokerOrganization` | `id`, `slug`, `name`, `cityId`, `verificationStatus`, `reraNumber` | One brokerage/agency = one tenant. |
| `User` | `id`, `email`, `role` (`BUYER`, `BROKER_MEMBER`, `BROKER_ADMIN`, `MODERATOR`, `ADMIN`) | Global login account. |
| `BrokerUser` | `userId`, `organizationId`, `role`, `active` | Membership linking a `User` to a `BrokerOrganization`. |
| `Lead` | `listingId`, `userId`, `organizationId`, `mode` (`MASKED`/`DIRECT_CONSENTED`), `status` (`NEW`/`ACKNOWLEDGED`/`REPLIED`/`CLOSED`/`DELETED`), `name`, `phoneMasked`, `email`, `message`, `consentText`, `idempotencyKey`, `deletedAt` | An enquiry tied to a listing, masked by default. |
| `Requirement` | `cityId`, `intent`, `category`, `subtype`, `role`, `name`, `phoneCiphertext` (encrypted), `phoneLast4`, `consentText`, `status`, `retentionUntil`, `deletedAt` | Buyer brief (wanted property), phone encrypted. |
| `Listing` | `id`, `stableId`, `cityId`, `localityId`, `brokerOrgId`, `propertyType`, `priceInr`, `bhk`, `areaSqft`, `availability`, `lifecycle` | Supply record; already linked to `BrokerOrganization`. |

**Location registry:** `client/src/lib/cities.ts`, `client/src/lib/localities.ts`, `client/src/lib/pincodes.ts` — authoritative **city → locality** list. This is the source of truth for "**area**" assignment (see §5.3: area = locality).

**Broker lead inbox (already built):** `docs/leads/phase-1-lead-inbox.md`; code in `client/src/lib/leads/` and `app/api/broker/leads/`. Behavior: phone **masked by default**, `consentText` shown before actions, status workflow `NEW → ACKNOWLEDGED → REPLIED → CLOSED`, audit trail, idempotent creation.

**Lead scoring (already built):** `P1-LEAD-002` — deterministic **hot/warm/cold** score from structured signals (transparent heuristic, not ML).

### 2.4 Governing design rules (from the architecture)

- **Consent + masking are load-bearing.** Buyer phone is masked (`MASKED`) unless direct consent (`DIRECT_CONSENTED`); `Requirement.phoneCiphertext` is encrypted. Any new system that touches buyer data must respect this.
- **Deterministic, transparent logic** over black-box ML (the project rejects "AI valuation" style claims; heuristics must be explainable).
- **DPDP erasure:** buyer right-to-delete is implemented by purge scripts (`scripts/privacy/purge-expired-requirements.mjs`). Any new store of buyer data must support erasure.
- **Multi-tenancy is NOT yet enforced** — the current repo is single-org demo data; `organizationId`/`brokerOrgId` columns exist but are not consistently scoped in queries. Enforcing org-scoping is required wherever private broker data is served.

---

## 3. Glossary (shared vocabulary)

| Term | Meaning |
|---|---|
| **Broker / agency** | The tenant — a real-estate business with its own employees. |
| **Agent / employee** | A member of a broker's team (≤ 20). Assigned to localities. |
| **Area** | A **locality** (e.g., Thaltej). Assignment/territory unit. |
| **Lead** | An enquiry from the public site about a listing or a property need. |
| **Cold caller** | Optional employee role that first-touches leads and hands off hot ones. |
| **Hot / cold lead** | Qualification state: cold = not yet ready/verified; hot = qualified, ready for a salesperson. |
| **Channel request** | A broker publishing demand (buyer requirement) or supply (seller listing) to the shared network. |
| **Match** | A candidate pairing of a buyer request ↔ a seller listing across brokers. |
| **Deal** | A matched request that closes; carries an agreed commission split. |
| **Commission split** | The per-deal, broker-negotiated division of commission (not formulaic). |

---

## 4. Actors

| Actor | Description |
|---|---|
| **Broker** (agency owner) | Runs a small team (≤ 20 employees). Manages employees, enters salaries, sees dashboards, does simple accounting. |
| **Agent / employee** | Works under a broker. Assigned to localities. Manages leads assigned to them. Can enter commission on their own deals. |
| **Cold caller** *(optional role)* | Where a broker enables it, a designated employee does first-touch qualification before handoff. Not every broker uses this. |
| **Buyer** | Wants to buy/rent (demand). |
| **Seller** | Wants to sell/rent out (supply). |
| **Other brokers** | Independent agencies cooperating through the shared channel. |

---

## 5. Requirements (final, confirmed)

### 5.1 Platform nature (confirmed)

- **Multi-tenant platform serving many brokers.** Each broker sees only its own team, leads, areas, and accounting.
- **≤ 20 employees per broker.** Total broker count undecided — design for many small tenants.
- Monetization: **no platform fee on channel deals** (bundled into the broker's plan/combo).

### 5.2 Pillar 1 — Lead Management CRM

- **Area = locality level.** Architech's city → locality registry is the source of truth.
- A locality maps to one **responsible employee**; one employee can own many localities.
- **Lead routing — two modes (cold calling is OPTIONAL):**
  - **Mode A (direct):** lead → assigned immediately to the locality's owning employee.
  - **Mode B (cold caller):** lead → cold caller qualifies → a cold→hot lead is transferred to the locality's owner.
  - This is **per-broker configuration**: `cold-calling enabled? yes/no` + which employee is the cold caller.
- **Lead lifecycle:** New → Contacted → Qualified (Hot) → Negotiation → Closed (Won/Lost). Ownership + stage changes are auditable; the cold-caller handoff is a tracked transition.
- **Broker dashboard:** per-employee progress (leads, stages, conversions, closed deals), per-locality and per-employee views.
- **Employee management (nice-to-have):** leave tracking; salary records (salary entered by the broker).

### 5.3 Pillar 2 — Brokers Channel

- A network of independent brokers cooperating on deals.
- Both sides publishable: **Demand** (buyer requirement) and **Supply** (seller listing).
- **Matching:** surface candidate buyer ↔ seller matches across brokers. **Negotiation is between the two brokers, per deal.**
- **Privacy (critical):** buyer and seller **phone numbers are NEVER shown** in the channel — details only. Brokers **contact each other** to negotiate; the end-customer number is never exposed by the platform.
- **Membership & fees:** at launch the channel is **open + invite**; **no platform fee** on channel deals.
- **Commission split:** negotiated per deal (no fixed formula); recorded at **deal close**.
- **Closing a channel request:** a broker can **close its own request** unilaterally (a deal may close outside the channel). Optional **dual-close mode**: closing by one sends a notification to the other broker to also confirm.

### 5.4 Pillar 3 — Accounting (simple)

- Lightweight ledger per broker:
  - **Income:** commission per deal — entered by employee or broker, recorded at **deal close**.
  - **Expenses:** salaries (entered by broker) + other costs.
- **Out of scope for now:** GST return filing, e-invoicing (IRN), e-way bills, GSTR-1/3B, full payroll engine.

### 5.5 Explicit non-requirements (for now)

- GST filing, e-invoicing, e-way bill.
- Full HR/payroll engine.
- Buyer-facing surface (listings, RERA, search) is unchanged — owned by Architech.
- Agent-to-agent chat / messaging platform (deferred; revisit only if brokers explicitly ask).

---

## 6. Tooling decision

### 6.1 What was ruled out and why

| Tool | Category | Verdict |
|---|---|---|
| Vikunja, Taiga, Huly, Focalboard | Project-management / task boards | ❌ Not CRMs — no lead/deal/pipeline model. (Focalboard effectively discontinued; Taiga's maintainer wound down.) |
| Mattermost | Team chat | ❌ For the channel: chat cannot match requests, close deals, or record splits. Free tier has **no SSO** (paid Professional). Deferred. |
| Zulip | Team chat | ❌ Same category limits as Mattermost (chat ≠ matching). Better than Mattermost on paper (Apache 2.0, free SSO, topic threading), but the channel is application data, not chat. Deferred. |
| Frappe CRM (as the broker CRM) | CRM | ⚠️ Strong generic pipeline, but multi-tenancy ("many brokers, each with login + team") is **not built-in** (custom `Broker` doctype + User Permissions, or N sites). Leave/salary needs **Frappe HR + ERPNext**, a separate stack (Python/MariaDB) from Architech (TS/PostgreSQL). |
| EspoCRM / SuiteCRM | CRM | ⚠️ PHP stacks; multi-tenancy is workaround-based. |

### 6.2 What was chosen and why

- **Adopt Twenty CRM** (`github.com/twentyhq/twenty`) for the broker suite — see §7.
- **Adopt Frappe bench later** (ERPNext + Frappe HR + India Compliance) when payroll/GST is needed — see §8.
- **Keep Architech** as the public listing site + lead capture + consent/masking authority.

### 6.3 Key evidence (verified Sep 2026)

- **Twenty** is TypeScript/React/NestJS/**PostgreSQL** (same stack family as Architech), has **native multi-workspace multi-tenancy** (`IS_MULTIWORKSPACE_ENABLED=true` → one isolated workspace per broker, own subdomain/users/team, zero code change), **custom objects at runtime** (no SQL migrations) with auto GraphQL/REST per object, free lead→deal pipeline + kanban + tasks + RBAC + webhooks. AGPL-3.0. No payroll engine; no mobile app.
- **Frappe CRM** data model: `CRM Lead`, `CRM Deal`, `CRM Contact`, `CRM Organization`, `CRM Task`, `Communication` — lead→deal pipeline, kanban, email, call logging. Roles + record-level User Permissions + Sales Hierarchy (v1.72.0) cover "broker + ≤20 employees" *within one org*. Multi-tenancy = one site per tenant; single-DB multi-tenancy is open issue `frappe/frappe#28019`. Auto REST API + webhooks.
- **Frappe HR** (leave, attendance, salary/payroll) is a **separate app requiring ERPNext**.
- **India Compliance** (`resilient-tech/india-compliance`): GST, e-Invoice IRN (direct NIC, no GSP), e-Way bill, GSTR-1/3B, 2A/2B — installs onto ERPNext when needed.
- **Shared database between Architech and Frappe is impossible**: Architech is PostgreSQL (Prisma); Frappe is MariaDB.

### 6.4 Decision log (why the answer evolved — read top to bottom)

1. **v1:** "Extend Architech's own lead inbox; only Frappe CRM is a real CRM on the list." *(grounded: PM tools aren't CRMs)*
2. **v2:** "Integrated stack = Architech + Frappe CRM + ERPNext + India Compliance; Mattermost plugin for chat." *(superseded: chat ≠ matching; Mattermost SSO is paid)*
3. **v3:** "Extend Architech (Option A), one app / three modules." *(superseded: user prioritizes adopt-don't-build and native per-broker isolation)*
4. **v4 (current):** "Adopt **Twenty** for the broker suite (native multi-workspace isolation, same TS stack); **Frappe bench later** for payroll/GST." *(current)*

The single gating input that can change v4: **team stack comfort** — if the team is decisively stronger in Python than TypeScript, build the broker suite as a **custom Frappe app** instead (framework, not the CRM product), and accept the multi-tenancy caveat.

---

## 7. Recommended architecture — Twenty-based

### 7.1 Component diagram

```
                    Architech (existing, public)          Twenty (new, broker suite)
                    ┌───────────────────────────┐         ┌──────────────────────────────┐
  Public users ───► │ Next.js 16 + Prisma       │         │ self-hosted, multi-workspace │
                    │ PostgreSQL                │         │ TypeScript/React/PostgreSQL  │
                    │ - listings, RERA, search  │         │ - per-broker workspace       │
                    │ - lead capture            │         │ - lead pipeline (built-in)   │
                    │ - consent + masking       │         │ - custom objects:            │
                    │   (Lead, Requirement)     │         │   Request, Match, Deal,      │
                    └─────────────┬─────────────┘         │   Employee, Leave, Salary    │
                                  │ one-way lead sync     └───────────────▲──────────────┘
                                  │ (webhook + outbox,                    │
                                  │  idempotent, masking-                 │
                                  │  aware)                               │ channel matching logic
                                  ▼                                      │ (small service, TBD
                              [sync worker] ──────────────────────────────┘  location)
```

### 7.2 System-of-record map

| Entity | System of record | Notes |
|---|---|---|
| Listing, RERA, media | Architech | public marketplace |
| Buyer requirement + consent + phone masking | **Architech** | the only place consent/masking decisions are made |
| Lead pipeline / deal / notes / team | **Twenty** | per-broker workspace |
| Channel buy/sell requests + matches + deal close + split | **Twenty** (custom objects) | structured data + matching logic |
| Employee leave / salary (simple) | **Twenty** (custom objects) | simple ledger, not payroll |
| Invoices / GST / payroll | **Frappe bench (later)** | when complexity arrives |

### 7.3 Data flows

1. **Lead capture:** buyer enquiry on Architech (listing/requirement form) → masked phone + consent stored in Architech.
2. **Lead sync (one-way):** Architech → Twenty. `MASKED` leads sync phone-less; `DIRECT_CONSENTED` sync with number. Idempotent webhook + outbox; Architech remains authoritative for consent/masking.
3. **Channel:** broker creates buy/sell request in Twenty → matching logic surfaces candidate matches → brokers negotiate broker-to-broker → close + record split in Twenty.
4. **Accounting:** commission recorded at deal close (employee or broker enters it); salaries entered by broker.
5. **Later (Frappe):** when payroll/GST needed → ERPNext + Frappe HR + India Compliance on one bench, fed from Twenty deals.

### 7.4 Lead sync contract *(PROPOSED — validate at implementation)*

**Direction:** Architech → Twenty, **one-way only** (lifecycle changes that must reflect on the public site, e.g. "contacted", are handled by reading Twenty back or are not needed in Phase 1 — validate which).

**Event types (Architech outbox):**

| Event | Payload (key fields) | Twenty action |
|---|---|---|
| `lead.created` | `eventId`, `leadId`, `organizationId`, `mode`, `name`, `phone?` (only if `DIRECT_CONSENTED`), `email?`, `city`, `locality`, `intent`, `budget`, `listingRef`, `consentText` | upsert `Lead` in the broker's workspace |
| `lead.consent.revoked` | `eventId`, `leadId` | null out contact fields in Twenty |
| `lead.deleted` / `requirement.purged` | `eventId`, `entityId`, `entityType` | hard-delete the corresponding Twenty record (DPDP erasure) |

**Rules:**
- **Idempotency:** consumer dedupes on `eventId`; Architech outbox is durable (Postgres table) and retries with backoff.
- **Masking:** Architech decides. `MASKED` ⇒ no phone/email in the payload. Twenty never stores a buyer phone that Architech didn't consent to share.
- **Reconciliation:** each Twenty record stores `architechLeadId` / `architechRequirementId` as a custom field for lookup.

### 7.5 Proposed Twenty data model *(PROPOSED — names/types illustrative, define via Twenty's Data Model UI/SDK)*

Per-broker workspace gets these **custom objects** (in addition to Twenty's built-in People/Companies/Opportunities, which hold the lead pipeline):

| Custom object | Fields (illustrative) | Purpose |
|---|---|---|
| `AreaAssignment` | `localitySlug`, `employeeRef`, `active` | locality → responsible employee (many localities per employee) |
| `ColdCallerSetting` | `enabled`, `employeeRef` | per-broker cold-calling switch (Mode A/B) |
| `ChannelRequest` | `type` (buy/sell), `localitySlug`, `intent`, `budgetMin/Max`, `bhk`, `propertyType`, `detailSummary`, `status` (open/matched/closed), `createdByBroker` | the published demand/supply |
| `Match` | `buyRequestRef`, `sellRequestRef`, `score`, `status` (suggested/accepted/rejected) | a buyer↔seller pairing |
| `Deal` | `matchRef`, `status`, `closeMode` (single/dual), `splitAgreement`, `commission` | a closed match with split |
| `Employee` | `name`, `brokerRef`, `role` (agent/cold-caller), `salary` | team roster |
| `Leave` | `employeeRef`, `from`, `to`, `type`, `status` | simple leave tracking |
| `SalaryLedger` | `employeeRef`, `month`, `amount`, `status` | simple salary record |

> Mapping note: Architech `Lead.mode/status` maps onto Twenty's Opportunity stages (`NEW→Contacted→Qualified→Negotiation→Closed Won/Lost`). Architech `Requirement` can seed a `ChannelRequest` (buy) **only if** the buyer consents to channel publication — validate this consent wording.

### 7.6 Channel matching heuristics *(PROPOSED — deterministic, transparent)*

Matching is **rules-based** (consistent with the project's "no black-box" rule). A match candidate between a buy request `B` and sell listing `S` scores by:

1. **Hard filters (must all pass):** same `localitySlug` (or same city if locality unspecified); `B.intent` = `S.availability/intent` (buy↔sell, rent↔rent); `B.bhk ≤ S.bhk` (or within tolerance); `S.priceInr ≤ B.budgetMax` (within tolerance %); category/property-type compatible.
2. **Scoring (rank, not decide):** budget-fit closeness → BHK match → locality precision → recency of request.
3. **Output:** ordered candidate list per request; brokers see **details only** (no phone). A human broker then contacts the other broker (broker-to-broker) — matching never auto-reveals end-customer identity.

The matching service location is **TBD** (options: a small Architech-side service reading the shared registry + Twenty requests via API, or a Twenty-side workflow). Recommend keeping it next to the location registry (Architech) since matching depends on `cities.ts`/`localities.ts`.

### 7.7 API contract sketch *(PROPOSED)*

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/broker-suite/sync/leads` | POST | Architech→Twenty lead sync (receives outbox events) |
| `/api/broker-suite/requests` | POST/GET | create/list channel requests |
| `/api/broker-suite/requests/:id/matches` | GET | list ranked candidate matches for a request |
| `/api/broker-suite/matches/:id/accept` | POST | broker accepts a match |
| `/api/broker-suite/deals/:id/close` | POST | close a deal (single/dual mode) + record split |
| `/api/broker-suite/ledger` | GET | per-broker commission/salary ledger |

> Auth: broker workspace-scoped; a broker sees only its own workspace (Twenty enforces). Buyer phone is **never** returned by any channel endpoint.

### 7.8 Why not extend Architech directly (this supersedes the earlier "extend this repo" recommendation)

- Extending Architech is viable (the `organizationId` columns already exist and the lead inbox works), but the user's priorities are **adopt-don't-build** and **native per-broker isolation**.
- Twenty provides multi-broker isolation **out of the box** and a free pipeline UI, on the **same TypeScript stack**, reducing custom build to: lead sync, channel matching, and simple HR/accounting custom objects.
- Architech still hosts the **public site** and stays the **consent/masking authority** — no buyer PII moves to Twenty beyond what consent allows.

---

## 8. When Frappe wins (later phase)

Adopt **ERPNext + Frappe HR + India Compliance** (one bench, one site, one MariaDB) when:
- real **payroll** is needed (salary structures, PF/ESI/TDS), and/or
- **GST accounting / e-invoicing / e-way bill** is needed.

This is a clean, deferred "adopt, don't build" — it doesn't block the current phase and slots in without re-architecting Twenty/Architech (deal data flows from Twenty into ERPNext when the time comes).

---

## 9. Phased plan

| Phase | Work | Custom code | Acceptance criteria |
|---|---|---|---|
| **P0 (now)** | Deploy Twenty (self-hosted, `IS_MULTIWORKSPACE_ENABLED=true`); one isolated workspace per broker | none | A broker logs in and sees an empty workspace only |
| **P1** | Architech → Twenty lead sync (outbox + idempotent consumer; masking/consent rules enforced in Architech) | low | A public enquiry appears as a Twenty lead in the right broker's workspace; phone absent when `MASKED` |
| **P2** | Channel: buy/sell request custom objects + matching + close/dual-close + split | medium | Two brokers can publish, get matches (details only), negotiate, close, and record a split |
| **P3** | Simple accounting: commission ledger + salary/leave custom objects | low-medium | Broker sees income (commissions) and expenses (salaries) per month; no GST |
| **P4 (later)** | Frappe bench (ERPNext + HR + India Compliance) when payroll/GST arrives | config + integration | Payroll + GST run on the Frappe bench, fed from Twenty deals |

---

## 10. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **AGPL-3.0** (Twenty, Frappe) | License obligation if code is modified and offered as a service to third parties | Fine for internal self-hosting; legal review only if white-labeling to external brokerages |
| **Twenty has no mobile app** | Brokers in the field use phones | Accept for now (web-responsive); revisit if field usage becomes critical |
| **Twenty SSO/row-permissions are paid tiers** | Extra cost if needed | Basic workspace isolation is free; SSO not required for Phase 1 (each broker has own workspace login) |
| **DPDP erasure across systems** | Legal exposure if buyer data lingers in Twenty after deletion request | `lead.deleted`/`requirement.purged` events → hard delete in Twenty (see §7.4) |
| **Two stores of buyer data** (Architech + Twenty) | Privacy/consistency | One-way sync only; masking enforced at source; no phone leaves Architech without consent |
| **Scope creep (chat, GST, payroll)** | Delays | Explicitly out of scope (§5.5); chat deferred, GST/payroll deferred to P4 |

---

## 11. Decisions already confirmed (no re-litigation)

1. Multi-tenant platform; ≤ 20 employees/broker. ✅
2. Area = locality; locality → one responsible employee; employee may own many localities. ✅
3. Cold-calling is **optional** (per-broker switch); handoff is a tracked transition. ✅
4. Lead lifecycle New → Contacted → Qualified → Negotiation → Closed (Won/Lost). ✅
5. Channel shows **details only**, never buyer/seller phone; brokers contact each other. ✅
6. Channel membership: open + invite; **no platform fee**. ✅
7. Commission split: negotiated per deal, recorded at **deal close** (entered by employee or broker). ✅
8. Channel close: broker can close own request; optional dual-close with notification to the other broker. ✅
9. Accounting is simple income/expense; **no GST/e-invoicing now**. ✅
10. Tooling: **Twenty now; Frappe bench later.** ✅ (pending the single stack-comfort confirmation in §12)

---

## 12. Open questions / next steps

1. **Team stack comfort (gating):** TypeScript (Twenty, matches Architech) vs Python (Frappe). Recommendation is **Twenty**. *(If Python is strongly preferred, switch the broker-suite plan to a custom Frappe app.)*
2. **Matching service location:** Architech-side (recommended, near the location registry) vs Twenty-side. TBD.
3. **Channel publication consent:** does publishing a buyer requirement to the channel need an extra consent checkbox beyond the existing lead consent? TBD (legal wording).
4. **Lifecycle read-back:** in Phase 1, does Architech need to read Twenty lead status back to the public site (e.g., for broker dashboard parity)? TBD.

**Next artifact to produce:** detailed technical design —
- Twenty workspace layout + exact custom-object field definitions,
- Architech outbox schema + `lead.*` event payloads + idempotent consumer,
- channel matching heuristics (final thresholds) + API contracts,
- migration/seed plan for existing `Lead`/`Requirement` rows.

---

## 13. References

| Repo | URL | License | Role |
|---|---|---|---|
| Architech | (this repo) | MIT | public site + lead capture + consent/masking |
| Twenty | https://github.com/twentyhq/twenty | AGPL-3.0 | broker CRM + channel + simple accounting (chosen) |
| ERPNext | https://github.com/frappe/erpnext | GPL-3.0 | accounting (later) |
| Frappe HR | https://github.com/frappe/hrms | GPL-3.0 | leave/payroll (later) |
| India Compliance | https://github.com/resilient-tech/india-compliance | GPL-3.0 | GST/e-invoice (later) |
| Frappe CRM | https://github.com/frappe/crm | AGPL-3.0 | considered, not chosen for broker CRM |
| Zulip | https://github.com/zulip/zulip | Apache-2.0 | chat — deferred |
| Mattermost | https://github.com/mattermost/mattermost | MIT/commercial | chat — deferred |
