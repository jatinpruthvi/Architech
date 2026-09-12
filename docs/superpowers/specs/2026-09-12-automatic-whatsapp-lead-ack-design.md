# Automatic WhatsApp Lead Acknowledgement — Design Specification

**Date:** 12 Sep 2026
**Status:** Draft for user review
**Scope:** First working vertical slice for automatic, one-time WhatsApp acknowledgement from an active broker organization’s company-owned WhatsApp number.
**Primary source requirements:**
- [`docs/broker-suite/frappe-crm-whatsapp-tab-integration.md`](../../broker-suite/frappe-crm-whatsapp-tab-integration.md)
- [`docs/broker-suite/evolution-api-adoption-assessment.md`](../../broker-suite/evolution-api-adoption-assessment.md)
- [`docs/broker-suite/decision.md`](../../broker-suite/decision.md)

---

## 1. Goal and product boundary

When a lead is created for a broker-owned listing, an organization with an `ACTIVE` marketplace subscription may send exactly one configurable acknowledgement to the lead’s WhatsApp number from that organization’s connected company-owned WhatsApp account.

The first implementation is city-agnostic. Every city uses the owning broker organization’s one connected WhatsApp account. City-specific account routing is a later extension, not a hidden first-version rule.

The broker connects the company number by scanning a QR code displayed in the authenticated Architech broker dashboard. Evolution API is self-hosted as a separate private service. The browser never calls Evolution directly and never receives an Evolution global or instance API key.

This slice does **not** implement the Frappe CRM WhatsApp tab, inbound customer chat, message history, media, campaigns, multi-account routing, Chatwoot, official Meta Cloud API, or broker-facing logout/pause/delete controls.

### 1.1 Acceptance outcome

The first pilot is successful when a test organization can:

1. sign in to Architech with an `ACTIVE` subscription;
2. open the broker WhatsApp settings page;
3. create an Evolution session and scan its QR using WhatsApp’s Linked devices flow;
4. see the account become connected;
5. save one bounded acknowledgement template;
6. create an eligible lead;
7. cause one server-side Evolution text send from the broker’s connected number;
8. see the send state and provider reference in the broker-facing status surface; and
9. prove that retries, duplicate lead posts, a non-active subscription, a disconnected account, and cross-organization access cannot create an unauthorized or duplicate send.

A provider acceptance response is not presented as proof of handset delivery.

---

## 2. Current repository context

Architech is a Next.js 16 / React 19 / TypeScript application with Prisma 7 and PostgreSQL. The current repository already provides:

- organization-scoped broker sessions and permissions;
- `MarketplaceSubscription` with `ACTIVE`, `TRIAL`, `PAUSED`, `EXPIRED`, and `CANCELLED` states;
- `resolvePlanStatusForOrg`, which resolves the most recent organization subscription;
- `Lead` rows with encrypted `phoneCiphertext`, `phoneLast4`, consent provenance, retention, soft deletion, and audit events;
- `InteropOutbox` and `InteropInboundEvent` patterns for durable external projections;
- broker dashboard and lead inbox routes;
- AES-256-GCM contact encryption and Indian E.164 phone normalization;
- a lead event spine, which is useful for notification but is not by itself durable enough to be the provider queue.

The current lead creation fallback idempotency key includes the raw phone and message. This slice must replace or bypass that unsafe fallback with opaque or keyed material before the provider dispatch is enabled. Raw phone values must not appear in dispatch ids, logs, URLs, or generic job payloads.

The `business_suite/*` entries in the parent repository are empty gitlink placeholders. The first acknowledgement slice remains in Architech and does not require checking out or changing the Frappe repositories. The exact Evolution source used for the local service is `evolution-foundation/evolution-api` `2.3.7` at commit `cd800f2976e1e5b682fbf86a01ee4d85ae61f370`.

---

## 3. Chosen architecture

### 3.1 Recommended first-version topology

