# Broker Channel — Designing the DB for ERPNext/Frappe Consumability

**Status:** Findings + binding schema rules, before channel implementation
**Verified against pinned upstream source** (cloned `--depth 1`, HEADs confirmed):

| Repo | Tag | HEAD | Verified |
|---|---|---|---|
| `frappe/frappe` | `v16.33.0` | `33bf510` | ✅ matches pin |
| `frappe/crm` | `v1.83.0` | `52c500d` | ✅ matches pin |
| `frappe/erpnext` | `v16.34.1` | `0b50853` | ✅ matches pin |
| `evolution-foundation/evolution-api` | `2.3.7` | `cd800f2` | ✅ matches pin |
| `frappe/hrms` | `v16.17.1` | `e1481b5` | ✅ matches pin |
| `resilient-tech/india-compliance` | `v16.9.0` | `071b544` | ✅ matches pin |

Clones are scratch (`/tmp/refclones`) and intentionally not committed. This document is
the persistent record — see `upstream-repo-checkout-guide.md` §Issue 2.

---

## 0. Why this document exists

The channel design (`broker-channel-implementation-design.md`) specifies an automatic
ERPNext write on deal close. If Architech's schema is shaped without regard to what
Frappe's ORM physically accepts, every sync becomes a lossy translation layer with
rounding bugs and truncation. Reading the actual upstream source surfaced **five
hard constraints and one existing bug** that must shape the Prisma schema *now*,
because they are cheap to honour up front and expensive to retrofit after migration.

---

## 1. Hard constraints found in upstream source

### 1.1 `VARCHAR_LEN = 140` — every identifier we send

`frappe/frappe/database/database.py:91` sets `VARCHAR_LEN = 140`, and
`frappe/frappe/database/mariadb/database.py:192-208` maps these fieldtypes to
`varchar(140)`:

```
Data, Link, Dynamic Link, Select, Read Only, Color, Icon, Phone, Autocomplete
```

**Implication:** any Architech identifier that lands in a Frappe `Data` or `Link`
field must be **≤ 140 characters**, and silently truncates otherwise.

Our `cuid()` values are 25 chars, so raw IDs are safe. The risk is **composite
idempotency keys**. The design doc's example is:

```
channel.close.v1.deal_9y...
```

A key built as `channel.close.v1.<dealId>.<organizationId>.<closeVersion>` is
`16 + 25 + 1 + 25 + 1 + 2 ≈ 70` chars — safe. But a key that concatenates a payload
hash or multiple IDs can exceed 140. **Rule: bound the idempotency key to 128 chars
and enforce it with a DB check constraint on the Architech side**, so we fail loudly
in our own database rather than silently truncating in MariaDB and creating a
duplicate-key collision that maps two different deals onto one ERPNext doc.

### 1.2 `Currency` is `decimal(21,9)` — NOT an integer

`frappe/frappe/database/mariadb/database.py:176`:

```python
"Currency": ("decimal", "21,9"),
```

The design doc models money as `BigInt` INR (`totalCommissionInr`, `priceInr`,
`budgetMaxInr`). ERPNext will receive these into a **9-decimal-place fixed-point
column**, 12 integer digits + 9 fractional.

This is actually *good* — 12 integer digits caps at ₹999,999,999,999 (~₹1 lakh crore),
far above any brokerage commission — but it creates two obligations:

1. **JSON serialisation.** `BigInt` does not survive `JSON.stringify`. Sending
   `500000` as a JS number is fine up to 2^53, but sending it as a `BigInt` throws.
   **Rule: serialise all money fields to decimal *strings* in the sync payload**
   (`"500000.000000000"`), never JS numbers, never raw `BigInt`. Strings avoid both
   the throw and float drift.
2. **Rounding is our responsibility.** Because ERPNext stores 9 decimals, a split of
   ₹500000 three ways will not reconcile if we let ERPNext round. We store whole
   paise/rupees as `BigInt` and validate `demandShare + supplyShare == total` *in
   Architech* before the write. Never let the remainder be resolved downstream.

**Keep `BigInt` in Prisma.** It is the correct choice — it is exact, and it maps
cleanly to a decimal string. Do not switch to `Float`.

### 1.3 Standard Frappe columns are reserved

`frappe/frappe/model/__init__.py:86-92` — every DocType gets:

```
name, owner, creation, modified, modified_by, docstatus, idx
```

