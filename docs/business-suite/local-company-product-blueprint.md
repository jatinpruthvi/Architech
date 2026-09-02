# Local Company Business Suite — advanced, simple, hosting-only blueprint

**Date:** 02 Sep 2026
**Status:** Recommended product blueprint; no implementation or paid service authorized
**Depends on:** [`modular-platform-selection.md`](./modular-platform-selection.md)
**Goal:** Turn the selected Frappe CRM + ERPNext + self-hosted WhatsApp composition into a useful mobile-first product for local Indian businesses without creating overlapping apps or mandatory vendor fees.

## 1. Simple answer

The more valuable setup is **not more software**. It is one reliable flow from enquiry to money, with optional operations modules:

```text
Customer enquiry / existing business data
                    │
                    ▼
       Frappe site for that company
 Frappe CRM Lead → Deal → ERPNext quotation
                    → order → invoice → payment
                    │
       ┌────────────┴─────────────┐
       ▼                          ▼
Employee mobile CRM        Optional operations
Call / status / task       purchase / inventory /
       │                   POS / project / service /
       ▼                   manufacturing / HR
Evolution/Baileys
       │
       ▼
Company-owned WhatsApp app
```

The product should have four clear boundaries:

1. **Frappe CRM is the lead/deal authority** for assignment, progress, calls, notes and next actions.
2. **ERPNext is the commercial/finance authority** from Customer/Quotation onward, plus accounting, inventory and operations.
3. **Evolution `2.3.7` is the initially reviewed WhatsApp transport**, while employees use the normal company-owned WhatsApp app.
4. **Architech is installed only for the Real Estate profile.** Generic companies should never see listings, locality matching or broker terminology.

Build one small, brand-neutral Frappe app—provisionally `business_suite_core`—for the integration and repeatable product configuration. Do not fork ERPNext and do not add another CRM.

## 2. What “free” can honestly mean

### Mandatory software profile: no vendor license fee

The required product can avoid:

- per-user ERP/CRM fees;
- a Chatwoot deployment or per-agent inbox fee;
- per-message WhatsApp API fees;
- Frappe Cloud, Evolution Cloud and managed automation fees;
- mandatory AI credits, telephony, SMS, paid email, GSP or payment-gateway services;
- a commercial inventory/accounting add-on.

### It cannot mean zero operating cost

A product sold to companies still needs servers, storage, backups, domains, monitoring, maintenance, support and the company's existing phone/SIM/data. These are real infrastructure/service costs. The honest promise is:

> **No mandatory third-party software, seat or message charge. The customer pays us for deployment, migration, hosting, backup, maintenance and support.**

Optional Meta Cloud WhatsApp, GST Suvidha Provider automation, SMS/voice, payment gateways, app-store publishing, commercial email delivery or managed storage must be separately enabled, separately priced and disabled by default.

## 3. The advanced product is built from complete workflows

### 3.1 Lead-to-cash — every customer profile

```text
Lead/form/import
  → consent + duplicate check
  → area/employee assignment in Frappe CRM
  → near-immediate WhatsApp acknowledgement
  → employee continues in normal company WhatsApp
  → call/outcome/status/next action in mobile CRM
  → Deal → ERPNext quotation
  → sales order → invoice → payment/reconciliation
  → receipt + feedback
```

High-value additions in `business_suite_core`:

- configurable lead routing by territory, source, product, team or working hours;
- normalized phone/email duplicate detection;
- deterministic scoring rules and follow-up due dates—no paid AI required;
- durable after-commit outbox, retries and a visible failed-message queue;
- one-click **Open WhatsApp**, **Call from SIM** and **Log outcome** actions from an assigned Frappe CRM lead;
- consented quotation, invoice, receipt and payment-reminder delivery through WhatsApp;
- short-lived signed document links rather than permanently public invoice URLs;
- suppression and `STOP` handling across all automated WhatsApp rules;
- manager dashboards for response time, conversion, pipeline value, outstanding debt and collections.

### 3.2 Quote-to-payment — local sales teams

ERPNext already supplies Customer, Quotation, Sales Order, Delivery Note, Sales Invoice, Payment Entry, receivable reports, bank-statement import and payment reconciliation. Add simple guided workspaces so a salesperson sees only:

1. My leads today;
2. Follow-ups due;
3. Quotations awaiting approval;
4. Orders awaiting fulfilment;
5. Overdue invoices requiring a consented reminder.

Use approval workflows for discounts, credit-limit exceptions, invoice cancellation and write-offs. Accounting submission/cancellation rights remain with accountant/owner roles—not sales agents.

