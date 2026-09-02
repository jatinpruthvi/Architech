# Broker Suite — Evolution API adoption assessment

**Date:** 02 Sep 2026
**Status:** Historical source/risk evidence; v8 transport gates remain relevant, Chatwoot composition is superseded
**Scope:** Source-level assessment of Evolution API `2.3.7`; originally evaluated alongside Architech and Chatwoot

> **v8 amendment (02 Sep 2026):** Chatwoot has been removed from implementation. Any Chatwoot mirror, inbox, assignment, callback, retention or mobile requirement below is evaluation history, not selected architecture. Evolution now sends through company-owned accounts and employees continue in normal WhatsApp; Frappe CRM owns lead progress. The current decision is [`decision.md`](./decision.md).
>
> This is a source-level architecture and adoption assessment, not a penetration test or legal opinion. It still defines the Evolution licensing, credential, lifecycle, consent, idempotency, canary and unofficial-transport gates that apply to v8.

## 1. Decision

Evolution API **supplements but does not replace Chatwoot**:

- **Architech remains the authorization and account-lifecycle control plane.** It owns brokerage tenancy, provider/account registry, consent, desired state, commands, audit, retention, erasure tombstones, queues, and reconciliation.
- **Chatwoot remains the human conversation inbox and mobile-agent surface.** It does not become the WhatsApp account registry or CRM authority.
- **Evolution API is the requested lead-triggered provider adapter for `WHATSAPP-BAILEYS`.** After a customer creates a specifically WhatsApp-consented lead, Architech dispatches an immediate acknowledgement from an eligible brokerage-owned linked number; Evolution mirrors the conversation into Chatwoot for the assigned agent. The adapter, encrypted lead destination, durable fast outbox, add/pair/pause/logout/delete UI, event ingress, reconciliation, and Chatwoot bridge are required project scope. Real-number production activation still requires explicit business/legal risk acceptance after synthetic and limited brokerage-owned-number pilots.
- **Official WhatsApp remains available through Chatwoot's Meta Cloud API channel, but it is not the requested transport for this automatic brokerage-number follow-up.** Do not route official Meta credentials through Evolution API `v2.3.7`: that release overloads its instance `token` as both the Meta bearer token and Evolution's per-instance API key, stores it in the instance row, returns it from instance surfaces, and places the instance API key in outbound webhook payloads.
- **Genuine WhatsApp Flows require the official Meta path and are outside the hosting-only baseline.** Evolution `v2.3.7` exposes list and button endpoints, and its Baileys implementation constructs a protocol object named `nativeFlowMessage`, but it has no first-class `flow_id`, `flow_token`, Flow JSON, publish, or data-exchange endpoint. That is not evidence of the official WhatsApp Flows product. The baseline uses text menus plus capability-gated lists/buttons; a Meta Flow adapter remains disabled unless separately cost-approved.

This creates two explicit transports behind one Architech account registry:

| Transport | First implementation role | Onboarding | Production posture |
|---|---|---|---|
| `CHATWOOT_META_CLOUD` | Supported official alternative and genuine-Flow route | Meta Embedded Signup/manual Cloud API setup; no QR | Available per brokerage; Meta policy, template/window rules, and usage pricing apply |
| `EVOLUTION_BAILEYS` | Required lead-created immediate follow-up from brokerage-owned linked accounts | QR or pairing code through Architech | Requested workflow after the activation gate; feature-flagged until risk acceptance/canary because unofficial protocol, number restriction/ban, breakage, privacy, and shared-process risks apply |
| `EVOLUTION_META_CLOUD` | Not enabled on `v2.3.7` | Token, WABA ID, phone-number ID | Reconsider only after an upgraded/forked release separates provider secrets from API credentials and passes the same security gates |

There is no honest option that simultaneously guarantees an official supported transport and zero Meta charges. As of 02 Sep 2026, Meta states that service messages become chargeable per delivered message on **01 Oct 2026**, and a payment method is required by **30 Sep 2026** to avoid service-message delivery stopping. Baileys avoids the Cloud API charge by using an unofficial WhatsApp Web session; it does not turn that transport into an approved or ban-safe API.

## 2. Immutable source snapshot

