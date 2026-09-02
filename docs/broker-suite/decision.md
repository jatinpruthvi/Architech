# Broker Suite — Requirements, Architecture & Tooling Decision

**Date:** 01 Sep 2026
**Status:** ✅ Requirements confirmed; tooling recommendation finalized (not yet implemented).
**Scope:** Everything decided across the CRM / channel / accounting / chat exploration, in one document. Supersedes the earlier scattered notes (`crm-tooling-decision.md`, `open-source-stack-integration.md`, `broker-suite-requirements.md`, `broker-suite-architecture-options.md`, `broker-suite-build-vs-adopt.md`).

---

## 1. TL;DR

1. Architech is a **multi-tenant platform serving many brokers**; each broker has its own login and a small team (≤ 20 employees).
2. Three capabilities are required: **Lead Management CRM**, **Brokers Channel** (cross-broker buy/sell matching), and **simple Accounting** (no GST filing / e-invoicing for now).
3. **Recommended approach: adopt Twenty CRM (self-hosted, TypeScript/PostgreSQL) for the broker CRM + channel + simple HR/accounting**, with a **one-way lead sync from Architech** (consent + phone-masking stay in Architech).
4. **Adopt Frappe (ERPNext + Frappe HR + India Compliance) later**, only when real payroll (PF/ESI/TDS) or GST accounting is needed.
5. Chat tools (Mattermost/Zulip) and project-management tools (Vikunja/Taiga/Huly/Focalboard) are **not part of the solution** for now.

---

## 2. Requirements (final, confirmed)

### 2.1 Actors

| Actor | Description |
|---|---|
| **Broker** (agency owner) | Runs a small team (≤ 20 employees). Manages employees, enters salaries, sees dashboards, does simple accounting. |
| **Agent / employee** | Works under a broker. Assigned to localities. Manages leads assigned to them. Can enter commission on their own deals. |
| **Cold caller** *(optional role)* | Where a broker enables it, a designated employee does first-touch qualification before handoff. Not every broker uses this. |
| **Buyer** | Wants to buy/rent (demand). |
| **Seller** | Wants to sell/rent out (supply). |
| **Other brokers** | Independent agencies cooperating through the shared channel. |

### 2.2 Platform nature (confirmed)

- **Multi-tenant platform serving many brokers.** Each broker sees only its own team, leads, areas, and accounting.
- **≤ 20 employees per broker.** Total broker count undecided — design for many small tenants.

### 2.3 Pillar 1 — Lead Management CRM

- **Area = locality level** (e.g., Thaltej). Architech's city → locality registry is the source of truth.
- A locality maps to one **responsible employee**; one employee can own many localities.
- **Lead routing — two modes (cold calling is OPTIONAL):**
  - **Mode A (direct):** lead → assigned immediately to the locality's owning employee.
  - **Mode B (cold caller):** lead → cold caller qualifies → a cold→hot lead is transferred to the locality's owner.
  - This is **per-broker configuration** (`cold-calling enabled? yes/no` + which employee is the cold caller).
- **Lead lifecycle:** New → Contacted → Qualified (Hot) → Negotiation → Closed (Won/Lost). Ownership + stage changes are auditable; the cold-caller handoff is a tracked transition.
- **Broker dashboard:** per-employee progress (leads, stages, conversions, closed deals), per-locality and per-employee views.
- **Employee management (nice-to-have):** leave tracking; salary records (salary entered by the broker).

### 2.4 Pillar 2 — Brokers Channel

