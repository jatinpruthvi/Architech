# Real-estate portal lead ingestion — Housing.com, MagicBricks, 99acres

**Date:** 08 Sep 2026
**Status:** Design. Extends the ingestion spine in [`feature-coverage-mapping.md`](./feature-coverage-mapping.md) §5 — for the Real Estate profile these adapters come **before** the IndiaMart/JustDial/TradeIndia class, because they are the vertical's actual demand channels. **Not a decision**; the consent-handling choice in §4 is flagged for product sign-off.
**Question answered:** how do leads from Housing.com, MagicBricks and 99acres get into the Frappe CRM site, given the site is the real-estate vertical of the business suite.

**Evidence (verified 08 Sep 2026):**

| Portal | Mechanism (confirmed) | Source |
|---|---|---|
| **MagicBricks** | **Push Integration**: MagicBricks POSTs a lead JSON (`name`, `email`, `country_code`, `phone`, `project_name`, `project_id`, `city`, `locality`, `min_budget`, `max_budget`, `remarks`) to an API endpoint you provide | ANAROCK push-integration documentation with the full payload schema |
| **99acres** | **Webhook push** (configure a webhook URL inside the 99acres business account) **and periodic pull** (account credentials; leads/activities/tasks every 15 min) | LeadSquared 99acres connector documentation (both modes described) |
| **Housing.com** | **Push, partner-activated** (integration type "PUSH": you send your endpoint details to the Housing.com team, they activate it on their side) **and pull** (`Housing Id` + `Secret Key`, default 3-hour sync) | NeoDove integration guide (PUSH flow); LeadSquared Housing connector (webhook + Id/secret pull); Leadrat API docs (Housing listed as pull-type with username/password) |
| Extended family | Same pattern covers Quikr Homes, CommonFloor, RoofandFloor, Makaan, EstateDekho, PropertyWala, RealEstateIndia | Leadrat third-party integration documentation |

