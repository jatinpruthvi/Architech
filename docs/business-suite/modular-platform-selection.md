# Modular Business Suite — current platform selection

**Date:** 02 Sep 2026
**Status:** Final v8 selection after end-to-end review; implementation and real-number activation not started
**Scope:** A reusable, self-hosted suite for real-estate brokerages and other local companies with CRM, direct company-owned WhatsApp, mobile calling, accounting and optional inventory/operations modules.

> Chatwoot was removed from the implementation by product decision on 02 Sep 2026. Employees use the company's normal WhatsApp app for conversations and the installable Frappe CRM web app for lead progress. The detailed mobile flow is in [`mobile-calling-lead-workflow.md`](./mobile-calling-lead-workflow.md).

## 1. Current selection

| Layer | Selection | Authority/responsibility |
|---|---|---|
| Business framework and tenancy | **Frappe Framework v16 line** | Site-per-business database, users/roles, forms, APIs, jobs, workflows and reports |
| Lead management | **Frappe CRM `v1.83.0` line** | Lead, Deal, Contact, Organization, assignment, stage, note, task, call log and pipeline authority |
| Accounting and commercial transactions | **ERPNext v16 line** | Customer, Item, Quotation, Sales Order, Invoice, Payment, ledger, purchase and financial reports |
| Inventory, optional | **ERPNext Stock/Buying** | Warehouse, stock ledger/valuation, buying, delivery, batches/serials and reconciliation |
| Employee customer conversation | **Normal WhatsApp app on a company-controlled number** | Human conversation UI on the employee's phone; not the CRM authority |
| WhatsApp transport/control | **Pinned self-hosted Evolution API `2.3.7` / Baileys** | QR/pairing, immediate first message, incoming/outgoing events and account lifecycle |
| Mobile calling | **Frappe CRM PWA + owned `Call from SIM` action** | Opens the native dialer; employee confirms call outcome and next action in CRM |
| Owned integration | **`business_suite_core` Frappe app plus thin private gateway** | Consent, encrypted destination, area/employee/account routing, outbox, idempotency, audit, suppression, reconciliation and erasure |
| Real-estate vertical | **Architech connector/module** | Listing discovery, locality routing, masked enquiry intake, broker channel, matching and commissions |
| India compliance, optional | **India Compliance** | India tax fields/reports/validations; paid GSP/API operations remain disabled by default |
| HR/payroll, optional | **Frappe HR** | Employee/leave/payroll only where required |

The three main requirements remain clear:

- **CRM:** Frappe CRM owns lead assignment and progress.
- **Channel:** Evolution plus company-owned WhatsApp handles customer conversation; Architech adds the broker-to-broker channel only for Real Estate.
- **Accounting:** ERPNext owns quotations onward, invoices, payments and ledger.
- **Optional inventory:** ERPNext Stock is enabled only for companies that need it.

## 2. Why Frappe CRM rather than ERPNext's older CRM

ERPNext v16 currently has Lead, Opportunity, assignment, follow-up, status and pipeline reports. However, ERPNext's current official documentation says its built-in CRM is scheduled for removal in version 17 and recommends Frappe CRM for new implementations.

Therefore a new sellable product should not build long-lived mobile customization on the deprecated ERPNext CRM workspace. Use a clean lifecycle boundary instead:

```text
Frappe CRM: Lead → Deal → progress/next action
                         │
                         ▼ official same-site integration
ERPNext: Customer → Quotation → Order → Invoice → Payment/Ledger
```

Frappe CRM's official ERPNext integration can create/link Customers and Quotations from a Deal and keeps CRM Product linked to ERPNext Item with ERPNext as the item/pricing source. This is a supported transition boundary rather than two active CRM authorities.

## 3. Why Chatwoot is no longer required

The customer always used WhatsApp, not Chatwoot. Chatwoot provided a shared staff inbox, but it added another deployment, database, login, mapping layer and operational burden.

For the selected small-company workflow:

- an area maps to one employee and one eligible company-controlled WhatsApp account;
- Evolution sends the first message from that account immediately after the consented lead commit;
- the employee continues in the normal WhatsApp app;
- the employee records outcome, status and follow-up in Frappe CRM mobile;
- managers monitor CRM progress rather than reading every chat.

