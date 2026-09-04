# Brokers Channel — Implementation Design

**Status:** Draft for implementation
**Supersedes:** none
**Applies to:** Architech (Next.js + Prisma + PostgreSQL), Frappe CRM/ERPNext side via `business_suite_core`
**Confirmed decisions baked in:**
1. Channel notifications are surfaced **only in Architech**.
2. No broker-to-broker chat. The counterparty **business/agency mobile number** is revealed; brokers contact each other by call/`wa.me`/SMS outside the platform.
3. Publishing a sanitized demand/supply request requires **no separate customer channel consent/opt-out**.
4. On deal close, Architech **automatically writes** the agreed deal/commission facts into each participant's ERPNext with idempotency + reconciliation.

---

## 0. Scope

This design covers:

- Prisma schema for channel requests, matches, deals, commission entries, outbox, and ERPNext sync state.
- Deterministic matching (hard filters + weighted score with reasons).
- API/route surface for brokers.
- The ERPNext close-write contract (payload, idempotency, retry, reconciliation).
- Privacy/RLS rules and acceptance tests.

It does **not** cover the operational lead pipeline (Frappe CRM) or the listed customer-facing site flows.

---

## 1. Global invariants

1. **One channel record belongs to exactly one organization** (`organizationId` non-null, RLS-enforced).
2. **A cross-broker match links exactly two organizations.** Any private source mapping stays owner-only.
3. **Sanitized channel outputs never contain end-customer PII**, `phoneCiphertext`, raw message text, customer email/address, or a reversible private source key.
4. **Verified organizations only** may publish/accept (`verificationStatus = verified`).
5. **Idempotency** is mandatory for the ERPNext close-write (and any retried provider call).
6. **One official direction per field.** Architech is authoritative; Frappe CRM / ERPNext consume projections.
7. **No automatic commission/direction decisions** — the split agreement is negotiated by brokers before close.

---

## 2. Prisma schema

### 2.1 Enums

```prisma
enum ChannelRequestType {
  DEMAND     // buyer requirement
  SUPPLY     // seller listing
}

enum ChannelRequestStatus {
  DRAFT
  OPEN
  MATCHED
  CLOSED
  CANCELLED
  EXPIRED
}

enum ChannelMatchStatus {
  SUGGESTED
  ACCEPTED
  REJECTED
  DEAL_CREATED
}

enum ChannelDealStatus {
  OPEN
  PENDING_OTHER_CLOSE
  CLOSED
  CANCELLED
}

enum ChannelDealCloseMode {
  SINGLE
  DUAL
}

enum ErpnextSyncStatus {
  PENDING
  IN_FLIGHT
  SUCCESS
  FAILED
  RECONCILED
}
```

### 2.2 ChannelRequest

```prisma
model ChannelRequest {
  id                    String                 @id @default(cuid())
  organizationId        String                 // RLS tenant owner
  createdById           String
  type                  ChannelRequestType
  cityId                String
  localitySlug          String?
  intent                String                 // BUY | RENT
  propertyType          String
  bhkMin                Int?
  bhkMax                Int?
  areaMinSqft           Int?
  areaMaxSqft           Int?
  budgetMinInr          BigInt?
  budgetMaxInr          BigInt?                // required for DEMAND
  priceInr              BigInt?                // required for SUPPLY
  detailSummary         String                 // sanitized structured summary only
  sourceListingId       String?
  sourceRequirementId   String?
  status                ChannelRequestStatus  @default(DRAFT)
  expiresAt             DateTime
  publishedAt           DateTime?
  closedAt              DateTime?
  revision              Int                    @default(1)
  searchVector?         // optional: locality/property for fast filtering
  createdAt             DateTime               @default(now())
  updatedAt             DateTime               @updatedAt

  @@index([organizationId, status])
  @@index([cityId, localitySlug, type, intent, propertyType, status])
  @@index([expiresAt])
}
```

**Validation rules**
- `DEMAND` requires `budgetMinInr`/`budgetMaxInr`; must not contain `priceInr`.
- `SUPPLY` requires `priceInr`; `budgetMinInr`/`budgetMaxInr` must be null.
- `detailSummary` is generated from structured fields only; a server-side sanitizer rejects contact-like content.
- `sourceListingId`/`sourceRequirementId` are **owner-scoped private refs** and are never returned on cross-org APIs.
- A request can only be `OPEN` if the publisher org is verified.

### 2.3 ChannelMatch