**Rule:** the `Channel Deal Commission` DocType we create in `business_suite_core`
must not define fields with these names, and our payload must not use them as
top-level keys. Note `modified` in particular — a natural name for a sync timestamp,
and a collision.

Also note `name` is the primary key and is itself `varchar(140)`. If we ever want the
ERPNext doc to be *named after* our deal ID (attractive for reconciliation), it fits —
but see §1.5 on why that is still risky.

### 1.4 `Journal Entry` and `Sales Invoice` are submittable — idempotency is not enough

Both `journal_entry.json` and `sales_invoice.json` carry `"is_submittable": 1`.
Submittable documents have a `docstatus` lifecycle:

```
0 = Draft   →   1 = Submitted   →   2 = Cancelled
```

A cancelled document **still exists** and still holds its unique field values. This
breaks the naive idempotency model in the design doc, which assumes
"key exists → return `duplicate: true`".

**Scenario that breaks it:** we post a commission Journal Entry, an accountant
cancels it (docstatus 2), we retry the sync. Our idempotency check finds the
cancelled doc and reports `duplicate: true` — but no live financial record exists.
The commission silently vanishes from the books while Architech shows `SUCCESS`.

**Rule:** the idempotency lookup must return the doc *and its `docstatus`*, and the
handler must distinguish:

| Found state | Response |
|---|---|
| No doc | create → `"created"` |
| `docstatus 0/1` | `"duplicate"`, return existing ref |
| `docstatus 2` (cancelled) | `"cancelled_upstream"` — do **not** silently succeed |

Architech must model `ErpnextSyncStatus.CANCELLED_UPSTREAM` and surface it in the
admin reconciliation queue described in §5.6 of the design doc. This is exactly the
"orphan state" that section anticipates, but the design doc does not name the
cancellation cause.

**Corollary:** the tracking DocType (`Channel Deal Commission`) should be
**non-submittable** so it is a stable, always-present idempotency anchor, with the
optional financial posting linked *from* it. That keeps the audit record immune to
accountant-side cancellation.

### 1.5 Party references are `Dynamic Link`, not plain foreign keys

`journal_entry_account.json`:

```
party_type  | Link         | DocType
party       | Dynamic Link | party_type
```

`party` is resolved through `party_type` at runtime — there is no referential
integrity. A broker organization posted as a party must already exist as a
`Customer` or `Supplier` doc in *that business's own site*.

**Implication for our schema:** the counterparty brokerage in a channel deal is a
party in the *other* brokerage's books. We cannot assume it exists. **Rule: the sync
payload carries `counterpartyBusinessName` as a plain `Data` string, and the Frappe
handler is responsible for find-or-create of the party** — Architech never sends a
Frappe primary key it did not itself receive back from that site. This is already
the shape in the design doc's payload; this finding confirms it is the *only* safe
shape.

### 1.6 Precedent: `CRM Lead.facebook_lead_id` is `unique`

`crm_lead.json` marks `facebook_lead_id` as `Data | unique`. This is upstream's own
pattern for "external system ID, deduplicated at the DB level."

**Rule:** mirror it exactly. `Channel Deal Commission` gets
`architech_idempotency_key | Data | unique` and
`architech_channel_deal_id | Data | indexed`. Using a `unique` DB constraint rather
than an application-level check is what makes concurrent retries safe.

---

## 2. Existing bug found in our own schema

`prisma/schema.prisma:601`:

```prisma
priceInr             Int
```

`Listing.priceInr` is a **32-bit signed integer**, capping at **₹2,147,483,647
(~₹214 crore)**. The channel design doc specifies `BigInt` for `priceInr` and
`budgetMaxInr`.

Two problems:

1. **A genuine ceiling.** ₹214 crore is reachable for commercial property and land
   in Ahmedabad, and certainly in Mumbai/Delhi if the product expands. An overflow
   here is a hard insert failure, not a rounding error.
2. **Type mismatch across the join.** `ChannelRequest.priceInr` (BigInt) will be
   populated from `Listing.priceInr` (Int) via `sourceListingId`. Mixing widths on a
   field that feeds a financial sync invites silent coercion bugs.

**Recommendation:** widen `Listing.priceInr` to `BigInt` in the same migration that
introduces the channel models. It is a widening change — no data loss, no backfill
logic — but it does require touching every TypeScript read site, since Prisma will
start returning `bigint` instead of `number`. Worth doing now while the blast radius
is small; painful once the channel is live and reading it.

---

