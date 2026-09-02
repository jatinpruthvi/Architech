# StudyArena

**Question:** as we decided  use both Server: https://github.com/chatwoot/chatwoot
Mobile app: https://github.com/chatwoot/chatwoot-mobile-app

then can can you please check how can we implement below requirement as well.

**Answered by** Contestant A · Round 6 · 02 Sept 2026

---

## Short answer

Yes — the requirements can be implemented, but **Chatwoot alone cannot**. The correct split, consistent with your Broker Suite doc:

- **Twenty** = system of record: pipeline stages, routing rules, channel requests, matches, deals, splits, accounting, HR (unchanged from your doc).
- **Chatwoot Server** = the conversation/notification layer + the **broker's mobile client**.
- **Architech** = public site, lead capture, consent/masking authority (unchanged).

Chatwoot replaces two things in your doc: the "notification mechanism (TBD)" in §12.2 #9 and the broker mobile experience. It does **not** replace Twenty's custom objects or the matching service.

---

## Updated component diagram

```text
 Architech (public)                Twenty (broker data)              Chatwoot (conversations)
 ┌───────────────────────┐        ┌──────────────────────────┐      ┌───────────────────────┐
 │ listings, search      │        │ per-broker workspace     │      │ per-broker account    │
 │ lead capture          │──sync─▶│ Lead pipeline (Opps)     │─────▶│ contact+conversation  │
 │ consent + masking     │        │ AreaAssignment           │ link │ teams, assignment     │
 │ location registry     │        │ ColdCallerSetting        │      │ labels, notes         │
 │ matching service      │◀───────│ ChannelRequest/Match/Deal│      │ WhatsApp/email inbox  │
 └──────────┬────────────┘        │ Employee/Leave/Salary    │      └──────────┬────────────┘
            │                     │ CommissionEntry          │                 │
            │  events (outbox)    └──────────────────────────┘        mobile push
            ▼                                                             ▼
     [sync worker]                                            Official Chatwoot app
                                                              (broker's phone)
```

---

## Requirement-by-requirement implementation (mapping your §5)

### §5.2 Pillar 1 — Lead Management CRM

