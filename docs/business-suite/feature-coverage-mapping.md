# Business suite feature lists — coverage mapping and build plan

**Date:** 08 Sep 2026
**Status:** Planning input. Maps two requested feature lists onto the v8 business-suite stack. **Not a decision** — items marked ⚠️ DECIDE need a v8 amendment or product sign-off before build.
**Scope:** The two lists below describe (1) a WhatsApp-marketing platform (the Aisensy/WATI feature class) and (2) a lead-aggregation CRM (the Cronberry/Groweon feature class). This document maps every item to the component that owns it in the selected architecture, states what is native / adapter / custom / deferred, and flags the conflicts with v8's consent, cost and scope boundaries.
**Verified sources:** `frappe/crm v1.83.0` (cloned — `lead_syncing` module, web-form hooks, assignment-rules API), `shridarpatil/frappe_whatsapp` (cloned — Bulk WhatsApp Message, WhatsApp Notification, `product_catalog_json`, Flows doctypes), `frappe/ecommerce_integrations` (GitHub API — Shopify/Amazon/Unicommerce/Zenoti; **WooCommerce absent from current supported list**; app active, pushed 27 Aug 2026, GPL-3.0), IndiaMart/TradeIndia/JustDial lead APIs (existence confirmed via their seller CRM-key flows and third-party CRM integrations), plus the transport assessment ([`../broker-suite/waha-transport-assessment.md`](../broker-suite/waha-transport-assessment.md)) and the WhatsApp-tab design ([`../broker-suite/frappe-crm-whatsapp-tab-integration.md`](../broker-suite/frappe-crm-whatsapp-tab-integration.md)).

---

## 0. Direct answer

**Roughly 60% of both lists is already native** to Frappe CRM + ERPNext (install-and-configure, no build). The remaining work concentrates in five custom clusters: **(1) lead-ingestion adapters** (IndiaMart/JustDial/TradeIndia/Google Ads/Sheets), **(2) the campaign + metrics layer** (delivered/replies/performance analytics on transport events), **(3) the WhatsApp adapter** (already designed — the CRM tab + outbox), **(4) WooCommerce orders** (dropped from the official connector app), and **(5) catalog sync**. Two items are **deferred by standing decision** (AI chatbot, flow-builder automation) and two need a **product decision** because they collide with v8: **smart broadcast** (consent + Meta billing) and **aggregator-lead first-touch automation** (consent provenance).

The stack assignment in one line per layer:

| Layer | Owns |
|---|---|
| **Frappe CRM** | Leads, contacts, deals, follow-ups, assignment, SLA, team/roles, dashboards, FB/IG lead sync, web forms |
| **ERPNext** | Orders, invoices, items, payments, financial reports (+ India Compliance) |
| **`frappe_whatsapp` (official Meta path)** | Templates, bulk sends (campaigns), catalogue fields, Flows — per-business opt-in with that business's Meta billing |
| **Transport (WAHA/gowamd) + `business_suite_whatsapp`** | The CRM's per-lead/deal WhatsApp tab, message/ack events (the metrics layer's data source) |
| **`business_suite_core`** | Ingestion adapters (IndiaMart/JD/TI/Google Ads/Sheets/Brevo), consent & suppression, source taxonomy, campaign analytics, routing |
| **Architech** | Public website intake, city/locality vocabulary (replaces "top countries"), real-estate vertical |

## 1. List 1 — WhatsApp-marketing platform features

