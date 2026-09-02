# StudyArena

**Question:** as we decided  use both Server: https://github.com/chatwoot/chatwoot
Mobile app: https://github.com/chatwoot/chatwoot-mobile-app

then can can you please check how can we implement below requirement as well.

**Answered by** Contestant F · Round 6 · 02 Sept 2026

---

The brief chose Twenty; you’ve now locked Chatwoot for mobile. I’ll map each Broker Suite requirement onto Chatwoot vs Architech and spell out what to actually build.

I need Chatwoot’s actual APIs for custom attributes, teams, labels, and platform tenancy so the mapping isn’t guesswork.

**Chatwoot cannot be the Broker Suite.** It can be the **broker mobile inbox**. The rest of §5 still has to live in Architech (and must **not** be forced into Twenty as well).

Chatwoot is a conversation desk (contacts, assignment, notes, push). It has **no** custom objects, **no** cross-tenant matching, **no** commission/ledger, **no** locality ownership. The channel is **cross-broker**, while Chatwoot accounts are **isolated** — matching cannot run inside Chatwoot.

## Target stack (reconciles both decisions)

```text
Public buyer ──► Architech (SoR)
                   │ listings, consent, masking
                   │ locality registry, routing
                   │ channel requests / matches / deals
                   │ commission + salary ledger
                   │
                   │ outbox (never block the enquiry)
                   ▼
              Chatwoot Server          Official iOS/Android app
              1 account per broker ──► push, chat, call, notes
```

| Keep | Drop / defer |
|---|---|
| Architech as SoR for listings, leads, channel, accounting | **Twenty** for this phase (third system + second broker UI) |
| Chatwoot official app (store, not a fork) | Fork of `chatwoot-mobile-app` |
| Existing Architech lead inbox + listing submission | Agent-to-agent chat product (§5.5) |
| Frappe later, only for PF/ESI/GST | Building pipeline/channel inside Chatwoot labels |

Twenty was chosen because it had a CRM UI and **no mobile**. Chatwoot now covers mobile. Adding Twenty **and** Chatwoot gives brokers two apps and you three databases. Architech already has `BrokerOrganization`, `Lead`, `Listing`, `Requirement`, locality registry, and the masked lead inbox.

---

## Who owns what (do not drift)

| Requirement (§5) | System of record | Chatwoot’s job |
|---|---|---|
| Locality → one employee | Architech `AreaAssignment` | none |
| Mode A/B routing + handoff | Architech | **apply** assignment via API |
| Lead lifecycle + audit | Architech `Lead` / `Deal` | mirror as **labels** only |
| Broker dashboard (conversion, locality) | Architech | conversation counts only |
| Channel buy/sell + match + split | **Architech only** | optional “open in Architech” link |
| Phones never in channel | Architech (never send) | never stored |
| Commission / salary ledger | Architech | none |
| New-lead push, WhatsApp, call, notes | Chatwoot | **this is why it exists** |
| Consent / DPDP erasure | Architech | delete contact on purge event |

---

## 1. Chatwoot tenancy

Self-host Chatwoot. Use **Platform API** (self-hosted only) so every `BrokerOrganization` is one Chatwoot **account**.

```text
Chatwoot install
├── Account: org_ahmedabad_prime     ← BrokerOrganization.id
│   ├── Team: Cold callers           (only if Mode B on)
│   ├── Team: Sales
│   ├── Inbox: Architech leads (API inbox)
│   └── Agents: BrokerUser members
└── Account: org_other
```

On broker activation:

1. `POST /platform/api/v1/accounts` → store `chatwootAccountId`
2. Create owner user + `account_user` (administrator)
3. Create API inbox “Architech leads”
4. For each `BrokerUser`: agent with role `agent` / `administrator`
5. Create teams `cold-callers` and `sales`

Store mapping in Architech (encrypt the token):

```prisma
model ChatwootIntegration {
  id                  String   @id @default(cuid())
  organizationId      String   @unique
  accountId           Int
  inboxId             Int
  coldCallerTeamId    Int?
  salesTeamId         Int?
  encryptedApiToken   String
  baseUrl             String
  webhookSecret       String
  enabled             Boolean  @default(true)
}

model ChatwootAgentMap {
  id               String @id @default(cuid())
  organizationId   String
  brokerUserId     String
  chatwootAgentId  Int
  @@unique([organizationId, brokerUserId])
}
```

**Gate:** verified isolation tests before any real buyer data: agent A cannot open org B; API token A cannot query B; masked phone never appears in push/search.

Brokers install the **official** Chatwoot app, then enter your Chatwoot URL + their agent login. No fork, no store review.

---

## 2. Pillar 1 — Lead CRM

### Area assignment (Architech)

```prisma
model AreaAssignment {
  id             String  @id @default(cuid())
  organizationId String
  localitySlug   String  // from client/src/lib/localities.ts
  brokerUserId   String
  active         Boolean @default(true)
  @@unique([organizationId, localitySlug])
}

model ColdCallerSetting {
  organizationId String  @id
  enabled        Boolean @default(false)
  brokerUserId   String? // the cold caller
}
```