```prisma
model ChannelMatch {
  id                 String               @id @default(cuid())
  demandRequestId    String
  supplyRequestId    String
  score              Int                  // 0-100
  reasons            Json                 // [{factor, weight, points, note}]
  status             ChannelMatchStatus   @default(SUGGESTED)
  createdBy          String?              // "system" | userId
  createdAt          DateTime             @default(now())
  updatedAt          DateTime             @updatedAt
  demandRequest      ChannelRequest       @relation(...)
  supplyRequest      ChannelRequest       @relation(...)

  @@unique([demandRequestId, supplyRequestId])
  @@index([status, score])
  @@index([demandRequestId, status])
  @@index([supplyRequestId, status])
}
```

**Notes**
- A match is a pure pairing; it is not a deal.
- `reasons` is stored once at creation so brokers can view "why" consistently.
- Match creation is idempotent: unique pair prevents duplicates.

### 2.4 ChannelDeal

```prisma
model ChannelDeal {
  id                     String                @id @default(cuid())
  matchId                String                @unique
  demandOrganizationId   String
  supplyOrganizationId   String
  demandContactUserId    String?
  supplyContactUserId    String?
  status                 ChannelDealStatus     @default(OPEN)
  closeMode              ChannelDealCloseMode  @default(DUAL)
  splitAgreement         Json?                 // negotiated, no formula
  totalCommissionInr     BigInt?
  demandBrokerShareInr   BigInt?
  supplyBrokerShareInr   BigInt?
  demandBrokerConfirmAt  DateTime?
  supplyBrokerConfirmAt  DateTime?
  closedAt               DateTime?
  closeVersion           Int                   @default(1)
  erpnextSyncStatus      ErpnextSyncStatus     @default(PENDING)
  createdAt              DateTime              @default(now())
  updatedAt              DateTime              @updatedAt

  @@index([demandOrganizationId, status])
  @@index([supplyOrganizationId, status])
}
```

**Validation at close**
```
demandBrokerShareInr + supplyBrokerShareInr == totalCommissionInr
```
- A broker can close its own request without closing the shared deal (request `CLOSED`, deal remains `OPEN` or as appropriate).
- Dual close requires both orgs to confirm; `PENDING_OTHER_CLOSE` between them.

### 2.5 CommissionEntry (management ledger)

```prisma
enum CommissionEntryType {
  COMMISSION_INCOME
  COMMISSION_EXPENSE  // optional: only if a party owes the other directly
}

model CommissionEntry {
  id               String   @id @default(cuid())
  organizationId   String   // RLS tenant owner
  dealId           String
  entryType        CommissionEntryType
  amountInr        BigInt
  employeeId       String?
  description      String
  entryDate        DateTime
  recordedById     String
  erpnextDocId     String?  // populated by ERPNext sync
  createdAt        DateTime @default(now())

  @@index([organizationId, entryDate])
  @@index([dealId])
}
```

This is a **management ledger**, not statutory accounting. ERPNext/India Compliance handles statutory posting (see §5).

### 2.6 Outbox / ERPNext sync state

```prisma
model ErpnextCloseWrite {
  id                String             @id @default(cuid())
  channelDealId     String
  organizationId    String
  idempotencyKey    String             @unique
  payloadHash       String
  status            ErpnextSyncStatus  @default(PENDING)
  attemptCount      Int                @default(0)
  lastError         String?
  nextRetryAt       DateTime?
  erpnextDocId      String?
  processedAt       DateTime?
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt

  @@index([status, nextRetryAt])
  @@index([channelDealId])
}

model InboundProviderEvent {
  id             String   @id @default(cuid())
  provider       String
  externalId     String
  organizationId String
  processedAt    DateTime @default(now())

  @@unique([provider, externalId])
}
```

---

## 3. Deterministic matching algorithm

### 3.1 Trigger

When a request transitions `DRAFT → OPEN` (or is re-published after edit), the matching worker runs.

If publishing **DEMAND**, candidate set = opposite `SUPPLY` requests with `status = OPEN`,
in the same city, compatible intent/property type/locality/BHK, price within budget tolerance.
If publishing **SUPPLY**, the mirror logic applies against `DEMAND` requests.

### 3.2 Hard filters

A pair is rejected unless all applicable filters pass:

| Filter | Rule |
|---|---|
| City | `cityId_demand == cityId_supply` |
| Intent | `intent_demand == intent_supply` |
| Property type | `propertyType_demand == propertyType_supply` |
| Locality | if both specify → `localitySlug_demand == localitySlug_supply`; if either omits → allow |
| BHK | if both specify and ranges do not overlap → reject |
| Price | demand published: `supply.priceInr <= round(1.10 * demand.budgetMaxInr)` |
| Price | supply published: `demand.budgetMaxInr >= round(supply.priceInr / 1.10)` |
| Verified | both organizations `verificationStatus = verified` |
| Status | both requests `OPEN` and not expired |