| Feature | Owner | Status | Notes |
|---|---|---|---|
| Smart Broadcast Messaging | `frappe_whatsapp` Bulk WhatsApp Message + custom audience builder | ⚠️ **DECIDE + custom** | Bulk outside the 24-h window is **only legitimate on the official Meta path** (approved templates, per-message marketing fees) — the hosting-only baseline holds only if each business runs broadcast under *its own* Meta account/billing as a paid-profile opt-in. Unofficial bulk = ban magnet (exactly what capping/timelock telemetry warns about) and DPDP exposure. The "smart" part (segment by source/status/city/consent) is custom on CRM data, and **consent-gated** either way. |
| Facebook & Instagram Integration | Frappe CRM `lead_syncing` (lead capture); DM inbox = out of scope | **Native (half)** | FB/IG **Lead Ads** → CRM is built in (Facebook Lead Form, Page, Sync Source, Failed-Sync Log doctypes — verified in source). FB/IG **DM conversations** would need an omnichannel inbox — removed with Chatwoot in v8; raise separately if required. |
| Shopify Integration | `frappe/ecommerce_integrations` app → ERPNext | **Native via pinned app** | Orders/customers/items into ERPNext (Sales Order/Invoice/Customer/Item); GPL-3.0, actively maintained. CRM sees the customer via the Deal→Customer link. |
| WooCommerce Integration | custom adapter (or community app) | **Custom** | The official `ecommerce_integrations` app supports Shopify/Amazon/Unicommerce/Zenoti — **WooCommerce was dropped**. Either a custom REST/webhook adapter into ERPNext (same mapping as Shopify's) or a reviewed community app. |
| WhatsApp Catalogue | `frappe_whatsapp` (official Meta path) + ERPNext Item | **Custom sync** | The app carries `product_catalog_json` on messages and Flow support (verified), but catalog *sync* (ERPNext Item → Meta Commerce catalog) is a build. Official path only — the unofficial transports do not implement catalogs. |
| Google Sheet Integration | `business_suite_core` adapter | **Custom (S)** | Two directions: lead import (Frappe's Data Import covers CSV natively; Sheets sync is a small polling/OAuth adapter) and export/report mirroring. Self-hosted; no n8n dependency. |
| API Integration | The whole stack | **Native** | Frappe REST/RPC + webhooks per site, `business_suite_core` endpoints, the private gateway. This is the architecture's default mode of operation. |
| Smart Chatbot | — | **Deferred (v8 §15)** | "No AI automation … before the core pilot proves a requirement." Scripted auto-replies/WhatsApp Flows (frappe_whatsapp) can carry basic guided flows; a real bot is a post-pilot decision. |
| Lead Management | Frappe CRM | **Native** | Lead → assignment → qualification → Deal → Won/Lost; Kanban; custom views. |
| Team Management Dashboard | Frappe CRM | **Native** | Roles (Sales User/Manager), assignment, SLA timers, manager views per v8 §5. |
| New Leads Tracking | Frappe CRM + ingestion adapters | **Native + adapter** | Assignment notifications and "new/untouched" lists are built in; new-source alerts come with the ingestion layer. |
| Active Campaigns | Campaign state (frappe_whatsapp bulk docs or a custom Campaign doctype) | **Custom (S)** | A thin campaign registry linking audience → sends → outcomes. |
| Campaign Performance | `business_suite_core` analytics | **Custom (M)** | Aggregations over the campaign registry + message events. |
| Delivered Metrics | Transport events → analytics | **Custom (M)** | WAHA `message.ack` / Evolution `MESSAGES_UPDATE` already land in the event ingestion designed in the WhatsApp-tab doc; the metrics layer is read-side aggregation over it. |
| Replies Metrics | Transport events → analytics | **Custom (M)** | Inbound `message` events correlated to campaign sends (same event spine). |
| Contacts Management | Frappe CRM | **Native** | Contacts + Organizations, custom fields, per-lead/deal history. |
| Automation Flow | CRM assignment rules + notifications; flow-builder deferred | **Native core / deferred builder** | Rules, escalations, SLA, mandatory next action (v8 §5.2) are covered; a visual flow-builder is the deferred chatbot-adjacent piece. |
| CRM Analytics | Frappe CRM dashboards + custom reports | **Native + custom** | Stage funnels and assignment/overdue views built in; bespoke KPIs are report-level work. |
| Orders Tracking | ERPNext (+ ecommerce_integrations) | **Native** | Sales Order → Delivery Note → Invoice → Payment; e-commerce orders arrive via the connector. |
| Lead Tracking | Frappe CRM | **Native** | Stages, owners, activity timeline. |
| Conversion Rate | custom funnel report | **Custom (S)** | Stage-transition report over CRM data (Lead→Deal→Won); the event spine makes it a query, not a pipeline. |
| Top Countries Analytics | — | **Custom (S) — reframe** | For an India-first product the meaningful dimension is **city/locality**, not country — and that vocabulary already exists (Architech's city/locality registry; `interop/india-state-mapping.ts` for GST-aligned states). Build "top cities/localities" on lead geo instead. |

## 2. List 2 — lead-aggregation CRM features

| Feature | Owner | Status | Notes |
|---|---|---|---|
| IndiaMart Integration | `business_suite_core` ingestion adapter | **Custom (S/M)** | Real: paid IndiaMart accounts generate a CRM API key (seller.indiamart.com → Settings → Accounts → "Integrate Lead Manager with third-party CRM"). Poll → normalize → CRM Lead with stamped source + **consent provenance** (see §4). |
| JustDial Integration | ingestion adapter | **Custom (S/M)** | Advertiser lead push/API; same normalize→CRM contract as IndiaMart. |
| TradeIndia Integration | ingestion adapter | **Custom (S/M)** | Provides user/profile/key API credentials (confirmed via their API settings flow); same contract. |
| Meta Ads Integration | Frappe CRM `lead_syncing` | **Native** | FB/IG lead forms with scheduled sync (5 min–daily) and field mapping — verified module. Full channel design (Instant Forms, Click-to-WhatsApp, DMs): [`meta-lead-sources.md`](./meta-lead-sources.md). |
| Google Ads Integration | ingestion adapter | **Custom (S)** | Google Ads lead-form extensions deliver via webhook → normalize → CRM Lead. |
| Website Integration | CRM web forms + Architech intake | **Native + designed** | CRM web forms exist (custom-field hooks verified in v1.83.0); Architech's public enquiry → lead event via the InteropOutbox is the already-designed path for the real-estate vertical. |
| Chatbot Integration | — | **Deferred (v8 §15)** | A passive website widget that posts into the same lead-ingestion contract is Small and harmless; a conversational bot is deferred. |
| Brevo Integration | `business_suite_core` email adapter | ⚠️ **DECIDE (cost gate)** | Brevo is a paid-track SaaS (free tier exists). v8 §12 bars mandatory vendor payments; self-hosted email via ERPNext/Frappe email covers follow-ups natively. Make Brevo an optional per-business provider, never a dependency. |
| Lead Management | Frappe CRM | **Native** | — |
| Contacts Management | Frappe CRM | **Native** | — |
| Follow-ups | Frappe CRM + v8 §5.2 | **Native** | Tasks, notes, mandatory next action, overdue/SLA views. |
| Deals | Frappe CRM | **Native** | Stages, expected value, Won/Lost + reasons. |
| Reports | Frappe CRM + ERPNext | **Native** | List views, report builder, financial reports. |
| Source Tracking | CRM `source` field + ingestion contract | **Custom (S)** | The adapters must stamp a **standardized source taxonomy** (platform, campaign, medium) at ingestion — enforced in the `business_suite_core` normalize step, not left to free text. |
| Status Tracking | Frappe CRM | **Native** | Lead/Deal stages per v8 §5.2 progress model. |
| Total Leads Count | dashboards | **Native** | — |
| Conversion Tracking | funnel report | **Custom (S)** | Same query as list 1's Conversion Rate. |
| Automate Follow-ups | CRM notifications + consent-gated WhatsApp reminders on the outbox | **Custom (M)** | The outbox/worker machinery is already designed (v8 §7); reminders ride it with the same consent/suppression gates. No cold automation (§4). |
| Team Management | Frappe roles/permissions | **Native** | — |
| Close More Sales Tracking | pipeline analytics | **Native + custom** | Won/Lost reasons, conversion and expected-value views are CRM-native; "close more sales" as a KPI is a funnel report. |

## 3. Common to both

All ten common items resolve through the above: Lead Management, Contacts, CRM Dashboard, Team Management (native); Chatbot (deferred); Automation/Follow-ups (native core + outbox custom); Conversion Tracking (custom report); Source Tracking (custom taxonomy); Reports & Analytics (native + custom KPIs); Campaign/Performance Metrics (custom on the event spine).

## 4. The two policy collisions (decide before building)

1. **Broadcast and cold-lead automation vs the consent model.** v8's consent architecture (WhatsApp opt-in ≠ call consent; `STOP`/suppression; purpose expiry; first-message-out-of-consented-enquiry only) was designed for **inbound enquiries**. Aggregator leads (IndiaMart/JustDial/TradeIndia) and broadcast audiences are **cold or lukewarm**. The build must: stamp every lead with its **consent provenance** at ingestion; default aggregator leads to **human first-touch** (the employee opens WhatsApp/calls from the CRM) rather than automated sends; and restrict broadcast to **opt-in lists on the official Meta path** under the business's own billing. Anything broader is a deliberate v8 amendment, not an implementation detail.
2. **Paid-provider perimeter.** Brevo (email), Meta marketing-template fees, and any hosted chatbot API stay **optional per-business paid profiles** — never requirements of the baseline stack. This is v8 §12 applied to the new list, and it is also the product's differentiator against the SaaS per-seat/per-message competitors these lists come from.

## 5. Build order

1. **Foundation (already planned):** Frappe site per business + CRM + ERPNext + transport + `business_suite_whatsapp` (the tab) + outbox/consent/suppression in `business_suite_core`. Everything below rides this.
2. **Ingestion spine:** the normalize→dedupe→CRM-Lead contract with source taxonomy + consent provenance — **specified and implemented as [`lead-ingestion-contract.md`](./lead-ingestion-contract.md) (contract v1, `client/src/lib/interop/lead-ingestion.ts`)**. **For the Real Estate profile the adapters order is: Architech/website enquiries (designed) → MagicBricks push → 99acres → Housing.com → email-parse fallback → CSV import (day one)** — see [`real-estate-portal-lead-ingestion.md`](./real-estate-portal-lead-ingestion.md) for the verified per-portal mechanisms (MagicBricks Push Integration, 99acres webhook + pull, Housing.com partner-activated push + Id/secret pull). The horizontal adapters follow for non-real-estate businesses: IndiaMart → Meta Ads (native, config only) → JustDial → TradeIndia → Google Ads → Google Sheets.
3. **Metrics spine:** campaign registry + event aggregation (delivered/read/replies/performance) on the transport event ingestion; conversion funnels; "top cities/localities" on Architech's registry.
4. **Commerce:** Shopify via `ecommerce_integrations`; WooCommerce custom adapter; catalog sync for the official path.
5. **Post-pilot decisions:** broadcast product (with the §4.1 amendment), chatbot/flow-builder, Brevo or additional paid providers.

## 6. What this list does not change

The v8 boundaries hold: no Chatwoot re-introduction (the lists' inbox-shaped items are served by the CRM tab + normal WhatsApp), n8n stays out of the control plane (adapters are `business_suite_core` code), the transport stays behind the private gateway, and one site per business keeps every new data source inside its tenant.