Unassigned locality → org admin bucket + notify (edge case §12.2 #6). Employee exit → reassign localities; leads follow the new owner (#7).

### Routing (Architech decides, Chatwoot executes)

On `lead.created`:

```text
1. Write Lead in Architech (masked, consent, idempotencyKey) — this is the commit
2. Outbox event LEAD_CREATED
3. Worker:
     locality owner = AreaAssignment
     if ColdCallerSetting.enabled → assignee = cold caller, stage = NEW
     else                          → assignee = locality owner
     if no owner                   → unassigned team
4. POST Chatwoot contact (no phone if MASKED)
5. POST conversation on API inbox
6. Assign to mapped chatwootAgentId
7. Set labels + custom attributes
8. Store IDs on LeadExternalReference
```

Contact payload (masked):

```json
{
  "name": "Buyer AT-1048",
  "inbox_id": 12,
  "custom_attributes": {
    "architech_lead_id": "lead_123",
    "listing_id": "listing_456",
    "locality_slug": "thaltej",
    "lead_mode": "MASKED",
    "score_band": "hot",
    "architech_url": "https://app.example.com/broker/leads/lead_123"
  }
}
```

Do **not** send `phone` / `email` unless `Lead.mode = DIRECT_CONSENTED`. Chatwoot must not become a second copy of PII.

Conversation first message (what the agent sees on the phone):

```text
New enquiry · Thaltej · 3 BHK · ₹80–90 lakh
Listing AT-1048
Score: HOT (budget fit + locality + recency)

[Open in Architech]
Phone is masked until consent.
```

### Lifecycle

Architech is canonical:

`NEW → CONTACTED → QUALIFIED → NEGOTIATION → WON | LOST`

Chatwoot labels are a **mirror** only:

`stage:new` `stage:contacted` `stage:qualified` `stage:negotiation` `stage:won` `stage:lost`

Handoff (Mode B): cold caller taps a canned action or you add one Architech button “Mark hot & transfer”. Architech writes an auditable `LeadTransfer`, then Chatwoot `POST .../assignments` to the locality owner. Hot/cold is **manual** by the cold caller; show P1-LEAD-002 score as suggestion, never auto-decide (§12.2 #5).

### Dashboard

Build in Architech (you already have `/broker/dashboard` and lead inbox). Chatwoot reports are conversation SLA, not conversion by locality. Do not try to make Chatwoot the CRM dashboard.

---

## 3. Pillar 2 — Brokers Channel (100% Architech)

Chatwoot accounts cannot see each other, so **channel matching cannot live there**.

```prisma
enum ChannelRequestType { BUY SELL }
enum ChannelRequestStatus { OPEN MATCHED CLOSED }

model ChannelRequest {
  id             String               @id @default(cuid())
  organizationId String
  createdById    String
  type           ChannelRequestType
  localitySlug   String
  cityId         String
  intent         String               // buy/rent
  bhk            Int?
  propertyType   String
  budgetMinInr   BigInt?
  budgetMaxInr   BigInt?
  priceInr       BigInt?
  detailSummary  String
  sourceListingId String?             // prefer Listing ref for SELL
  status         ChannelRequestStatus @default(OPEN)
  expiresAt      DateTime
  closedAt       DateTime?
}

model ChannelMatch {
  id            String @id @default(cuid())
  buyRequestId  String
  sellRequestId String
  score         Int
  status        String // suggested | accepted | rejected
  @@unique([buyRequestId, sellRequestId])
}

model ChannelDeal {
  id              String @id @default(cuid())
  matchId         String @unique
  status          String // pending | pending_other_close | closed
  closeMode       String // single | dual
  splitAgreement  Json   // negotiated, no formula
  commissionInr   BigInt?
  closedAt        DateTime?
}
```

Matching stays next to `cities.ts` / `localities.ts` (as the brief already recommended):

1. Hard filters: same locality (or city), intent, BHK tolerance, price ≤ budget, type.
2. Rank: budget fit → BHK → locality precision → recency.
3. Brokers see **details only**. Never put buyer/seller phone on a channel payload or into Chatwoot.

Publish only if `BrokerOrganization.verificationStatus = verified`; expire requests (e.g. 30 days). Dual-close: `pending_other_close` + reminder; ops resolves stale ones.

Mobile for channel: **Architech broker PWA** (matches, accept, close, split). Chatwoot is the wrong screen. Optional: after a match, Architech can open a Chatwoot conversation **between the two brokers** later — that is the deferred chat item, not Phase 1.

---

## 4. Pillar 3 — Accounting (100% Architech)

Chatwoot has no ledger.

```prisma
model CommissionEntry {
  id             String   @id @default(cuid())
  organizationId String
  dealId         String
  employeeId     String?
  amountInr      BigInt
  recordedById   String
  recordedAt     DateTime @default(now())
}

model SalaryLedger {
  id             String   @id @default(cuid())
  organizationId String
  employeeId     String
  month          DateTime
  amountInr      BigInt
  recordedById   String
}

model ExpenseEntry {
  id             String   @id @default(cuid())
  organizationId String
  amountInr      BigInt
  note           String
  recordedAt     DateTime @default(now())
}
```

Commission is entered **at deal close** (employee or broker). No GST. Frappe stays a later phase when PF/ESI/TDS or e-invoicing appears.

---

## 5. Sync contract (the only integration)

**One way for PII:** Architech → Chatwoot. Chatwoot never becomes authoritative for phone/consent.

Durable outbox (do not await Chatwoot on the public form):

```prisma
model OutboxEvent {
  id          String    @id @default(cuid())
  type        String
  aggregateId String
  payload     Json
  attempts    Int       @default(0)
  availableAt DateTime  @default(now())
  processedAt DateTime?
  lastError   String?
  @@index([processedAt, availableAt])
}

model LeadExternalReference {
  leadId                   String
  provider                 String  // "chatwoot"
  externalContactId        String?
  externalConversationId   String?
  lastSyncedAt             DateTime?
  @@unique([leadId, provider])
}

model InboundWebhookEvent {
  id           String   @id @default(cuid())
  provider     String
  externalId   String
  organizationId String
  processedAt  DateTime @default(now())
  @@unique([provider, externalId])
}
```

| Event | Architech → Chatwoot |
|---|---|
| `lead.created` | create contact + conversation + assign |
| `lead.assigned` | reassign conversation |
| `lead.stage.changed` | replace `stage:*` labels |
| `lead.consent.revoked` | strip phone/email attributes |
| `lead.deleted` / `requirement.purged` | delete contact (DPDP) |
| `broker_user.deactivated` | disable Chatwoot agent |

**Inbound webhooks** (verify HMAC / shared secret, resolve account → org, ignore unknown types):

| Chatwoot event | Architech action |
|---|---|
| `conversation_status_changed` / label change | if agent set `stage:*`, update `Lead`/`Deal` **only after** org check |
| `conversation_resolved` | suggest CLOSED; do not auto-close a channel deal |
| agent message sent | `NEW → ACKNOWLEDGED/REPLIED` if still NEW |

Never trust `organization_id` inside custom attributes. Always: signature → accountId → `ChatwootIntegration` → `Lead.organizationId` match.

---

## 6. Auth (Phase 1)

Separate logins: Architech (better-auth) and Chatwoot agent. Same email, two passwords. SSO/OIDC later if needed. Do not block the MVP on bridging.

---

## 7. What to build, in order

| Phase | Days | Done when |
|---|---:|---|
| **C0** Deploy Chatwoot + official app, 1 test org, 2 agents | 1–2 | Push arrives on a test conversation |
| **C1** Platform provisioning + `ChatwootIntegration` | 1–2 | New broker → isolated account |
| **C2** Outbox `lead.created` + masking + assignment | 2–3 | Public enquiry → correct agent’s phone, **no phone if MASKED** |
| **C3** Isolation + DPDP delete tests | 1–2 | Cross-tenant leak test fails closed |
| **A1** `AreaAssignment` + Mode A/B + unassigned bucket | 2 | Lead lands on locality owner or cold caller |
| **A2** Handoff audit + stage mirror | 1–2 | Cold→hot reassigns Chatwoot |
| **CH1** `ChannelRequest` / match / close / split (web + PWA) | 5–8 | Two brokers match with **zero** end-customer phones |
| **AC1** Commission at close + salary ledger | 2–3 | Broker sees income/expense for one month |
| **PWA** Installable Architech broker pages | 1–2 | Channel + ledger work on phone Chrome/Safari |

**~16–25 dev-days** for a usable suite. Chatwoot is ~6–9 of those; the rest is Architech because that is the actual product.

Skip WhatsApp until C2 is green. Skip forking the mobile app. Skip Twenty until (if ever) you want a second CRM UI.

---

## 8. Fate of existing Architech broker UI (§12.2 #1)

| Surface | Action |
|---|---|
| `/broker/leads` + consent/masking | **Keep** as SoR; Chatwoot is the mobile front |
| Listing submission | **Keep** in Architech |
| `/broker/dashboard` | **Keep / extend** (pipeline + locality stats) |
| Channel + ledger | **New Architech routes** + PWA |
| Twenty workspaces | **Do not provision** |

---

## Bottom line

Use **both Chatwoot repos as designed**: self-host the server, install the **store** mobile app. Implement Broker Suite **around** Chatwoot, not inside it:

- **Chatwoot** = notify, talk, assign, note  
- **Architech** = route, match, close, split, pay, consent  

If you want the next artifact, it should be the technical design in §13 **rewritten for this split** (outbox payloads, Chatwoot Platform/Application calls, matching thresholds, seed of existing `Lead` rows) — not a Twenty workspace layout.