### 3.3 Score (0–100)

```ts
const WEIGHTS = {
  locality: 35,
  propertyType: 25,
  budgetFit: 20,
  bhkAreaFit: 10,
  recency: 10,
} as const;

function scoreMatch(demand: Request, supply: Request): { score: number; reasons: MatchReason[] } {
  const reasons: MatchReason[] = [];

  // locality
  const locality =
    demand.localitySlug && supply.localitySlug && demand.localitySlug === supply.localitySlug
      ? 1
      : demand.localitySlug || supply.localitySlug
        ? 0.5            // one side specified locality: same city credit only
        : 0.75;          // neither specified: reasonable default
  push(reasons, 'locality', WEIGHTS.locality, locality);

  // property type
  const prop = demand.propertyType === supply.propertyType ? 1 : 0;
  push(reasons, 'propertyType', WEIGHTS.propertyType, prop);

  // budget fit
  const mid = Number(demand.budgetMinInr ?? demand.budgetMaxInr) +
               Number(demand.budgetMaxInr ?? demand.budgetMinInr);
  const budgetMid = mid / 2;
  const price = Number(supply.priceInr ?? 0);
  const budgetFit = budgetMid > 0
    ? Math.max(0, 1 - Math.abs(price - budgetMid) / budgetMid)
    : 0;
  push(reasons, 'budgetFit', WEIGHTS.budgetFit, budgetFit);

  // BHK / area fit
  const bhkCompatible = bhkOverlaps(demand, supply) ? 1 : 0.5;
  const area = areaCloseness(demand, supply);
  const bhkAreaFit = Math.round((bhkCompatible + area) / 2 * 100) / 100;
  push(reasons, 'bhkAreaFit', WEIGHTS.bhkAreaFit, bhkAreaFit);

  // recency
  const oldest = Math.min(demand.createdAt.getTime(), supply.createdAt.getTime());
  const recency = Math.max(0, 1 - (Date.now() - oldest) / (30 * 24 * 60 * 60 * 1000));
  push(reasons, 'recency', WEIGHTS.recency, recency);

  return { score: clamp(Math.round(reasons.reduce((s, r) => s + r.points, 0))), reasons };
}
```

### 3.4 Example reasons output

```js
[
  { factor: 'locality',      weight: 35, points: 35 },
  { factor: 'propertyType',  weight: 25, points: 25 },
  { factor: 'budgetFit',     weight: 20, points: 18 },
  { factor: 'bhkAreaFit',    weight: 10, points: 8 },
  { factor: 'recency',       weight: 10, points: 7 },
]
// score = 93
```

### 3.5 Suggested threshold behavior

| Band | Action |
|---|---|
| 80–100 | Show as **Strong**; allow accept immediately |
| 60–79 | Show as **Good**; allow accept |
| 40–59 | Show as **Possible**; allow accept but de-emphasize |
| <40 | Do **not** show by default; can be surfaced behind an "advanced" toggle if product decides |

### 3.6 Match lifecycle

```ts
async function createMatchesForRequest(requestId: string) {
  // 1. load request + its org
  // 2. run hard filters
  // 3. score each surviving pair
  // 4. upsert ChannelMatch (unique pair, status SUGGESTED unless one already exists)
  // 5. ignore <40 unless required
  // 6. create in-app broker notifications in Architech only
}
```

---

## 4. API surface