| Item | Source-confirmed snapshot |
|---|---|
| Canonical repository | [`evolution-foundation/evolution-api`](https://github.com/evolution-foundation/evolution-api); the historical `EvolutionAPI/evolution-api` URL redirects there |
| Stable release inspected | [`2.3.7`](https://github.com/evolution-foundation/evolution-api/releases/tag/2.3.7), released 05 Dec 2025 |
| Immutable source commit | [`cd800f2976e1e5b682fbf86a01ee4d85ae61f370`](https://github.com/evolution-foundation/evolution-api/tree/cd800f2976e1e5b682fbf86a01ee4d85ae61f370) |
| Newer release posture at inspection | `2.4.0-rc1` and `2.4.0-rc2` are GitHub prereleases; no newer stable release was published |
| Current default-branch head observed | `fa09d37892cdbb1d65a250155d293d92230c5b30` |
| Package/runtime at stable source | `package.json` version `2.3.7`; Dockerfile builds on Node 24 Alpine |
| Stable image | Docker Hub publishes `evoapicloud/evolution-api:v2.3.7`; Linux/amd64 digest shown by Docker Hub is `sha256:456b4104b0ddffbb092d6b3c0560a4ae86fc3e014e885b882aca4b1b371dfc81`, arm64 is `sha256:0e5d84f45b390e1d659500c9a98bfa2a53be28a341fbc0864966b77485f2a0c5` |
| Current source-supported providers | Baileys/WhatsApp Web (`WHATSAPP-BAILEYS`), Meta Cloud (`WHATSAPP-BUSINESS`), and an Evolution provider surface |
| License posture | Repository license says Apache 2.0 **plus additional logo/copyright and usage-notification conditions**; GitHub reports `NOASSERTION`, so it must not be described simply as Apache-2.0/OSI-approved |

The upstream Compose file is an example, not a production lockfile. At `2.3.7` it references `evoapicloud/evolution-api:latest`, `evoapicloud/evolution-manager:latest`, `redis:latest`, and `postgres:15`. Those floating references are not accepted for Architech. The stable Dockerfile also carries a stale `LABEL version="2.3.1"`, so runtime version and image provenance must be verified independently rather than inferred from that label.

## 3. Resolution of supplied claims

| Supplied claim | Source result | Project decision |
|---|---|---|
| Evolution is an alternative to Baileys | **Incorrect framing.** Evolution's `WHATSAPP-BAILEYS` provider embeds Baileys. | Evolution reduces custom socket/session API work; it does not remove Baileys risks. |
| A failed account does not affect others | **Not established.** One API process holds many instances in `WAMonitoringService.waInstances`. | Treat one Evolution API process/container as one failure domain. Shard or physically isolate according to measured blast radius. |
| Add/pause/delete accounts dynamically | **Partial.** `create`, `connect`, `restart`, `connectionState`, `logout`, and `delete` exist. No provider-level pause endpoint was found. Delete starts asynchronous event-listener cleanup. | Implement pause as an Architech outbound gate. Make commands idempotent and reconcile observed provider state. Never treat a successful delete response as completed erasure. |
| Built-in Manager is enough for brokerage admins | **Unsafe boundary.** Stable source serves bundled manager assets and upstream Compose also launches a separate manager image; control uses high-value API credentials. | Set `SERVER_DISABLE_MANAGER=true`, omit the separate Manager container, and expose only Architech's tenant-aware admin UI. |
| Native Chatwoot integration is plug-and-play | **Technically present, not safe to expose directly.** Evolution can create/find a Chatwoot API inbox and mirror text/media, but its `/chatwoot/webhook/:instanceName` route has no Evolution auth guard and does not verify Chatwoot's HMAC. | Manually provision the Chatwoot API inbox. Send its signed callback to an Architech gateway, verify HMAC/tenant/inbox/account/state, deduplicate, and only then forward on the private network. Do not use Evolution `autoCreate` with a public direct callback. |
| Webhooks are secure because a secret URL can be used | **Insufficient.** Stable Evolution supports custom headers and a short-lived Bearer JWT generated from `jwt_key`, but the JWT authenticates the sender and is not a digest of the body. Webhook payloads include `apikey`. | Require private TLS/network ingress, JWT verification, replay/dedup controls, account lookup, payload-schema validation, and state re-fetch. Never log or persist the webhook `apikey`. |
| Evolution `token` safely represents a provider token | **Contradicted for Meta mode.** `v2.3.7` stores the supplied token as the instance token, accepts it as an Evolution `apikey`, uses it as Meta Bearer auth, returns instance records including token, and includes `apikey` in webhooks. | Disable `EVOLUTION_META_CLOUD` on this release. The Baileys instance key is still sensitive and remains gateway-only. |
| Lists/buttons provide reliable checkbox-style interactions | **Overstated.** Endpoints exist, but current open issues report HTTP success with non-delivery for buttons/lists. The Baileys implementation is protocol-sensitive. | Text is the required baseline. Lists/buttons are progressive enhancement with delivery verification and text fallback. Multi-select uses a stateful text menu unless an official Flow is used. |
| `nativeFlowMessage` means WhatsApp Flows | **Incorrect.** No first-class official Flow identifiers, Flow management, or data-exchange surface was found in `2.3.7`. | Build genuine Flows only on official Meta; do not market Baileys buttons as WhatsApp Flows. |
| Humanized delay prevents bans | **Unsupported.** Random/typing delays do not establish policy compliance or number safety. | Enforce opt-in, frequency, purpose, stop requests, per-account quotas, and quality monitoring. Do not describe delay as anti-ban protection. |
| 25 accounts per VPS / fixed RAM per account | **Not source-confirmed.** Workload varies with history sync, groups, media, events, Chatwoot import, reconnects, and protocol changes. | Set shard caps only from a measured load/reconnect test and operational blast-radius target. |
| Zero Meta fees is guaranteed | **False for official Cloud API and time-sensitive.** Meta pricing changes on 01 Oct 2026. | Maintain a dated cost model from Meta's official rate card. Baileys has infrastructure/operations and number-loss risk even without Cloud API message charges. |
| License is Apache 2.0 | **Incomplete.** The repository adds conditions; GitHub cannot classify it as a standard license. | Legal approval, required admin-visible usage notice, and third-party inventory are release gates. Keep Evolution behind a service boundary; do not copy its code into Architech without review. |

Issue reports do not prove every deployment will fail, but they disprove reliability guarantees. Relevant current upstream reports include [buttons accepted but not delivered](https://github.com/evolution-foundation/evolution-api/issues/2404), [button/PIX non-delivery](https://github.com/evolution-foundation/evolution-api/issues/2467), [Baileys session removal/restriction](https://github.com/evolution-foundation/evolution-api/issues/2693), and [messages pending on the Baileys version pinned by `2.3.7`](https://github.com/evolution-foundation/evolution-api/issues/2638).

## 4. Responsibility map against the three main requirements

| Main requirement | Architech | Chatwoot | Evolution API |
|---|---|---|---|
| **CRM** | Canonical lead, encrypted consented destination, locality owner, assignment, immediate-send outbox/state, stage, consent, audit, dashboard | Human conversation after Evolution mirrors the automatic first contact; assignment mirror, notifications/mobile; device-dialer handoff when an allowed contact phone exists | Required Baileys transport for the consented lead acknowledgement plus account connection/message state; never lead/pipeline authority |
| **Brokers Channel** | Canonical sanitized demand/supply publication, matching, broker negotiation, closing, split | Optional notifications or broker-to-broker conversation if separately authorized | No matching/channel ownership; never receives end-customer data from cross-broker publications |
| **Accounting** | Canonical lightweight commission/salary/expense ledger | No role | No role; messaging fees/infrastructure may be imported later as ordinary operating expenses, not provider accounting authority |

Evolution is therefore not a fourth product pillar. It is a bounded communications adapter inside the CRM communication boundary.

## 5. Target architecture

```text
 Brokerage admin / agent
          │
          ├──────────► Architech PWA (account admin, CRM, channel, ledger)
          │                    │
          │                    ▼
          │       ┌─────────────────────────────┐
          │       │ Architech control plane     │
          │       │ org/RLS + account registry  │
          │       │ consent + outbox + commands │
          │       │ audit + tombstone + reconcile│
          │       └───────┬───────────┬─────────┘
          │               │           │
          │      optional │           │ consented lead fast path
          │      official ▼           ▼
          │       Chatwoot Meta   Integration gateway
          │       Cloud inbox          │
          │               │            ▼
          └──────────► Chatwoot ◄── Evolution API shard
                    mobile/web      (private; no Manager)
                         │
                         └── signed API-inbox callback
                              to gateway, then private forward
```

### Non-negotiable boundaries

1. Browsers, mobile apps, Chatwoot agents, n8n, Typebot, and brokerage users never receive Evolution's global API key or an instance key.
2. Evolution, PostgreSQL, Redis, metrics, manager assets, QR/pairing codes, and internal callbacks are not internet-exposed. Only the Architech gateway and required Meta/Chatwoot public endpoints are exposed.
3. Architech authorizes from its authenticated organization context and server-side registry. Neither an Evolution instance name nor a Chatwoot account/inbox ID supplied by a client establishes ownership.
4. n8n may consume purpose-minimized events later; it is not the control plane and cannot create/delete accounts or send unrestricted messages.
5. Cross-broker publications never flow to Evolution or customer Chatwoot inboxes. Their end-customer phone remains absent.

## 6. Account registry and state machine

### 6.1 Provider-neutral account record

The technical design should add an Architech-owned tenant table equivalent to:

- `id`: CUID string, compatible with current Architech identifiers;
- `organizationId`: required brokerage owner, RLS-enforced;
- `transport`: `CHATWOOT_META_CLOUD` or `EVOLUTION_BAILEYS` initially;
- `providerDeploymentId`: the exact Chatwoot/Evolution deployment or shard boundary;
- opaque `evolutionInstanceName` and returned `evolutionInstanceId`, when applicable;
- `metaBusinessAccountId` and `metaPhoneNumberId`, when applicable;
- provider-scoped `chatwootAccountId` and `chatwootInboxId`;
- label and encrypted phone/E.164 value only if operationally required, plus a display-safe last four digits;
- `desiredState`, `observedState`, last provider observation/error, and reconciliation timestamp;
- `secretRef` values pointing to a secret manager—never raw provider/global/Chatwoot/Meta tokens;
- policy/risk-acceptance version, accepting actor/time, purpose, and account-ownership attestation;
- `deletionRequestedAt`, `deletedAt`, and non-PII tombstone/audit fields.

External IDs are unique only within their provider deployment. Every foreign mapping and unique constraint must include `providerDeploymentId`; numeric Chatwoot IDs and Evolution-generated IDs cannot be treated as global.

Supporting RLS tables should include account commands, provider-event receipts, outbound dispatch/dedup records, consent snapshots, audit entries, reconciliation runs, and deletion steps. High-value platform operations use a separately audited escape path.

### 6.2 State model

```text
DRAFT
  ├─ Meta ─────► ONBOARDING ─► ACTIVE
  └─ Baileys ──► PAIRING_REQUIRED ─► CONNECTING ─► ACTIVE

ACTIVE ◄──────────────► PAUSED
  │                         │
  ├──────────────► DEGRADED/DISCONNECTED ─► CONNECTING
  │
  ├─ Baileys logout ─► LOGGED_OUT ─► PAIRING_REQUIRED
  │
  └──────────────► DELETING ─► DELETED
                         └────► DELETE_FAILED (retry/reconcile)
```

- **Pause** is local desired state. The gateway stops new automated sends and rejects Chatwoot API-inbox outgoing callbacks while preserving the provider session. It is not implemented as logout.
- **Logout** applies to the Evolution/Baileys linked-device session. It removes/revokes session credentials and requires pairing again. It does not erase retained messages, Chatwoot records, audits, or backups.
- **Delete connection** removes the Architech integration and its remote inbox/instance according to policy. For Meta it does not silently destroy a brokerage's WABA or phone-number asset; destructive Meta asset removal is a separate, step-up-confirmed operation.
- **Delete completion** requires reconciled absence/disablement in Evolution, Chatwoot, secrets, live media/object storage, and local active tables, plus a recorded backup-expiry boundary. Evolution's HTTP success is only acceptance of a remote step.

### 6.3 Commands and reconciliation

- Every mutating request creates one command with an idempotency key and expected prior state.
- A worker leases commands; browsers never call providers directly.
- Serialize lifecycle and outbound work per account. Creation, logout, delete, and send must not race.
- Record request digest, attempt count, restricted response metadata, next retry time, and terminal/dead-letter state. Do not store QR images, raw tokens, or message bodies in generic job payloads.
- Reconciliation periodically calls provider state surfaces and compares desired versus observed state. It also inventories Chatwoot inboxes and provider instances to identify orphans.
- Duplicate create becomes “adopt/reconcile existing mapping” only after ownership checks. Duplicate delete remains safe and converges on the tombstoned state.
- A successful send with a lost response is an ambiguous outcome. Do not blindly retry a non-idempotent provider send; reconcile provider/Chatwoot message IDs and surface uncertainty.

## 7. Add, connect, QR, pause, logout, and delete UX

### Add WhatsApp Account

1. Require brokerage admin permission and recent/step-up authentication.
2. Require account label, brokerage ownership attestation, communication purpose, opt-in policy acknowledgement, and transport choice.
3. Explain the transport before activation:
   - Meta Cloud: official, no QR, Meta signup/verification/window/template/pricing rules.
   - Evolution/Baileys: linked-device QR/pairing, unofficial, possible restriction/ban/protocol breakage, no official SLA.
4. Enforce tenant/account quotas server-side and audit actor, organization, IP/session, transport, and policy version.

### QR/pairing

- The worker creates an opaque Evolution instance and stores only provider mappings/secret references.
- QR/pairing data is delivered only over an authenticated, no-store response to the initiating admin. Apply short application TTL, single active ceremony, rate limits, and audit.
- Do not persist QR base64 in the Architech database, place it in URLs, send it in push/email, expose it to Chatwoot, or log it.
- Verify observed account identity after pairing before changing to `ACTIVE`; a successful scan alone is not final proof.

### Pause/logout/delete

- Pause must take effect at the outbound gateway before the UI reports success.
- Logout and delete require explicit consequence text and step-up confirmation.
- Delete immediately revokes normal access and creates a tombstone before remote calls begin.
- Deactivate/remove the Chatwoot inbox and agent access as part of the workflow. Stable Evolution deletion removes its local Chatwoot configuration but source review found no corresponding Chatwoot inbox deletion.
- Maintain a visible partial-failure state with retry/operator escalation; never hide orphaned Evolution instances or Chatwoot inboxes.

## 8. Event, API, and queue security

### 8.1 Evolution control API

- Allow only the Architech worker/gateway service identity over a private network; prefer mTLS/service-mesh identity in addition to the API key.
- Keep the global key in the secret manager, rotate it, and use it only for control operations. Use opaque per-instance keys for Baileys and never expose them to brokerage users.
- Set `AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=false`, but do not depend on that variable as a redaction control: at `2.3.7`, source inspection found `fetchInstances` returning Prisma instance records including token.
- Gateway responses use an allowlist. Strip `hash`, `token`, `apikey`, webhook headers, Chatwoot tokens, proxy credentials, and raw provider responses.
- Disable Manager, docs if not operationally needed, telemetry, broad CORS, full debug/webhook logs, global websocket events, and unused integrations.

### 8.2 Evolution events to Architech

- Configure per-instance webhooks to a private tenant-neutral gateway and use a unique `jwt_key` secret per deployment or account risk boundary.
- Verify JWT signature, algorithm, `exp`, expected claims, and destination service; require TLS/mTLS. The JWT is not body-bound, so deduplicate and re-fetch state for high-impact events.
- Validate a strict event schema and size/content limits. Resolve `instance` through the registry and ensure it maps to exactly one active organization.
- Deduplicate with a provider message/status identity plus event type; use a digest fallback for lifecycle events. Evolution does not provide a Chatwoot-style delivery ID for all events.
- Do not trust the instance path/name alone and do not persist the included `apikey` field. Redact phone/message/media values from operational logs.
- Return quickly after durable receipt; process in an account-partitioned queue that tolerates retries and reordering.

### 8.3 Chatwoot API inbox to Evolution

At Chatwoot `v4.17.1` commit `b354a9550e1fb59fa537a9c384232cb076213e72`, API-inbox callbacks use the same trigger that emits `X-Chatwoot-Timestamp`, HMAC-SHA256 `X-Chatwoot-Signature` over `{timestamp}.{raw_body}`, and `X-Chatwoot-Delivery` when the channel secret is present. Evolution `2.3.7` receives its native Chatwoot callback without a guard or signature check.

Therefore:

1. Provision the Chatwoot API inbox manually with its callback URL pointing to Architech, not directly to Evolution.
2. Preserve raw request bytes, verify the Chatwoot HMAC in constant time, enforce a short skew window, and deduplicate `X-Chatwoot-Delivery`.
3. Resolve Chatwoot deployment/account/inbox and Evolution instance through the server registry; validate outgoing/non-private event type, contact mapping, active consent, messaging policy/window, account desired state, and quotas.
4. Forward an allowlisted body over the private network to Evolution's callback endpoint. Evolution's endpoint must not be publicly routable.
5. Treat Chatwoot's callback result as dispatch intent, not CRM stage authority. Record the returned WhatsApp message key/status mapping where available.

Use a dedicated least-privilege Chatwoot service identity per account/deployment where possible. Evolution stores its Chatwoot integration token in its own database, so database/storage encryption and strict access remain required.

## 9. Chatwoot/mobile behavior

### 9.1 What the native Evolution integration gives us

The integration is real and useful. Evolution's official documentation supports configuring Chatwoot either during `/instance/create` or later with `/chatwoot/set/{instance}`. Stable `2.3.7` source can find/create a Chatwoot API inbox, create contacts and conversations, mirror incoming WhatsApp text/media, send Chatwoot agent text/media replies through Baileys, add an agent signature, and control pending/reopen behavior. Optional contact and message-history imports also exist.

Architech should use that **live conversation data plane**, rather than rebuilding an inbox:

| Native capability | Project advantage | Boundary retained by Architech |
|---|---|---|
| WhatsApp → Chatwoot contact/conversation mirroring | Agents receive linked-device WhatsApp conversations in the same Chatwoot web/mobile UI as supported channels | Consent, contact projection, organization/account mapping, and retention remain canonical in Architech |
| Chatwoot API-inbox outgoing callback → Evolution | Agents can reply with text/media from Chatwoot without receiving Evolution credentials | The callback first passes through Architech's HMAC, tenant, pause, suppression, policy, quota, and audit gate |
| One named API inbox per Evolution instance | Multiple brokerage-owned WhatsApp accounts can appear as separate inboxes with independent assignments | Architech creates and records the exact brokerage/account/inbox/instance mapping; inbox names never authorize access |
| Chatwoot assignment, teams, labels, macros, notifications, and native mobile apps | Reuses mature human-support workflows instead of building a second conversation client | Assignment can mirror the CRM owner, but Chatwoot status/labels do not become CRM or deal authority |
| Agent signature and conversation pending/reopen options | Makes a shared brokerage number usable by a team and supports a chosen triage model | Per-broker settings are explicit, audited configuration—not uncontrolled agent/provider state |
| Optional contact/history import | Can assist a separately approved migration | Disabled initially because it broadens PII, storage, and erasure scope and, in `2.3.7`, history import can require direct Chatwoot database access |

The intended live paths are:

```text
Immediate first contact
customer submits lead + WhatsApp consent
  ─► Architech commits lead + encrypted destination + outbox event
  ─► high-priority worker ─► private Evolution sendText ─► broker's linked WhatsApp
                                      └───────────────► mirror into Chatwoot

Customer response
WhatsApp ─► Evolution/Baileys ─► Chatwoot API inbox ─► assigned broker/agent
                    └──────────► selected Evolution events ─► Architech gateway/audit

Later human reply
Chatwoot outgoing message ─► signed API-inbox callback ─► Architech gateway
    ─► private Evolution callback ─► Baileys ─► WhatsApp
```

This gives brokers one conversation workspace while allowing the lead-created acknowledgement to take the shortest controlled path. It also permits official Meta inboxes as a separate supported option, but this project's requested automatic lead follow-up originates from the brokerage's risk-accepted Evolution/Baileys linked number. The transport remains visible on every account/inbox; the system must not imply that a Baileys inbox is an official Meta channel.

### 9.2 Lead-triggered immediate brokerage message

The trigger is **successful lead creation in Architech**, not an agent first opening Chatwoot. The customer experience should be: submit an enquiry, then promptly receive a relevant acknowledgement from the listing brokerage's own connected WhatsApp number. A reply should open/continue the matching Chatwoot conversation for the assigned broker employee.

Required dispatch sequence:

1. The lead form identifies the brokerage and displays an unbundled, unambiguous WhatsApp consent such as: “I agree to receive WhatsApp messages from {brokerage} about this enquiry.” Store the exact text/version, brokerage identity, purpose, source, timestamp, and withdrawal state. Do not preselect it or reuse generic terms consent.
2. In one Architech database transaction, create the lead, encrypted WhatsApp destination/contact point, audit entry, assignment, and a high-priority `lead.whatsapp_ack.requested` outbox row. Never call Evolution before this commit.
3. Select an eligible `ACTIVE` Evolution account owned by the same brokerage, using explicit locality/employee/default-account rules. Never fall across organizations. A configured same-broker backup account is allowed; silent fallback to a different transport or brokerage is not.
4. The hot worker immediately rechecks consent, suppression/`STOP`, lead deletion, account desired/observed state, quota, and template version. It decrypts the destination only in worker memory and calls Evolution's private `/message/sendText/{instance}` endpoint with no artificial typing delay.
5. Store the returned provider message key as `PROVIDER_ACCEPTED`; consume `SEND_MESSAGE`/message-update events for later `DELIVERED`, `READ`, `FAILED`, or `UNKNOWN` evidence when available. HTTP success is not customer delivery.
6. Stable Evolution source mirrors API-sent messages into its configured Chatwoot inbox. Verify the resulting contact/conversation/message mapping and attach the opaque Architech lead ID. Evolution performs that mirror asynchronously, so reconcile a missing Chatwoot copy rather than treating provider acceptance as proof that the inbox is complete.
7. Route the Chatwoot conversation to the canonical locality owner or cold caller. The customer's reply arrives through Evolution in that inbox; subsequent human replies use Chatwoot and the signed Architech callback gateway.

Speed is an engineering SLO, not a delivery guarantee:

- target P95 lead-commit → worker-start at **≤ 250 ms** under normal load;
- target P95 lead-commit → Evolution provider acceptance at **≤ 1 second**, subject to benchmark evidence;
- measure customer-device delivery separately because WhatsApp/network/device conditions are external;
- show dispatch/delivery state in Architech instead of claiming that every customer receives the message within one second.

One lead creates at most one automatic acknowledgement per consent purpose/template version. Use a unique idempotency key such as `(organizationId, leadId, accountId, purpose, templateVersion)`. A timeout after an ambiguous provider send must be reconciled, not blindly retried and duplicated.

A suitable initial message is transactional and specific, for example:

```text
Hi {firstName}, this is {brokerageName}. We received your enquiry for {listingTitle}.
{agentFirstName} will help you shortly. Reply here with your preferred visit time, or STOP to opt out.
```

Do not put full customer data, hidden channel information, commission data, or unverified availability/price claims in the message. Do not use this path for bulk marketing.

**Current-schema prerequisite:** the existing Prisma `Lead` stores only `phoneMasked`; it has no encrypted destination that a post-commit worker can use. The current default lead idempotency key also concatenates the submitted phone and message. Before this flow is implemented, add an encrypted, purpose-scoped lead contact point (ciphertext, key version, keyed lookup digest, last four, consent reference, retention) and replace raw-value idempotency material with an opaque client key or server HMAC. This preserves a durable send without exposing the number in ordinary lead rows, logs, URLs, or job payloads.

Direct WhatsApp necessarily discloses the customer's WhatsApp identity to the selected brokerage and to Chatwoot once the conversation is mirrored. Therefore a masked-only lead without this specific disclosure/contact consent is not eligible for automatic WhatsApp follow-up.

### 9.3 Safe provisioning profile

Do not use the upstream quick-start literally. In stable `2.3.7`, `autoCreate=true` creates or finds an inbox by name and sets its callback directly to Evolution's unauthenticated `/chatwoot/webhook/{instanceName}` route. It can also create a bot contact/conversation whose commands include connect, status, cache clear, and disconnect. That bypasses Architech's lifecycle authority. Initial history import can write directly to Chatwoot's PostgreSQL database and materially expands data access.

Use this sequence instead:

1. Architech creates the tombstone-capable WhatsApp account record and an opaque Evolution instance name.
2. The account worker creates the Evolution/Baileys instance on the private network without exposing QR, keys, or raw provider responses.
3. Architech provisions a uniquely named Chatwoot API inbox in the correct brokerage's Chatwoot account. Its callback URL points to the Architech gateway; its generated callback secret is stored in the secret manager.
4. Architech configures Evolution using `/chatwoot/set/{instance}` with `autoCreate=false`, the exact pre-created inbox name, Chatwoot URL/account ID, and a dedicated integration-user token scoped to that Chatwoot account. The raw set/find response is never returned to a browser because it can contain the Chatwoot token.
5. Evolution discovers the inbox by its exact name for live contact/conversation APIs. Architech verifies the resulting inbox ID, records the deployment-scoped mapping, and rejects duplicate/ambiguous names.
6. Only after QR/pairing identity verification and end-to-end test messages pass may the account become `ACTIVE`.

Initial configuration posture:

| Setting/capability | Initial decision |
|---|---|
| `autoCreate` | `false`; Architech provisions and maps the API inbox |
| Evolution `CHATWOOT_BOT_CONTACT` | `false`; no lifecycle commands through a Chatwoot bot conversation |
| `importContacts` / `importMessages` | `false`; no broad historical synchronization or direct Chatwoot-DB import |
| `daysLimitImportMessages` | Not used while import is disabled; any migration is a separate approved one-off job |
| `mergeBrazilContacts` | `false` for this India-focused deployment |
| `signMsg` | Enable if the brokerage wants the customer to see which agent replied; test the exact formatting |
| `reopenConversation` | Start `false` so a resolved conversation can form a new support episode; validate against broker workflow |
| `conversationPending` | Per-broker triage setting; it does not control Architech lead stage |
| Chatwoot token | Dedicated account-scoped integration identity, secret-managed and rotated; never a Platform API token in the data plane |
| Media | Live text/media only after type, size, URL/egress, malware, retention, and erasure controls pass |

### 9.4 Agent/mobile boundary

- Evolution's bridge is the path to the existing Chatwoot web and mobile agent UX; Architech should not build a duplicate chat composer, assignment queue, or conversation push client.
- Chatwoot mobile conversation actions do not administer Evolution accounts. Add/pair/pause/logout/delete remain in Architech PWA.
- Source-checked Chatwoot Mobile contact calling hands a `tel:` URL to the device's system dialer. It is not managed VoIP or call recording.
- A phone may be projected to Chatwoot only for a direct-consented lead or a customer who is communicating through the brokerage's WhatsApp account for the recorded purpose. Masked leads and all cross-broker publications remain phone-free and therefore cannot expose direct calling.
- No call recording is included. Any future managed voice/recording feature requires a separate provider, consent/notice, retention, access, and jurisdictional review. Evolution call events are not evidence of a compliant recording system.
- Chatwoot labels/assignment may mirror Architech. They do not mutate canonical lead ownership or stage without an explicit verified Architech transition.

## 10. Text menus, lists/buttons, and genuine Flows

### Required baseline: text state machine

Every interaction must work as numbered text, for example:

```text
Choose property type:
1. Apartment
2. Villa
3. Plot
Reply with a number, or STOP to opt out.
```

Store an opaque, tenant/account/contact-scoped interaction ID, current step, allowed choices, expiry, and consent purpose. Normalize replies deterministically, reject stale/ambiguous values, rate-limit, and provide a human fallback. Never place customer contact information into button/list IDs.

For multi-select (“checkbox-like”) input, collect a delimited reply or one choice per step and echo a confirmation summary. This works across transports and is the fallback when an interactive message is unsupported or undelivered.

### Lists and buttons

- Evolution `2.3.7` has `/message/sendList/:instanceName` and `/message/sendButtons/:instanceName` and implements them for Baileys and Meta.
- In the Baileys mode these are unofficial protocol operations. HTTP `201` means the adapter accepted the request, not that WhatsApp delivered/rendered it.
- Interactive messages are generated by Architech automation/templates; the normal Chatwoot agent composer remains text/media oriented.
- Require capability flags per transport/release, delivery timeout/status handling, device/version test matrix, and automatic text fallback. Do not use list/button-only input for a consequential consent, financial, or deal-closing action.

### Genuine WhatsApp Flows (optional, outside hosting-only baseline)

- Do not configure, publish, or send a Meta Flow in the required baseline. Genuine Flows create an official Meta runtime/billing dependency and need a separate cost/policy approval.
- If separately approved later, build/publish Flow JSON and send Flow messages only through official Meta interfaces.
- Use unpredictable flow tokens scoped to organization/account/contact/purpose/expiry. Implement Meta's encrypted data-exchange endpoint and verify the applicable signatures and replay rules for the selected Flow/Data API version.
- Chatwoot `v4.17.1` source recognizes incoming `interactive.nfm_reply` and stores parsed data in `content_attributes.whatsapp_flow_response`, but a release/device spike must prove the complete send → submit → Chatwoot webhook → Architech ingestion path.
- Evolution `2.3.7` is not the Flow authority. Re-evaluate a future stable release only against exact source and an end-to-end test.
- Flow responses can contain sensitive preference/contact data. Apply schema allowlists, purpose limitation, encryption, short raw-payload retention, and erasure propagation.

## 11. Deployment baseline for the Evolution pilot

No production image is approved merely by this assessment. A synthetic pilot may use the inspected stable source/image under these controls:

1. Pin source `cd800f2976e1e5b682fbf86a01ee4d85ae61f370` and `evoapicloud/evolution-api:v2.3.7` by the correct architecture digest; mirror it to an owned registry after provenance, SBOM, malware/vulnerability, and signature review.
2. Pin PostgreSQL and Redis exact patch images by digest. Use a separate Evolution database/schema and Redis namespace/instance; do not share Architech's schema or credentials.
3. Omit the separate `evolution-manager` container and set `SERVER_DISABLE_MANAGER=true`. Do not expose port 8080 publicly.
4. Set at minimum: telemetry off, Manager off, restricted CORS, strong generated global key, instance exposure off, minimal redacted logs, encrypted backups, and explicit database save/retention choices. The upstream `.env.example` enables telemetry and message/contact/chat/history storage and uses broad examples; do not copy it unchanged.
5. Use Redis in the supported pilot topology, health checks, resource requests/limits, restart policy, PodDisruption/backup controls, and per-shard observability. Redis availability does not create per-account process isolation.
6. Disable all unneeded RabbitMQ/SQS/Kafka/NATS/Pusher/websocket/chatbot/AI/Typebot/n8n integrations. Add them only with a separate threat/data-flow review.
7. Egress-allowlist the required WhatsApp/Chatwoot/secret/monitoring destinations where operationally feasible. Prevent instance SSRF surfaces from reaching metadata/control networks.
8. Encrypt disks/backups and strictly restrict Evolution DB access: `v2.3.7` stores session, instance, contact/message, webhook, proxy, and Chatwoot integration data in its own stores depending on configuration.
9. Do not use upstream `latest` tags. Do not use `atendai/evolution-api:v2.0.0`; it is not the current canonical repository/image identity.

### Capacity and failure-domain test

Determine accounts per shard from a synthetic test, not a fixed RAM claim. Measure:

- idle and active RSS/CPU/event-loop delay per account;
- Redis/PG operations, connection counts, and storage growth;
- message text/media throughput and status latency;
- QR/reconnect storms, process restart, Redis loss, PG failover, and WhatsApp protocol disconnects;
- Chatwoot callback retry bursts and Evolution webhook retries;
- full-history/contact/group behavior with those features disabled and, if needed, enabled;
- one malformed/large event and one account logout/delete while other accounts send.

Set a shard cap from SLO, headroom, restart time, and accepted multi-account blast radius. A hard-isolation tenant receives a separate Evolution deployment, database, Redis, object storage, keys, logs, and backups.

## 12. Consent, policy, retention, and erasure

- Only brokerage-owned numbers may be connected. Do not link employees' personal WhatsApp accounts or accounts the brokerage cannot prove it controls.
- Meta requires opt-in before business messaging; store business identity, purpose/category, source, text/version, actor, capture time, and withdrawal evidence. Apply the same standard to Baileys even though the unofficial transport does not enforce Cloud API windows/templates.
- Honor `STOP`/withdrawal immediately at the Architech outbound gate and propagate suppression to Chatwoot/automation. Maintain a tenant-scoped do-not-contact record containing only the minimum identifier needed for enforcement.
- Default Evolution source configuration stores messages, updates, contacts, chats, labels, history, and number checks. Choose the minimum needed fields and retention; do not accept those defaults silently.
- Media is untrusted input. Scan, type/size limit, encrypt, segregate by tenant/account, use short-lived URLs, and delete all copies/derivatives.
- Deletion order: tombstone and pause → revoke UI/worker access → disable Chatwoot inbox → logout/delete Evolution instance → delete Chatwoot contact/conversation/media as policy requires → revoke secrets/sessions → verify live-store absence → record backup expiry. Reconciliation retries every incomplete step.
- Restores replay erasure tombstones and current desired account state before either Evolution or Chatwoot becomes available, preventing deleted sessions/messages from being resurrected.
- Baileys session credentials are equivalent to a linked device and extremely sensitive. A leak can expose account communications. QR, pairing code, session state, API keys, and tokens must never enter analytics, error reports, normal logs, URLs, or support screenshots.

## 13. Cost and policy posture

### Hosting-only commercial baseline

The baseline acceptance criterion is **no mandatory per-message, per-conversation, per-agent, SaaS, Cloud-API, or commercial-license payment beyond infrastructure hosting and the brokerage's existing phone/SIM/data service**. This can be the design target; it cannot honestly mean that operating the service has no cost or that upstream terms will never change.

Required baseline:

- self-host Architech, PostgreSQL, Redis, object/media storage, queues, monitoring, logs, and backups;
- self-host **Chatwoot Community Edition only**; do not enable Chatwoot Cloud, Premium/Enterprise code, Captain AI, paid support, paid voice, or another metered add-on. Chatwoot's official documentation describes the self-hosted Community Edition as free under MIT, with hosting, maintenance, and troubleshooting owned by the operator;
- self-host the pinned Evolution `2.3.7` service/image; do not use Evolution Cloud or another paid Evolution provider. The inspected `2.3.7` license does not state a seat/message charge for compliant use, but legal approval and the required administrator-visible Evolution usage notice remain release gates. Manager/frontend components remain disabled, so no branding is removed;
- use `EVOLUTION_BAILEYS` for this requested workflow and do not configure Meta billing credentials. `CHATWOOT_META_CLOUD` is an optional separately accepted transport and must never be an automatic fallback;
- use the broker's already-owned WhatsApp number/SIM. Number acquisition, SIM/data service, replacement after restriction/ban, and staff operations are not software subscription fees and must be disclosed rather than hidden;
- disable paid AI APIs, SMS/voice providers, commercial email services, Chatwoot premium features, managed n8n, paid telemetry/error SaaS, and any marketplace add-on in the baseline. Add one only through an explicit cost-changing decision;
- use free TLS automation such as Let's Encrypt and self-hosted observability where practical. Domain registration, compute, storage, egress, backup capacity, and operations remain hosting/operating costs;
- use the upstream Chatwoot mobile application only while it and its Community push-relay path remain available without a fee and the privacy gate passes. A branded custom native app can introduce Apple/Google developer-account and maintenance costs, so it is outside the hosting-only baseline.

Before every production release and quarterly thereafter, maintain a dependency/billing inventory proving that no required runtime path asks for a paid license, payment method, metered API key, or vendor subscription. Configuration must contain no Meta billing fallback. A future upstream pricing/license change triggers re-evaluation or version replacement—it cannot silently create a customer bill.

### Evolution/Baileys

- There is no Meta Cloud API message line item on this path, and the pinned self-hosted baseline has no source-stated per-message or per-agent charge when the Evolution license conditions are met.
- “Hosting-only” still includes Evolution compute, PG/Redis, storage/egress, backups, monitoring, operations, reconnect incidents, protocol upgrades, and possible number replacement/business interruption.
- WhatsApp's own guidance warns against unwanted automated/bulk messaging and unauthorized/unsupported apps and states that accounts can be restricted or banned. Consent and low volume reduce abuse risk; they do not make an unofficial client supported.
- The brokerage must accept that linked numbers may be logged out, restricted, or permanently banned and that a protocol change may stop delivery without notice or SLA.

### Optional official Meta Cloud

- This transport is outside the hosting-only baseline because Meta may charge by delivered message category, recipient market, current date, and volume tier.
- On 02 Sep 2026, non-template service messages are still temporarily free, but Meta's official notice says per-message service charging and charging for utility messages inside the customer-service window start 01 Oct 2026.
- A payment method must be in place by 30 Sep 2026 or service-message delivery may stop when charging starts.
- A brokerage can enable this path only after a separate explicit cost/policy acceptance. Do not hard-code a rupee rate or switch to it automatically.

## 14. Implementation and activation gates

### Required implementation scope

- provider-neutral WhatsApp account registry with RLS;
- encrypted purpose-scoped lead destination plus safe keyed deduplication—current `Lead.phoneMasked` alone cannot support post-commit dispatch;
- transactional lead-created fast outbox, deterministic same-broker account selection, one-message idempotency, delivery-state tracking, and near-immediate Evolution send;
- brokerage account list and add/connect/pause/logout/delete UX;
- Evolution adapter worker and private gateway;
- provider-scoped IDs, secret references, commands, event receipts, deduplication, audit, and reconciliation;
- Chatwoot API-inbox bridge with HMAC-verifying gateway;
- text interaction engine plus capability-gated button/list enhancement and fallback;
- deletion/erasure steps and restore tombstone replay;
- a disabled provider interface/design for a possible future official Meta Flow adapter; no Meta credentials, live Flow spike, billing dependency, or genuine-Flow promise is part of the hosting-only baseline.

### Evolution/Baileys production activation gate

All must pass before a real brokerage number can be enabled:

1. Business owner and legal/security accept the named unofficial-client, ban/restriction, privacy, and custom-license risks.
2. Exact image/source, SBOM/vulnerability review, private topology, backup/restore, telemetry/log controls, and secret rotation are approved.
3. The release billing inventory proves no mandatory paid license/SaaS/API path: Chatwoot Community Edition and pinned self-hosted Evolution only; no Meta payment method, Cloud fallback, premium feature, paid AI/voice/SMS/email/error service, or custom-app store-account dependency.
4. Two synthetic organizations pass cross-tenant gateway/RLS tests; direct Evolution/Manager access is impossible.
5. Account add/pair/pause/logout/delete/re-pair/reconcile and orphan cleanup pass under retries and concurrent commands.
6. Chatwoot callback HMAC, delivery deduplication, wrong-account rejection, paused-account rejection, and malicious payload tests pass.
7. A synthetic lead commit proves encrypted destination handling, single-send idempotency, deterministic same-broker account selection, API-send mirroring into the correct Chatwoot inbox, reply assignment, and visible failure states. The measured fast-path SLO is accepted without presenting provider acceptance as customer delivery.
8. Text works across target devices; list/buttons demonstrably fall back when not delivered. No Flow claim is made for Baileys.
9. Reconnect storm, provider restart, Redis/PG interruption, media limits, and shard blast-radius tests meet defined SLOs.
10. Consent/STOP, phone masking, cross-broker exclusion, retention, erasure, and restore-replay drills pass.
11. A canary using a non-critical brokerage-owned test number runs for an approved observation period before any business-critical number.

Failure keeps the feature implemented but disabled. It does not justify silently switching transports.

## 15. Primary sources

### Evolution

- [Stable `2.3.7` release](https://github.com/evolution-foundation/evolution-api/releases/tag/2.3.7)
- [`2.3.7` package and dependencies](https://github.com/evolution-foundation/evolution-api/blob/cd800f2976e1e5b682fbf86a01ee4d85ae61f370/package.json)
- [Custom license](https://github.com/evolution-foundation/evolution-api/blob/cd800f2976e1e5b682fbf86a01ee4d85ae61f370/LICENSE)
- [Upstream Compose example](https://github.com/evolution-foundation/evolution-api/blob/cd800f2976e1e5b682fbf86a01ee4d85ae61f370/docker-compose.yaml)
- [Dockerfile](https://github.com/evolution-foundation/evolution-api/blob/cd800f2976e1e5b682fbf86a01ee4d85ae61f370/Dockerfile)
- [Instance routes](https://github.com/evolution-foundation/evolution-api/blob/cd800f2976e1e5b682fbf86a01ee4d85ae61f370/src/api/routes/instance.router.ts) and [lifecycle controller](https://github.com/evolution-foundation/evolution-api/blob/cd800f2976e1e5b682fbf86a01ee4d85ae61f370/src/api/controllers/instance.controller.ts)
- [Shared in-process instance monitor and cleanup](https://github.com/evolution-foundation/evolution-api/blob/cd800f2976e1e5b682fbf86a01ee4d85ae61f370/src/api/services/monitor.service.ts)
- [API-key guard](https://github.com/evolution-foundation/evolution-api/blob/cd800f2976e1e5b682fbf86a01ee4d85ae61f370/src/api/guards/auth.guard.ts)
- [Webhook delivery/JWT/payload behavior](https://github.com/evolution-foundation/evolution-api/blob/cd800f2976e1e5b682fbf86a01ee4d85ae61f370/src/api/integrations/event/webhook/webhook.controller.ts)
- [Chatwoot callback route](https://github.com/evolution-foundation/evolution-api/blob/cd800f2976e1e5b682fbf86a01ee4d85ae61f370/src/api/integrations/chatbot/chatwoot/routes/chatwoot.router.ts) and [bridge service](https://github.com/evolution-foundation/evolution-api/blob/cd800f2976e1e5b682fbf86a01ee4d85ae61f370/src/api/integrations/chatbot/chatwoot/services/chatwoot.service.ts)
- [Baileys button/list implementation](https://github.com/evolution-foundation/evolution-api/blob/cd800f2976e1e5b682fbf86a01ee4d85ae61f370/src/api/integrations/channel/whatsapp/whatsapp.baileys.service.ts)
- [Meta provider implementation](https://github.com/evolution-foundation/evolution-api/blob/cd800f2976e1e5b682fbf86a01ee4d85ae61f370/src/api/integrations/channel/meta/whatsapp.business.service.ts)
- [Current Evolution provider overview](https://docs.evolutionfoundation.com.br/en/evolution-api), [webhooks](https://docs.evolutionfoundation.com.br/en/evolution-api/configuration/webhooks), [Chatwoot](https://docs.evolutionfoundation.com.br/en/evolution-api/integrations/chatwoot), and [Cloud API](https://docs.evolutionfoundation.com.br/en/evolution-api/integrations/cloudapi)
- [Docker Hub image tags](https://hub.docker.com/r/evoapicloud/evolution-api/tags)

### Chatwoot and Meta

- Chatwoot `v4.17.1` [`WebhookListener`](https://github.com/chatwoot/chatwoot/blob/b354a9550e1fb59fa537a9c384232cb076213e72/app/listeners/webhook_listener.rb), [`Webhooks::Trigger`](https://github.com/chatwoot/chatwoot/blob/b354a9550e1fb59fa537a9c384232cb076213e72/lib/webhooks/trigger.rb), and [`Channel::Api`](https://github.com/chatwoot/chatwoot/blob/b354a9550e1fb59fa537a9c384232cb076213e72/app/models/channel/api.rb)
- Chatwoot `v4.17.1` [incoming WhatsApp Flow response handling](https://github.com/chatwoot/chatwoot/blob/b354a9550e1fb59fa537a9c384232cb076213e72/app/services/whatsapp/incoming_message_base_service.rb)
- [Chatwoot self-hosted Community versus Premium](https://www.chatwoot.com/hc/user-guide/articles/1750735898-purchasing-a-paid-self_hosted-chatwoot-license-a-step_by_step-guide) — official documentation states Community Edition is free under MIT and operator-maintained
- [Chatwoot WhatsApp Embedded Signup](https://developers.chatwoot.com/self-hosted/configuration/features/integrations/whatsapp-embedded-signup)
- [Meta pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) and [01 Oct 2026 service-message update](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages)
- [Meta opt-in requirements](https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in)
- [Meta WhatsApp Flows](https://developers.facebook.com/documentation/business-messaging/whatsapp/flows) and [Flow endpoint guidance](https://developers.facebook.com/documentation/business-messaging/whatsapp/flows/guides/implementingyourflowendpoint)
- [WhatsApp responsible-use guidance](https://faq.whatsapp.com/361005896189245/) and [unsupported-app warning](https://faq.whatsapp.com/520312452657376/)