This is simpler and keeps the hosting-only requirement. A future shared inbox would be a separately approved requirement, not a hidden dependency.

## 4. Mobile employee workflow

```text
Assigned lead on Frappe CRM mobile
        ├── Open WhatsApp ─► normal company WhatsApp conversation
        ├── Call from SIM ─► native phone dialer
        └── Log result ─────► outcome + note + stage + next follow-up
```

Frappe CRM is installable from `/crm` in Android Chrome and iOS Safari. The inspected `v1.83.0` source provides a PWA and manual call-log model. Its upstream automated call UI supports Twilio/Exotel; those paid integrations are not selected. `business_suite_core` adds the standard `tel:` action and a post-return result sheet.

A web app cannot reliably read a normal cellular call's connection, duration or recording. The employee must confirm the result. Do not request restricted device call-log permissions or claim automatic evidence.

Recommended progress model:

```text
Lead: New → Contacted → Qualified
Deal: Qualification → Proposal/Quotation → Negotiation → Won/Lost
```

Keep **call outcome** separate: Connected/Interested, Follow-up, Visit Scheduled, No Answer, Busy, Not Interested or Invalid Number.

## 5. Area/account routing

```text
Bopal lead  → Employee A → Company Number A
Naroda lead → Employee B → Company Number B
```

The company must own/control every routable number and SIM. An employee may carry the phone, but a personal account that leaves with the employee is not eligible.

Lead assignment chooses both the single active Frappe CRM owner and the WhatsApp account for first contact. Use only a configured same-business fallback (primary → backup → admin queue); if no eligible account is connected, hold and alert. Native WhatsApp cannot enforce multi-agent ownership, so only the active owner replies. Reassignment does not silently switch the number in the middle of a thread; use an explicit handoff.

## 6. Product profiles

| Profile | Included modules |
|---|---|
| **Business Core** | Frappe CRM + direct WhatsApp/Evolution + mobile calling + ERPNext Accounting/Selling |
| **Trade & Distribution** | Business Core + Buying, Items, warehouses, stock valuation and delivery |
| **Service & AMC** | Business Core + Projects, Issues, visits, timesheets, assets and recurring invoices |
| **Retail** | Business Core + POS, barcode, stock, pricing and loyalty |
| **Light Manufacturing** | Trade + BOM, work orders, subcontracting, quality and production costing |
| **Real Estate** | Business Core + Architech listing, locality, broker channel, deals and commissions |
| **India Compliance** | Applicable profiles + India Compliance; external paid filing APIs remain opt-in |

Use fixtures, roles, workspaces, print formats and feature flags. Do not fork upstream or create customer-specific code for ordinary configuration.

## 7. Tenant/deployment model

- One Frappe site/database per unrelated customer business.
- Frappe CRM, ERPNext and `business_suite_core` run on that site's pinned compatible app set.
- Shared versioned Bench/application pools are acceptable for the standard tier, then shard by scale/risk.
- Evolution instances map explicitly to the same business and company-owned number.
- The control plane maps `business/site → release pool → Evolution shard/instance`.
- A hard-isolation tier receives separate application/data infrastructure and credentials.

Never model unrelated customers as different ERPNext `Company` records in one site, and never use cross-business WhatsApp fallback.

## 8. Immediate message and reply flow

```text
Architech/form/API
       │
       ▼
Frappe CRM Lead + consent + owner + durable outbox
       │ after commit
       ▼
Private gateway ─► Evolution ─► customer's WhatsApp
                         ▲               │
                         │               │ reply
                         └── employee's normal company WhatsApp app

Employee updates call/message outcome and next action in Frappe CRM mobile.
```

Rules:

1. The first WhatsApp-consented message does not wait for an employee to open any app; voice-call permission is tracked separately.
2. One lead/purpose/template creates at most one acknowledgement.
3. Provider acceptance, delivery, read, failure and unknown remain distinct states.
4. Incoming/outgoing provider events add only a minimal CRM activity marker by default; Frappe CRM remains the progress authority.
5. `STOP`, do-not-call, invalid number and consent withdrawal suppress the relevant channel.
6. API-send/native-phone/customer-reply/native-reply/reconnect behavior must pass an exact-version test matrix.
7. Existing latency target remains measured worker start P95 ≤250 ms and Evolution acceptance ≤1 second under normal load—not customer-device delivery.