```text
Broker browser
     │ authenticated Architech session
     ▼
Architech Next.js control plane
  ├─ active-subscription and organization authorization
  ├─ WhatsApp account registry
  ├─ QR/status/template API and broker UI
  ├─ lead transaction + durable WhatsApp dispatch row
  ├─ private Evolution adapter
  └─ webhook verification and dispatch-state updates
     │ server-to-server only
     ▼
Private Evolution API 2.3.7
  ├─ Baileys instance sessions
  ├─ Evolution PostgreSQL database
  └─ Evolution Redis
```

For this first slice, the private Evolution adapter is a server-only Architech module. It is intentionally shaped as a provider boundary so it can later move into the separate private gateway described in the broader broker-suite documents without changing broker-facing routes or dispatch contracts.

### 3.2 Why this is the first slice

A dedicated gateway from the first commit would be closer to the eventual production topology but would add a second application, deployment, authentication boundary, and operational surface before the lead-to-message contract has been proven. A Frappe-first implementation would solve the larger CRM-tab problem rather than the requested automatic acknowledgement.

The Architech server remains a private caller of Evolution. Evolution is not embedded in the Next.js process, and Evolution’s global API key remains server-only. The local setup must use a separate Evolution PostgreSQL database and Redis instance/namespace rather than reusing Architech’s application database.

### 3.3 Evolution source contract verified for this design

Evolution `2.3.7` provides the required primitives:

- `POST /instance/create` for an instance using the `WHATSAPP-BAILEYS` integration;
- `GET /instance/connect/:instanceName` for QR/status data;
- `GET /instance/connectionState/:instanceName` for connection state;
- `POST /message/sendText/:instanceName` with `{ number, text }`;
- per-instance webhook configuration with `QRCODE_UPDATED`, `CONNECTION_UPDATE`, `SEND_MESSAGE`, and `SEND_MESSAGE_UPDATE` events;
- a webhook `jwt_key` configuration that makes Evolution send a JWT authorization header.

The upstream create response may contain sensitive `hash`/instance credential material and webhook payloads can contain an `apikey`. The adapter must use an allowlist and discard those fields before persistence, logging, or browser response.

---

## 4. User flows

### 4.1 Broker connects a company WhatsApp account

1. A signed-in organization member opens the Architech broker dashboard’s WhatsApp settings page.
2. The server requires the organization to have subscription status `ACTIVE` and the session to have the account-management permission.
3. If the organization has no account, the server generates an opaque instance name that does not contain the organization name, phone number, email, or customer data.
4. The server calls Evolution’s private `/instance/create` endpoint with:
   - `integration: "WHATSAPP-BAILEYS"`;
   - `qrcode: true`;
   - the instance name;
   - a private webhook URL; and
   - only the required event list.
5. The adapter redacts the create response and stores the provider instance id, instance name, and connection state. It never stores or returns the provider `hash` unless a later source-verified implementation proves it is required and stores it through an approved secret reference.
6. The browser polls an Architech QR endpoint. Architech calls Evolution’s `/instance/connect/:instanceName` server-side and returns only a short-lived, sanitized QR representation or a `connected`/`waiting` state.
7. The broker opens WhatsApp on the company phone, chooses **Settings → Linked devices → Link a device**, and scans the QR displayed by Architech.
8. Evolution sends a verified `CONNECTION_UPDATE` webhook. Architech maps the opaque instance to exactly one organization account and updates its observed state.
9. The dashboard shows connected state and a masked provider phone identifier if Evolution supplies one. It never shows provider keys or raw webhook data.

The broker-facing first version has no logout, pause, or delete buttons. If the broker removes the linked device from WhatsApp, Evolution’s connection event or the next server-side state check marks the account disconnected, and new sends are blocked. A future lifecycle feature can add explicit controls after the pilot.

### 4.2 Broker configures the acknowledgement template

