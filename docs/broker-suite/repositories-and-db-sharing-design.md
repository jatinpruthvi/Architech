# Which Repositories We Use + Cross-Repo Database Sharing Design

**Date:** 03 Sep 2026
**Applies to:** Architech (Next.js/Prisma/PostgreSQL) + Frappe-based Business Suite + Evolution API transport
**Objective:** Confirm the exact Git repositories in scope, document their database-level structures, and define an **insert/share contract** so Architech data can be pushed easily and idempotently into the other repositories without coupling their internal databases.

> **Do not direct-insert rows into another repository's database.** Every repository owns its own DB schema and lifecycle. We share data through a versioned **insert contract** (HTTP/Frappe API / webhooks) backed by an *integration outbox + external mapping + idempotency key* design.

---

## 1. Repositories in scope (v8 confirmed)

| # | Repository | Purpose in our architecture | DB engine | Our write model |
|---|---|---|---|---|
| 1 | [`jatinpruthvi/Architech`](https://github.com/jatinpruthvi/Architech) | Our product: public discovery, listing, locality, enquiry/consent/masking, **Broker Channel**, matching, deals, commission split, channel dashboard | PostgreSQL + Prisma (application-level; PostGIS for location where available) | **Source of truth / owner** |
| 2 | [`frappe/frappe`](https://github.com/frappe/frappe) | Framework / bench runtime used by Frappe CRM + ERPNext + our `business_suite_core` app | MariaDB (default) or PostgreSQL per site | **Runs sites; no direct table writes** |
| 3 | [`frappe/crm`](https://github.com/frappe/crm) `v1.83.0` | Lead/deal authority for operational CRM (*Frappe CRM app on the business site*) | Same Frappe site DB (MariaDB/PG) | **Frappe REST API insert** via `business_suite_core` |
| 4 | [`frappe/erpnext`](https://github.com/frappe/erpnext) `v16.34.1` | Commercial/finance authority: customer/item/quotation/order/invoice/payment/ledger/inventory | Same Frappe site DB | **Frappe REST API insert + submit**, never raw SQL |
| 5 | [`frappe/hrms`](https://github.com/frappe/hrms) `v16.17.1` | Optional HR/payroll profile | Same Frappe site DB | Frappe REST API (on customer demand only) |
| 6 | [`resilient-tech/india-compliance`](https://github.com/resilient-tech/india-compliance) `v16.9.0` | Optional India tax/validations | Same Frappe site DB | Frappe REST API (on customer demand only) |
| 7 | [`evolution-foundation/evolution-api`](https://github.com/evolution-foundation/evolution-api) `2.3.7` | Private WhatsApp transport/control (Baileys embedded) | PostgreSQL or MySQL (Prisma) + Redis | **Evolution HTTP API only**; never insert into its DB |
| 8 | *New owned repo/app* `business_suite_core` (Frappe app) | Our integration hub installed on each Frappe site: inbound API, idempotency record, mapping, finance projection, audit | Same Frappe site DB (our own DocTypes) | **Custom DocTypes we control** |
| 9 | *Our gateway/worker* (can live in Architech) | Private outbound controller for Evolution + Frappe calls | Uses Architech Postgres for outbox/mappings | **Owned by Architech** |

**Not selected/removed:** Chatwoot (`chatwoot/chatwoot`, `chatwoot/chatwoot-mobile-app`), Twenty, DeskcommCRM, BottleCRM, wacrm, Open Mercato, Ever Gauzy, InsulaCRM, open_crm, Vocero, OpenBSP/Whatomate/MultiWA/OpenWA, paid Meta Cloud-as-mandatory.

**Version policy:** pin upstream immutable commits/images (no `latest` tags). Do **not** fork upstream. `business_suite_core` is the only custom code we add to a Frappe site.

> **Source of truth for the DB tables below:** files read from the real pinned upstream clones:
> `frappe/erpnext@v16.34.1`, `frappe/crm@v1.83.0`, `frappe/frappe@v16.33.0`, `evolution-foundation/evolution-api@2.3.7`.
> These are **exact source values**, not doc estimates.
>
> Exact files inspected:
> - `erpnext/accounts/doctype/sales_invoice/sales_invoice.json` (+ `sales_invoice_item.json`)
> - `erpnext/accounts/doctype/gl_entry/gl_entry.json`
> - `erpnext/accounts/doctype/payment_entry/payment_entry.json`
> - `erpnext/accounts/doctype/journal_entry/journal_entry.json` (+ `journal_entry_account.json`)
> - `erpnext/selling/doctype/customer/customer.json`
> - `erpnext/selling/doctype/quotation/quotation.json` (+ `quotation_item.json`)
> - `erpnext/selling/doctype/sales_order/sales_order.json` (+ `sales_order_item.json`)
> - `erpnext/stock/doctype/item/item.json`, `item_price.json`, `bin.json`, `stock_ledger_entry.json`
> - `crm/fcrm/doctype/crm_lead/crm_lead.json`, `crm_deal.json`, `crm_organization.json`, `crm_call_log.json`, `crm_task.json`, `fcrm_note.json`, `erpnext_crm_settings.json`
> - `frappe/model/document.py` (standard columns)
> - `evolution-api/prisma/postgresql-schema.prisma`

---

## 2. Database-level detail: ERPNext / Frappe (the target)

### 2.1 Frappe data model (core concept)

- A **DocType** == one database table.
- Table name = `tab` + DocType name. Examples:
  - DocType `Customer` → `tabCustomer`
  - DocType `Sales Invoice` → `tabSales Invoice`
  - Child `Sales Invoice Item` → `tabSales Invoice Item`
- Every document has framework columns. Confirmed from `frappe/model/document.py` (`class Document(BaseDocument)`):

| Column | Type | Meaning |
|---|---|---|
| `name` | varchar | Primary key (naming series, e.g. `CUST-0001`, `SINV-2026-00001`) |
| `doctype` | varchar | DocType name |
| `owner` | varchar | User who created |
| `creation` | datetime | Created at |
| `modified` | datetime | Last update |
| `modified_by` | varchar | Last editor |
| `docstatus` | int | 0 = draft, 1 = submitted, 2 = cancelled (set via `set_docstatus()`) |
| `idx` | int | Ordering for child rows |

- **Child tables** (line items) store: `parent`, `parenttype`, `parentfield`, `idx` plus the item-specific fields.
- **Submitted documents are mostly immutable** (do not edit directly after submit; use Cancel/Amend).

### 2.2 Key ERPNext tables/fields we will target for a Channel Close (exact from v16.34.1 JSON)

**Master data**

| DocType → table | Required fields (source `reqd`) | Key fields used by us |
|---|---|---|
| `Customer` → `tabCustomer` | `customer_name`, `customer_type` | `customer_name`, `customer_type`, `customer_group`, `territory`, `tax_id`, `default_currency`, `default_price_list`, `mobile_no`, `email_id`, `primary_address`, `naming_series`, `disabled` |
| `Item` → `tabItem` | `item_code`, `item_group`, `stock_uom` | `item_code`, `item_name`, `item_group`, `stock_uom`, `is_sales_item`, `is_stock_item`, `standard_rate`, `description`, `brand`, `uoms`(child) |
| `Item Price` → `tabItem Price` | `item_code`, `uom`, `price_list`, `price_list_rate` | `item_code`, `uom`, `price_list`, `price_list_rate`, `currency`, `customer`, `supplier`, `valid_from`, `valid_upto` |

**Selling**

| DocType → table | Required fields (source `reqd`) | Key fields used by us |
|---|---|---|
| `Quotation` → `tabQuotation` | `naming_series`, `quotation_to`, `company`, `transaction_date`, `order_type`, `currency`, `conversion_rate`, `selling_price_list`, `price_list_currency`, `plc_conversion_rate`, `items`, `status` | `quotation_to`, `party_name`, `customer_name`, `company`, `transaction_date`, `valid_till`, `currency`, `selling_price_list`, `items`(child), `taxes`(child), `grand_total`, `status` |
| `Quotation Item` → `tabQuotation Item` (child) | `item_name`, `qty`, `uom`, `conversion_factor`, `ordered_qty` | `item_code`, `item_name`, `qty`, `uom`, `conversion_factor`, `rate`, `amount`, `net_rate`, `net_amount`, `warehouse`, `item_group`, `brand` |
| `Sales Order` → `tabSales Order` | `naming_series`, `customer`, `order_type`, `company`, `transaction_date`, `currency`, `conversion_rate`, `selling_price_list`, `price_list_currency`, `plc_conversion_rate`, `items`, `status` | `customer`, `customer_name`, `company`, `transaction_date`, `delivery_date`, `currency`, `selling_price_list`, `items`(child), `taxes`(child), `grand_total`, `per_delivered`, `per_billed`, `status` |
| `Sales Order Item` → `tabSales Order Item` (child) | (see parent `items`) | `item_code`, `item_name`, `qty`, `uom`, `conversion_factor`, `rate`, `amount`, `net_rate`, `net_amount`, `warehouse`, `delivery_date`, `grant_commission` |

**Accounting / Ledger**

| DocType → table | Required fields (source `reqd`) | Key fields used by us |
|---|---|---|
| `Sales Invoice` → `tabSales Invoice` | `naming_series`, `customer`, `company`, `posting_date`, `currency`, `conversion_rate`, `selling_price_list`, `price_list_currency`, `plc_conversion_rate`, `items`, `base_net_total`, `base_grand_total`, `grand_total`, `debit_to` | `customer`, `company`, `posting_date`, `due_date`, `currency`, `selling_price_list`, `items`(child), `taxes`(child), `grand_total`, `base_grand_total`, `outstanding_amount`, `status`, `debit_to`, `update_stock` |
| `Sales Invoice Item` → `tabSales Invoice Item` (child) | `item_name`, `uom`, `conversion_factor`, `rate`, `amount`, `base_rate`, `base_amount`, `income_account`, `cost_center` | `item_code`, `item_name`, `qty`, `uom`, `conversion_factor`, `rate`, `amount`, `base_rate`, `base_amount`, `income_account`, `cost_center`, `warehouse`, `item_group`, `brand` |
| `Payment Entry` → `tabPayment Entry` | `naming_series`, `payment_type`, `posting_date`, `company`, `paid_from`, `paid_from_account_currency`, `paid_to`, `paid_to_account_currency`, `paid_amount`, `source_exchange_rate`, `base_paid_amount`, `received_amount`, `target_exchange_rate`, `base_received_amount` | `payment_type`, `posting_date`, `company`, `party_type`, `party`, `paid_from`, `paid_to`, `paid_amount`, `base_paid_amount`, `received_amount`, `references`(child), `mode_of_payment`, `remarks` |
| `Journal Entry` → `tabJournal Entry` | `voucher_type`, `naming_series`, `posting_date`, `company`, `accounts` | `voucher_type`, `posting_date`, `company`, `accounts`(child), `total_debit`, `total_credit`, `difference`, `user_remark`, `multi_currency` |
| `Journal Entry Account` → `tabJournal Entry Account` (child) | — | `account`, `account_type`, `cost_center`, `party_type`, `party`, `account_currency`, `exchange_rate`, `debit_in_account_currency`, `credit_in_account_currency`, `debit`, `credit`, `against_account`, `reference_type`, `reference_name` |
| `GL Entry` → `tabGL Entry` | — | `posting_date`, `transaction_date`, `account`, `party_type`, `party`, `cost_center`, `debit`, `credit`, `account_currency`, `debit_in_account_currency`, `credit_in_account_currency`, `against`, `against_voucher_type`, `against_voucher`, `voucher_type`, `voucher_no`, `voucher_detail_no`, `remarks`, `is_opening`, `is_advance`, `is_cancelled`, `fiscal_year`, `company`, `finance_book` |

**Inventory (optional module)**

| DocType → table | Required fields | Key fields used by us |
|---|---|---|
| `Bin` → `tabBin` | — | `warehouse`, `item_code`, `actual_qty`, `reserved_qty`, `projected_qty`, `ordered_qty`, `indented_qty`, `planned_qty`, `stock_uom`, `company`, `valuation_rate`, `stock_value` |
| `Stock Ledger Entry` → `tabStock Ledger Entry` | — | `item_code`, `warehouse`, `posting_date`, `posting_time`, `voucher_type`, `voucher_no`, `voucher_detail_no`, `actual_qty`, `incoming_rate`, `outgoing_rate`, `qty_after_transaction`, `valuation_rate`, `stock_value`, `stock_value_difference`, `is_cancelled`, `company` |

> **Practical note:** for a Channel Close, the minimal ERPNext write is normally **`Channel Deal Commission`** (our custom DocType) + an optional **`Journal Entry`** (`accounts` child with commission income account vs counterparty clearing account). Sales Invoice/Quotation is only needed if we are treating the commission as an invoice to a brokerage.

### 2.3 How to insert into ERPNext (correct approach)

- **Use Frappe REST API**, not raw SQL:
  - `POST /api/resource/DoctorType` → create draft doc.
  - `POST /api/resource/{Doctype}` with JSON body e.g. `{"doctype":"Customer","customer_name":"..."}`.
  - `POST /api/resource/{Doctype}/{name}` → update draft.
  - `POST /api/resource/{Doctype}/{name}?action=submit` OR `POST /api/method/frappe.client.submit` → submit (only then GL/stock entries are created).
  - `GET /api/resource/{Doctype}/{name}` → fetch full doc including child tables.
  - `GET /api/resource/{Doctype}?filters=...&fields=...` → list.
- **Preferred custom endpoint** for cross-system calls: `POST /api/method/business_suite_core.api.sync_channel_deal` (our app). This keeps ERPNext internals hidden from Architech.
- **Auth:** `Authorization: token api_key:api_secret` for a dedicated least-privilege integration user, or signed HMAC header on our custom endpoint.
- **Idempotency:** Frappe has **no built-in idempotency key**. We implement it in `business_suite_core` with a tracking DocType + unique constraint (see §5).

### 2.4 Frappe CRM database detail (exact from Frappe CRM v1.83.0 source)

CRM DocTypes actually live under `crm/fcrm/doctype/...`. Key ones:

| DocType → table | Required fields (source `reqd`) | Key fields used by us | Child tables |
|---|---|---|---|
| `CRM Lead` → `tabCRM Lead` | `first_name`, `status` | `first_name`, `middle_name`, `last_name`, `gender`, `status`, `email`, `website`, `mobile_no`, `phone`, `lead_owner`, `source`, `industry`, `image`, `lead_name`, `job_title`, `organization`, `converted`, `territory`, `sla`, `communication_status`, `lost_reason`, `lost_notes` | `status_change_log`, `products`, `rolling_responses` |
| `CRM Deal` → `tabCRM Deal` | `status` | `organization`, `lead`, `deal_owner`, `naming_series`, `email`, `mobile_no`, `status`, `territory`, `source`, `contact`, `currency`, `deal_value`, `expected_deal_value`, `expected_closure_date`, `closed_date`, `lost_reason`, `lost_notes` | `contacts`, `status_change_log`, `products`, `rolling_responses` |
| `CRM Organization` → `tabCRM Organization` | — | `organization_name`, `website`, `organization_logo`, `no_of_employees`, `annual_revenue`, `industry`, `territory`, `currency`, `address`, `exchange_rate` | — |
| `CRM Contact` | — (child table `CRM Contacts`) | `contact`, `full_name`, `email`, `mobile_no`, `phone`, `gender`, `is_primary` | — |
| `CRM Call Log` → `tabCRM Call Log` | `from`, `status`, `type`, `to` | `id`, `from`, `status`, `start_time`, `medium`, `type`, `to`, `duration`, `recording_url`, `end_time`, `note`, `receiver`, `caller`, `reference_doctype`, `reference_docname`, `telephony_medium` | `links` |
| `CRM Task` → `tabCRM Task` | `title` | `title`, `priority`, `start_date`, `assigned_to`, `status`, `due_date`, `description`, `reference_doctype`, `reference_docname` | — |
| `CRM Note` → `tabFCRM Note` | `title` | `title`, `content`, `reference_doctype`, `reference_docname` | — |
| `CRM Status Change Log` (child) | — | `from`, `from_date`, `duration`, `to`, `to_date`, `last_status_change_log`, `log_owner`, `from_type`, `to_type` | — |
| `ERPNext CRM Settings` → `tabERPNext CRM Settings` | — | `enabled`, `erpnext_site_url`, `erpnext_company`, `api_key`, `api_secret`, `is_erpnext_in_different_site`, `sync_products`, `create_customer_on_status_change`, `deal_status` | — |

> **Important:** CRM **Lead/Deal progress** is the user-facing operational pipeline. The **Broker Channel** is a different Architech-owned domain and must **not** be modeled as CRM `Deal` unless explicitly agreed (the v8 docs push channel + matching + split into Architech and keep CRM as per-broker operational lead/deal authority).

---

## 3. Database-level detail: Evolution API (exact from `prisma/postgresql-schema.prisma` @ 2.3.7)

**DB engine:** PostgreSQL (or MySQL) via Prisma; Redis for cache/queues. **Never write into this DB directly.** Use the Evolution HTTP API and consume its webhooks.

| Table (model) | Exact fields |
|---|---|
| `Instance` | `id`, `name`, `ownerJid`, `profileName`, `profilePicUrl`, `integration`, `number`, `businessId`, `token`, `clientName`, `disconnectionReasonCode`, `disconnectionObject`, `disconnectionAt`, `createdAt`, `updatedAt` |
| `Session` | `id`, `sessionId`, `creds` (String JSON), `createdAt` |
| `Chat` | `id`, `remoteJid`, `name`, `labels`(JSON), `createdAt`, `updatedAt`, `instanceId`, `unreadMessages` |
| `Contact` | `id`, `remoteJid`, `pushName`, `profilePicUrl`, `createdAt`, `updatedAt`, `instanceId` |
| `Message` | `id`, `key`(JSON), `pushName`, `participant`, `messageType`, `message`(JSON), `contextInfo`(JSON), `messageTimestamp`(Int), `chatwootMessageId`, `chatwootInboxId`, `chatwootConversationId`, `chatwootContactInboxSourceId`, `chatwootIsRead`, `instanceId`, `webhookUrl`, `status`, `sessionId` |
| `MessageUpdate` | `id`, `keyId`, `remoteJid`, `fromMe`, `participant`, `pollUpdates`(JSON), `status`, `messageId`, `instanceId` |
| `Webhook` | `id`, `url`, `headers`(JSON), `enabled`, `events`(JSON), `webhookByEvents`, `webhookBase64`, `createdAt`, `updatedAt`, `instanceId` |
| `Chatwoot` (legacy/v8 unused) | `id`, `enabled`, `accountId`, `token`, `url`, `nameInbox`, `signMsg`, `signDelimiter`, `number`, `reopenConversation`, `conversationPending`, `mergeBrazilContacts`, `importContacts`, `importMessages`, `daysLimitImportMessages`, `organization`, `logo`, `ignoreJids`, `createdAt`, `updatedAt`, `instanceId` |
| `Label` | `id`, `labelId`, `name`, `color`, `predefinedId`, `createdAt`, `updatedAt`, `instanceId` |
| `Proxy` | `id`, `enabled`, `host`, `port`, `protocol`, `username`, `password`, `createdAt`, `updatedAt`, `instanceId` |
| `Setting` | `id`, `rejectCall`, `msgCall`, `groupsIgnore`, `alwaysOnline`, `readMessages`, `readStatus`, `syncFullHistory`, `wavoipToken`, `createdAt`, `updatedAt`, `instanceId` |
| `Media` | `id`, `fileName`, `type`, `mimetype`, `createdAt`, `messageId`, `instanceId` |
| `IntegrationSession` | `id`, `sessionId`, `remoteJid`, `pushName`, `awaitUser`, `context`(JSON), `type`, `createdAt`, `updatedAt`, `instanceId`, `parameters`, `botId` |
| Other models | `Rabbitmq`, `Nats`, `Sqs`, `Kafka`, `Websocket`, `Pusher`, `Typebot`, `TypebotSetting`, `OpenaiCreds`, `OpenaiBot`, `OpenaiSetting`, `Template`, `Dify`, `DifySetting`, `EvolutionBot`, `EvolutionBotSetting`, `Flowise`, `FlowiseSetting`, `IsOnWhatsapp`, `N8n`, `N8nSetting`, `Evoai`, `EvoaiSetting` |

**Rules:**
- Architech's account registry maps `organizationId` → Evolution `instanceId` (opaque) → company WhatsApp number.
- Architech calls `/instance/create` (QR/pair), `/message/sendText/{instance}`, lifecycle endpoints.
- Architech subscribes to webhooks and stores only minimal activity markers in its own DB.
- **No cross-repo DB foot in Evolution.** Its PostgreSQL DB is private.
- `Session.creds`, `Instance.token`, `Webhook.headers`, `Proxy.*`, and any `*Creds`/AI secrets are extremely sensitive and must never reach Architech logs, UI, or outbox payloads.

---

## 4. Database-level detail: Architech (our side)

Own DB: **PostgreSQL + Prisma**. Relevant existing domain models (from the docs):
- `Organization`, `BrokerUser`, `BrokerOrganization`, `Listing`, `Requirement`, `Lead` (masked phone), `Locality`/`City`, consent/audit stores.
- New channel models (already designed in `broker-channel-implementation-design.md`): `ChannelRequest`, `ChannelMatch`, `ChannelDeal`, `CommissionEntry`.
- **New integration models required for sharing** (next section).

---

## 5. The "insert way" — cross-repo sharing contract

The goal: Architech data must be **easy, safe, idempotent** to share into Frappe CRM / ERPNext / Evolution without any system reaching into another's DB.

### 5.1 Rule #1: never share by direct DB access

| From | To | Correct mechanism | Wrong mechanism |
|---|---|---|---|
| Architech | Frappe CRM / ERPNext | `POST /api/method/business_suite_core.api.*` (HTTP) | INSERT into `tabCustomer`, `tabSales Invoice`, etc. |
| Architech | Evolution | Evolution HTTP API + signed webhooks | INSERT into Evolution `Message`/`Instance` |
| Frappe site | Architech (read-back) | Frappe API / webhook with HMAC | Direct join across databases |
| Any repo | Any repo | Versioned JSON contract | Cross-database FK/trigger |

### 5.2 Rule #2: every shared record carries a stable external identity

Each pushed object must carry:
- `source_system` = `architech`
- `source_object_type` = `channel_deal` | `channel_match` | `channel_request` | `lead`
- `source_object_id` = Architech `cuid` (e.g. `deal_9y...`)
- `idempotency_key` = `${source_system}.${source_object_type}.v1.${source_object_id}` (one version of the object)
- `payload_hash` = SHA-256 of canonical JSON payload, so retries with changed data are detected.
- `schema_version` = e.g. `1`

### 5.3 Rule #3: idempotency lives in the target app, not only the sender

Even with an `idempotency_key`, the target must deduplicate on its own. In `business_suite_core` we add:

**Custom DocType `Architech Integration Log` (Frappe side)**

| Field | Type | Why |
|---|---|---|
| `architech_source` | Data | source system |
| `architech_object_type` | Data | channel_deal / lead / ... |
| `architech_object_id` | Data | source cuid |
| `idempotency_key` | Data (unique, not null) | dedupe |
| `payload_hash` | Data | detect change |
| `schema_version` | Int | version handling |
| `status` | Select: `PENDING / SUCCESS / FAILED / RECONCILED` | integration state |
| `target_document_type` | Link/Data | which ERPNext/CRM doc was created |
| `target_document_name` | Data | `SINV-...` etc. |
| `error_message` | Long Text | for retry |
| `response_json` | JSON | masked response (never raw PII) |
| `processed_at`, `created_at` | Datetime | audit |

**Index / unique:** `Unique on (architech_source, architech_object_type, architech_object_id, idempotency_key)` — one success row per source object+version.

**Custom DocType `Channel Deal Commission` (Frappe side)** — the financial representation of a closed channel deal:
- `channel_deal_id` (external, Data)
- `organization_id` / `broker_name` (business only)
- `total_commission`, `demand_share`, `supply_share` (Currency)
- `split_agreement_json`, `closed_at`, `close_mode`
- `erpnext_entry_reference` (optional Link to Sales Invoice / Journal Entry)
- `status`

### 5.4 Architech side: integration outbox + mappings

Add to Architech Postgres:

```prisma
enum IntegrationStatus { PENDING IN_FLIGHT SUCCESS FAILED RECONCILED }

model IntegrationOutbox {
  id             String   @id @default(cuid())
  sourceSystem   String   // "architech"
  targetSystem   String   // "frappe_crm" | "erpnext" | "evolution"
  targetApp      String?  // "business_suite_core"
  objectType     String   // channel_deal | channel_match | channel_request | lead
  objectId       String   // architech local id
  idempotencyKey String   @unique
  schemaVersion  Int
  payloadHash    String
  payload        Json     // canonical JSON; no end-customer PII
  status         IntegrationStatus @default(PENDING)
  attemptCount   Int      @default(0)
  nextRetryAt    DateTime?
  lastError      String?
  targetDocType  String?
  targetDocId    String?
  processedAt    DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([targetSystem, status, nextRetryAt])
  @@index([targetSystem, objectType, objectId])
}

model ExternalEntityMapping {
  id             String  @id @default(cuid())
  sourceSystem   String
  sourceObjectType String
  sourceObjectId String
  targetSystem   String
  targetDocType  String?
  targetDocId    String  // e.g. SINV-..., CRM-DEAL-..., evolutionInstanceId
  targetExtra    Json?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([sourceSystem, sourceObjectType, sourceObjectId, targetSystem])
}
```

### 5.5 Canonical payload contract (Channel Deal → ERPNext)

```json
{
  "schemaVersion": 1,
  "sourceSystem": "architech",
  "sourceObjectType": "channel_deal",
  "sourceObjectId": "deal_9y...",
  "idempotencyKey": "architech.channel_deal.v1.deal_9y...",
  "payloadHash": "sha256:...",
  "operation": "upsert",
  "docType": {
    "type": "custom:Channel Deal Commission",
    "targetDoctype": "Journal Entry",
    "submit": true
  },
  "deal": {
    "channelDealId": "deal_9y...",
    "closeMode": "DUAL",
    "closedAt": "2026-09-03T12:00:00.000Z",
    "totalCommissionInr": 500000,
    "demandBrokerShareInr": 250000,
    "supplyBrokerShareInr": 250000
  },
  "counterpartyBusiness": {
    "organizationName": "Skyline Realty",
    "businessPhone": "+91-98xxxxxxxx",
    "verificationStatus": "verified"
  },
  "sanitizedProperty": {
    "city": "ahmedabad",
    "locality": "thaltej",
    "propertyType": "apartment",
    "intent": "BUY",
    "bhk": 3,
    "priceInr": 11200000
  }
}
```

**PII rule:** this payload contains business/broker contact only. Never include buyer/seller phone, email, address, raw message, `phoneCiphertext`, or reversible customer key.

### 5.6 End-to-end flow for a Broker Channel close

```text
Architech
  └── ChannelDeal → CLOSED
        ├── create CommissionEntry for each org (Architech ledger)
        ├── append IntegrationOutbox rows:
        │     → target frappe_crm (Lead/Deal projection)
        │     → target erpnext (Channel Deal Commission + optional Journal Entry)
        └── notify only in Architech UI/PWA (brokers see business phone + wa.me/tap-call)

Worker
  ├── POST {frappe-site}/api/method/business_suite_core.api.sync_channel_deal
  │     headers: X-Architech-Idempotency-Key, X-Architech-Payload-Hash, HMAC
  │     body: canonical payload from §5.5
  │        └── business_suite_core dedupes via Architech Integration Log
  │             → creates Channel Deal Commission
  │             → optional configured Journal Entry / Sales Invoice (behind flag)
  │             → returns { status, targetDocumentType, targetDocumentName }
  └── update IntegrationOutbox.status + ExternalEntityMapping.targetDocId
      on failure → retry with backoff / dead-letter → RECONCILED
```

### 5.7 Evolution sharing (non-data-share)

- `Channel notifications` stay **Architech only** — no Evolution send for the channel.
- The only Evolution integration used for business suites is the **customer lead WhatsApp transport**, which is separate from channel records.
- Even there: Architech writes only `idempotency_key`, `provider_message_key`, `status` to its own DB. Evolution owns message history.

---

## 6. Why this design answers "insert way so data can be shared easily"

| Concern | Design answer |
|---|---|
| One DB per repo | No cross-DB joins/FK/triggers; only HTTP/webhook contracts. |
| Easy to add a new repo | Add a `targetSystem` in IntegrationOutbox + a handler. No schema change on the target. |
| No duplicate rows | Deterministic `idempotency_key` + target-side unique `Integration Log`. |
| Retry-safe | `payload_hash` detects changed payload; retry uses same key → duplicate detected. |
| Traceable | Architech maps `sourceObjectId → targetDocId`. |
| Auditable | Both sides keep status/attempt/error response. |
| Safe privacy | Canonical payload is sanitized and PII-free; business contact only. |
| Not coupled to upstream forks | We don't fork Frappe/ERPNext/Evolution; `business_suite_core` is our only custom site app. |
| Cost-safe | Only self-hosted, pinned, idempotent APIs; no paid per-record insert service. |

---

## 7. Next steps to implement

1. Create `business_suite_core` Frappe app with:
   - `Architech Integration Log` and `Channel Deal Commission` DocTypes + unique idempotency key.
   - `sync_channel_deal` whitelisted endpoint with HMAC + payload-hash check.
2. Add Architech Prisma models `IntegrationOutbox` + `ExternalEntityMapping`.
3. Add an outbox worker that calls Frappe CRM/ERPNext custom methods (and Evolution API separately), with exponential retry and dead-letter.
4. Add a reconciliation job: compare Architech outbox state vs `Architech Integration Log` on each Frappe site.
5. Write contract tests: duplicate call no-op, retry no-op, missing/ changed hash rejected, PII field leak test, cross-org isolation test.