### 3.3 Purchase-to-stock — traders and distributors

Enable ERPNext Buying and Stock without adding another inventory repository:

```text
reorder level → material request → supplier RFQ/quotation
→ purchase order → receipt/quality check → purchase invoice
→ stock valuation + payable → supplier payment
```

Valuable local features:

- multiple warehouses and branches;
- item variants, units of measure and price lists;
- batches/serial numbers and expiry where required;
- landed-cost allocation;
- barcode-supported physical reconciliation;
- ageing, slow/non-moving inventory and margin reports;
- stock reservation, pick list, delivery and return controls;
- reorder alerts and purchase suggestions requiring human approval.

### 3.4 Service-to-renewal — service businesses and contractors

Use ERPNext Projects, Tasks, Timesheets, Issues, Assets, Maintenance and recurring invoices:

```text
lead → quotation/contract → project or service issue
→ assignment/visit/time/material → customer approval
→ invoice → payment → warranty/AMC renewal reminder
```

The employee's company WhatsApp app holds the live conversation; ERPNext `Issue` or Project holds the structured job, owner, priority, due date, cost and billable result. Frappe CRM holds the pre-sale lead/deal activities and next action.

### 3.5 Plan-to-produce — selected small manufacturers

Only after Stock and Accounting are stable, enable ERPNext Manufacturing:

- multi-level bills of materials;
- work orders/job cards and material transfers;
- operations/workstations and capacity planning;
- subcontracting;
- scrap/by-product and production costing;
- quality inspection and traceability.

Manufacturing is a separate implementation profile, not a checkbox turned on during a sales demo. Pilot it with one simple production line before promising complex process manufacturing.

### 3.6 Optional local assistance—advanced, but never authoritative

After the core workflows are dependable, a customer may enable self-hosted OCR/summarization under a separately reviewed model and license:

- extract a draft expense or supplier invoice from a scan;
- summarize an employee-provided WhatsApp export or note into a proposed CRM note, without silently reading the device;
- suggest duplicate contacts or an item mapping;
- answer from approved help articles.

Every result remains a draft requiring an authorized user. It must never submit a ledger entry, payment, GST document, customer message or stock movement by itself. Keep tenant data local, record provenance, test Gujarati/Hindi quality and budget the extra CPU/GPU—the software may have no vendor fee, but compute is not free. No paid AI credit is part of the required product.

## 4. Product profiles for local companies

The same tested code should install different **fixtures, roles, workspaces, print formats and workflows**—not customer-specific forks.

| Profile | Best initial customer | Included value | Defer initially |
|---|---|---|---|
| **Business Core** | Small service/trading company | Frappe CRM, mobile calling/status, direct company WhatsApp, quotations, invoices, expenses, payments, receivables/payables, dashboard | Stock/manufacturing |
| **Trade & Distribution** | Wholesaler, distributor, textile/engineering trader | Business Core + buying, warehouses, stock valuation, price lists, batches/serials, delivery/returns | Manufacturing |
| **Service & AMC** | Repair, maintenance, agency, consultant, contractor | Business Core + projects, issues, visits, timesheets, assets, recurring billing and renewals | POS/manufacturing |
| **Retail** | Single/few-location shop | Business Core + POS, barcode, stock, pricing and loyalty | Complex omnichannel commerce |
| **Light Manufacturing** | Fabricator, parts/packaging or simple assembly unit | Trade + BOM, work orders, subcontracting, quality and production costing | Pharma/chemical regulatory promises |
| **Real Estate** | Brokerage | Business Core + Architech listings, locality routing, privacy-preserving broker channel, deals and commissions | Generic inventory/POS |

Ahmedabad/Gujarat has strong engineering, textile, chemicals, pharmaceuticals, manufacturing and trading activity. Start with **traders/distributors, service/AMC businesses and simple fabricators** because their workflows are valuable but can be validated without first taking on highly regulated pharma/chemical compliance.

## 5. India/local-company readiness

### 5.1 Accounting and GST

Use the GPL India Compliance app where compatible. The hosting-only profile can include:

- GSTIN, HSN/SAC and tax templates;
- Indian invoice/credit-note/debit-note formats;
- GST/TDS/TCS validations and reports provided by the pinned app;
- export/JSON workflows that the accountant uploads manually where supported;
- branch, warehouse, cost-center and accounting-dimension reporting;
- bank-statement import and semi-automatic reconciliation.