- A network of independent brokers cooperating on deals.
- Both sides publishable: **Demand** (buyer requirement) and **Supply** (seller listing).
- **Matching:** surface candidate buyer ↔ seller matches across brokers. **Negotiation is between the two brokers, per deal.**
- **Privacy (critical):** buyer and seller **phone numbers are NEVER shown** in the channel — details only. Brokers **contact each other** to negotiate; the end-customer number is never exposed by the platform.
- **Membership & fees:** at launch the channel is **open + invite**; **no platform fee** on channel deals (monetization via the broker's plan/combo).
- **Commission split:** negotiated per deal (no fixed formula); recorded at **deal close**.
- **Closing a channel request:** a broker can **close its own request** unilaterally (a deal may close outside the channel). Optional **dual-close mode**: closing by one sends a notification to the other broker to also confirm.

### 2.5 Pillar 3 — Accounting (simple)

- Lightweight ledger per broker:
  - **Income:** commission per deal — entered by employee or broker, recorded at **deal close**.
  - **Expenses:** salaries (entered by broker) + other costs.
- **Out of scope for now:** GST return filing, e-invoicing (IRN), e-way bills, GSTR-1/3B, full payroll engine.

### 2.6 Explicit non-requirements (for now)

- GST filing, e-invoicing, e-way bill.
- Full HR/payroll engine.
- Buyer-facing surface (listings, RERA, search) is unchanged — owned by Architech.

---

## 3. Tooling decision (the journey, condensed)

### 3.1 What was ruled out and why

| Tool | Category | Verdict |
|---|---|---|
| Vikunja, Taiga, Huly, Focalboard | Project-management / task boards | ❌ Not CRMs — no lead/deal/pipeline model. (Focalboard effectively discontinued; Taiga's maintainer wound down.) |
| Mattermost | Team chat | ❌ For the channel: chat cannot match requests, close deals, or record splits. Free tier has **no SSO** (paid Professional). Deferred. |
| Zulip | Team chat | ❌ Same category limits as Mattermost (it's chat, not matching). Better than Mattermost on paper (Apache 2.0, free SSO, topic threading), but the channel is application data, not chat. Deferred. |
| Frappe CRM (as the broker CRM) | CRM | ⚠️ Strong generic pipeline, but multi-tenancy ("many brokers, each with login + team") is **not built-in** (custom `Broker` doctype + User Permissions, or N sites). Leave/salary needs **Frappe HR + ERPNext**, a separate stack (Python/MariaDB) from Architech (TS/PostgreSQL). |
| EspoCRM / SuiteCRM | CRM | ⚠️ PHP stacks; multi-tenancy is workaround-based. |

### 3.2 What was chosen and why

**Adopt Twenty CRM** (`github.com/twentyhq/twenty`) for the broker suite — see §4.

**Adopt Frappe bench later** (ERPNext + Frappe HR + India Compliance) when payroll/GST is needed — see §5.

**Keep Architech** as the public listing site + lead capture + consent/masking authority.

### 3.3 Key evidence (verified Sep 2026)

- **Twenty** is TypeScript/React/NestJS/**PostgreSQL** (same stack family as Architech), has **native multi-workspace multi-tenancy** (`IS_MULTIWORKSPACE_ENABLED=true` → one isolated workspace per broker, own subdomain/users/team, zero code change), **custom objects at runtime** (no SQL migrations) with auto GraphQL/REST per object, free lead→deal pipeline + kanban + tasks + RBAC + webhooks. AGPL-3.0. No payroll engine; no mobile app.
- **Frappe CRM** data model: `CRM Lead`, `CRM Deal`, `CRM Contact`, `CRM Organization`, `CRM Task`, `Communication` — lead→deal pipeline, kanban, email, call logging. Roles + record-level User Permissions + Sales Hierarchy (v1.72.0) cover "broker + ≤20 employees" *within one org*. Multi-tenancy = one site per tenant; single-DB multi-tenancy is open issue `frappe/frappe#28019`. Auto REST API + webhooks.
- **Frappe HR** (leave, attendance, salary/payroll) is a **separate app requiring ERPNext**.
- **India Compliance** (`resilient-tech/india-compliance`): GST, e-Invoice IRN (direct NIC, no GSP), e-Way bill, GSTR-1/3B, 2A/2B — installs onto ERPNext when needed.
- **Shared database between Architech and Frappe is impossible**: Architech is PostgreSQL (Prisma); Frappe is MariaDB.

---

## 4. Recommended architecture — Twenty-based

### 4.1 System-of-record map

| Entity | System of record | Notes |
|---|---|---|
| Listing, RERA, media | Architech | public marketplace |
| Buyer requirement + consent + phone masking | **Architech** | the only place consent/masking decisions are made |
| Lead pipeline / deal / notes / team | **Twenty** | per-broker workspace |
| Channel buy/sell requests + matches + deal close + split | **Twenty** (custom objects) | structured data + matching logic |
| Employee leave / salary (simple) | **Twenty** (custom objects) | simple ledger, not payroll |
| Invoices / GST / payroll | **Frappe bench (later)** | when complexity arrives |

### 4.2 Data flows

1. **Lead capture:** buyer enquiry on Architech (listing/requirement form) → masked phone + consent stored in Architech.
2. **Lead sync (one-way):** Architech → Twenty. `MASKED` leads sync phone-less; `DIRECT_CONSENTED` sync with number. Idempotent webhook + outbox; Architech remains authoritative for consent/masking.
3. **Channel:** broker creates buy/sell request in Twenty → matching logic (in the chosen stack, likely a small Architech or Twenty-side service) surfaces candidate matches → brokers negotiate broker-to-broker → close + record split in Twenty.
4. **Accounting:** commission recorded at deal close (employee or broker enters it); salaries entered by broker.
5. **Later (Frappe):** when payroll/GST needed → ERPNext + Frappe HR + India Compliance on one bench, fed from Twenty deals.

### 4.3 Why not extend Architech directly (this supersedes the earlier "extend this repo" recommendation)

- Extending Architech is viable (the `organizationId` columns already exist and the lead inbox works), but the user's priorities are **adopt-don't-build** and **native per-broker isolation**.
- Twenty provides multi-broker isolation **out of the box** and a free pipeline UI, on the **same TypeScript stack**, reducing custom build to: lead sync, channel matching, and simple HR/accounting custom objects.
- Architech still hosts the **public site** and stays the **consent/masking authority** — no buyer PII moves to Twenty beyond what consent allows.

---

## 5. When Frappe wins (later phase)

Adopt **ERPNext + Frappe HR + India Compliance** (one bench, one site, one MariaDB) when:
- real **payroll** is needed (salary structures, PF/ESI/TDS), and/or
- **GST accounting / e-invoicing / e-way bill** is needed.

This is a clean, deferred "adopt, don't build" — it doesn't block the current phase and slots in without re-architecting Twenty/Architech.

---

## 6. Phased plan

| Phase | Work | Custom code | Notes |
|---|---|---|---|
| **P0 (now)** | Deploy Twenty (self-hosted, multi-workspace enabled) | none | one isolated workspace per broker |
| **P1** | Architech → Twenty lead sync (outbox + idempotent consumer; masking/consent rules enforced in Architech) | low | one-way only |
| **P2** | Channel: buy/sell request custom objects + matching + close/dual-close + split | medium | the matching + deal logic is the core build |
| **P3** | Simple accounting: commission ledger + salary/leave custom objects | low-medium | no GST |
| **P4 (later)** | Frappe bench (ERPNext + HR + India Compliance) when payroll/GST arrives | config + integration | feeds from Twenty deals |

---

## 7. Open questions / next steps

1. **Team stack comfort:** TypeScript (Twenty, matches Architech) vs Python (Frappe). This is the single gating decision — recommendation is **Twenty**.
2. **Commission timing** confirmed as deal close. ✅
3. **Channel close semantics:** single-close by owner + optional dual-close notification. ✅ (recorded)
4. **Next artifact:** detailed technical design — Twenty workspace layout + custom objects (Request, Match, Deal, Employee, Leave, Salary), Architech→Twenty sync contract, channel matching heuristics, and API contracts.
