# StudyArena

**Question:** as we decided  use both Server: https://github.com/chatwoot/chatwoot
Mobile app: https://github.com/chatwoot/chatwoot-mobile-app

then can can you please check how can we implement below requirement as well.

**Answered by** Contestant C · Round 6 · 02 Sept 2026

---

Yes—but **Chatwoot cannot replace Twenty feature-for-feature**. It can implement the mobile lead inbox, notifications, assignment, and broker communication. The **channel matching, deals, locality routing rules, and accounting must live in Architech**.

The lowest-effort complete design is:

```text
Architech = business engine and source of truth
Chatwoot Server = mobile inbox and communication engine
Chatwoot Mobile fork = branded mobile shell
Architech responsive pages = CRM/channel/accounting screens inside mobile app
```

## 1. Revised system ownership

| Requirement | Implement in | Reason |
|---|---|---|
| Public listings and enquiries | Architech | Already implemented |
| Consent, masking, DPDP deletion | Architech | Existing authority |
| Lead routing by locality | Architech | Chatwoot does not model locality ownership properly |
| Lead conversations and notifications | Chatwoot | Its strongest capability |
| Agent assignment | Architech decides; mirror to Chatwoot | Keeps routing deterministic |
| Lead pipeline | Architech source; mirror labels/status to Chatwoot | Prevents labels becoming the database |
| Broker channel requests | Architech | Requires cross-broker structured data |
| Buyer/seller matching | Architech | Requires global, privacy-aware matching |
| Deals and commission splits | Architech | Structured and auditable |
| Salary, expenses, commission ledger | Architech | Chatwoot is not accounting software |
| Mobile conversation UI | Chatwoot mobile app | Already available |
| Mobile CRM/channel UI | Responsive Architech pages opened inside app | Lowest custom-native effort |

I would remove Twenty from Phase 1. Running **Architech + Twenty + Chatwoot** creates three user stores, three permission models, and difficult synchronization.

---

# 2. Mobile approach: fork Chatwoot and add an Architech tab

Use both repositories:

- Server: `chatwoot/chatwoot`
- Mobile: `chatwoot/chatwoot-mobile-app`

Keep most of the mobile application unchanged. Add one navigation item:

```text
Inbox | Contacts | Broker Suite | Settings
```

The **Broker Suite** tab opens a secure mobile-optimized Architech surface:

```text
/mobile
├── dashboard
├── leads
├── channel
├── matches
├── deals
├── team
└── ledger
```

Initially this can be a secure WebView or authenticated browser/deep-link flow. Do not rewrite these screens in React Native immediately.

### Why this is the practical “out-of-the-box” solution

You reuse Chatwoot’s:

- Login and session handling
- Push notifications
- Conversation inbox
- Messages and attachments
- Agent assignment
- Private notes
- Contact management
- iOS and Android infrastructure

You build responsive web pages only for features Chatwoot does not have:

- Channel matching
- Deals
- Commission split
- Accounting
- Territory configuration
- Analytics

That is significantly less work than recreating the whole Chatwoot inbox in Expo.

---

# 3. Architecture

```text
                        PUBLIC USERS
                             │
                             ▼
┌─────────────────────────────────────────────────┐
│ ARCHITECH — Next.js, Prisma, PostgreSQL         │
│                                                 │
│ Listings and requirements                       │
│ Consent and masked customer identity            │
│ Lead routing and pipeline                       │
│ Locality assignments                            │
│ Channel requests and matching                   │
│ Deals, commission splits, ledger                │
│ Broker/team authorization                       │
└──────────────┬───────────────────┬──────────────┘
               │ outbox events     │ mobile APIs/pages
               ▼                   ▼
┌────────────────────────────┐   Chatwoot mobile fork
│ CHATWOOT SERVER            │   ┌────────────────────┐
│                            │◀──│ Inbox              │
│ Broker account isolation   │   │ Conversations      │
│ Conversations/messages     │   │ Push notifications │
│ Agent assignment           │   │ Broker Suite tab   │──▶ Architech
│ Notifications              │   └────────────────────┘
└──────────────┬─────────────┘
               │ verified webhooks
               ▼
          Architech updates
```