Automatic IRN/e-invoice/e-waybill API calls require appropriate portal/GSP credentials and may carry external charges. They are not part of the free promise. A chartered accountant must approve the chart of accounts, taxes, opening balances, print formats and month-end reports before production cutover.

### 5.2 Migration from spreadsheets or legacy accounting

A repeatable migration service is essential for selling locally. Use ERPNext's CSV/Excel Data Import, Chart of Accounts Importer, Opening Invoice Creation, opening balance tools and Stock Reconciliation. Build a guided staging process:

1. export and preserve the unchanged legacy reports;
2. clean and map customers, suppliers, items, tax IDs, warehouses and accounts;
3. dry-run into a disposable site;
4. reconcile master counts, receivables, payables, tax, bank, stock value and trial balance;
5. obtain owner/accountant sign-off;
6. execute a dated cutover and keep legacy data read-only;
7. run a short parallel-verification period without double-entering values into both ledgers indefinitely.

Never promise a one-click Tally migration until a tested exporter/version-specific mapping and reconciliation suite exists.

### 5.3 Language and usability

- English and Hindi can use the upstream translation system, after quality review.
- Create and maintain a **Gujarati translation pack** for the product's limited guided workspaces, templates and help—not an unverified claim that every upstream screen is already well translated.
- Provide Gujarati/Hindi/English WhatsApp templates selected by customer preference.
- Use branded company letterheads and clear GST invoice PDFs.
- Add a customer-owned UPI ID/QR to approved invoice print formats if requested, but mark an invoice paid only after a verified Payment Entry/bank reconciliation. Scanning a QR is not payment evidence.
- Prefer mobile-responsive guided screens; do not promise offline operation until it is actually designed and tested.

### 5.4 Customer self-service

ERPNext's customer portal can expose order, invoice and shipment status. Begin with short-lived signed links delivered after consent; enable full portal accounts only for customers that need them. Never expose another customer's records through predictable URLs or shared contacts.

## 6. Direct mobile communication without Chatwoot

Chatwoot is not part of the implementation. The customer uses normal WhatsApp and phone calls; the employee uses normal company WhatsApp plus the installable Frappe CRM web app.

The required mobile actions are:

- **Open WhatsApp** for the existing company-account conversation;
- **Call from SIM** using a standard `tel:` link and the native dialer;
- **Log call result** after returning to CRM;
- **Change stage**, add a note/task and set the next follow-up;
- manager views for untouched leads, overdue actions, conversion and employee/locality progress.

Frappe CRM's inspected `v1.83.0` PWA can be installed from the browser and has a manual `CRM Call Log`. Its upstream automated calling interface supports Twilio/Exotel; those paid integrations are disabled. The owned app adds direct SIM calling without claiming access to restricted device call state, exact duration or recording.

For transactional automation, use strict event rules rather than marketing blasts:

| Event | Default action |
|---|---|
| New specifically consented lead | Assign employee/account and send one immediate acknowledgement |
| Customer reply | Employee continues in the normal company WhatsApp app |
| Call completed/attempted | Employee confirms outcome, CRM stage and next action |
| Quotation approved | Send secure quotation link if that purpose is consented |
| Invoice submitted | Send invoice/link if customer channel preference allows it |
| Payment overdue | Controlled reminder cadence with suppression, working hours and owner visibility |
| Payment reconciled | Send receipt/thank-you once |
| Service due/AMC renewal | Reminder only under the correct consent purpose |

The linked-device transport remains unofficial and can break or cause number restriction. Keep per-number rate/concurrency limits, human takeover, canary tests, pause switches and no silent Meta fallback. Detailed behavior is in [`mobile-calling-lead-workflow.md`](./mobile-calling-lead-workflow.md).

## 7. Productization for selling many businesses

### 7.1 One company = one isolated business site

- One Frappe site/database per unrelated customer business, with Frappe CRM and ERPNext on a tested same-site app set.
- One Evolution instance per company-owned number; no personal employee number pool.
- Deployment-scoped external IDs and credentials; no cross-business fallback.
- Versioned shared application pools can host compatible sites, then shard by load/risk.

Do not put unrelated customers into one ERPNext site as separate `Company` records.

### 7.2 Brand-neutral control plane

A small internal control plane provisions and operates the product:

- site/domain and deployment assignment;
- product profile and module flags;
- employee/locality and Evolution company-account mappings;
- backup/restore status and release cohort;
- health, queue lag and storage alerts;
- customer-owned domains and data export;
- maintenance window, incidents and support entitlement;
- release/billing inventory proving that no unapproved paid dependency was enabled.

