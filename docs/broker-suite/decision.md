# Broker / Business Suite — canonical v8 decision

**Date:** 02 Sep 2026
**Status:** Final v8 plan after end-to-end review; implementation not started
**Supersedes:** v7 Chatwoot architecture and all earlier CRM/tooling proposals

> **Current decision:** Chatwoot is removed. Customers use normal WhatsApp/phone. Employees use normal company-owned WhatsApp plus the installable Frappe CRM web app for lead assignment, calls, status and follow-up. ERPNext owns commercial/accounting/inventory records. Architech remains the real-estate public/vertical layer.

## 1. Product requirements

Three named capabilities remain mandatory:

1. **CRM** — capture, assign, qualify and track leads/deals, employee progress and next actions.
2. **Channel** — direct customer WhatsApp plus the Real Estate profile's privacy-preserving broker-to-broker demand/supply channel.
3. **Accounting** — quotations, invoices, payments, income/expense and ledger; optional inventory and India compliance for local companies.

Additional confirmed requirements:

- Multi-business product that can be sold beyond real estate.
- One unrelated business must not access another business's data.
- A specifically WhatsApp-consented lead triggers a near-immediate message from the selected company/broker-owned unofficial WhatsApp/Evolution account.
- WhatsApp and voice-call permissions are channel-specific. A WhatsApp opt-in alone does not silently authorize repeated sales calls; `do not call`, `STOP`, withdrawal and purpose expiry are enforced centrally.
- The initial message must not wait for an employee to open an app.
- Multiple company-owned WhatsApp accounts can be routed by area/employee.
- Personal employee WhatsApp accounts are not eligible.
- No mandatory vendor payment beyond self-hosting and existing company telecom/SIM/data: no per-seat, per-message, SaaS, AI-credit or support/add-on fee.
- Inventory, HR, manufacturing and India compliance are optional profiles.

## 2. Current component selection

| Responsibility | Selection | Authority |
|---|---|---|
| Public real-estate discovery and enquiry intake | Architech | Listings, locality registry, masked enquiry intake and public consent evidence |
| Generic lead/deal management | Frappe CRM `v1.83.0` line | Lead, Deal, Contact, Organization, owner, stage, call/note/task and next action |
| Accounting/selling/inventory | ERPNext v16 line | Customer, Item, Quotation, Order, Invoice, Payment, ledger, buying, stock and operations |
| Customer WhatsApp conversation | Normal WhatsApp app on company-controlled employee phone | Human message interface only |
| WhatsApp transport/control | Evolution API `2.3.7` / Baileys | Linked session, send/receive events and lifecycle only |
| Mobile calling | Frappe CRM PWA + owned `Call from SIM` action | Native dialer plus employee-confirmed call result |
| Integration | `business_suite_core` Frappe app + thin private gateway | Consent, routing, encrypted destination, outbox/inbox, idempotency, audit, suppression and reconciliation |
| Cross-broker channel | Architech Real Estate profile | Sanitized demand/supply publishing, matching, negotiation state and commissions |
| Tenant provisioning | Brand-neutral control plane | Site/release/provider mapping, feature profile, backup, restore, health and data export |

**Not selected:** Chatwoot, Twenty, a second generic CRM, paid telephony, official Meta as a mandatory path, managed automation or custom native mobile app.

## 3. Why Frappe CRM is the long-term CRM

ERPNext v16 still contains Lead/Opportunity management, assignment, status, follow-up and funnel reports. However, ERPNext's official current documentation says that built-in CRM is scheduled for removal in version 17 and recommends Frappe CRM for new implementations.

Use this lifecycle boundary:

```text
Frappe CRM
Lead → assignment → contact/qualification → Deal → stage/next action
                                                │
                                                ▼ same-site integration
ERPNext
Customer → Quotation → Sales Order → Invoice → Payment/Ledger
```

Frappe CRM owns pre-sale progress. ERPNext owns sellable items/pricing and commercial/finance records. A Deal creates/links the ERPNext Customer and Quotation through the tested same-site integration. Do not mirror active Lead/Opportunity status into the deprecated ERPNext CRM module.

## 4. Why Chatwoot is removed

The customer never required Chatwoot; the customer uses WhatsApp. Chatwoot was only a shared employee inbox. It adds another deployment, database, login, data copy, mapping/reconciliation path and upgrade surface.

The selected small-company model does not need that inbox:

```text
Area/locality → assigned employee → company-owned WhatsApp number
```

Evolution sends the immediate first message from that account. The employee continues in normal WhatsApp and records the outcome/next action in mobile Frappe CRM. A manager measures CRM progress, not chat-screen activity.