## Tenant model

Use one Chatwoot account for each `BrokerOrganization`.

```text
Chatwoot
├── Account: Broker A
│   ├── Agents: A1, A2
│   └── Inbox: Architech Leads
├── Account: Broker B
│   ├── Agents: B1, B2
│   └── Inbox: Architech Leads
└── Platform operations account
```

Do **not** implement the cross-broker channel by exposing conversations across accounts. Account isolation should remain intact. The shared channel belongs in Architech.

---

# 4. Lead management implementation

## 4.1 Locality assignment

Add an explicit assignment model in Architech:

```prisma
model LocalityAssignment {
  id             String   @id @default(cuid())
  organizationId String
  localitySlug   String
  brokerUserId   String
  active         Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([organizationId, localitySlug])
  @@index([organizationId, brokerUserId])
}
```

One locality has one owner per brokerage; one employee can own many localities.

## 4.2 Cold-caller configuration

```prisma
model LeadRoutingSetting {
  id                String   @id @default(cuid())
  organizationId    String   @unique
  coldCallingEnabled Boolean @default(false)
  coldCallerUserId  String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}
```

## 4.3 Pipeline

Do not force the existing public-lead status to carry the entire CRM pipeline. Add a broker CRM record:

```prisma
enum BrokerLeadStage {
  NEW
  CONTACTED
  QUALIFIED
  NEGOTIATION
  CLOSED_WON
  CLOSED_LOST
}

model BrokerLeadCase {
  id                     String          @id @default(cuid())
  leadId                 String          @unique
  organizationId         String
  localitySlug           String?
  assignedBrokerUserId   String?
  originatingColdCallerId String?
  stage                  BrokerLeadStage @default(NEW)
  score                   Int?
  closedAt                DateTime?
  lostReason              String?
  createdAt               DateTime        @default(now())
  updatedAt               DateTime        @updatedAt

  @@index([organizationId, stage])
  @@index([organizationId, assignedBrokerUserId])
}
```

Use an audit table:

```prisma
model BrokerLeadAudit {
  id             String   @id @default(cuid())
  brokerLeadId   String
  organizationId String
  action         String
  fromValue      String?
  toValue        String?
  actorUserId    String?
  metadata       Json?
  createdAt      DateTime @default(now())

  @@index([brokerLeadId, createdAt])
}
```

## 4.4 Routing algorithm

```text
1. Create Lead in Architech.
2. Resolve organization from listing.
3. Resolve locality from listing/requirement.
4. Load broker routing configuration.
5. If cold calling is enabled:
   assign lead to configured cold caller.
6. Otherwise:
   assign lead to locality owner.
7. If no owner exists:
   place lead in broker-admin unassigned queue.
8. Write assignment audit event.
9. Write Chatwoot synchronization event.
```

When a cold caller marks a lead `QUALIFIED`:

```text
1. Resolve locality owner.
2. Transfer ownership to that employee.
3. Preserve originatingColdCallerId.
4. Record HANDOFF audit event.
5. Reassign the Chatwoot conversation.
6. Notify the receiving employee.
```

---

# 5. Mapping leads to Chatwoot

Create one Chatwoot contact and conversation for each Architech lead.

## Safe custom attributes

```json
{
  "architech_lead_id": "lead_123",
  "architech_case_id": "case_123",
  "listing_ref": "AT-1048",
  "locality_slug": "thaltej",
  "lead_score": 78,
  "lead_temperature": "HOT",
  "pipeline_stage": "QUALIFIED",
  "lead_mode": "MASKED",
  "architech_url": "https://app.example.com/mobile/leads/case_123"
}
```

For a masked lead, create a pseudonymous contact:

```json
{
  "name": "Buyer AT-1048",
  "phone_number": null,
  "email": null
}
```

Never send `phoneCiphertext`, an unmasked phone, or reversible customer identity to Chatwoot unless the consent state allows it.

### Labels for mobile convenience

```text
architech-lead
stage-new
stage-contacted
stage-qualified
stage-negotiation
stage-won
stage-lost
locality-thaltej
temperature-hot
```

These labels are mirrors. Architech remains the source of truth.

