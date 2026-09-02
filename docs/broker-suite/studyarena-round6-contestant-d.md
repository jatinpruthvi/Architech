# StudyArena

**Question:** as we decided  use both Server: https://github.com/chatwoot/chatwoot
Mobile app: https://github.com/chatwoot/chatwoot-mobile-app

then can can you please check how can we implement below requirement as well.

**Answered by** Contestant D · Round 6 · 02 Sept 2026

---

## Verdict: Chatwoot replaces the *mobile + conversation* layer — and it also makes Twenty redundant

Grounded on what the two repos actually give you (verified just now):

- `chatwoot-mobile-app` is **React Native + Expo, MIT**, published on both stores, requires **server ≥ 3.13.0**, iOS 13.4+, Android 6.0+.
- The server exposes **three API tiers**: *Application API* (agent/admin, per-account token), *Platform API* (**self-hosted only** — creates accounts/users/agent-bots), *Client API* (custom end-user surfaces). Endpoints that matter to you exist as first-class: **Teams, Conversation Assignments, Automation Rule, Custom Attributes, Labels, Contacts, Webhooks, Reports, Audit Logs**.

The brief in §6.2 picked Twenty largely for *native multi-workspace isolation on a TS stack*. Chatwoot gives you the same isolation (one **Account** per brokerage, agents scoped to the account) **plus** the mobile app Twenty explicitly lacks (§6.3: "no mobile app"). Running Architech + Twenty + Chatwoot means **three** stores of buyer contact data and three-way consent sync — that directly violates §2.4 ("consent + masking are load-bearing") and §12.2 #15.

**Revised recommendation, superseding §6.2 / §7:**

| Layer | System | Why |
|---|---|---|
| Public site, listings, RERA, lead capture, **consent + masking authority** | **Architech** (unchanged) | §2.4 |
| **Pillar 1 CRM** — locality routing, stages, dashboards, audit | **Architech** (extend the existing lead inbox) | It already owns `cities.ts`/`localities.ts`, `Lead`, `BrokerUser`, P1-LEAD-002 scoring |
| **Pillar 1 mobile + conversations** — inbox, push, assignment, notes, WhatsApp/email | **Chatwoot** | The whole reason it's in the stack |
| **Pillar 2 Channel** — requests, matching, deal close, split | **Architech** (custom, unavoidable) | Chatwoot has no matching/deal/split model |
| **Pillar 3 Accounting** — commission, salary, leave | **Architech** (simple ledger) | 3 tables; not worth a second platform |
| Payroll / GST | **Frappe bench, later** | §8 unchanged |

**Twenty: drop it.** Everything it was chosen for is now covered, and its custom-object layer would have held data Architech must own anyway for DPDP erasure.

---

## Requirement-by-requirement implementation (§5)

### 5.2 Pillar 1 — Lead Management CRM

**Area = locality → responsible employee.** Chatwoot's auto-assignment is round-robin and knows nothing about Ahmedabad localities. So **Architech decides the assignee, Chatwoot executes it.** Order of operations on a new enquiry:

```
Buyer submits enquiry
  → Architech creates Lead (masked phone, consentText)   ← SoR
  → Architech resolves locality → AreaAssignment → employee
  → Architech resolves ColdCallerSetting (Mode A or B)
  → outbox event  chatwoot.conversation.create
  → worker: POST /api/v1/accounts/{acct}/contacts        (masking-aware payload)
            POST /api/v1/accounts/{acct}/conversations
            POST .../conversations/{id}/assignments  { assignee_id }
  → broker's phone rings via Chatwoot push
```

Map `BrokerUser` → Chatwoot agent (`user_id`), and **locality → Chatwoot Team** so you get a "Thaltej" team view on mobile for free. Teams are managed via the Teams API; membership mirrors `AreaAssignment`.

**Cold-calling switch (Mode A / Mode B).** Both modes are just *which agent id goes into the first assignment call*:

- Mode A: `assignee_id = localityOwner.chatwootUserId`
- Mode B: `assignee_id = coldCaller.chatwootUserId`, and label `stage-new` + `pending-handoff`

The **handoff** is the tracked transition §5.2 requires: cold caller taps *Qualified* on mobile (adds label `stage-qualified`), Chatwoot fires `conversation_updated` → your webhook → Architech writes a `LeadStageTransition` row (`from`, `to`, `byUserId`, `at`) **and** calls the Assignments API to move the conversation to the locality owner. The audit trail lives in Architech, where §2.4 wants it.

**Lead lifecycle.** Keep the enum in Architech; mirror to Chatwoot as labels for mobile ergonomics. As I flagged before, labels alone can't hold stage history, value, or lost reason.

```prisma
enum DealStage { NEW CONTACTED QUALIFIED NEGOTIATION CLOSED_WON CLOSED_LOST }

model LeadStageTransition {
  id        String    @id @default(cuid())
  leadId    String
  from      DealStage?
  to        DealStage
  byUserId  String?
  source    String    // "chatwoot_webhook" | "architech_ui" | "system"
  at        DateTime  @default(now())
  @@index([leadId, at])
}
```

Label ↔ enum map: `stage-new, stage-contacted, stage-qualified, stage-negotiation, stage-won, stage-lost`. Write the label set with an **Automation Rule** per account so agents can't invent stages.

**Broker dashboard (per-employee progress).** Build it in Architech from `Lead` + `LeadStageTransition` — you own the data, so per-locality and per-employee conversion is a plain SQL group-by. Chatwoot's Reports API gives you response-time/first-reply SLA as a *bonus* metric, not the pipeline.

**Leave + salary (nice-to-have).** Three Architech tables (below). No Chatwoot involvement.

### 5.3 Pillar 2 — Brokers Channel

Chatwoot cannot model this. Build it in Architech — matching must sit next to the locality registry anyway (§7.6 already recommended this, and dropping Twenty resolves §12.1 #2: **matching lives in Architech**).

The §7.6 heuristic carries over unchanged: hard filters (locality/city, intent, `B.bhk ≤ S.bhk ± tol`, `S.priceInr ≤ B.budgetMax ± tol%`, type compatible) → rank by budget-fit, BHK, locality precision, recency.

**The out-of-the-box part — how the channel reaches the phone without an Expo build.** Create a **second inbox per broker account of type "API"** called *Broker Channel*. When Architech's matcher produces a new candidate match, it posts a conversation into that inbox:

```http
POST /api/v1/accounts/{acct}/conversations
{ "inbox_id": {channelInboxId}, "contact_id": {counterpartyBrokerContactId},
  "custom_attributes": { "match_id": "m_9f2", "score": 0.84 } }
```

Message body (details only — **never** a buyer/seller phone, per §5.3 and decision #5):

> **New channel match — 91% budget fit**
> Demand: 3 BHK, Thaltej, ₹1.05–1.20 Cr
> Supply: AT-1048 · 3 BHK · 1,540 sqft · ₹1.12 Cr
> Counterparty: **Skyline Realty** (verified)
> Open → https://app.architech.in/broker/matches/m_9f2

The broker gets a **push notification on the official Chatwoot app**, and broker-to-bro