Keep this control plane separate from Architech's real-estate domain. Architech becomes one optional vertical connector.

### 7.3 Reusable implementation pack

For each profile, version-control:

- roles and role profiles;
- workspaces and dashboards;
- custom fields/property setters only where necessary;
- workflows and approval states;
- notification/WhatsApp rules;
- print formats and letterheads;
- sample chart/tax mappings reviewed by an accountant;
- import templates and reconciliation reports;
- English/Hindi/Gujarati help and training checklists;
- automated profile installation and upgrade tests.

Customer-specific code is the exception. Prefer configuration with an owner and removal date.

## 8. Reliability, privacy and security are sellable features

A local company will trust the product only if its data and ledger survive mistakes and upgrades:

- private network access to MariaDB/PostgreSQL/Redis and Evolution; no public provider admin/API;
- TLS, 2FA, least-privilege role profiles and accountant-controlled submission/cancellation;
- signed webhooks, idempotent inbox/outbox processors and secret rotation;
- encrypted sensitive integration contact destinations and provider credentials in a secret store;
- daily encrypted full backups plus point-in-time logs/snapshots appropriate to the sold recovery tier;
- off-machine/offsite copy, immutable retention where practical, and scheduled restore drills;
- per-site queue/storage/CPU limits and noisy-neighbour tests;
- audit/access/export logs, deletion workflows and applicable Indian data-protection contracts;
- tested upgrade cohort: internal site → demo site → pilot sites → general sites, with rollback/restore instructions.

Do not sell an RPO/RTO until a timed restore drill proves it.

A small shared open-source operations stack may use Prometheus/Grafana-compatible monitoring and encrypted `restic` backups. Kubernetes, Kafka, n8n and an extra BI/helpdesk/drive product are unnecessary at launch. ERPNext reports/dashboards, workers and its database-backed outbox are sufficient until measured load or a specific customer requirement proves otherwise.

## 9. How to sell the service while keeping software hosting-only

Sell **outcomes and responsibility**, not a proprietary per-user license:

| Revenue item | What the customer buys |
|---|---|
| Implementation/setup | Process discovery, company/tax/role setup, print formats and verified go-live |
| Migration | Data cleaning, mapping, imports and accountant reconciliation |
| Monthly business-site service | Hosting, backups, monitoring, updates and standard support |
| Dedicated isolation tier | Separate deployment/resources and stronger recovery commitments |
| Training | Owner, accountant, sales, warehouse and agent workflows in local language |
| Custom workflow/integration | Scoped engineering, testing and maintenance |
| On-site support | Optional local visit/service contract |

Price by **business site, resource/recovery tier and service level**, not WhatsApp message or employee seat. Resource-fair-use limits are still needed so one customer cannot exhaust a shared pool.

Commercial trust points:

- no forced annual lock-in to recover their data;
- export of customer-owned data and attachments;
- documented backup and exit process;
- clear list of optional external costs;
- upstream license notices and source obligations;
- trademark-safe branding and no claim of endorsement by Frappe/ERPNext;
- no removal of paid-feature gates from upstream products.

Evolution's additional license conditions remain a legal gate for a sold service. If legal review requires a standard OSI-only component set, implement the same adapter contract directly on pinned MIT-licensed Baileys. That is more engineering, but it protects the rest of the product architecture.

## 10. Local pilot and sales sequence

### Stage A — one complete demo company

Create a synthetic Ahmedabad trading/service company and demonstrate:

1. lead arrives and receives consented WhatsApp acknowledgement;
2. assigned employee handles the reply in company WhatsApp and records call/message outcome in Frappe CRM;
3. quotation is approved and delivered;
4. order/invoice posts correctly;
5. bank statement/payment is reconciled;
6. owner sees pipeline, sales, gross margin, receivables and cash reports;
7. backup is restored into an isolated environment.

### Stage B — three design partners

Choose deliberately different, low-regulatory-complexity pilots:

- one trader/distributor with a manageable item list and warehouse;
- one service/AMC/contractor business;
- one real-estate brokerage using the Architech vertical.

Run each in its own site/database. Document process gaps; improve the shared profile instead of copying custom code between customers.

### Stage C — sell repeatable profiles

Publish clear demos and onboarding checklists for Business Core, Trade, Service and Real Estate. Add Retail or Light Manufacturing only after the required profile has automated tests, migration templates and a reference pilot.

Use local trust channels rather than generic software advertising:

- partner with CAs/accountants who can validate finance and refer suitable companies;
- work with local trade/manufacturing associations and existing business networks;
- demonstrate one industry-specific flow using realistic Gujarati/English documents;
- offer a fixed-scope discovery and data-quality assessment before quoting migration;
- make one trained “company champion” responsible for adoption in every customer;
- sell responsive local support, transparent costs and data portability as the differentiator.

Measure value, not feature count: effort does not equal adoption. Track:

- first-response and follow-up time;
- lead-to-quotation and quotation-to-order conversion;
- quotation/invoice preparation time;
- overdue receivables and collection time;
- stock accuracy and non-moving value;
- order fulfilment time;
- service jobs completed within due date;
- month-end reconciliation differences;
- backup restore success and support incidents.

## 11. Delivery order

1. Pin and test one compatible Frappe/Frappe CRM/ERPNext/India Compliance/Evolution release set.
2. Build `business_suite_core`: tenant mappings, consent, encrypted contacts, durable outbox/inbox, idempotency, conversation links, suppression and audit.
3. Build the Business Core guided workspace and lead-to-cash flow.
4. Add India accounting setup, print formats, bank reconciliation and accountant acceptance tests.
5. Add provisioning, profile fixtures, backups, monitoring, upgrade cohorts and data export.
6. Complete the synthetic demo and two-business isolation/restore drills.
7. Pilot Trade, Service and Real Estate profiles with three design partners.
8. Add POS/Manufacturing/HR/advanced analytics only against validated demand.

Do not begin with a marketplace of modules, AI, a custom native mobile app or dozens of integrations. A dependable enquiry → conversation → quotation → invoice → payment flow is more advanced and valuable than ten disconnected dashboards.

## 12. Production gates

Do not sell production access until all are true:

- two unrelated sites pass negative cross-tenant authorization tests;
- CRM, accounting and inventory authorities are documented and unique;
- accountant signs off tax, opening balances and financial reports;
- WhatsApp real-number activation/legal/consent/canary gates pass;
- mobile CRM calling uses the existing company SIM with no Twilio/Exotel dependency;
- message retries cannot duplicate first contact, invoice or receipt;
- migration totals reconcile to source reports;
- backup and full restore are timed and verified;
- upgrade and rollback run on a representative clone;
- exit export and deletion procedures work;
- optional GSP/Meta/SMS/email/payment costs cannot activate silently.

## 13. Primary evidence

- [ERPNext repository and included modules](https://github.com/frappe/erpnext)
- [Frappe site-per-database tenancy](https://docs.frappe.io/framework/user/en/basics/sites)
- [ERPNext customer and integrated transaction history](https://docs.frappe.io/erpnext/customer)
- [ERPNext Buying](https://docs.frappe.io/erpnext/buying), [Projects](https://docs.frappe.io/erpnext/projects-introduction), [POS](https://docs.frappe.io/erpnext/pos-workflows), and [BOM/Manufacturing](https://docs.frappe.io/erpnext/user/manual/en/bill-of-materials)
- [ERPNext accounting migration](https://docs.frappe.io/erpnext/accounting-migration-overview), [Data Import](https://docs.frappe.io/erpnext/data-import), and [bank reconciliation](https://docs.frappe.io/erpnext/bank-reconciliation)
- [ERPNext customer portal](https://docs.frappe.io/erpnext/customer-portal), [subscriptions](https://docs.frappe.io/erpnext/subscription), and [role permissions](https://docs.frappe.io/erpnext/permissions)
- [Frappe translations](https://docs.frappe.io/framework/user/en/translations)
- [India GSP credential requirement](https://docs.frappe.io/erpnext/v14/user/manual/en/regional/india/gsp_credentials_for_e_waybill_or_e_invoice) and [manual e-waybill JSON workflow](https://docs.frappe.io/erpnext/v14/user/manual/en/regional/india/generating_e_waybill)
- [Frappe CRM mobile app installation](https://docs.frappe.io/crm/mobile-app-installation), [Call Log](https://docs.frappe.io/crm/call-log), and [ERPNext integration](https://docs.frappe.io/crm/erpnext)
- [ERPNext CRM v17 removal notice](https://docs.frappe.io/erpnext/CRM#important-erpnext-crm-is-scheduled-for-removal)
- [Gujarat MSME Handbook 2025–26](https://www.gspma.in/public_assets/img/documentation/HANDBOOK%20AHMEDABAD.pdf)
- Detailed WhatsApp review: [`../broker-suite/evolution-api-adoption-assessment.md`](../broker-suite/evolution-api-adoption-assessment.md)