---

# 6. Reliable synchronization

Add an outbox rather than calling Chatwoot directly during enquiry submission.

```prisma
model IntegrationOutboxEvent {
  id             String    @id @default(cuid())
  organizationId String
  eventType      String
  aggregateType  String
  aggregateId    String
  payload        Json
  attemptCount   Int       @default(0)
  availableAt    DateTime  @default(now())
  processedAt    DateTime?
  lastError      String?
  createdAt      DateTime  @default(now())

  @@index([processedAt, availableAt])
}
```

Recommended event types:

```text
broker.lead.created
broker.lead.assigned
broker.lead.stage_changed
broker.lead.handed_off
broker.lead.consent_changed
broker.lead.deleted
broker.user.activated
broker.user.deactivated
```

Store provider mappings:

```prisma
model ChatwootReference {
  id                     String   @id @default(cuid())
  organizationId         String
  entityType             String
  entityId               String
  chatwootAccountId      Int
  chatwootContactId      String?
  chatwootConversationId String?
  lastSyncedAt           DateTime?
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  @@unique([entityType, entityId])
  @@index([chatwootAccountId, chatwootConversationId])
}
```

## Webhook direction

Chatwoot should send events back for:

- Conversation assigned
- Conversation status changed
- Message created
- Conversation resolved
- Agent/contact changed

However, only approved events should modify Architech:

| Chatwoot action | Architech result |
|---|---|
| Agent assignment | Update owner only if agent mapping is valid |
| First outbound reply | Move `NEW → CONTACTED` |
| Resolve conversation | Do not automatically mark deal won/lost |
| Label changed | Usually ignore; do not trust labels as pipeline authority |
| Message created | Store metadata/timestamp, not necessarily message body |

Webhook processing must verify account ownership and deduplicate event IDs.

---

# 7. Brokers Channel

Chatwoot should only send notifications about matches. The structured channel must be in Architech.

## Core models

```prisma
enum ChannelRequestType {
  DEMAND
  SUPPLY
}

enum ChannelRequestStatus {
  OPEN
  MATCHED
  PENDING_CLOSE
  CLOSED
  EXPIRED
}

model ChannelRequest {
  id                   String               @id @default(cuid())
  organizationId       String
  createdByUserId      String
  type                 ChannelRequestType
  sourceListingId      String?
  sourceRequirementId  String?
  cityId               String
  localitySlug         String?
  intent               String
  propertyType         String
  bhkMin               Int?
  bhkMax               Int?
  budgetMinInr         BigInt?
  budgetMaxInr         BigInt?
  areaMinSqft          Int?
  areaMaxSqft          Int?
  summary              String
  status               ChannelRequestStatus @default(OPEN)
  expiresAt            DateTime
  closedAt             DateTime?
  createdAt            DateTime             @default(now())
  updatedAt            DateTime             @updatedAt

  @@index([cityId, localitySlug, type, status])
  @@index([organizationId, status])
}
```

```prisma
enum ChannelMatchStatus {
  SUGGESTED
  ACCEPTED
  REJECTED
  DEAL_CREATED
}

model ChannelMatch {
  id              String             @id @default(cuid())
  demandRequestId String
  supplyRequestId String
  score           Int
  reasons         Json
  status          ChannelMatchStatus @default(SUGGESTED)
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  @@unique([demandRequestId, supplyRequestId])
  @@index([status, score])
}
```

## Critical privacy rule

Channel responses may show broker contact details, but not customer contact details:

```json
{
  "matchId": "match_123",
  "score": 88,
  "property": {
    "locality": "Thaltej",
    "bhk": 3,
    "priceInr": 8500000
  },
  "counterpartyBroker": {
    "organizationName": "ABC Realty",
    "contactName": "Assigned Broker",
    "businessPhone": "+91..."
  }
}
```

Never return:

```text
buyerPhone
sellerPhone
phoneCiphertext
customerEmail
customerAddress
```

---

# 8. Deterministic matching

Suggested first version:

## Hard filters

A pair is rejected unless:

\[
\text{city}_{D}=\text{city}_{S}
\]