All routes are server-only, authenticated, tenant-scoped, and RLS-enforced.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/broker/channel/requests` | Create `DRAFT` request |
| POST | `/api/broker/channel/requests/:id/publish` | Publish → `OPEN`, triggers matching |
| GET | `/api/broker/channel/requests` | List own requests |
| GET | `/api/broker/channel/requests/:id` | Details (own only) |
| POST | `/api/broker/channel/requests/:id/close` | Close own request (not shared deal) |
| POST | `/api/broker/channel/requests/:id/cancel` | Cancel own request |
| GET | `/api/broker/channel/matches` | List matches involving my org; sanitized output |
| POST | `/api/broker/channel/matches/:id/accept` | Accept a `SUGGESTED` match → creates `ChannelDeal` |
| POST | `/api/broker/channel/matches/:id/reject` | Reject |
| GET | `/api/broker/channel/deals` | List active/closed deals |
| GET | `/api/broker/channel/deals/:id` | Deal detail (sanitized, includes business contact) |
| POST | `/api/broker/channel/deals/:id/split` | Save negotiated split agreement (both orgs allowed, broker validation) |
| POST | `/api/broker/channel/deals/:id/confirm` | Confirm your side of a dual close |
| POST | `/api/broker/channel/deals/:id/close` | Trigger close (single mode) or complete dual close |
| POST | `/api/broker/channel/deals/:id/cancel` | Cancel a deal before close |
| GET | `/api/broker/channel/dashboard` | Channel KPI: open requests, matches, deals, commission totals |

### Sanitized response shape (match/deal)

```json
{
  "matchId": "match_1",
  "score": 93,
  "reasons": [{ "factor": "locality", "points": 35 }],
  "property": {
    "city": "ahmedabad",
    "locality": "thaltej",
    "propertyType": "apartment",
    "intent": "BUY",
    "bhk": 3,
    "priceInr": 11200000,
    "areaSqft": 1540
  },
  "counterpartyBroker": {
    "organizationId": "org_2",
    "organizationName": "Skyline Realty",
    "verificationStatus": "verified",
    "contactName": "Rajesh Shah",
    "contactRole": "assigned-agent",
    "businessPhone": "+91-98xxxxxx",
    "businessPhoneMasked": "+91-98••••••"
  },
  "actions": {
    "canAccept": true,
    "canConfirm": false,
    "canClose": false,
    "businessPhoneProvided": true,
    "waMeLink": "https://wa.me/9198xxxxxxxx"
  }
}
```

**Absolute prohibition:** the response payload, including `contactName`, `businessPhone`, custom attributes, and any links, is limited to the **broker business contact**. It must never return the buyer/seller customer phone/email/address/raw message.

---

## 5. ERPNext close-write contract (automatic)

### 5.1 When it fires

On `ChannelDeal` transitioning to `CLOSED`:
- One **manual commission entry** is created per participating organization (in Architech).
- One **ERPNext sync job** is created per participating organization (idempotent).
- Both may be retried; duplicate close calls are no-ops.

### 5.2 Endpoint (Frappe side)

```
POST {frappeSite}/api/method/business_suite_core.api.sync_channel_deal
Content-Type: application/json
Authorization: Bearer <service-token or signed HMAC>
```

### 5.3 Payload

```json
{
  "idempotencyKey": "channel.close.v1.deal_9y...",
  "source": "architech",
  "channelDealId": "deal_9y...",
  "closeVersion": 1,
  "closeMode": "DUAL",
  "closedAt": "2026-09-03T12:00:00.000Z",
  "organizationId": "org_2",
  "deal": {
    "demandOrganizationId": "org_1",
    "supplyOrganizationId": "org_2",
    "totalCommissionInr": 500000,
    "demandBrokerShareInr": 250000,
    "supplyBrokerShareInr": 250000,
    "splitAgreement": {
      "type": "negotiated",
      "summary": "50/50 except seller-side adjustments"
    },
    "counterpartyBusinessName": "Skyline Realty",
    "counterpartyBusinessPhone": "+9198xxxxxxxx"
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

**Payload rules**
- **No end-customer PII.** `counterpartyBusinessName`/`counterpartyBusinessPhone` are business/agency contact only. Never send buyer/seller phone, email, address, or raw message.
- `splitAgreement` is a JSON blob stored for audit; it is **not** used to auto-cascade posting without a verified financial template.
- `idempotencyKey` is required and bounded.

### 5.4 ERPNext handler behavior

1. **Idempotency check** — if `Channel Deal Commission` / sync-recording with this `idempotencyKey` exists, return it unchanged (HTTP 200) with `duplicate: true`.
2. **Create tracking doc** — create a `Channel Deal Commission` DocType in `business_suite_core` (the "proof" record) with all payload fields and no customer PII.
3. **Optional / configurable financial posting** — by default create a **Journal Entry** (or a **Sales Invoice** for the brokerage commission) against the configured commission income account and the participating brokerage's counterpart/clearing account, only when a `channelCommissionTemplate` is configured and an accountant-approved template exists. This is behind a feature flag; it **must not** fail the tracking-doc write.
4. **Return**:
```json
{
  "status": "created" | "duplicate",
  "erpnextChannelDealId": "CH-DEAL-0001",
  "erpnextEntryReference": "JOURNAL-... / SALES-INVOICE-... / null",
  "link": {
    "channelDealId": "deal_9y...",
    "organizationId": "org_2"
  }
}
```

### 5.5 Architech side state machine

```text
CLOSED
   -> ErpnextCloseWrite PENDING
   -> worker POSTs payload
   -> SUCCESS (stores erpnextChannelDealId + reference)
   -> FAILED (retry with backoff, max attempts, dead-letter)
   -> RECONCILED (manual or scheduled reconciliation when retries exhausted)
```

Retry **must not duplicate**: same `idempotencyKey` on ERPNext side → duplicate detection. Architech never re-posts a doc it has already marked success unless the stored payload hash differs (in which case it creates a new version).

### 5.6 Reconciliation

- A nightly (or hourly) job compares:
  - Architech `ErpnextCloseWrite.status`
  - ERPNext `Channel Deal Commission` existence for each known `idempotencyKey`/`channelDealId`
- Orphan states escalate to a visible admin queue.
- The accountant approves chart, axes, opening balances, and commission templates before any auto-posting is enabled.

### 5.7 Privacy through finance

- ERPNext receives **no end-customer contact data**.
- If the accountant later maps commission to a client invoice, that mapping is done inside the business's own ERPNext site with authorized data, not synced back to the channel.

---

## 6. Authorization & tenancy

- Every `ChannelRequest`, `ChannelMatch`, `ChannelDeal`, `CommissionEntry` carries `organizationId`.
- PostgreSQL RLS configured `USING ("organizationId" = current_setting('app.current_org_id'))`, with `FORCE ROW LEVEL SECURITY` on private tenant tables.
- Sanitized channel reads (`ChannelRequest` view with summary only, `ChannelMatch`, `ChannelDeal` sanitized projection) use a **separate sanitized view** that excludes source refs and PII-bearing columns.
- Application runs as non-superuser / non-`BYPASSRLS`.
- Broker accept/confirm/close actions verify the requesting user belongs to one of the two deal orgs.
- Raw `organization_id` from client payloads is never trusted; it is resolved server-side from the session.

---

## 7. Notifications (in Architech only)

- On publish → matching runs → in-app notification list (Architech broker UI/PWA).
- On match accept → deal created → both brokers see it.
- On split saved / confirm / close → in-app status updates.
- No WhatsApp/email/SMS notification path for the channel.
- The only "reach out" affordance is the counterparty's **business phone** with tap-to-call / `wa.me`.
- If a channel notification is ever extended later, it is a separate, audited cost/approval decision.

---

## 8. Tests / acceptance gates

### Privacy
- Two verified orgs: match/deal APIs never return customer phone/email/address/raw message.
- Cross-org query with poisoned PII cannot return a source key or `phoneCiphertext`.
- RLS: read, write, raw SQL, background worker, pooled-connection reuse all fail closed.

### Matching
- Hard-filter rejection cases (city/intent/type/locality/BHK/price).
- Deterministic score + reasons match fixed fixtures.
- Idempotent match creation (same pair never duplicates).
- Expired / unverified orgs are excluded.
- <40 matches not surfaced.

### Deal & close
- Single close and dual close state transitions.
- Split validation `demand + supply == total`.
- Cross-org confirmation is possible.
- Closing own request doesn't auto-close shared deal unless confirmed.

### ERPNext
- Two deployments receive correct per-org payloads.
- Duplicate close call returns `duplicate: true`.
- Retry with same idempotency key does not create a second doc.
- Sanitized payload contains no end-customer PII.
- Failed sync can be retried and reconciled.
- Optional financial template posting is behind flag and approved by an accountant.

### Notifications
- In-app notification exists and is Architech-only.
- No channel message uses Evolution/Chatwoot/customer conversation transport.

---

## 9. Implementation order (concrete)

1. Add enums/models + migration + RLS + sanitized views.
2. Add `ChannelRequest` create/publish/close/cancel APIs + server-side sanitizer.
3. Add matching worker + `ChannelMatch` persistence + score reasons.
4. Add match accept/reject → `ChannelDeal` creation.
5. Add split/confirm/close/cancel APIs + state machine.
6. Add `CommissionEntry` creation at close.
7. Add in-app broker channel dashboard/notifications.
8. Add `business_suite_core` `/api/method/business_suite_core.api.sync_channel_deal` + `Channel Deal Commission` DocType.
9. Add `ErpnextCloseWrite` worker, retry, idempotency, reconciliation.
10. Run two-business isolation, matching fixtures, close/retry/erasure, and ERPNext contract tests.

**Exit gate:** two brokerages can publish → match → negotiate split → dual-close → each site gets the correct ERPNext record, with zero end-customer PII crossing any channel boundary.