1. An authorized broker organization member opens the same WhatsApp settings page.
2. The page shows one active template and its version.
3. The broker edits the body and saves it. The server validates the body and creates a new immutable version; it never mutates a version already referenced by a dispatch.
4. The server permits only these initial placeholders:
   - `{{firstName}}` — lead name normalized to a safe display value;
   - `{{brokerName}}` — owning broker organization name;
   - `{{listingTitle}}` — active listing title;
   - `{{city}}` — listing city name.
5. Unknown placeholders, empty bodies, oversized bodies, control characters, and unbounded values are rejected.
6. The system’s default template is:

   ```text
   Hi {{firstName}}, this is {{brokerName}}. We received your enquiry for {{listingTitle}} in {{city}}. Our team will contact you shortly. Reply STOP to opt out.
   ```

The default is a transactional acknowledgement, not a marketing campaign. The first version has no template scheduling, audience selection, media, links, bulk send, or follow-up sequence.

### 4.3 Lead creates one dispatch

1. The public lead flow validates the existing lead fields and records the one minimal WhatsApp eligibility field described in §6.3.
2. The lead transaction resolves the listing’s broker organization server-side. A request body cannot choose the recipient organization.
3. The transaction writes the lead and its audit event.
4. If the lead is eligible for this feature, the same transaction writes one `WhatsAppDispatch` row using a unique `(leadId, purpose)` constraint. No provider call happens inside the lead request transaction.
5. A duplicate lead submission returns the existing lead contract and does not create a second dispatch.
6. A worker claims pending dispatches after commit.
7. The worker re-checks subscription status, lead deletion, WhatsApp eligibility, account connection state, template version, and organization ownership before decrypting the phone.
8. The worker normalizes the stored contact to the Evolution number format in memory, renders the immutable template version, and calls Evolution’s private `sendText` endpoint.
9. The worker stores only provider-safe state: dispatch status, provider message id when supplied, bounded error code, attempt count, timestamps, and a payload hash. It does not store raw phone numbers or message bodies in generic job data.
10. `SEND_MESSAGE` / `SEND_MESSAGE_UPDATE` events update the provider state when a matching provider message id exists. These events are evidence of provider processing, not handset delivery guarantees.

### 4.4 Eligibility and skip behavior

A dispatch is eligible only when all of these are true:

- the lead belongs to a broker listing with a non-null owning organization;
- that organization’s resolved subscription status is exactly `ACTIVE`;
- the lead has the minimal WhatsApp eligibility flag enabled;
- the organization has a configured active template;
- the organization has one connected WhatsApp account; and
- the lead is not deleted, suppressed, or past its retention boundary.

A lead that is not eligible is not sent. The system records a non-sensitive skip reason such as `NO_ACTIVE_PLAN`, `NO_WHATSAPP_OPT_IN`, `NO_CONNECTED_ACCOUNT`, or `LEAD_DELETED`. It does not retry a permanently ineligible row. If the account is temporarily connecting, the row may remain pending until its bounded expiry; the design must not create an unbounded backlog.

### 4.5 At-most-once provider behavior

The dispatch contract is at most one automatic acknowledgement per lead and purpose. The database uniqueness constraint prevents duplicate creation. A provider timeout after the request may be ambiguous because Evolution `2.3.7` does not provide an application-level idempotency key for `sendText`.

The worker therefore uses these states:

```text
PENDING → IN_FLIGHT → ACCEPTED
                      ├─ FAILED
                      └─ UNKNOWN
```

- `ACCEPTED` means Evolution returned a provider message reference.
- `FAILED` means the adapter received a definitive non-send error before acceptance.
- `UNKNOWN` means the request outcome cannot be proven. It is not automatically retried.
- A scheduled reconciliation may inspect provider evidence later, but it must not blindly resend an `UNKNOWN` dispatch.

---

## 5. Data model changes

The implementation must extend the existing Prisma schema and migrations. Names below are the contract; exact migration naming follows the repository’s timestamp convention.

### 5.1 `WhatsAppAccount`

One account per organization is enforced for the first slice. The schema should remain extensible to multiple accounts later by making the organization relation non-global in a future migration rather than putting city routing into the first model.