\[
\text{intent}_{D}=\text{intent}_{S}
\]

\[
\text{propertyType}_{D}=\text{propertyType}_{S}
\]

\[
\text{price}_{S}\leq 1.10\times\text{budgetMax}_{D}
\]

If both requests specify locality:

\[
\text{locality}_{D}=\text{locality}_{S}
\]

## Score out of 100

\[
\text{score}
=
35L+25P+20B+10A+10R
\]

Where:

- \(L=1\) for exact locality, \(0.5\) for same city
- \(P=1\) for exact property type
- \(B\in[0,1]\) is budget closeness
- \(A\in[0,1]\) is area/BHK compatibility
- \(R\in[0,1]\) is recency

Example budget score:

\[
B=\max\left(0,1-\frac{|\text{price}-\text{budgetMid}|}{\text{budgetMid}}\right)
\]

Suggested thresholds:

```text
80–100: Strong match
60–79:  Good match
40–59:  Possible match
Below 40: Do not show initially
```

Store the score reasons so brokers can see:

```text
+35 Exact locality
+25 Exact property type
+18 Price within 8% of target
+10 Exact BHK
+7  Request created recently
=95 Strong match
```

---

# 9. Deal and commission implementation

```prisma
enum ChannelDealStatus {
  OPEN
  PENDING_OTHER_CLOSE
  CLOSED
  CANCELLED
}

model ChannelDeal {
  id                     String            @id @default(cuid())
  matchId                String            @unique
  demandOrganizationId   String
  supplyOrganizationId   String
  status                 ChannelDealStatus @default(OPEN)
  dualCloseEnabled       Boolean           @default(false)
  demandConfirmedAt      DateTime?
  supplyConfirmedAt      DateTime?
  totalCommissionInr     BigInt?
  demandBrokerShareInr   BigInt?
  supplyBrokerShareInr   BigInt?
  splitAgreement         String?
  closedAt               DateTime?
  createdAt              DateTime          @default(now())
  updatedAt              DateTime          @updatedAt
}
```

Validation at close:

\[
\text{demandBrokerShare}+\text{supplyBrokerShare}
=
\text{totalCommission}
\]

For dual-close:

```text
Broker A closes
    ↓
PENDING_OTHER_CLOSE
    ↓
Notify Broker B through Chatwoot
    ↓
Broker B confirms
    ↓
CLOSED + ledger entries generated
```

A broker may close its own request without the other side. That closes the request, not automatically the shared deal.

---

# 10. Simple accounting

Use a unified ledger rather than separate loosely related salary and commission tables.

```prisma
enum LedgerEntryType {
  COMMISSION_INCOME
  SALARY_EXPENSE
  OTHER_INCOME
  OTHER_EXPENSE
}

model BrokerLedgerEntry {
  id             String          @id @default(cuid())
  organizationId String
  type           LedgerEntryType
  amountInr      BigInt
  employeeUserId String?
  dealId         String?
  description    String
  entryDate      DateTime
  recordedById   String
  createdAt      DateTime        @default(now())

  @@index([organizationId, entryDate])
  @@index([organizationId, type])
}
```

At deal close, create one commission entry for each participating organization. Salaries and other expenses are entered manually by the broker admin.

This remains a management ledger—not statutory accounting, payroll, or GST filing.

---

# 11. Mobile screens

## Existing Chatwoot screens

Use unchanged:

- Inbox
- Conversation detail
- Contact
- Notifications
- Agent assignment
- Private notes

## Architech Broker Suite screens

Add as responsive pages:

```text
Dashboard
├── New leads
├── Qualified leads
├── Conversion by employee
└── Revenue/expense summary

Leads
├── My leads
├── Unassigned
├── Pipeline
└── Handoff history

Channel
├── Publish demand
├── Publish supply
├── My requests
└── Candidate matches

Deals
├── Active
├── Pending confirmation
└── Closed

Team
├── Employees
├── Locality assignments
├── Cold-caller setting
└── Leave/salary records

Ledger
├── Commission income
├── Salary expense
└── Other expenses
```

Each Chatwoot lead conversation should contain a button such as:

> **Open Broker Suite lead**  
> `https://app.example.com/mobile/leads/case_123`