There is no Chatwoot deployment, API inbox, callback, mobile app, account mapping, message mirror or Chatwoot retention path in v8.

## 5. Mobile employee workflow

Frappe CRM is installable from the site's `/crm` route through Android Chrome or iOS Safari. It remains an online PWA; offline behavior is not promised.

The owned app provides **My Leads**:

- assigned to me;
- locality/area filters;
- new and untouched leads;
- follow-ups due/overdue;
- customer, requirement, stage and next action;
- in-app assignment badge and first-action SLA timer;
- **Open WhatsApp**, **Call from SIM**, **Add Note**, **Set Follow-up**, **Change Status**.

Frappe CRM's assignment notification and SLA records are the baseline. Optional Web Push may later send only a generic message such as “New lead assigned—open CRM”; it must contain no customer name, phone, requirement or message text and requires a separate browser/privacy test. It is not required for initial WhatsApp dispatch.

### 5.1 Calling

`Call from SIM` uses a normalized `tel:+91...` destination and opens the phone's native dialer. The employee confirms the call and chooses the company SIM when a dual-SIM phone prompts.

After returning to CRM, a result sheet asks:

- Connected — interested
- Connected — follow-up required
- Meeting/site visit scheduled
- No answer
- Busy/call later
- Not interested
- Wrong/invalid number

A browser cannot reliably know whether a normal cellular call connected, its exact duration or recording. The employee confirms the result. Do not request restricted Android/iOS call-log permissions and do not invent call evidence.

Only the assigned employee, configured backup and manager may reveal/call the operational number. Calls respect the business's configured hours, channel/purpose consent, do-not-call suppression and attempt limit; the platform never auto-dials.

The inspected Frappe CRM `v1.83.0` PWA has a manual `CRM Call Log`; its upstream automated call UI supports Twilio/Exotel. Those paid integrations are disabled. Direct SIM calling is an owned extension.

### 5.2 Progress model

Keep call result separate from pipeline stage:

```text
Lead: New → Contacted → Qualified
Deal: Qualification → Proposal/Quotation → Negotiation → Won / Lost
```

The Real Estate profile can show **Site Visit Scheduled** between Qualified and Proposal/Negotiation.

Rules:

| Outcome | Progress action | Required next action |
|---|---|---|
| No answer | Stage unchanged | Retry date/time |
| Busy | Stage unchanged | Follow-up date/time |
| Connected/interested | Contacted or Qualified | Note + next action |
| Site visit/meeting | Qualified / Visit Scheduled | Appointment |
| Not interested | Lost | Lost reason |
| Invalid number | Invalid/Lost + suppression | Reason and stop automation |

Managers see lead/deal Kanban, conversion, expected value, lost reasons, overdue follow-ups and employee/locality progress in Frappe CRM.

## 6. Area, employee and account routing

```text
Bopal lead  → Employee A → Company Number A
Naroda lead → Employee B → Company Number B
```

A locality mapping selects:

1. the Frappe CRM lead owner;
2. the eligible company-controlled Evolution account for first contact; and
3. optionally the cold caller before locality-owner handoff.

Every lead has exactly one active owner. Direct mode does not safely support several employees replying concurrently from one native WhatsApp account because the WhatsApp app cannot enforce CRM assignment. A shared number may be used only with one designated active responder per conversation.

Routing uses an explicit same-business fallback chain: primary area employee/account → configured backup employee/account → unassigned/admin queue. If no eligible connected account exists, hold and alert; never choose an arbitrary personal or cross-business number. If a backup sends the first message, it also becomes the active CRM owner unless an audited handoff follows.

A company must own/control the SIM and WhatsApp account even if an employee carries the device. Employee exit, lost/stolen phone or role removal must support CRM-session revocation, lead reassignment, WhatsApp linked-device removal, credential/session rotation and SIM/account recovery.

Reassigning a CRM lead does not silently change WhatsApp identity in an active conversation. Continue from the original company account or perform an explicit, audited handoff.

## 7. Immediate WhatsApp flow

```text
Architech/form/API
       │ commit Lead/intake + consent + encrypted destination + outbox
       ▼
High-priority worker
       │ resolve business + employee + eligible account
       ▼
Private gateway → Evolution /message/sendText → Customer WhatsApp
                                                  │
                                                  ▼ reply
                                Employee's normal company WhatsApp app
                                                  │
                                                  ▼
                                outcome/status/next action in Frappe CRM
```

Required rules:

1. Lead and outbox command commit atomically; provider calls happen after commit.
2. One lead/purpose/template gets at most one initial acknowledgement.
3. The destination is decrypted only by the worker; no raw contact in logs/idempotency.
4. Provider acceptance, delivery, read, failure and unknown remain separate.
5. Evolution events write a minimal CRM activity marker—direction, timestamp, account, provider ID/status and lead mapping—without copying message body/media by default. The employee records the useful business summary and next action.
6. Before launch, prove that API sends appear on the employee phone, customer replies appear there, employee native replies emit the expected provider event, and reconnect/replay does not duplicate CRM activity.
7. Text is the required baseline; lists/buttons are capability-gated with fallback.
8. Genuine Meta Flows remain outside the hosting-only baseline.
9. `STOP`, withdrawal, invalid number and account pause suppress further automation.
10. The linked-device path remains unofficial and can break or restrict the company number.
11. Measured target remains worker-start P95 ≤250 ms and Evolution acceptance ≤1 second under normal load—not customer-device delivery.

## 8. Architech real-estate boundary

Architech remains authoritative for:

- public listing/search/media and broker verification;
- city/locality registry and public enquiry source;
- masked requirement/listing intake and consent evidence;
- privacy-preserving cross-broker demand/supply channel;
- matching, negotiation state, deal close and commission split.

The broker channel must never publish customer phone, email, raw message, free-form identifying text or a reversible private source key. Brokers contact each other; customer identity is not exposed through channel records.

For operational CRM, Architech emits a purpose-minimized, idempotent lead event to the business's Frappe site. Frappe CRM owns employee assignment/progress after creation. Architech does not become the generic CRM for non-real-estate companies.

## 9. Existing Architech implementation gaps

Before automatic contact:

- Current `Lead` stores only `phoneMasked`; add purpose-scoped encrypted post-commit contact storage or an equivalent protected intake record.
- Replace raw-derived default idempotency material in `client/src/lib/leads/server.ts` with random/opaque or keyed material.
- Reuse the existing AES-256-GCM pattern in `client/src/lib/requirements.server.ts` with key versioning and purpose separation.
- Extend privacy purge/erasure across outbox, provider mappings, CRM projection and restore tombstones.
- Enforce organization isolation consistently and add negative two-business tests.

## 10. Tenant and deployment model

- One Frappe site/database per unrelated business.
- Install compatible pinned Frappe CRM, ERPNext and `business_suite_core` apps on the same business site.
- Standard tier may share a versioned Bench/application pool; shard by load/risk.
- Evolution instances map to the same business and company-owned number on private shards.
- Hard-isolation tier uses separate application/data infrastructure, credentials, logs and backups.
- No unrelated businesses as separate ERPNext `Company` records in one site.
- No cross-business provider fallback or unscoped external IDs.
- Operational phone access is limited to assigned employee/configured backup/manager; exports are separately permissioned and audited.
- Database volumes, exports and backups containing CRM contacts are encrypted, retention-limited and restore-tested.

Systems integrate through authenticated APIs/webhooks and durable idempotent processors—never cross-database writes.

## 11. Product profiles

| Profile | Modules |
|---|---|
| **Business Core** | Frappe CRM + direct WhatsApp/Evolution + mobile calling + ERPNext Selling/Accounting |
| **Trade & Distribution** | Business Core + Buying, Stock, warehouse, valuation and delivery |
| **Service & AMC** | Business Core + Project, Issue, visit, timesheet, asset, recurring invoice |
| **Retail** | Business Core + POS, barcode, inventory, pricing and loyalty |
| **Light Manufacturing** | Trade + BOM, work order, subcontracting, quality and costing |
| **Real Estate** | Business Core + Architech listing/locality/channel/matching/commission |
| **India Compliance** | Applicable profile + India Compliance reports/validations; paid API filing opt-in only |
| **HR** | Frappe HR only on customer demand |

## 12. Hosting-only and resale contract

Mandatory baseline has no vendor seat/message/API subscription:

- self-host Frappe, Frappe CRM, ERPNext, MariaDB and Redis/Valkey;
- self-host pinned Evolution, PostgreSQL and Redis;
- use existing company SIM/voice/data;
- no Chatwoot;
- no Twilio, Exotel, Frappe Cloud, Evolution Cloud, Meta billing, paid GSP, paid AI/voice/SMS/email SaaS or managed automation;
- self-host monitoring and encrypted backups.

Compute, storage, egress, domains, backups, maintenance, support and telecom are real costs. Sell implementation/hosting/support, not a fictional promise of zero operating cost.

License gates:

- Frappe Framework: MIT.
- Frappe CRM: AGPL-3.0; network/source obligations and branding need legal review.
- ERPNext/HR/India Compliance: GPL-3.0; distribution/source/trademark review required.
- Evolution `2.3.7`: additional administrator notice/logo conditions and GitHub `NOASSERTION`; legal approval before sold deployment.
- Pin immutable commit/image digests. Mutable tags and Evolution `2.4.x` real-number activation remain prohibited until exact-source license/security/behavior review.
- If strict OSI-only licensing is mandatory, use an owned pinned Baileys gateway behind the same adapter.

## 13. Delivery phases

1. Pin/test one same-site Frappe v16 + Frappe CRM main/v1 + ERPNext v16 + India Compliance candidate set; lock exact commits only after install, migration, CRM-to-ERP and rollback tests.
2. Build `business_suite_core` tenancy, channel-specific consent, encrypted contact, single-owner/fallback account routing, outbox/inbox, idempotency, suppression and audit.
3. Build My Leads PWA actions: assignment badge/SLA, Open WhatsApp, Call from SIM, post-call outcome, stage and mandatory next action.
4. Prove immediate Evolution send, native-phone synchronization, provider activity markers, reconnect/replay and reply on company-owned test accounts behind feature flags.
5. Prove Frappe CRM Deal → ERPNext Customer/Quotation → Invoice/Payment.
6. Add Architech event adapter, broker locality routing and real-estate channel/deal boundary.
7. Add provisioning, backup/restore, upgrade cohort, data export and two-business isolation tests.
8. Pilot one local business and one brokerage before broader sale.
9. Add inventory, manufacturing, HR and compliance only after profile-specific acceptance.

## 14. Production gates

- Two-business negative authorization tests pass.
- Mobile call flow works on Android, iPhone and dual-SIM scenarios without false call evidence.
- WhatsApp versus voice consent, do-not-call/`STOP`, attempt limits and working-hours rules pass negative tests.
- Single active owner, unavailable-account fallback, explicit handoff and no-cross-business fallback tests pass.
- Employee exit, lost phone, account recovery, session revocation and reassignment drill passes.
- Lead stages/outcomes/mandatory-next-action, assignment notification/SLA and manager reports are accepted by sales users and managers.
- Evolution API-send/native-phone/customer-reply/native-reply/reconnect event matrix passes without duplicate activity.
- Real-number Evolution license, risk, consent, canary and pause gates pass.
- No raw contact-derived idempotency/logging remains.
- CRM-to-ERP Customer/Quotation mapping is idempotent and financially reconciled.
- Accountant approves chart, taxes, opening balances and reports.
- Backup/full restore and upgrade/rollback are timed and verified.
- Optional paid Meta/GSP/telephony/AI services cannot activate silently.

## 15. Final improvement review

The final review added the improvements that increase value without adding another large system:

1. **Channel-specific consent:** WhatsApp and voice calling are independently controlled.
2. **Single active owner with safe fallback:** prevents two employees replying and prevents arbitrary-number routing.
3. **Minimal WhatsApp activity markers in CRM:** managers see contact/reply timing without storing a second full chat history.
4. **Mandatory next action + SLA:** every open lead has an owner, due action and escalation signal.
5. **Mobile-first SIM calling:** free of telephony API charges while remaining honest about manual outcomes.
6. **Company device/number lifecycle:** handles employee exit, lost phones and account recovery.
7. **Exact compatibility lock and staged upgrades:** protects the same-site Frappe CRM/ERPNext composition.
8. **One database per business and profile-based packaging:** makes the platform suitable for local-company sale.

Do **not** add offline editing, automatic call recording, shared-number multi-agent inbox, native mobile app, AI automation, paid telephony, official Meta/GSP billing or another analytics/helpdesk/CRM product before the core pilot proves a requirement. These are optional future decisions, not missing launch features.

## 16. Current planning documents

- Horizontal selection: [`../business-suite/modular-platform-selection.md`](../business-suite/modular-platform-selection.md)
- Mobile calling/status design: [`../business-suite/mobile-calling-lead-workflow.md`](../business-suite/mobile-calling-lead-workflow.md)
- Local-company productization: [`../business-suite/local-company-product-blueprint.md`](../business-suite/local-company-product-blueprint.md)
- Evolution source/risk evidence: [`evolution-api-adoption-assessment.md`](./evolution-api-adoption-assessment.md)
- Broader ecosystem evidence: [`open-source-ecosystem-evaluation.md`](./open-source-ecosystem-evaluation.md)

The older evidence documents contain historical Chatwoot analysis. Those sections are not selected architecture after v8; they remain only as evaluation history until separately condensed.