```prisma
enum WhatsAppAccountStatus {
  PROVISIONING
  QR_READY
  CONNECTING
  CONNECTED
  DISCONNECTED
  ERROR
}

model WhatsAppAccount {
  id                 String               @id @default(cuid())
  organizationId     String               @unique
  provider           String               @default("EVOLUTION_BAILEYS") @db.VarChar(32)
  instanceName       String               @unique @db.VarChar(100)
  providerInstanceId String?              @db.VarChar(140)
  status             WhatsAppAccountStatus @default(PROVISIONING)
  phoneLast4         String?              @db.VarChar(4)
  connectedAt        DateTime?
  lastObservedAt     DateTime?
  lastErrorCode      String?              @db.VarChar(64)
  createdAt          DateTime             @default(now())
  updatedAt          DateTime             @updatedAt

  organization BrokerOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  dispatches   WhatsAppDispatch[]

  @@index([organizationId, status])
  @@index([status, lastObservedAt])
}
```

The final schema may use a raw partial unique index or an application transaction for the active-template rule. It must not store a raw Evolution global key, raw webhook JWT key, QR payload, pairing code, or provider `hash` in ordinary columns.

### 5.2 `WhatsAppTemplate`

```prisma
model WhatsAppTemplate {
  id             String   @id @default(cuid())
  organizationId String
  version        Int
  body           String   @db.VarChar(1200)
  isActive       Boolean  @default(true)
  createdById    String?
  createdAt      DateTime @default(now())

  organization BrokerOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  dispatches   WhatsAppDispatch[]

  @@unique([organizationId, version])
  @@index([organizationId, isActive, version])
}
```

A save creates a new version and deactivates the previous version in one transaction. Dispatches reference the exact version used for rendering. Template rows are not deleted while a dispatch references them.

### 5.3 Minimal lead eligibility field

The first feature does not introduce a general consent-management subsystem. It adds one explicit, auditable channel eligibility fact to the existing lead flow:

- `whatsappOptIn Boolean @default(false)`;
- `whatsappOptInAt DateTime?`;
- `whatsappOptInText String?` containing the bounded text/version shown at capture.

The lead form keeps the checkbox unchecked by default. A lead can still be created without it and can be handled through existing manual broker workflows. The automatic dispatch gate requires `whatsappOptIn = true`. This is intentionally one field and one gate; it is not a campaign or repeated-contact feature.

### 5.4 `WhatsAppDispatch`

```prisma
enum WhatsAppDispatchStatus {
  PENDING
  IN_FLIGHT
  ACCEPTED
  FAILED
  UNKNOWN
  SKIPPED
}

model WhatsAppDispatch {
  id                String                 @id @default(cuid())
  organizationId    String
  leadId            String
  accountId         String?
  templateId        String?
  purpose           String                 @default("lead-ack") @db.VarChar(48)
  templateVersion   Int?
  status            WhatsAppDispatchStatus @default(PENDING)
  skipReason        String?                @db.VarChar(64)
  providerMessageId String?                @db.VarChar(140)
  payloadHash       String?                @db.VarChar(64)
  attemptCount      Int                    @default(0)
  lastErrorCode     String?                @db.VarChar(64)
  nextAttemptAt     DateTime?
  acceptedAt        DateTime?
  completedAt       DateTime?
  createdAt         DateTime               @default(now())
  updatedAt         DateTime               @updatedAt

  organization BrokerOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  lead         Lead               @relation(fields: [leadId], references: [id], onDelete: Cascade)
  account      WhatsAppAccount?   @relation(fields: [accountId], references: [id], onDelete: SetNull)
  template     WhatsAppTemplate?  @relation(fields: [templateId], references: [id], onDelete: SetNull)

  @@unique([leadId, purpose])
  @@index([organizationId, status, nextAttemptAt])
  @@index([accountId, status])
  @@index([providerMessageId])
}
```