Use universal/app links so the URL opens inside the mobile app when installed and in the browser otherwise.

---

# 12. Authentication between the mobile app and Architech

Do not pass a permanent Better Auth session in a URL.

Use a one-time handoff:

```text
1. Chatwoot mobile app requests POST /api/mobile/handoff.
2. Server validates the Chatwoot user/account mapping.
3. Architech issues a random, single-use code.
4. App opens /mobile/auth/handoff?code=...
5. Architech consumes code and creates its normal secure session.
6. Code expires after 60 seconds and cannot be reused.
```

Suggested handoff record:

```prisma
model MobileHandoffCode {
  id             String    @id @default(cuid())
  codeHash       String    @unique
  userId         String
  organizationId String
  expiresAt      DateTime
  consumedAt     DateTime?
  createdAt      DateTime  @default(now())
}
```

If direct identity validation against Chatwoot becomes difficult, use separate Architech login inside the Broker Suite tab for Phase 1. It is less elegant but safer than an insecure token bridge.

---

# 13. DPDP deletion flow

Deletion must propagate to Chatwoot.

```text
Buyer deletion/consent revocation in Architech
    ↓
Commit local deletion/redaction
    ↓
Write privacy.erasure.requested outbox event
    ↓
Delete/redact Chatwoot contact and conversations
    ↓
Remove attachments where applicable
    ↓
Record completion without retaining deleted PII
```

For consent revocation:

- Remove phone and email from Chatwoot.
- Replace contact name with a pseudonymous lead reference.
- Remove PII accidentally copied into custom attributes.
- Decide a retention policy for message content.
- Record the erasure completion timestamp.

---

# 14. Implementation phases

## Phase 0 — validate the integration: 2–4 days

1. Deploy Chatwoot Server.
2. Build the unmodified mobile app against it.
3. Create one account for one test brokerage.
4. Add two agents.
5. Create a conversation through the Chatwoot API.
6. Test Android and iOS push.
7. Verify Account A cannot access Account B.

## Phase 1 — lead inbox: 5–8 days

1. Add integration/outbox tables.
2. Implement locality routing.
3. Create Chatwoot contacts and conversations asynchronously.
4. Mirror assignment and stage.
5. Process signed/secret-protected webhooks.
6. Implement consent revocation and erasure.
7. Add deep links to Architech lead detail.

## Phase 2 — mobile Broker Suite shell: 4–7 days

1. Fork and rebrand the mobile app.
2. Add the Broker Suite navigation item.
3. Implement secure login/handoff.
4. Add responsive dashboard and lead pipeline pages.
5. Configure universal links.
6. Prepare internal TestFlight/Play testing.

## Phase 3 — channel and matching: 10–15 days

1. Add channel models.
2. Implement demand/supply publication.
3. Implement deterministic matching.
4. Add match notification conversations or messages.
5. Add accept/reject and deal creation.
6. Enforce customer-contact privacy.

## Phase 4 — deals and simple ledger: 6–10 days

1. Add close and dual-close workflows.
2. Add negotiated commission split.
3. Generate ledger entries.
4. Add salary and expense entry.
5. Add broker dashboard reports.

A credible total is approximately **27–44 developer-days**, because Chatwoot saves the communication/mobile-inbox work but does not provide the channel, matching, or accounting modules.

---

# 15. Final tooling decision

Update the attached decision from:

> Twenty now; Frappe later.

to:

> **Architech + Chatwoot Server + Chatwoot Mobile now; Frappe/ERPNext later if statutory accounting or payroll is required.**

Use this exact division:

- **Chatwoot:** inbox, communication, assignment interface, push notifications.
- **Architech:** tenant authority, routing, pipeline state, channel, matching, deals, privacy, and simple accounting.
- **Chatwoot mobile fork:** existing communication UI plus a Broker Suite tab opening Architech’s responsive screens.
- **Frappe/ERPNext later:** payroll, GST, e-invoicing, and statutory accounting.

This fulfills the requirements with both Chatwoot repositories while avoiding the mistake of trying to turn Chatwoot labels and custom attributes into a complete CRM and accounting database.
