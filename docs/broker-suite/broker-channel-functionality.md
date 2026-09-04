# Brokers Channel — How It Should Work

**Source:** Architech `docs/broker-suite/decision.md` (canonical v8), `docs/business-suite/*`, `docs/broker-suite/open-source-ecosystem-evaluation.md`, plus the Round 6 StudyArena contestant specs that detail the matching/close models.
**Purpose:** Functional model of the privacy-preserving cross-broker channel before any implementation.

---

## 1. What the Brokers Channel is

The **Brokers Channel** is Architech's real-estate vertical capability. It is the place where **verified brokerages** exchange **sanitized demand and supply** without ever exposing their **end-customer contact data**.

It is *not*:
- a generic CRM;
- a customer-facing marketplace;
- a chat/inbox product;
- a statutory accounting system.

It is the missing B2B matching layer: one brokerage may hold a buyer's requirement while another holds the matching seller listing. The channel lets them find each other, negotiate, close a joint deal, and split the commission.

---

## 1.1 Confirmed v8 decisions

| Question | Decision |
|---|---|
| Channel notification surface | **Only in Architech** (in-app broker UI/PWA). No WhatsApp/email/SMS channel-notification path. |
| Broker-to-broker chat | **Not required.** Both brokers have the counterparty's **business mobile number** and contact each other directly (call / `wa.me` / SMS) outside the platform. |
| Separate customer channel consent/opt-out for publication | **Not required.** No separate customer channel consent/opt-out is required to publish a sanitized demand/supply request. |
| Closed deals into ERPNext | **Yes, automatically.** On close, Architech writes the agreed deal/commission facts into ERPNext idempotently. |

---

## 2. Position in the architecture (v8)

| Layer | Owner | Channel's role |
|---|---|---|
| Public listing/search, locality registry, enquiry intake, consent, masking | **Architech** | Channel is built on top of this |
| Lead assignment, deal progress, follow-up per brokerage | **Frappe CRM** | Channel emits minimal, idempotent events; does **not** replace this |
| Quotations, invoices, payments, accounting | **ERPNext** | Receives closed-deal/commission facts when relevant; does **not** own channel matching |
| Cross-broker demand/supply, matching, negotiation state, deal close, commission split | **Architech** | **Authority** |

Architech may emit purpose-minimized, idempotent lead/deal events to a business's Frappe site, but the channel/platform data stays in Architech.

---

## 3. Participants

- **Broker organization** — must be verified before publishing (docs: publish only if `verificationStatus = verified`).
- **Broker user / assigned agent** — the person acting for the organization. Channel may reveal the *business/agency contact* of the counterparty broker, never the buyer/seller's.
- **End customer (buyer/seller/tenant)** — **not** a participant. They exist only as structured, sanitized facts (locality, BHK, budget, intent, etc.).

---

## 4. Two request types

### Demand request (from a buyer requirement)
- city / locality / intent (buy or rent) / property type
- BHK min–max, area min–max
- budget min–max in INR
- optional source requirement ref
- expiry, status

### Supply request (from a seller listing)
- city / locality / intent / property type
- price in INR
- BHK, area, listing ref (prefer source listing reference)
- expiry, status

Both are **structured** fields only. Free-form identifying text or contact-like content must be rejected.

---

## 5. Privacy boundary (the load-bearing rule)

> The channel must never publish a customer phone, email, raw message, free-form identifying text, reversible private source key, `phoneCiphertext`, or customer address.

Implementation implications:
- Sanitized publication tables/views contain **no PII and no reversible source identifier**.
- Private source mapping stays owner-only (separate table).
- Cross-broker APIs and webhooks return **sanitized outputs only**.
- Summaries are generated from approved structured fields; contact-like content is rejected.
- Keep the private mapping separate from public publication so discovery doesn't weaken private-table RLS.
- Verify with poisoned-row / two-organization tests: a cross-broker query must never return PII or private keys.

---

## 6. Lifecycle / state machine

### Request (demand or supply)
```
DRAFT → OPEN → (ACCEPTED | REJECTED) → MATCHED → PENDING_CLOSE → CLOSED
                                                         ↘ CANCELLED / EXPIRED
```

### Match
```
SUGGESTED → ACCEPTED → DEAL_CREATED
         ↘ REJECTED
```

### Deal
```
OPEN → PENDING_OTHER_CLOSE → CLOSED
       ↘ CANCELLED
```

- A request may be closed by its own broker without closing the shared deal.
- Requests expire (e.g., 30 days).
- Only verified brokers can publish / accept.

---

## 7. Deterministic matching

### Hard filters (reject if any fails)
- same city
- same intent (buy / rent)
- same property type
- if both specify locality → exact locality equality
- supply price within tolerance of demand budget (e.g., `price ≤ 1.10 × budgetMax`)
- BHK tolerance

### Score (0–100), deterministic
Example weights: `35·locality + 25·propertyType + 20·budgetFit + 10·area/BHK fit + 10·recency`.
- `locality`: 1.0 exact locality, 0.5 same city
- `budgetFit`: closeness to mid-point of budget range
- `areaFit`: BHK/area closeness
- `recency`: newer request scores higher

### Score bands
- 80–100: Strong match
- 60–79: Good match
- 40–59: Possible match
- below 40: not shown initially

Store the **score reasons** so brokers see *why* (e.g., `+35 exact locality`, `+25 exact property type`, `+18 price within 8%`), not just a single number.

---

## 8. Broker workflow