The dispatch table carries no raw customer phone or rendered message body. The worker loads the lead, decrypts the contact only in memory, renders the referenced template, and discards both after the provider request.

### 5.5 Organization relations and audit

`BrokerOrganization` receives relations for accounts, templates, and dispatches. `Lead` receives its dispatch relation. Account connection, template changes, QR initiation, skip decisions, and provider state transitions create `AuditEvent` rows with organization and actor scope. Audit metadata is restricted to non-sensitive identifiers, state, version, and bounded reason codes.

---

## 6. Server interfaces

All routes are server-only, authenticated, organization-scoped, and `Cache-Control: no-store`. Mutations use the repository’s request-safety checks.

### 6.1 Broker routes

| Method | Route | Permission | Purpose |
|---|---|---|---|
| `GET` | `/api/broker/whatsapp` | `broker.whatsapp.read` | Return sanitized account state, active template metadata, and feature eligibility |
| `POST` | `/api/broker/whatsapp/connect` | `broker.whatsapp.manage` | Create or resume the organization’s Evolution instance |
| `GET` | `/api/broker/whatsapp/qr` | `broker.whatsapp.read` | Server-side QR poll; return QR/state only, never provider credentials |
| `GET` | `/api/broker/whatsapp/status` | `broker.whatsapp.read` | Return observed state and last safe error |
| `GET` | `/api/broker/whatsapp/template` | `broker.whatsapp.read` | Return current template and allowed placeholders |
| `PUT` | `/api/broker/whatsapp/template` | `broker.whatsapp.manage` | Create the next validated template version |

The first version should grant management permission only to the broker organization administrator. Members may later receive read/send policy according to product decision. The server resolves `organizationId` from the session and never accepts it as an authority-bearing request field.

### 6.2 Evolution adapter interface

The Architech module must expose a provider-neutral interface so the rest of the application does not construct Evolution URLs or payloads directly:

```ts
type WhatsAppProvider = {
  createInstance(input: {
    instanceName: string;
    webhookUrl: string;
    webhookJwtKey: string;
    events: string[];
  }): Promise<{ providerInstanceId: string | null; state: string }>;
  getQr(input: { instanceName: string }): Promise<{ state: string; qrDataUrl?: string }>;
  getConnectionState(input: { instanceName: string }): Promise<{ state: string }>;
  sendText(input: { instanceName: string; number: string; text: string }): Promise<{ providerMessageId: string | null }>;
};
```

The concrete Evolution implementation adds the server-side global API key and base URL from environment configuration. It returns allowlisted data only. No browser route imports or calls the concrete provider module directly except through the account/dispatch services.

### 6.3 Internal webhook route

Evolution posts to a private Architech route such as `/api/internal/providers/evolution/webhook`. The route:

1. preserves the raw request body if signature verification requires it;
2. verifies the expected JWT algorithm, signature, expiry, and deployment key;
3. validates event size and shape;
4. resolves `instance` through `WhatsAppAccount.instanceName`;
5. rejects unknown instances and cross-organization mappings;
6. deduplicates provider event identity where available;
7. discards `apikey`, raw credentials, QR payloads after state processing, and unnecessary message bodies; and
8. records only the account/dispatch state needed for this MVP.

This first slice does not ingest inbound customer message bodies. `MESSAGES_UPSERT` is not a CRM chat feature in this phase; it is either disabled or ignored after strict validation.

### 6.4 Outbox worker interface

Dispatch processing is invoked through an authenticated internal driver. It must use an atomic claim so multiple worker/cron invocations cannot process the same row concurrently:

```text
claim due PENDING row
  → mark IN_FLIGHT and increment attempt count
  → re-check subscription/account/lead/template
  → call provider once
  → mark ACCEPTED, FAILED, UNKNOWN, or SKIPPED
```

The first local setup may use a small polling worker or the repository’s authenticated scheduled-job pattern. The dispatch service must remain reusable if that driver moves to a dedicated gateway worker later. A lead request must never wait synchronously for Evolution to answer.

---