| Requirement | Implemented in | How |
|---|---|---|
| Lead capture, consent, masking | **Architech** | Unchanged. Chatwoot receives **only** what consent allows: `MASKED` → contact created with name `"Buyer AT-1048"`, **no phone/email**; `DIRECT_CONSENTED` → real phone synced. |
| Pipeline New→Contacted→Qualified→Negotiation→Closed | **Twenty** | Opportunity stages, as per doc. Chatwoot's open/pending/resolved status is **not** your pipeline — don't conflate them. |
| Area = locality → owning employee | **Twenty** (`AreaAssignment`) + **Chatwoot** (Teams) | Create one Chatwoot **Team per locality owner** (or per locality group). Architech's routing logic (which reads `cities.ts`/`localities.ts`) resolves the locality → employee → sets the conversation's `team_id`/`assignee_id` via Chatwoot API at creation time. Twenty `AreaAssignment` stays the source of truth. |
| Mode A (direct) | Routing worker | Conversation auto-assigned to the locality owner's Chatwoot agent ID. |
| Mode B (cold caller) | Chatwoot Team "Cold Callers" | Conversation assigned to cold-caller team first. **Handoff = Chatwoot reassignment** (cold-caller team → locality owner's team). Chatwoot logs every assignment change (audit), satisfying "tracked transition". "Hot" decision stays **manual** per your §12.2 #5; the cold caller also moves the Twenty stage to `Qualified` (or a webhook from a Chatwoot label like `hot` → Twenty stage update — pick one direction to avoid two-way sync drift; recommend: label in Chatwoot → webhook → Twenty). |
| Lead-assigned notifications (§12.2 #9 — was TBD) | **Chatwoot** | Solved for free: assignment → mobile push + in-app notification on the official app. Email via Resend remains optional. |
| Broker dashboard (per-employee conversions, stages) | **Twenty** | Chatwoot reports conversation metrics, not pipeline conversions. Build dashboards on Twenty data. |
| Unassigned locality fallback (§12.2 #6) | Routing worker | No `AreaAssignment` match → assign to a Chatwoot "Unassigned" team containing the broker admin → push notification prompts assignment. |
| Employee exit / reassignment (§12.2 #7) | Chatwoot + Twenty | Chatwoot has bulk reassign of an agent's conversations; Twenty `AreaAssignment` updated so new leads follow. |

### §5.3 Pillar 2 — Brokers Channel

**Important limitation:** Chatwoot accounts are isolated — it has **no native cross-account (broker↔broker) messaging**. Your doc also defers agent-to-agent chat (§5.5). So:

| Requirement | Implemented in | How |
|---|---|---|
| Publish demand/supply requests, matching, scoring | **Twenty + Architech matching service** | Unchanged from §7.5/§7.6. Chatwoot is not involved in matching. |
| End-customer phone never shown | **Architech/Twenty** | Channel endpoints never return phone (unchanged). |
| Broker↔broker negotiation | **Broker business phone/WhatsApp**, not Chatwoot | When a match is accepted, show the **other broker's business contact** (agency phone — not the end customer's). Phase 1: tap-to-call/`wa.me` link from the Twenty match screen. |
| Deal close + split recording | **Twenty** | Unchanged. |
| **Dual-close notification** (§12.2 #10 — was TBD) | **Chatwoot** | When broker A closes, your deal service calls the Chatwoot API on **broker B's account**: create/find a conversation in a dedicated "Channel Deals" inbox and post an incoming-style message: *"Deal AT-2211 (buy ↔ sell, Thaltej) was closed by [Agency A]. Please confirm."* → B gets a mobile push. B confirms in Twenty; timeout reminders = follow-up messages in the same thread. |

This is the one place Chatwoot adds real value to the channel: it turns every "notification TBD" in your doc into a delivered mobile push.

### §5.4 Pillar 3 — Accounting

**Entirely Twenty** (`CommissionEntry`, `SalaryLedger`, `Employee`, `Leave`). Chatwoot has no role here.

### Mobile requirement (the reason we're here)

Brokers install the **official Chatwoot app** and log into their brokerage's Chatwoot account. They get: new-lead push → open conversation → call/WhatsApp buttons (for consented leads) → notes → handoff. For pipeline/data screens (kanban, matches, ledger), they open **Twenty's responsive web UI** via deep links embedded in the conversation's custom attributes (`architech_url`, `twenty_opportunity_url`). No forked mobile app, no Expo, no app-store work.

---

## Updated system-of-record map (supersedes §7.2 by adding one column)

| Entity | System of record |
|---|---|
| Listing, RERA, consent, masking, location registry | Architech |
| Pipeline stages, AreaAssignment, ColdCallerSetting, ChannelRequest, Match, Deal, split, Employee/Leave/Salary, CommissionEntry | Twenty |
| Conversations, messages, agent assignment state, notification delivery | Chatwoot |
| GST/payroll | Frappe bench (later, unchanged) |

**Linking rule:** every Twenty Opportunity stores `chatwootConversationId`; every Chatwoot conversation stores `architech_lead_id` + `twenty_opportunity_id` in custom attributes. That single bidirectional reference is the entire Twenty↔Chatwoot coupling — keep it that thin.

---

## Integration contracts

**Architech → both (existing outbox pattern from §7.4, add Chatwoot as a second consumer):**

| Event | Twenty action | Chatwoot action |
|---|---|---|
| `lead.created` | upsert Opportunity | create contact (masking-aware) + conversation in broker's inbox, assign per routing rules |
| `lead.consent.revoked` | null contact fields | update contact — remove phone/email |
| `lead.deleted` / `requirement.purged` | hard delete | delete contact + conversation (DPDP — **critical: Chatwoot is a new buyer-data store, it must be in your purge scripts**) |

**Chatwoot → Architech/Twenty (webhooks, signature-verified):** `conversation_updated` (label `hot` → Twenty stage), `message_created` (optional activity mirror — skip in Phase 1).

**Deal service → Chatwoot (server-side API):** dual-close prompts, unassigned-lead alerts, match-accepted alerts.

---

## Watch-list (the things that will bite you)

1. **DPDP erasure:** `Requirement.phoneCiphertext` purge must now also delete the Chatwoot contact. Add Chatwoot to `scripts/privacy/purge-expired-requirements.mjs` before go-live.
2. **One sync direction per field.** Chatwoot label → Twenty stage for "hot"; Twenty → Chatwoot for everything else. Two-way sync of the same field is how CRM integrations rot.
3. **Tenancy mapping:** one Chatwoot **account** per broker, mirroring one Twenty **workspace** per broker. Provision both in the same broker-onboarding flow (§12.2 #3).
4. **Masked leads in Chatwoot:** never create a Chatwoot contact with a real identifier for `MASKED` leads, and train brokers that "Call" only exists for consented leads — the button simply won't be there otherwise.
5. **Effort delta vs your doc's plan:** add ~5–8 dev-days on top of the Twenty plan (deploy, account provisioning, conversation creation in the sync worker, dual-close messaging, purge integration, tenancy testing). Still far cheaper than Expo (~15–25 days) and it ships with maintained iOS/Android apps.

**Next artifact:** extend your §13 technical design with three additions — (a) Chatwoot account/team provisioning spec per broker, (b) the Chatwoot consumer in the outbox worker (masking rules + assignment logic), (c) the dual-close notification flow. Everything else in your doc stands.