1. **Publish** a sanitized demand or supply request (verified org only).
2. **Discover** candidate matches — see structured property facts + counterparty **business contact**, never customer contact.
3. **Accept / decline** a match; create a deal.
4. **Negotiate** the commission split; record the agreement (negotiated, not auto-formula).
5. **Close** — single close (one broker) or dual close (both sides confirm).
6. **Reconcile** — record commission entries for each participating organization.

---

## 9. Commission split and accounting

- A deal records: total commission, demand-broker share, supply-broker share, split agreement, close mode, status.
- Validation: `demandShare + supplyShare = totalCommission`.
- At close, create one **commission income entry** per participating organization.
- This is a **management ledger** at this stage — not statutory accounting/GST/payroll. ERPNext/Frappe/India Compliance is the later boundary if statutory accounting becomes real scope.
- Never store customer phones or emails on the deal/commission/ledger records.

---

## 10. Communications and notifications (v8 confirmed)

The docs are explicit that:
- Architech owns the channel and its notification surface.
- Chatwoot is **removed** (v8), so channel notifications never go through a Chatwoot inbox.
- **Confirmed (v8):** channel notifications are surfaced **only in Architech** (in-app broker UI / PWA). No separate messenger/WhatsApp/email notification path for the channel.

**Broker-to-broker chat is NOT in scope.**
- **Confirmed (v8):** no broker-to-broker chat is required.
- Both brokers already have their **business/agency mobile number** exposed on the match/deal record.
- They contact each other directly (call / `wa.me` / SMS) **outside** the platform.

**What Architech must expose for the match/deal:**
- Counterparty brokerage name + verification status.
- Counterparty broker/agent name (business contact, not end-customer).
- Counterparty **business mobile number** (business/agency contact).
- Human-friendly **tap-to-call** and **`wa.me`** links from the Architech broker UI/PWA.
- Sanitized property/requirement facts + score reasons.
- Match/deal actions: accept, decline, negotiate split, close, dual-close.

So the v8 channel flow is: **sanitized publishing → deterministic matching → explicit negotiation via direct broker-to-broker contact (phone/wa.me) → close + split**, all surfaced in Architech.

---

## 11. Integration boundaries

- **Architech** remains the source of truth for: listing, locality, channel request, match, deal, commission, consent/masking, audit.
- **Frappe CRM** receives only purpose-minimized, idempotent lead/deal events so brokers can continue operational work there.
- **ERPNext** receives commercial/accounting facts when a deal reaches the finance stage.
- **Confirmed (v8):** closed deals **write into ERPNext automatically**. On deal close, Architech creates/syncs the ERPNext records (e.g., customer/party, quotation/sales order context, or the agreed commission/invoice/payment facts) through the same-site or supported integration path — idempotent, non-duplicating, and financially reconcilable.
- **No two-way sync of the same field.** Pick one direction per field; keep the channel authority in Architech.
- Do not recreate the channel (matching/deal/split) in Frappe CRM, ERPNext, or another inbox system.

---

## 12. What it must NOT do

- Leak customer PII across broker orgs.
- Be used as a generic CRM or as the operational lead pipeline.
- Send customer data to Evolution/Chatwoot or any customer conversation store.
- Automatically decide hot/cold leads or commission splits.
- Auto-post statutory ledger entries.
- Bypass tenant isolation or use a cross-org fallback.
- Expose contact data through cross-broker channel records or webhooks.

---

## 13. Security / tenancy requirements

- Disallow multiple brokerages in the same private-tenant row; enforce RLS per org.
- Separate **sanitized-channel** tables from **private source** tables.
- Application runs as non-superuser / non-`BYPASSRLS`.
- Two-organization negative tests: read, write, relation traversal, raw SQL, background jobs, pooled-connection reuse.
- Queue/lifecycle with idempotency keys; request expiry; audited accept/close.
- Erasure/expiry propagation to channel publications and any projections.

---

## 14. Recommended implementation order

1. Core Architech identity, verification, locality registry, listing/lead capture, consent/masking (already in progress).
2. Channel request model + sanitized publication (verified org gate, expiry, audit).
3. Deterministic matching + score reasons.
4. Match accept/decline → deal creation.
5. Negotiation/split agreement + close/dual-close workflow.
6. Commission ledger entries + broker dashboard (channel pipeline, matches, closes, split totals).
7. Notifications in Architech only (broker UI/PWA) + counterparty business number revealed for direct call / `wa.me`; no customer PII.
8. Frappe CRM event projection + automatic ERPNext write on deal close (idempotent, reconcilable).

**Exit gate before production:** two verified brokerages can match and close with **zero** customer phone/email/raw message crossing the channel, and cross-tenant read/write tests fail closed.

---

## 15. Resolved open questions

| Question | Decision |
|---|---|
| Channel notification surface | **Only in Architech.** |
| Broker-to-broker chat | **Not needed** — reveal business mobile number + tap-to-call / `wa.me`. |
| Separate customer channel consent/opt-out for publication | **No.** |
| Closed deals into ERPNext | **Yes** — automatic, idempotent write on close. |
| Matches auto-created or require confirmation | Still a design choice (docs lean deterministic suggestion + broker accept/decline). |

### Remaining design decisions (not user-blocked)
- Exact ERPNext write shape per close (sales invoice vs commission-invoice vs payment entry vs ledger-only) — scope for the Frappe/ERPNext implementation.
- Whether matches are auto-suggested or broker-confirmed before appearing.
- Expiry/default and request-lifecycle values.