## 7. Security and privacy constraints

1. **Organization scope:** every account, template, dispatch, and webhook lookup is scoped to an organization. An instance name, provider id, or client-supplied organization id never establishes ownership.
2. **Plan gate:** only exact `ACTIVE` subscription status permits QR initiation, template use, and dispatch. `TRIAL` is not sufficient for this feature.
3. **Credential boundary:** Evolution global API key and webhook verification key are server-only environment secrets. They never appear in client bundles, API responses, logs, audit metadata, or error messages.
4. **QR boundary:** QR data is ephemeral, no-store, not placed in URLs, not emailed/pushed, not persisted in Prisma, and not written to logs or analytics. The QR endpoint returns only the current state or short-lived display data.
5. **Customer contact:** decrypt only in the dispatch worker. No raw phone in idempotency keys, provider logs, URLs, generic job payloads, or browser responses.
6. **Template safety:** render only allowlisted placeholders; escape/normalize control characters; bound body and rendered output; do not allow arbitrary URLs or executable template syntax.
7. **At-most-once:** a unique `(leadId, purpose)` key prevents duplicate dispatch creation. Ambiguous provider results become `UNKNOWN`, not blind retries.
8. **Account ownership:** only company-owned broker accounts are eligible. The first UI records a broker attestation/acknowledgement; personal employee accounts are not supported.
9. **Provider isolation:** Evolution, its database, Redis, internal callbacks, and management surfaces are private. The separate manager service is not included in the local setup.
10. **Logging:** provider responses are reduced to safe status/error codes. Webhook payloads, phone numbers, message bodies, QR strings, tokens, and API keys are not logged.
11. **Retention:** the dispatch record is a delivery audit, not a message archive. Lead retention/erasure must delete or anonymize related dispatch state without preserving the customer’s number or rendered body.
12. **Feature flag:** real-number activation remains disabled unless the deployment has the required Evolution source/image, secret, privacy, license, and canary gates configured. A missing provider configuration fails closed.

---

## 8. Local and deployment setup

Create a separate WhatsApp development compose configuration rather than modifying Architech’s application database services to share state with Evolution. The setup contains:

- Evolution API pinned to source/image `2.3.7` and a verified architecture digest;
- a dedicated Evolution PostgreSQL database/volume;
- a dedicated Evolution Redis service/namespace;
- no Evolution Manager container;
- no public Evolution port in a production-like deployment;
- telemetry off, broad CORS off, instance exposure off, and minimal redacted logs;
- an internal network path from Architech to Evolution; and
- environment variables for the server-only Evolution URL, global API key, webhook verification key, and feature flag.

The upstream Compose file is not copied verbatim because it uses floating image tags and example defaults. The local compose file is for synthetic/test accounts; real-number activation remains a separate gate.

The QR flow needs a running Evolution service. If the service is not configured, the Architech routes return a clear disabled/unavailable state rather than attempting a browser-to-provider fallback.

---

## 9. UI design

Add a WhatsApp section to the authenticated Architech broker workspace rather than Frappe CRM. The page contains three small panels:

1. **Connection**
   - not connected: `Connect WhatsApp` action;
   - QR pending: QR image, expiry/status text, and safe instructions to scan from WhatsApp Linked devices;
   - connecting: polling status;
   - connected: masked connection state and last observed time;
   - disconnected/error: safe state and instruction to reconnect through the same flow.
2. **Acknowledgement template**
   - textarea with placeholder help;
   - rendered preview using fixture values;
   - save/version action;
   - validation errors returned by the server.
3. **Delivery status**
   - counts or latest state for this organization’s one-time acknowledgements;
   - no customer phone, message archive, inbound chat, or cross-organization rows.

The page must handle loading, provider-disabled, unauthorized, no-active-plan, QR-expired, disconnected, and empty-template states explicitly. It must not render a false “connected” state from fixture data in a production source.

---

## 10. Testing and verification

### 10.1 Unit tests