All of these are **advertiser/business-account features, not public APIs**: the broker needs an active (usually paid) listing account with each portal. None of them requires scraping — and scraping is prohibited twice over (portal ToS, and this repository's normative architecture lists scraped portal data under `prohibited_sources`).

---

## 1. The four ingestion patterns

### 1.1 Portal push → gateway (primary)

```text
Buyer enquires on portal listing
  → portal POSTs lead JSON to the business's gateway endpoint
      (per-tenant URL;  portal-specific API key / secret verified per request)
  → gateway: authenticate, dedupe, stamp consent provenance
  → normalize (§2) → Frappe CRM Lead via the same ingestion contract as every
     other source → assignment rules route to the locality owner (v8 §6)
```

- The gateway exposes **one endpoint per portal per tenant** (`/ingest/{portal}/…`), token-authenticated, never public-unauthenticated. Portal payloads differ; the gateway maps them onto the internal lead schema.
- MagicBricks pushes directly. Housing.com requires emailing their team to activate the push (their partner flow). 99acres has the webhook config in the account panel.
- **Push is the preferred mode everywhere it exists**: real-time, no stored portal credentials, no polling load.

### 1.2 Scheduled pull (where push is unavailable)

For portals/accounts that only support pull (Housing Id + secret; 99acres periodic sync):

```text
scheduled worker (per business, per portal)
  → authenticate with the portal credentials held in the tenant's secret store
  → fetch new leads since the last cursor
  → same normalize → dedupe → CRM path
```

- Credentials live in the **tenant's own secret store**, never in code or logs (same rule as the Evolution/R2 credentials).
- Pull frequency: 15–30 min is the LeadSquared-class norm; the first-touch SLA (assignment badge, v8 §5) tolerates this comfortably.

### 1.3 Email-parse fallback

Every portal also emails lead alerts to the account's registered address. An IMAP ingestion adapter (poll the mailbox, parse portal templates, extract fields) covers accounts without API access. **Design constraints:** treat templates as unstable (version the parsers per portal, alert on parse failures instead of guessing), keep it a fallback — never the primary channel — and record the email as the evidence trail for the lead.

### 1.4 Manual / bulk import

Portal dashboards export leads (Excel/CSV). Frappe's native **Data Import** covers this with zero build — it is the onboarding path for a broker's historical lead backlog on day one, before any adapter is connected.

## 2. Normalization — where Architech's registry earns its keep

> **Normative contract:** the internal lead schema, source taxonomy and consent-provenance model described here are specified and implemented in [`lead-ingestion-contract.md`](./lead-ingestion-contract.md) with the TypeScript reference at `client/src/lib/interop/lead-ingestion.ts` (tested). Adapters build against that contract; the tables below are the portal-specific translations.

A portal lead is already the domain we model. The normalize step maps portal fields onto the **same vocabulary the platform uses everywhere else**:

| Portal payload | Internal field | Note |
|---|---|---|
| `city`, `locality` | City/Locality via **Architech's city/locality registry** (slug-resolved, fuzzy-matched with a manual-review queue for unknown names) | This is the differentiator generic CRMs don't have: leads land already scoped to the routing geography (v8 §6 area→employee→account mapping) |
| `min_budget` / `max_budget` | budget range (INR, integer-safe) | |
| `project_name` / `project_id` | listing/project reference | Cross-reference against the broker's own inventory; unknown project = note, not a lookup failure |
| `phone` + `country_code` | E.164 `mobile_no` | **Mandatory**: CRM WhatsApp-tab matching and SIM-dial actions depend on it (`interop/phone.ts` contract) |
| `remarks` (e.g. *"looking for 3 BHK … for Sale in Goregaon West"*) | parsed → BHK, intent (buy/rent), property type | The same deterministic grammar approach as `search/parse-query.ts`; unparsed remainder stays in a note — lossless |
| — | `source`: portal id + `subsource` | The standardized source taxonomy from the coverage mapping |
| — | **consent provenance**: `portal-shared` | See §4 |

Every adapter (portals, IndiaMart-class, Meta Ads, website) writes the **same internal lead schema**; only the front translator differs. That contract is the build artifact — each portal adapter on top of it is Small.

## 3. Dedupe — the portal reality

The same buyer enquires on multiple portals for the same property (and portals resell leads). Dedupe is therefore **part of ingestion, not a report**:

1. Primary key: normalized `mobile_no` (+ city scope for same-number-different-city edge cases).
2. On match: **merge into the existing lead**, append the new source to a `sources[]` list (source attribution must be multi-valued — "came via MagicBricks *and* 99acres" is normal), and update the freshest requirement fields only.
3. Never silently drop a duplicate: the merge event is logged, because paid-lead accounting (which portal delivered what) depends on honest counts.

## 4. Consent provenance and first touch (DECIDE)

A portal lead's buyer consented **to the portal**, which resells/shares the enquiry with listing brokers. That is real but *lukewarm* consent, and DPDP scrutiny of exactly this resale chain is active (portals publish grievance officers for lead-sharing erasure requests). The design rule until a product decision says otherwise:

- Portal leads are stamped `consent_provenance: portal-shared` at ingestion.
- **Human first-touch by default**: the assigned employee contacts from the CRM (WhatsApp tab / `Call from SIM`). Automated first messages remain reserved for leads whose consent the business itself captured (Architech enquiries, website forms).
- Suppression/`STOP` applies to portal leads like any other, and a DPDP erasure/stop request from the buyer must be enforceable in our CRM regardless of what the portal does.
- Portal ToS on lead handling (retention, re-contact, resale prohibition) gets a legal-review line item in the §6 gates.

If the business later wants automated first-touch on portal leads, that is an explicit v8-style amendment with consent evidence — not an implementation detail.

## 5. What each party does (setup reality)

| Step | Who | Action |
|---|---|---|
| 1 | Broker | Hold an active business/listing account per portal (this is the paid part — lead packages/credits are the broker's own cost, like Meta billing) |
| 2 | Platform | Provision the tenant's gateway ingest endpoints + keys |
| 3 | Broker/Platform | MagicBricks: configure the push endpoint on the account; 99acres: set the webhook URL in the account panel; Housing.com: email the integration details to the Housing team for activation; pull-only accounts: store credentials in the tenant secret store |
| 4 | Platform | Verify round-trip with a test lead; enable assignment routing for the new source |
| 5 | Broker | Day-one backlog: export portal CSVs → Frappe Data Import |

## 6. Gates before production

1. Per-portal payload contract fixtures (freeze the observed schema per portal; alert on drift).
2. Dedupe/merge negative tests (same number via three portals → one lead, three sources, no data loss).
3. Consent-provenance tagging enforced at the contract level (an adapter cannot emit a lead without it).
4. Erasure drill: a buyer stop/erasure removes the lead and its phone from CRM, adapters' cursors, and any synced calendar/todo — with the same tombstone discipline as the requirements purge.
5. Legal review of each portal's lead-handling ToS before selling the suite with that connector enabled.
6. No scraping, ever: if a portal offers no export path, that portal stays on manual import — not a scraper.

## 7. Build order (amends the coverage mapping §5)

For the **Real Estate profile**, the ingestion spine orders: **Architech/website enquiries (designed, InteropOutbox) → MagicBricks push → 99acres (webhook, then pull) → Housing.com (push via their team, then pull) → email-parse fallback → CSV import (day one)** — and *then* the horizontal IndiaMart/JustDial/TradeIndia/Google Ads/Sheets adapters for non-real-estate businesses. The portal adapters reuse the identical normalize→dedupe→CRM contract, so the vertical and horizontal families are one build, sequenced by customer need.

**Strategic note, stated honestly:** portal leads are **rented demand** — priced per lead, resold to multiple brokers, and gone when the package ends. The platform's owned channel is Architech itself: public discovery pages that rank and convert are the lead source no competitor can resell. The portal adapters exist because brokers *already* buy those leads today; the product's answer to "where do leads come from" should remain Architech first, portals second.
