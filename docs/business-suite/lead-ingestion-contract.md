# Lead ingestion contract — the one schema every lead source normalizes to

**Date:** 08 Sep 2026
**Status:** Contract v1, implemented. The normative TypeScript reference lives at [`client/src/lib/interop/lead-ingestion.ts`](../../client/src/lib/interop/lead-ingestion.ts) with tests in `lead-ingestion.test.ts` (11 passing; `pnpm exec vitest run client/src/lib/interop/lead-ingestion.test.ts`). The Frappe-side implementation (`business_suite_core`) mirrors this in Python.
**Builds on:** [`real-estate-portal-lead-ingestion.md`](./real-estate-portal-lead-ingestion.md) (per-portal mechanisms) and [`feature-coverage-mapping.md`](./feature-coverage-mapping.md) §5 (the ingestion spine). This document is the contract those adapters build against.
**Consumers:** portal adapters (MagicBricks/99acres/Housing/…), B2B aggregator adapters (IndiaMart/JustDial/TradeIndia), Meta/Google lead-form flows, the website/Architech enquiry projection, CSV import, email-parse, and the CRM writer in `business_suite_core`.

---

## 0. The contract in one paragraph

Every lead, whatever its origin, is translated by its adapter into **one validated internal shape** before it touches anything else. Validation is total: it collects every error, normalizes what it accepts (E.164 mobile, lowercase email, bounded strings), and refuses to guess (unknown source = contract break, not free text; unreachable phone = rejection, not a maybe). The lead carries its **source taxonomy** (who produced it, what class of channel) and its **consent provenance** (what the buyer actually agreed to, and what that permits) as first-class fields — because dedupe is a cross-source problem and contact permission is a per-source fact, both must be decided at ingestion, never at send time.

## 1. Source taxonomy

Registry: `LEAD_SOURCES` in the module. IDs are stable, lowercase, hyphenated; they are provisioned as `CRM Lead Source` records on each business's Frappe site (the CRM's `source` field is a Link to that doctype — verified at `crm/fcrm/doctype/crm_lead/crm_lead.json` v1.83.0).

| Source id | Label | Medium | Channel class |
|---|---|---|---|
| `architech-website` | Architech Website | owned-web | digital-owned |
| `website-form` | Website Form | owned-web | digital-owned |
| `whatsapp` | WhatsApp Inbound | messaging | digital-owned |
| `walkin` / `referral` | Walk-in / Referral | offline | offline |
| `magicbricks`, `99acres`, `housing`, `quikr-homes`, `commonfloor`, `roofandfloor`, `makaan` | Property portals | portal | third-party-shared |
| `indiamart`, `justdial`, `tradeindia` | B2B aggregators | aggregator | third-party-shared |
| `meta-ads` | Meta Lead Ads | paid-social | digital-paid |
| `google-ads` | Google Lead Forms | search-ads | digital-paid |
| `csv-import`, `email-parse`, `manual` | Import surfaces | import | import |

`subsource` (optional, ≤140 chars) qualifies within a source: the portal listing package, the campaign name, the sync source. Adding a **source id** is a contract change (`LEAD_INGESTION_CONTRACT_VERSION` bump consideration); adding a subsource is configuration.

## 2. Consent provenance model

Registry: `CONSENT_CLASSES`. The permission matrix is resolved at ingestion and carried on the lead.

| Class | Definition | Human first touch | Automated WhatsApp | Automated email | Default retention |
|---|---|---|---|---|---|
| `first-party-form` | Consent captured on this business's own surface (Architech enquiry, own website form) | ✅ | ✅ | ✅ | 180 d |
| `ad-opt-in` | Buyer submitted a Meta/Google lead form for this business's ad | ✅ | ⚠️ only with `whatsappOptInEvidence` | ✅ | 180 d |
| `portal-shared` | Portal enquiry shared with listing brokers; consent was given **to the portal** | ✅ | ❌ | ❌ | 90 d |
| `aggregator-shared` | B2B aggregator lead (IndiaMart/JD/TI); consent was given **to the aggregator** | ✅ | ❌ | ❌ | 90 d |
| `walk-in-verbal` / `referral-verbal` | Offline, verbal only | ✅ | ❌ | ❌ | 90 d |
| `imported-unknown` | CSV/email backlog, no provable provenance | ✅ | ❌ | ❌ | 30 d |

Rules the code enforces:

1. **A lead cannot exist without consent provenance.** `consentClass`, `capturedAt`, and `evidence` (a bounded reference: webhook id, form submission id, email Message-ID, employee id — never free text about a person) are required; an adapter that cannot state them cannot emit a lead.
2. **`ad-opt-in` downgrades, not rejects.** Without the form's WhatsApp-checkbox evidence the lead still ingests (the buyer opted in — it is contactable) but `automatedWhatsAppFirstTouch` resolves to `false`. Rejecting would discard a contactable lead over a send-mode detail.
3. Retention defaults align with the platform's existing purge posture (`ARCHITECH_REQUIREMENT_RETENTION_DAYS=180` for first-party); final numbers are the legal review's to set.
4. `purpose` defaults to `real-estate-enquiry`; per-purpose consent and expiry are carried for the DPDP purpose-limitation story.

## 3. The normalized lead schema

```
IngestedLeadInput                                  (validated → NormalizedLead)
├─ source: LeadSourceId            required        registry id, not free text
├─ subsource?: string              ≤140
├─ providerLeadId?: string                         the source's own lead id
├─ occurredAt: string (ISO)        required        when it happened AT THE SOURCE
├─ name: { first? last? full? }    first-or-full   portals send both shapes
├─ mobile: string                  required        → E.164 via normalizeIndianPhone
├─ email?: string                                  → lowercase, pattern-checked
├─ city? / locality?: string       ≤140            raw; registry resolution is downstream
├─ budgetMinInr? / budgetMaxInr?   safe ints       0 < n ≤ ₹10 lakh crore; min ≤ max
├─ bhk?: int                       1–10
├─ intent?: buy|rent|sell|rent-out
├─ propertyType?: apartment|rowhouse|villa|penthouse|plot   (Prisma PropertyType vocabulary)
├─ projectName? / projectId?: string ≤140          unknown project = note, not lookup failure
├─ remarks?: string                ≤140*           verbatim requirement text (see below)
└─ consent: { consentClass, purpose?, capturedAt, evidence, expiresAt?, whatsappOptInEvidence? }
```

`NormalizedLead` adds: `contractVersion`, resolved `source` metadata, `dedupeKey` (= E.164 mobile), and the resolved consent `permissions`.