## 3. Binding schema rules for the channel models

These amend `broker-channel-implementation-design.md` §2. Everything not listed
stands as written.

1. **Money:** `BigInt` in Prisma, serialised as **decimal strings** in sync payloads.
   Never `Float`, never raw `BigInt` in JSON, never a JS number above 2^53.
2. **Identifiers:** every field destined for a Frappe `Data`/`Link` is **≤ 140 chars**.
   `idempotencyKey` is bounded to **128** and enforced by a DB check constraint.
3. **Reserved names:** no channel field or payload key may be named `name`, `owner`,
   `creation`, `modified`, `modified_by`, `docstatus`, or `idx`.
4. **Sync status enum** gains `CANCELLED_UPSTREAM` alongside the design doc's
   `PENDING / IN_FLIGHT / SUCCESS / FAILED / RECONCILED`.
5. **`ErpnextCloseWrite` gains `erpnextDocstatus Int?`** so reconciliation can detect
   accountant-side cancellation without a second round trip.
6. **Tracking doc is non-submittable**; financial posting is a separate, linked,
   flag-gated document.
7. **No Frappe primary keys flow outward.** Architech stores `erpnextDocId` only as
   an opaque string it received in a response, scoped per organization — never as a
   value it constructs or reuses across sites.
8. **Per-organization sync rows.** `ErpnextCloseWrite` is one row *per participating
   org per deal*, because the two brokerages have separate sites, separate tokens,
   and independently failing writes. The design doc says this; the unique constraint
   must therefore be on `(channelDealId, organizationId, closeVersion)` in addition
   to the unique `idempotencyKey`.

---

## 4. What this does *not* change

- The **privacy boundary is unaffected and unweakened.** Nothing in Frappe's schema
  pressures us to send customer PII; `decimal(21,9)` and `varchar(140)` are
  format constraints, not content ones. The prohibition in §5.3 of the design doc
  stands in full.
- **No upstream fork is needed.** Every constraint above is satisfied by shaping
  *our* schema and *our* `business_suite_core` app. We consume Frappe/ERPNext as
  pinned, unmodified dependencies.
- **Steps 1–7 of the implementation order remain pure Architech work** with no
  Frappe dependency. These rules only bind the shape of fields that will *eventually*
  cross the boundary at step 8.

---

## 4a. Identity resolution — the finding that most shapes the schema

Reading `erpnext/crm/frappe_crm_api.py:115` (v16.34.1) shows how ERPNext decides
whether a contact already exists:

```python
def contact_exists(email, mobile_no):
    email_exist = frappe.db.exists("Contact Email", {"email_id": email})
    mobile_exist = frappe.db.exists("Contact Phone", {"phone": mobile_no})
```

That is an **exact string match on an unnormalised `Data` column**. There is no
canonicalisation on the receiving side. So `+91 98765 43210`, `9876543210` and
`+919876543210` are three different contacts to ERPNext, and one brokerage
becomes three `Customer` records that invoices are then issued against.

**Therefore the canonical format must be decided on our side, before the value
crosses.** `lib/interop/phone.ts` normalises to E.164 and is the only sanctioned
way to populate `businessPhoneE164`. The column is `varchar(20)` so free text
cannot be stored in it.

### Linkage convention

Frappe CRM's own ERPNext integration links the two systems with plain `Data`
custom fields carrying the foreign key — `crm_deal` on Quotation and Customer,
`erpnext_item_code` on CRM Product (`erpnext_crm_settings.py:100-145`). There are
no real foreign keys across the boundary, because the systems are separate
databases.

We mirror that convention exactly: `erpnextCustomerId`, `frappeCrmOrgId`,
`frappeCrmLeadId`, `remoteDocId`, all `varchar(140)`, all holding values a remote
site handed us. We never construct a Frappe key.

Crucially these are scoped, **not globally unique**. Two brokerages run separate
sites that will both mint `CRM-LEAD-2026-00001`. `Lead.frappeCrmLeadId` is
therefore unique per `(organizationId, frappeCrmLeadId)`; a global index would
reject the second brokerage's perfectly valid lead.

### Upstream's ingestion pattern, adopted

`crm/lead_syncing/` is Frappe CRM's own external-ingestion framework, and its
shape is worth copying rather than inventing:

| Upstream mechanism | Our equivalent |
|---|---|
| `facebook_lead_id` as `unique` `Data` | `frappeCrmLeadId`, scoped unique |
| `last_synced_at` watermark | `frappeSyncedAt`, `InteropOutbox.processedAt` |
| `Failed Lead Sync Log` (type, payload, traceback) | `InteropOutbox.status` + `lastError` + `payload` |
| `DuplicateLeadError` on unique violation | `InteropInboundEvent` unique `(provider, externalId)` |

Upstream lets the **database** reject duplicates rather than checking first, which
is the only race-free option. Our unique constraints do the same.

## 4b. Three phone formats, not one

Reading Evolution API 2.3.7 (`src/utils/createJid.ts`) shows it does not store a
phone number at all. `Contact` and `Message` are keyed by `remoteJid`, unique per
`(remoteJid, instanceId)`, built as:

```ts
number = number.replace(/\+/g, '') ... .replace(/\D/g, '');
return `${number}@s.whatsapp.net`;
```

So three distinct formats coexist across the stack:

| System | Format | Example |
|---|---|---|
| Architech (canonical) | E.164 | `+919876543210` |
| ERPNext `Contact Phone.phone` | free-form `Data`, exact-matched | `+919876543210` |
| Evolution `remoteJid` | digits + suffix, no `+` | `919876543210@s.whatsapp.net` |

`lib/interop/phone.ts` converts between them. They must not be conflated: a JID
in an ERPNext phone field never matches a lookup, and an E.164 string used as a
JID carries a `+` that Evolution strips only on its own input path.

Evolution applies country-specific digit fixups for Mexico (52), Argentina (54)
and Brazil (55). India has no such rule, so our numbers map straight through --
but `toWhatsAppJid` is India-only for that reason.

## 4c. LGD state codes are NOT GST state codes

The sharpest finding, from `india-compliance` v16.9.0.

`gst_india/overrides/address.py:88` rejects any unrecognised state name with
`frappe.throw` — a hard write failure, not a warning:

```python
if doc.state not in STATE_NUMBERS:
    frappe.throw(_("Please select a valid State from available options"))
```

**Spelling.** Four of our 36 LGD records fail exact match:

| Our LGD name | India Compliance requires |
|---|---|
| `Andaman And Nicobar Islands` | `Andaman and Nicobar Islands` |
| `Jammu And Kashmir` | `Jammu and Kashmir` |
| `Lakshadweep` | `Lakshadweep Islands` |
| `The Dadra And Nagar Haveli And Daman And Diu` | `Dadra and Nagar Haveli and Daman and Diu` |

**Numbering — the dangerous one.** Twelve LGD codes differ from GST codes, and
three collide in a way that fails *silently*:

| State | LGD | GST |
|---|---|---|
| Andhra Pradesh | 28 | **37** |
| Ladakh | **37** | 38 |
| Dadra & Nagar Haveli and Daman & Diu | 38 | **26** |

LGD 37 is Ladakh, but GST 37 is Andhra Pradesh. Passing an LGD code where a GST
code is expected does not error — it files against the wrong state. On a tax
document that is a compliance incident, not a bug report. Nine more differ only
by a leading zero (`"4"` vs `"04"`), which string comparison also gets wrong.

`gst_india/overrides/address.py:97` additionally rejects a GSTIN whose first two
digits disagree with the address state.

`lib/interop/india-state-mapping.ts` holds an explicit entry for all 36 states.
Nothing derives a GST code by arithmetic or zero-padding, and the test suite
asserts the three colliding cases by name and checks exhaustiveness against the
LGD snapshot itself.

## 5. Residual risk

The `decimal(21,9)` finding is verified from source, but the **commission posting
template itself is still unspecified** — the design doc explicitly leaves "Journal
Entry vs Sales Invoice vs ledger-only" open, and that choice determines which
submittable-document cancellation paths we actually have to handle. §1.4 above is
written defensively to cover all of them.

Recommend resolving the posting shape with an accountant **before** step 8, not
before step 1 — it does not block the channel build.

Two further gaps remain open and are **not** closed by the interop migration:

1. **No RLS anywhere yet.** The channel design assumes
   `current_setting('app.current_org_id')` row-level security, and no migration
   in the repo establishes it. `InteropOutbox` carries `organizationId` and is
   ready for RLS, but the policy itself is still to be written.
2. **`Lead` still stores only `phoneMasked`.** Automatic first contact needs
   purpose-scoped encrypted storage, reusing the AES-256-GCM pattern already in
   `requirements.server.ts`. Unchanged by this work.