- template placeholder parser accepts only the four allowlisted placeholders;
- unknown placeholders and oversized/control-character bodies fail;
- rendering bounds and normalization are deterministic;
- active subscription gate accepts `ACTIVE` and rejects `TRIAL`, `PAUSED`, `EXPIRED`, `CANCELLED`, and no subscription;
- opaque instance names contain no organization or customer PII;
- dispatch idempotency key contains no raw contact data;
- one `(leadId, purpose)` cannot create two dispatch rows;
- `UNKNOWN` provider result is not automatically retried;
- provider response redaction removes `hash`, `token`, `apikey`, QR payloads, and raw error bodies;
- webhook event mapping rejects an unknown instance or wrong organization.

### 10.2 Route/API tests

- unauthorized sessions cannot create an account, read a QR, or edit a template;
- a non-active organization receives a closed-gate response for connect, template use, and dispatch;
- a broker can only read its own account/template/status;
- QR responses are no-store and contain no provider key;
- template writes create monotonically increasing versions;
- duplicate lead POSTs return the existing lead and do not enqueue a second dispatch;
- an unconnected account records a safe skip/pending state and does not call Evolution;
- a provider send failure is visible as a safe failure code without exposing provider internals.

### 10.3 Integration tests with a mock provider

Use a provider fake implementing `WhatsAppProvider` to prove:

1. lead transaction and dispatch row commit together;
2. dispatch worker claims and sends the correct organization’s account;
3. two organizations cannot cross-read or cross-send;
4. the rendered body uses the dispatch’s saved template version;
5. duplicate worker claims do not send twice;
6. a connection webhook enables sending only for the mapped account;
7. a disconnect webhook blocks subsequent sends; and
8. an ambiguous provider timeout produces `UNKNOWN` and no second provider call.

### 10.4 Manual synthetic pilot

Before any real customer number:

- run the pinned Evolution stack privately;
- connect a non-critical company-owned test number by QR;
- submit a synthetic lead with explicit WhatsApp eligibility;
- verify the customer test handset receives exactly one message;
- repeat the lead request and verify no second message;
- remove the linked device from WhatsApp and verify new dispatches are blocked;
- run two synthetic organizations and verify tenant isolation; and
- inspect logs and database rows for absence of raw phone, QR, API key, and rendered message body.

The pilot is not a production approval. The broader Evolution license, unofficial-client, privacy, canary, retention, and rollback gates remain applicable.

---

## 11. Implementation phases after spec approval

The detailed Superpowers implementation plan will split the work into independently testable tasks:

1. Source/configuration lock and exact Evolution local service setup.
2. Prisma account/template/dispatch schema and migration, including organization relations and retention behavior.
3. Opaque lead idempotency and minimal WhatsApp eligibility field in the lead transaction.
4. Provider interface plus Evolution adapter with response redaction and QR/status/send operations.
5. Authenticated webhook ingestion and account/dispatch state transitions.
6. Durable dispatch claim/worker and one-time send behavior.
7. Broker dashboard connection/template/status UI.
8. Unit, route, tenant-isolation, mock-provider, and synthetic-flow tests.
9. Fresh verification: type-check, lint, targeted tests, database validation, and a documented manual pilot checklist.

No implementation task should add Frappe CRM changes, inbound message storage, city-specific account routing, or multi-account lifecycle controls to this first plan.

---

## 12. Explicitly deferred decisions

- whether the later CRM WhatsApp tab stores full message bodies or only activity markers;
- whether Frappe CRM receives a provider projection or remains a progress-only surface;
- multiple WhatsApp accounts per organization and city/employee routing;
- explicit logout, pause, delete, re-pair, and orphan cleanup UI;
- a dedicated gateway process and separate provider worker deployment;
- inbound replies, message history, media, reactions, templates in the Meta sense, and retention purge of chat content;
- official Meta Cloud API and any paid messaging path;
- replacing Evolution with another transport such as gowamd or a future WAHA configuration.

These are not hidden requirements of the first acknowledgement slice.