Notes:
- Every human-visible string is bounded to **Frappe's varchar(140)** (`FRAPPE_DATA_MAX`) so nothing silently truncates on the receiving side — the same discipline as `idempotency.ts`. *Remarks on the Frappe side land in a Note (Long Text), so the 140 bound applies to the envelope field; the verbatim text itself travels whole inside the note payload.
- `dedupeKey` is the E.164 mobile produced by the shared normaliser (`interop/phone.ts`) — the one function ERPNext/CRM exact-match identity already depends on. Phone shapes that collapse: `9876543210`, `+919876543210`, `09876543210`, `+91 98765 43210` → one key (tested).
- City/locality arrive raw here; **registry resolution** (Architech's city/locality registry, fuzzy match with a manual-review queue) is the next downstream step, not the adapter's job.

## 4. Ingestion idempotency and dedupe/merge

- **Idempotency** (`ingestIdempotencyKey(source, providerLeadId)`): bounded to 128 chars via `buildIdempotencyKey`; a huge provider id **hashes, never truncates** (truncation would collide two leads onto one CRM record). Re-delivery is normal — portals retry webhooks, pull windows overlap, mailboxes re-parse.
- **Dedupe** is the `dedupeKey` (E.164 mobile): same human → existing lead, with the new source appended to a multi-valued `sources[]` (buyers multi-portal; attribution must survive), freshest requirement fields updated, and the merge **event-logged** (paid-lead accounting depends on honest per-source counts). Never silent-drop a duplicate.
- Same-number-different-city edge cases scope the match key (mobile + city scope); the merge rule is the same.

## 5. Gateway ingest API (the surface adapters call)

```text
POST /ingest/{source}                      per-tenant, per-source token auth
Authorization: Bearer <tenant-scoped ingest token>
Body: IngestedLeadInput (contract v1)

200 { ok: true,  lead: NormalizedLead }                 created or merged (see headers)
200 { ok: true,  duplicate: true, leadId }              idempotent re-delivery
422 { ok: false, errors: string[] }                     contract violations — do NOT retry unchanged
5xx { ok: false, errors: string[] }                     transient — retry with backoff
```

Rules: tokens are **per tenant + per source** (a MagicBricks token cannot write `source: 99acres`); the gateway rejects unauthenticated origins outright; 422 responses are poison-quarantined with the raw payload retained (bounded retention) for adapter fixing — they are contract breaks, not load. Burst/rate limits per token; every accept/reject is audit-logged with the evidence reference.

## 6. Frappe CRM target mapping (the writer in `business_suite_core`)

| Internal | Frappe CRM (`CRM Lead`) |
|---|---|
| `name.first` / `name.last` / `name.full` | `first_name` / `last_name` / split of `full` |
| `mobileE164` | `mobile_no` (E.164 — exact-match identity, see `interop/phone.ts`) |
| `email` | `email` |
| — | `status` → the site's New status; assignment rules route `lead_owner` per locality mapping (v8 §6) |
| `source.id` | `source` → Link to the provisioned `CRM Lead Source` record |
| `subsource`, `consent.*`, `intent`, `bhk`, `propertyType`, budgets, project refs | custom fields (fixtures in `business_suite_core`), all varchar-bounded per §3 |
| `remarks` | a CRM **Note** (verbatim record of the enquiry) |
| parsed requirement fields (additive, lossless — the `parse-query` grammar approach) | side-panel fields / Note append |
| `dedupeKey` | the writer's merge key (custom field, unique per merge scope) |
| `providerLeadId` + `ingestIdempotencyKey` | ingestion log table (dedupe + paid-lead accounting) |

## 7. Per-adapter mapping tables

**MagicBricks (push, verified payload):** `name`→`name.full`; `country_code`+`phone`→`mobile`; `email`; `city`; `locality`; `min_budget`/`max_budget`→budgets (INR ints); `project_name`/`project_id`; `remarks` (verbatim, e.g. *"looking for 3 BHK … for Sale in Goregaon West"* → parsed additively into `bhk`/`intent`); consent: `portal-shared`, evidence `magicbricks:push:{payload-ref}`.

**99acres (webhook + pull):** webhook body and pull lead objects are frozen as fixtures on first live capture (per the drift-fixture rule); consent `portal-shared`, evidence `99acres:{webhook-id|sync-window}`.

**Housing.com (partner-activated push + Id/secret pull):** same treatment; consent `portal-shared`, evidence `housing:{activation-ref|sync-window}`.

**IndiaMart / JustDial / TradeIndia (pull):** lead objects frozen as fixtures on first capture; consent `aggregator-shared`, evidence `{portal}:{query-id|sync-window}`. Requirement text parses additively exactly like portal remarks.

**Meta Lead Ads (native CRM `lead_syncing` module):** the CRM creates the lead itself; `business_suite_core` stamps the taxonomy on sync (map the sync source → `meta-ads`, `ad-opt-in`, evidence = the form-lead id; `whatsappOptInEvidence` only when the form carried the checkbox — map that custom field explicitly). **Full channel design — including Click-to-WhatsApp ads (which arrive as transport inbound, `whatsapp` source, user-initiated consent) and the DM-capture decision — is in [`meta-lead-sources.md`](./meta-lead-sources.md).**

**Google Ads lead forms:** webhook → this contract; `ad-opt-in` likewise.

**Architech / website (first-party):** the enquiry's consent text and submission record are the evidence (`architech:enquiry:{id}` / `web:{form-submission-id}`); consent `first-party-form`. On the Architech side this rides the existing `lead.created` projection (InteropOutbox) — v8 §9's gaps (encrypted contact storage, opaque idempotency material) apply to that path and are tracked there.

**CSV import / email-parse / manual:** `imported-unknown` (or a better class if the import sheet can prove provenance per row — e.g. a "source" column validated against the registry); evidence = import batch id / Message-ID / employee id.

## 8. Acceptance gates

1. The module's 11 contract tests pass (phone-shape collapse, permission matrices, ad-opt-in downgrade, unknown-source/consent rejection, budget bounds, key bounding/hashing, registry consistency).
2. Per-source **payload fixtures** frozen on first live capture; drift alerts on shape change (never guess a moved field).
3. Negative: an adapter emitting a lead without consent provenance is unrepresentable (type-level + runtime).
4. Merge: one number via three portals → one lead, three `sources[]` entries, merge event logged, no field loss.
5. Erasure drill: buyer stop/erasure removes lead, phone, notes, and ingestion-log PII with tombstones (extends the existing purge runbook).
6. Legal review per portal/aggregator ToS before enabling that connector on a sold site.

## 9. Open items (DECIDE)

- Final retention numbers per class (legal review; defaults in code are 180/90/30).
- Whether `ad-opt-in` **email** automation needs its own opt-in evidence (currently allowed with the form consent).
- The broadcast audience question remains separate (see [`feature-coverage-mapping.md`](./feature-coverage-mapping.md) §4.1) — this contract governs **lead ingestion**, not campaign audiences.