## 9. Hosting-only commercial contract

Mandatory baseline:

- self-host Frappe, Frappe CRM, ERPNext, MariaDB and Redis/Valkey;
- self-host pinned Evolution, PostgreSQL and Redis;
- use existing company-owned SIM/voice/data plans;
- no Chatwoot deployment;
- no Frappe Cloud, Evolution Cloud, Twilio, Exotel, Meta Cloud billing, GSP filing API, paid AI, voice/SMS/email SaaS, managed automation or app-store dependency;
- use self-hosted monitoring and encrypted backups.

Hosting, domain, storage, backup, maintenance, existing SIM/voice/data and number-loss interruption remain real costs. “Free” means no mandatory vendor software/seat/message fee, not zero operation cost.

## 10. License/resale qualification

| Component | License posture | Action |
|---|---|---|
| Frappe Framework | MIT | Preserve notice |
| Frappe CRM | AGPL-3.0 | Source/network-copyleft and branding review for sold hosting; keep custom integration separable |
| ERPNext | GPL-3.0 | Distribution/source and trademark review; do not imply Frappe endorsement |
| Frappe HR / India Compliance | GPL-3.0 | Optional app and external-API review |
| Evolution `2.3.7` | Additional logo/administrator usage-notification conditions; GitHub `NOASSERTION` | Required notice, Manager disabled and legal approval before selling |

If standard OSI-only licensing is mandatory, replace Evolution behind the same adapter with a pinned direct Baileys gateway. This removes Evolution's custom condition but adds session, lifecycle and maintenance engineering.

## 11. Delivery order

1. Prove a compatible same-site Frappe CRM + ERPNext + India Compliance candidate set.
2. Implement `business_suite_core` consent, area/account mapping, durable outbox/inbox and Evolution adapter.
3. Implement mobile My Leads, Open WhatsApp, Call from SIM and post-call result.
4. Configure stages, outcome rules, required next action and manager dashboards.
5. Prove Deal → ERPNext Customer/Quotation → Invoice/Payment.
6. Add provisioning, backups/restores, upgrade cohorts and two-business isolation tests.
7. Pilot one trader/service company and one real-estate brokerage.
8. Add inventory/manufacturing/HR only after profile acceptance.

## 12. Source snapshot

| Project | Snapshot observed 02 Sep 2026 | Commit | License |
|---|---|---|---|
| Frappe Framework | `v16.33.0` | `33bf510b17afcaaa857ed38b921d8e9e50dcd232` | MIT |
| Frappe CRM | `v1.83.0` | `52c500d6bdac3cd51553f95cfae9c7a940d99f1a` | AGPL-3.0 |
| ERPNext | `v16.34.1` | `0b50853985312bc64977f9324c55b5d8c1ab2e59` | GPL-3.0 |
| Frappe HR | `v16.17.1` | `e1481b5cd038657d82357d91a2d81cc84c707016` | GPL-3.0 |
| India Compliance | `v16.9.0` | `071b544ac4440636e643fc383ed67a116a276691` | GPL-3.0 |
| Evolution API | `2.3.7` | `cd800f2976e1e5b682fbf86a01ee4d85ae61f370` | Custom additional conditions; legal gate |

The pilot must produce one mutually compatible lock set; independent `latest` tags are not production approval.

### Primary references

- [Frappe CRM introduction](https://docs.frappe.io/crm/introduction), [mobile installation](https://docs.frappe.io/crm/mobile-app-installation), [Call Log](https://docs.frappe.io/crm/call-log), and [ERPNext integration](https://docs.frappe.io/crm/erpnext)
- [ERPNext CRM v17 removal notice](https://docs.frappe.io/erpnext/CRM#important-erpnext-crm-is-scheduled-for-removal)
- [Frappe site-per-database tenancy](https://docs.frappe.io/framework/user/en/basics/sites)
- [ERPNext repository](https://github.com/frappe/erpnext) and [India Compliance](https://docs.frappe.io/erpnext/india-compliance-app)
- Detailed mobile design: [`mobile-calling-lead-workflow.md`](./mobile-calling-lead-workflow.md)
- Existing transport evidence: [`../broker-suite/evolution-api-adoption-assessment.md`](../broker-suite/evolution-api-adoption-assessment.md)
