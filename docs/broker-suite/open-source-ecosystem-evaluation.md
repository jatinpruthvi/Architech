# Broker Suite — Open-source ecosystem evaluation

**Date:** 02 Sep 2026
**Status:** Historical ecosystem evidence; recommendation superseded by canonical v8
**Scope:** Source-level review of projects considered before Chatwoot removal and the Frappe CRM mobile decision.

> **v8 amendment (02 Sep 2026):** The selected composition is now Frappe CRM + ERPNext + direct company-owned WhatsApp/Evolution + mobile SIM calling; Chatwoot is removed. Selection statements below are retained only as evaluation history. Follow [`decision.md`](./decision.md) and [`../business-suite/modular-platform-selection.md`](../business-suite/modular-platform-selection.md).
>
> This is an architecture and adoption assessment, not a penetration test or legal opinion. Repository source, tests, CI definitions, releases, issue history, and security advisories were inspected. External projects' full test suites were not executed in this checkout.

## 1. Decision

**No newly discovered repository, or combination of repositories, is better enough to replace the Architech + Chatwoot direction.**

The recommended product boundary is:

1. **Architech remains canonical** for brokerage identity, memberships, locality ownership, listings, leads, requirements, cross-broker publication and matching, customer consent, masking, retention, deals, and commission splits.
2. **Chatwoot is a bounded communications subsystem** for agent inboxes, supported customer channels, assignment, conversation webhooks, native mobile applications, and push notifications.
3. **Evolution API is to be implemented as the bounded, private, feature-flagged Baileys adapter for the requested immediate lead follow-up from brokerage-owned linked numbers**, as well as multi-account QR/pair/logout/delete. A consented lead commit drives a durable near-immediate Evolution send; Evolution mirrors the resulting conversation into Chatwoot. It does not replace Chatwoot or Architech, and real-number activation requires explicit unofficial-transport risk acceptance and pilot gates.
4. **Official Meta Cloud remains available in Chatwoot as an explicit supported alternative and genuine-Flow route, not the requested transport for that brokerage-number workflow.** Evolution `v2.3.7` Meta mode is not approved because it conflates the Meta bearer token with its instance API credential and exposes credentials through provider surfaces/webhook bodies.
5. **The official Chatwoot mobile app is used first, subject to an explicit push-relay privacy gate.** It already supports a self-hosted URL and community-edition push. A custom build is justified only by a strict no-Chatwoot-relay requirement, or later branding/embedded-workflow needs.
6. **The Architech broker UI remains the mobile-responsive/PWA surface** for pipeline, locality, WhatsApp account lifecycle, channel, deal, and simple-ledger work. Chatwoot mobile is the conversation surface, not the Broker Suite system of record.
7. **ERPNext + Frappe HR + India Compliance remains a later finance boundary** when statutory accounting or payroll becomes real scope. It should not own the privacy-preserving broker channel.
8. **Twenty is deferred.** It adds another generic CRM store without solving native mobile, omnichannel communication, the cross-broker privacy model, or India finance.
9. **The mandatory deployment is hosting-only in commercial terms:** self-hosted Chatwoot Community + pinned self-hosted Evolution/Baileys, with no Meta billing, paid Cloud/Premium/Enterprise, paid AI/voice/SMS/email/monitoring, or other required metered add-on. Hosting, the broker's existing SIM/data, maintenance, and number-loss interruption remain real costs.

This is the least risky composition, not a claim that the current code is already production-complete. Architech still needs hard tenant enforcement and durable privacy orchestration, and a shared Chatwoot deployment provides account-level application isolation rather than PostgreSQL RLS.

## 2. Mandatory gates

A candidate was not accepted merely because it advertised “multi-tenant,” “mobile,” “real-estate,” or “WhatsApp.” It had to survive these gates:

| Gate | Required evidence |
|---|---|
| **Tenant isolation** | Independent brokerages cannot read or mutate each other's private data. Prefer database RLS tested under a non-superuser/non-bypass role, or a separate database/deployment per tenant. An application `tenant_id` filter alone is not a hard boundary. |
| **Field operation** | A maintained native agent app, or a credible mobile-first PWA with background notifications and tested small-screen workflows. “Responsive CSS” alone is insufficient. |
| **Broker workflow** | Lead pipeline, assignment, locality ownership, optional cold-caller handoff, property demand/supply, matching, deals, and negotiated commission splits. |
| **Cross-broker privacy** | A deliberate way to publish sanitized demand/supply across tenants without exposing customer contact data, while retaining ownership and auditability. |
| **Privacy lifecycle** | Consent provenance, purpose limitation, masking, retention, audit, export/erasure, attachment cleanup, and retryable propagation into external stores. |
| **Integration** | Stable APIs/webhooks, authenticated inbound events, idempotency, extension points, and a supportable deployment model. |
| **Finance path** | At minimum, simple commission income, salary/expense records, and a credible later path to Indian accounting/payroll. |
| **Production confidence** | License compatibility, security posture, release maturity, maintainer depth, CI, migration safety, backups, and reasonable operational complexity. |

No inspected project passes every gate. The recommendation therefore minimizes duplicated authority and assigns each subsystem only work it demonstrably performs well.

## 3. Comparison

Legend: **Pass** = implemented with credible evidence; **Partial** = useful but requires material work or a different deployment profile; **Fail** = mandatory capability is absent or contradicted by the implementation.

| Candidate | Hard tenant boundary | Mobile / push | CRM + communications | Cross-broker privacy | Finance path | Verdict |
|---|---|---|---|---|---|---|
| **Architech + Chatwoot + gated Evolution adapter** | **Partial today:** Architech needs RLS; strict Chatwoot/Evolution isolation requires separate per-broker data planes | **Pass** for conversations; Architech PWA for broker/account work | **Pass as a composition** after Architech workflow build-out; Evolution only transports risk-accepted Baileys messages | **Pass by design in Architech**, not Chatwoot/Evolution | **Partial:** simple Architech ledger; Frappe later | **Adopt this boundary; gate Evolution activation** |
| **Evolution API alone** | **Fail for independent brokerages:** instances have keys but no Architech organization/RLS boundary; many instances share one Node process/store | **Fail as agent product:** Manager is an operator console, not the maintained conversation/mobile workflow | **Partial communications transport/bridge; no broker CRM authority** | **Fail** | **Fail** | **Required bounded adapter only; never standalone/canonical** |
| **DeskcommCRM** | **Partial/strong:** real Supabase RLS and CI invariants, but many service-role routes bypass RLS | **Partial:** responsive web + Web Push; no native app or offline app data | **Pass for WhatsApp + generic pipeline** | **Fail:** no broker network/locality/property-matching model | **Fail** | **Best new challenger; pilot/watch, do not replace Chatwoot yet** |
| **BottleCRM** | **Pass:** PostgreSQL `FORCE RLS`, app role, context-reset and non-superuser CI | **Partial:** Flutter app, but no implemented push and no durable offline database | **Partial:** broad CRM/support; no WhatsApp inbox | **Fail** | **Partial:** invoices, not commissions/payroll/India compliance | **Borrow isolation/test patterns** |
| **Frappe CRM + WhatsApp + ERPNext/HR** | **Partial:** one site per brokerage can isolate; shared-site permissions are application-level | **Partial:** installable CRM PWA; deprecated old Flutter path | **Partial/strong:** CRM and finance are broad; inbox/mobile weaker than Chatwoot | **Fail without a custom Architech-like channel** | **Pass:** strongest India-oriented path | **Finance-first alternative, not current core** |
| **Open Mercato** | **Partial:** tenant/org-aware application scoping; no PostgreSQL RLS found | **Fail:** no native agent app or verified push/mobile product | **Partial:** modular CRM/sales framework; no verified WhatsApp inbox | **Fail** | **Partial:** broad commerce/ERP foundation, not India statutory accounting | **Architectural reference/watchlist** |
| **wacrm** | **Partial:** Supabase RLS, but material recent authorization history | **Fail:** no native app, service worker, implemented push, or credible PWA | **Pass only for WhatsApp + generic pipeline** | **Fail** | **Fail** | **Borrow selected Meta/API patterns** |
| **InsulaCRM** | **Fail for this use:** its installation guide explicitly rejects unrelated organizations sharing one instance | **Partial:** cache-oriented PWA shell; no push/native app | **Partial/strong real-estate workflow; no real WhatsApp integration** | **Fail:** matching is within one brokerage | **Fail** | **Borrow distribution/matching ideas only** |
| **Ever Gauzy** | **Partial:** application-scoped `tenantId`; no PostgreSQL RLS found | **Fail for mobile CRM** | **Partial:** very broad ERP/CRM/HR, but not an omnichannel agent product | **Fail** | **Partial/strong generic HR/expenses/invoicing; not India-specific** | **Reject as oversized core replacement** |
| **Twenty** | **Partial:** workspace isolation, not the required broker-channel privacy boundary | **Fail:** no native app | **Pass for generic CRM; fail for mature conversations** | **Fail without extensive custom work** | **Fail for payroll/statutory accounting** | **Defer** |
| **open_crm / Vocero / channel-only projects** | Varies; several are single-business or early application-scoped systems | Generally **Fail** | Useful narrow functionality | **Fail** | **Fail** | **Pattern sources only** |

## 4. Required follow-up: Evolution API

Evolution API was reviewed separately after multi-account WhatsApp add/delete, QR/pairing, and structured interactions became explicit project requirements. The complete immutable-source claim resolution and acceptance contract are in [`evolution-api-adoption-assessment.md`](./evolution-api-adoption-assessment.md).

The stable release inspected is `2.3.7` at `cd800f2976e1e5b682fbf86a01ee4d85ae61f370` (05 Dec 2025). At the 02 Sep 2026 inspection, `2.4.0-rc2` was still a prerelease and no newer stable release existed. Canonical source is `evolution-foundation/evolution-api`; the stable Docker Hub image is `evoapicloud/evolution-api:v2.3.7`, not the stale `atendai/evolution-api:v2.0.0` or a floating `latest` example.

Useful implemented surfaces are real:

- Baileys/WhatsApp Web and official Meta Cloud provider adapters;
- create, connect/QR, restart, connection-state, logout, and delete instance routes;
- per-instance API tokens and webhooks, PostgreSQL/MySQL persistence, Redis caching, event integrations, and media handling;
- native Chatwoot API-inbox bridge for text/media plus Typebot and other chatbot integrations;
- list/button endpoints for both Baileys and Meta modes;
- bundled/static Manager assets and a separately published Manager image.

Those capabilities do not establish a safe multi-tenant production boundary:

1. **Logical instance is not process isolation.** `WAMonitoringService.waInstances` holds multiple account clients in one Node process. A process crash/restart affects its shard; there is no source basis for a one-account crash-isolation guarantee.
2. **Meta token handling is unacceptable in `2.3.7`.** Instance creation uses the supplied `token` as the stored instance token and per-instance Evolution API key; the Meta adapter uses the same value as its Bearer token. `fetchInstances` returns instance records and Evolution webhook bodies include `apikey`. Official Meta therefore remains in Chatwoot.
3. **The native Chatwoot callback needs a front gate.** `/chatwoot/webhook/:instanceName` is mounted without Evolution auth and its receive service does not verify Chatwoot HMAC. Chatwoot `v4.17.1` does sign API-inbox callbacks, so Architech can verify raw-body HMAC/delivery ID, enforce account/org/consent/pause/quota, and privately forward an allowlisted event.
4. **Lifecycle is not idempotent orchestration.** Stable source has no pause operation. Delete emits asynchronous cleanup and does not remove the corresponding Chatwoot inbox. Architech must own desired/observed state, command serialization, tombstones, orphan inventory, and reconciliation.
5. **Interactive reliability is not guaranteed.** Stable source exposes lists/buttons, but upstream reports include HTTP success with non-delivery. Text menus remain the baseline. Its Baileys `nativeFlowMessage` structure is not the official WhatsApp Flows product; no first-class `flow_id`, Flow JSON lifecycle, or data-exchange endpoint was found.
6. **Security/privacy defaults require replacement.** The example environment enables telemetry and broad message/contact/chat/history persistence; Compose floats Evolution/Manager/Redis tags. Manager/global keys, QR/session credentials, event bodies, and Chatwoot tokens are high-value secrets.
7. **License is non-standard.** `LICENSE` says Apache 2.0 plus logo/copyright and administrator-visible usage-notification conditions; GitHub reports `NOASSERTION`. Legal review and the required notice are gates.
8. **“Free” changes the risk, not the cost to zero.** Baileys avoids Meta Cloud message charges but adds compute, storage, operations, reconnect, protocol, restriction/ban, and possible number-loss costs. Meta's official notice says Cloud API service and in-window utility messages become chargeable on 01 Oct 2026.

**Classification:** implement Evolution as the requested private `EVOLUTION_BAILEYS` lead-follow-up adapter behind Architech RLS, encrypted contact point, fast durable outbox, account registry/worker, HMAC gateway, secret manager, feature flag, and activation gate. Keep `CHATWOOT_META_CLOUD` available as the official alternative and genuine-Flow route. Disable `EVOLUTION_META_CLOUD` on `2.3.7`, disable Evolution Manager/public API/telemetry, and determine accounts per shard only through measured failure/capacity tests.

## 5. The strongest newly found candidate: DeskcommCRM

[DeskcommCRM](https://github.com/melgarafael/DeskcommCRM) deserves a more serious classification than a typical young CRM.

| Snapshot fact | Value |
|---|---|
| Repository created | 28 Apr 2026 |
| Inspection date | 02 Sep 2026 |
| Commit inspected | `4b280e8a573d6ed6a94908c7f1fbb01772d6a9e8` (02 Sep 2026) |
| Latest release at inspection | `v1.12.0` (02 Sep 2026) |
| Active commit authors in preceding 90 days | 21 authenticated GitHub logins observed, including 3 bot accounts; 18 non-bot logins |
| License at inspected commit | MIT |

At that snapshot:

- it uses almost the same product stack as Architech: Next.js 16, React, strict TypeScript, PostgreSQL/Supabase, Tailwind, and route handlers;
- it implements both the official Meta Cloud API and an optional QR/WAHA path, plus a shared inbox, pipelines, assignment, automation, signed webhooks, media, audit, LGPD requests, consent, cascade anonymization, storage-redaction queues, and Web Push;
- its CI runs type checking, linting, unit tests, a clean PostgreSQL baseline/install-update exercise, RLS/governance invariants, build checks, CodeQL, and a large Playwright suite;
- the repository has meaningful contributions beyond the owner, recent green workflows, and unusually candid internal threat-model and state-audit documents.

It still does **not** change the decision:

1. **No native mobile agent app and no offline application data.** The notification service worker implements Web Push, not offline CRM operation. Small-screen coverage exists but explicitly does not prove the dense Inbox/Kanban surfaces are fully usable at 390 px.
2. **No brokerage domain.** There is no locality ownership, property supply, cross-broker sanitized publication, buyer-to-listing network matching, negotiated splits, salary/expense ledger, or India accounting path.
3. **RLS is not the only boundary.** At the inspected head, 131 of 228 route handlers imported the Supabase admin/service-role client. Those code paths bypass RLS and depend on manual organization predicates plus tests. The repository recognizes this residual risk, but it matters for unrelated brokerages.
4. **Unconventional schema history.** The README says early migration files are stubs and a fresh installation must apply a large `baseline.sql`; CI validates baseline install/update, but this is not the same as replaying a complete immutable migration chain.
5. **Operational and product scope is large.** A normal deployment can involve Supabase, app/worker/scheduler containers, Redis compatibility, optional WAHA, Meta, multiple AI providers, storage, Sentry, email, and many crons. Most AI/e-commerce surface is irrelevant to Broker Suite.
6. **Production history is still short.** The repository was created on 28 Apr 2026 and reached `v1.12.0` by the 02 Sep 2026 inspection. Excellent tests and active contributors reduce risk; they do not create a long record of upgrades, incidents, and mobile field operation.
7. **It duplicates Architech authority.** Adopting its CRM, contacts, tenancy, consent, and LGPD models wholesale would create another system of record. Using only its inbox would carry a large unrelated codebase.

**Classification:** watch closely and run a disposable integration pilot if a WhatsApp-first, same-stack alternative is strategically important. Do not replace Chatwoot in production until the project has a longer security/upgrade history, a stable public API, enforced controls around service-role use, a conventional fresh-database migration story, and a proven mobile path.

## 6. Other candidates in depth

### 6.1 BottleCRM — strongest isolation reference

[BottleCRM](https://github.com/Django-CRM/Django-CRM), inspected at `989dc0373444a152ddb951588406f4e93e38c6ee`, is the best source found for hard multi-tenant CRM patterns. Repository identity is resolved: `MicroPyramid/Django-CRM` is the historical URL and GitHub redirects it to the canonical `Django-CRM/Django-CRM`; both Git URLs resolved to the same inspected HEAD. At that commit, the README brands the product BottleCRM, the Flutter client is in the same repository under `mobile/`, and `LICENSE` is MIT with copyright attributed to MicroPyramid.

- 64 organization-scoped tables are covered by generated `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` policies;
- production uses a non-superuser application role, with request/connection-pool context setup and cleanup;
- CI includes PostgreSQL jobs that execute as the policy-bound role and test cross-organization isolation and stale-context reset;
- its Django API, Svelte UI, CRM/support modules, and in-tree Flutter app are substantial.

It is not a Broker Suite replacement. Source and dependency inspection found no WhatsApp/omnichannel inbox, Firebase/APNs push, or durable mobile database despite broader “offline-first” wording. The mobile project is not gated in the main CI. The backend has no purpose-specific consent, retention, erasure cascade, or outbound domain webhook system. Its invoices are not a commission/payroll/India accounting system.

**Classification:** borrow RLS, pool-reset, non-superuser CI, and API test patterns. Do not adopt the platform wholesale.

### 6.2 wacrm — useful WhatsApp implementation, disproportionate risk

[wacrm](https://github.com/ArnasDon/wacrm), inspected around `98b5bd26`, is a concise same-stack implementation of Meta WhatsApp, shared inbox, contacts, pipelines, broadcasts, automations, RLS, APIs, and signed webhook handling. Its CI now covers lint, typecheck, tests, build, clean migration replay, and resulting-schema verification.

It fails mandatory gates: no native client, service worker, implemented Web Push, or mobile push; no public deal/pipeline API; outbound webhooks cover only a small conversation/message event set; rate limiting is in-memory/per-process; and it has no broker network, finance, or privacy lifecycle. Four published 2026 security advisories—including a critical database authorization bypass and high-severity authorization/SSRF findings—are material for a repository created in April 2026, even though fixes and disclosure are positive.

**Classification:** borrow Meta signature verification, payload normalization, media handling, account-scoped API key, and migration-CI ideas. Do not make it canonical or copy its in-memory rate limiter.

### 6.3 Open Mercato — strongest framework fit, not a finished product

[Open Mercato](https://github.com/open-mercato/open-mercato), inspected around its `v0.7.0` release, is the strongest same-stack architectural reference: Next.js/TypeScript/PostgreSQL, tenant and organization context, RBAC, audit, modular APIs/UI, custom entities, domain events, notifications, webhooks, portals, and encryption.

It is a broad framework rather than a ready Broker Suite. It was created in September 2025, has a very large code and issue surface, no native agent client, no verified production WhatsApp inbox, and no PostgreSQL RLS was found. Recent tenant-scope and security fixes show active hardening but also make a replatform now premature. Adopting it would replace Architech's Prisma/application conventions rather than add a bounded subsystem.

**Classification:** borrow module/event conventions, handler registries, idempotency, and extension boundaries. Reassess after a stable 1.x line, hard isolation evidence, and a real communications/mobile story.

### 6.4 InsulaCRM — domain ideas, explicit deployment disqualification

[InsulaCRM](https://github.com/InsulaCRM/InsulaCRM), inspected at `ddf430e0`, contains directly relevant real-estate ideas: round-robin/shark-tank/hybrid lead distribution, agent roles, properties, buyers, deals, buyer criteria matching, due-diligence workflows, APIs, signed outbound webhooks, plugins, notifications, and DNC/TCPA controls.

Its own installation guide states that each installation should represent one organization and that it is **not designed for a shared multi-tenant SaaS deployment** because admin plugin/update/restore/language operations cross the installation trust boundary. Eloquent global scopes are therefore defense within a trusted installation, not a hard boundary for independent brokerages. WhatsApp Business API integration is explicitly deferred; current work is a `wa.me` quick action. It has no push/native client, no cross-broker matching, no full privacy lifecycle, no finance, only seven public commits from one contributor identity, and no GitHub Actions workflow despite a useful PHPUnit suite.

**Classification:** borrow lead-distribution states and deterministic buyer-match scoring as domain input. Redesign them around Architech locality ownership and sanitized cross-broker publications.

### 6.5 Ever Gauzy — broad business suite, wrong-sized boundary

[Ever Gauzy](https://github.com/ever-co/ever-gauzy) is a serious, long-running TypeScript/NestJS/Angular platform with CRM, HR, expenses, compensation, time tracking, invoices, projects, and headless APIs. It has a real contributor base and broader business coverage than narrow CRMs.

It is nevertheless an oversized core replacement: no native field-agent CRM client was found in the repository, tenancy is primarily application-filtered through `tenantId`, current releases are prerelease-heavy, its hosted product is still described cautiously, and it has no India-specific statutory advantage over ERPNext. The Angular/Nest monorepo and AGPL license also make selective integration less attractive than a separate Frappe finance boundary.

**Classification:** reject as the Broker Suite core. Review concepts only; do not copy AGPL code into Architech.

### 6.6 Small and channel-only projects

- **open_crm:** excellent consent ceremonies, immutable quote/audit artifacts, recovery, and acceptance-test ideas; one contributor, no releases, minimal adoption, and native mobile deferred.
- **Vocero:** a well-scoped official-Meta WhatsApp CRM, but explicitly one instance per business, without a broker network, hard shared tenancy, native mobile, or finance.
- **OpenBSP / Whatomate:** useful official-Meta, multi-organization messaging/API implementations. They do not supply a mature native agent app, broker CRM, cross-broker channel, or finance, so choosing them means building the inbox/mobile product Chatwoot already supplies.
- **OpenWA / MultiWA / other QR gateways:** channel infrastructure, not CRMs. Reverse-engineered WhatsApp-Web paths add account-ban and compliance risk and should not be presented as the official/default production path for consent-sensitive broker communications.
- **Generic CRM/low-code products** such as EspoCRM, Corteza, Krayin, Relaticle, and NextCRM do not add enough broker-domain, privacy, mobile, or communications capability to justify a second platform.

## 7. Combinations considered

### Architech + DeskcommCRM

Closer stack alignment and stronger database RLS than Chatwoot, but it gives up native mobile maturity and broad omnichannel history, duplicates CRM/privacy authority, and adds a large AI/automation system. **Not better today.** A limited Meta-inbox pilot is reasonable only as a reversible experiment.

### Architech + BottleCRM + Chatwoot

This combines the best generic CRM isolation, a Flutter CRM shell, and mature communications. It also creates three private data stores, two agent applications, two workflow engines, and a complex erasure/synchronization graph. BottleCRM still lacks push and WhatsApp. **Strictly worse operationally than implementing broker workflow in Architech.**

### Architech + Frappe CRM/ERPNext instead of Chatwoot

This is the strongest **finance-first** alternative. Choose it when GST, TDS, payroll, EPF/ESI, e-invoicing, or a general ledger is an immediate launch requirement. It still needs Architech for the privacy-preserving network and does not currently match Chatwoot's native agent inbox. **Valid later boundary, not the current communications replacement.**

### Open Mercato + a communications project

Architecturally elegant for a greenfield product, but it replatforms Architech onto a young framework and still requires a mature mobile/inbox subsystem. **More migration and integration work, not less.**

### Architech + a low-level Meta API platform

OpenBSP, Whatomate, wacrm components, or direct Meta APIs can reduce the channel layer, but Architech would then need to build conversation assignment, retries, media UX, templates, notification/push behavior, presence, and native/mobile operations. **This contradicts the adopt-don't-build goal.**

### Architech + Chatwoot + Evolution API

This is accepted only with strict boundaries: Architech owns tenant authorization/account lifecycle; Chatwoot owns the agent inbox/mobile surface; Evolution privately transports feature-flagged Baileys accounts. The native Chatwoot bridge is fronted by Architech's HMAC-verifying gateway. Official Meta stays directly in Chatwoot, preventing duplicate webhook ownership and avoiding Evolution `2.3.7`'s Meta-token/API-key conflation. **Accepted as a required gated adapter, not as a third authority.**

## 8. What is worth harvesting

“Borrow” means adapting an idea or a small, reviewed component—not introducing another authoritative CRM database.

| Source | Worth borrowing | Do not borrow |
|---|---|---|
| **BottleCRM (MIT)** | Forced RLS DDL, non-superuser isolation jobs, pooled-connection context reset tests, organization-switch cleanup, API authorization matrix | Offline/push claims, generic CRM wholesale |
| **DeskcommCRM (MIT)** | “Every tenant table has RLS” invariant, two-organization attack tests, event-log/outbox handlers, consent provenance, cascade anonymization + storage deletion queue, Web Push plumbing, service-role-use lint concept, Meta adapter tests | Large AI/e-commerce surface, QR/WAHA production path, baseline-as-migration-history approach, broad service-role access |
| **wacrm (MIT)** | Meta webhook verification, message/status normalization, media fetch/storage, account-scoped API keys, migration/schema CI | In-memory rate limiter, complete app adoption |
| **InsulaCRM (MIT)** | Round-robin/shark-tank/hybrid assignment states, deterministic buyer-match score components, plugin-hook naming | Eloquent global scopes as “hard” tenancy; within-tenant buyer contact model for cross-broker use |
| **Open Mercato (MIT)** | Module manifests, typed domain events, module-owned idempotent webhook handlers, notification renderer boundaries, override conventions | Application scoping as a substitute for RLS; wholesale framework migration |
| **open_crm (MIT)** | Explicit consent ceremony, retained audit certificates, immutable quote/version model, recovery and acceptance scenarios | Platform adoption at its current maturity |
| **Evolution API (custom additional conditions)** | Instance lifecycle/provider adapter behavior only through a separately deployed service after legal/security review; no source copying assumed | Its Manager as tenant UI, global/API keys in clients, direct unauthenticated Chatwoot callback, Meta mode on `2.3.7`, `latest` Compose, anti-ban/capacity claims |
| **OpenBSP (Unlicense)** | Meta Embedded Signup/coexistence and tenant credential isolation patterns, after legal review | Using an API layer as if it were a mobile agent product |

### License boundary

- MIT sources can usually support selective reuse if copyright and license notices are preserved. License compatibility does not establish code quality or make copying security controls safe.
- Before copied code enters Architech, record the canonical repository, full commit SHA, source file, copied/derived scope, license text, attribution, local modifications, and dependency/generated-code review in `THIRD_PARTY_NOTICES.md`. Prefer an independently tested reimplementation for RLS, consent, authentication, and erasure controls.
- Twenty, Frappe CRM, and Ever Gauzy are AGPL-family systems; ERPNext/Frappe HR/India Compliance are GPL-family. Keep them behind service/API boundaries unless legal review approves another approach.
- Chatwoot code outside its `enterprise/` directory uses MIT terms; enterprise code has separate terms.
- Evolution API is not plain Apache-2.0 despite the bundled Apache text: its license adds logo/copyright and usage-notification conditions and GitHub reports `NOASSERTION`. Keep it at a service boundary, show the required administrator-visible notice if deployed, and obtain legal approval before release or code reuse.
- **Architech currently has no repository-level `LICENSE` file.** The owner must choose its licensing posture before third-party code is imported; an agent should not add a license by assumption. “Public on GitHub” is not itself a license.

## 9. Required architecture hardening

### 9.1 Hard tenancy in Architech

Before onboarding independent brokerages:

1. Classify every private table as `tenant-owned`, `platform-owned`, or `sanitized-channel`.
2. Make organization ownership non-null where a private record cannot be global.
3. Run the application with a PostgreSQL role that is neither superuser nor `BYPASSRLS`.
4. Add RLS to tenant-owned tables. Set organization context with `SET LOCAL` inside the same transaction used by Prisma queries; never rely on a session setting that can leak through the pool.
5. Add CI that creates two brokerages and proves isolation for read, write, relation traversal, raw SQL, background jobs, and pooled-connection reuse.
6. Put cross-broker fields in separate sanitized publication tables/views that contain no customer phone, email, message text, free-form text, or reversible source identifier. Generate any summary from approved structured fields and reject contact-like content. Keep the private source mapping in a separate owner-only table; never solve discovery by weakening private-table RLS.
7. Add schema/projection checks plus poisoned-row tests proving cross-broker queries cannot return PII or private source keys.
8. Require a reviewed escape hatch for platform operations, with explicit reason and audit event.

### 9.2 Chatwoot isolation profile

- Map one Chatwoot account to one Architech brokerage and resolve that mapping server-side. Never accept `account_id` from an untrusted request.
- Use the Platform API only for provisioning. Use user or agent-bot credentials for account data-plane calls; do not treat a platform token as an application token.
- A shared Chatwoot database is **logical account isolation**, not hard database isolation. For brokerages requiring a hard boundary, provision a separate Chatwoot deployment with a dedicated database and object-storage boundary per brokerage and automate upgrades, backups, and health checks.
- Copy only communication-purpose data. Do not mirror listings, requirements, matching records, commission data, or private channel details into Chatwoot custom attributes.
- Store Architech identifiers and idempotency keys, not duplicated authority.

### 9.3 Official-app push relay is an external data flow

The official app's “push works out of the box” behavior has an important privacy qualification. In Chatwoot's inspected source, when Firebase credentials are absent and `ENABLE_PUSH_RELAY_SERVER` is true (the default), the server sends the complete FCM options to `https://hub.2.chatwoot.com/send_push`. That request includes the device push token, title/body, account/conversation notification identifiers, and installation metadata. The normal body can contain the sender name plus the first ten words of the message.

This relay is separate from optional usage telemetry. Disabling telemetry does not, by itself, disable relay push. FCM/APNs are external processors in either delivery model; the default model adds Chatwoot's hub as another processor. The client source confirms transit, but not the hub's retention, access logging, or processing region; those require contractual/operational evidence before approval.

Before mobile sign-off:

1. Record the relay, FCM/APNs, Meta, email, error monitoring, and object storage in the data-flow/processor inventory and privacy notice as applicable.
2. Treat lock-screen notifications as a minimized disclosure surface. Use non-identifying names for masked contacts and generic push text (for example, “New message — open Chatwoot to view”) so customer names and message previews do not transit the relay or appear on a locked phone. The inspected source exposes no generic-preview setting, so this requires a small maintained server patch unless upstream adds one; otherwise keep relay push disabled.
3. Set `ENABLE_PUSH_RELAY_SERVER` deliberately and verify the effective path on physical iOS and Android devices; do not rely only on the default.
4. If a strict tenant rejects Chatwoot-relay transit, the valid fork trigger is a custom mobile build with its own bundle identifiers and Firebase credentials, sending directly from Chatwoot to FCM. That removes the Chatwoot relay, not the Apple/Google push processors.
5. Pin the Chatwoot **server** release and rehearse upgrades against the current official stable and beta apps. Store-app versions cannot be operationally pinned on users' phones, so maintain a tested compatibility matrix and staged server-upgrade runbook.

### 9.4 Durable integration and privacy

- Add an Architech transactional outbox for contact/conversation provisioning, consent changes, and erasure. Write it atomically with the canonical change; require an idempotency key, typed/minimized payload, bounded retries, lease recovery, and visible dead-letter state rather than retaining arbitrary PII in generic JSON.
- Scope every external account, inbox, agent, contact, conversation, and delivery identifier to a specific Chatwoot integration/deployment because numeric IDs can collide across physically separate deployments. Keep API and verification secrets in a secret manager.
- Use a Chatwoot **account webhook**, not payload identifiers as authentication. The inspected `v4.17.1` source signs deliveries with `X-Chatwoot-Timestamp` and `X-Chatwoot-Signature`, where the signature is HMAC-SHA256 over `{timestamp}.{raw_body}` using the per-webhook secret; it also emits `X-Chatwoot-Delivery`. Verify raw bytes with constant-time comparison, enforce a short clock-skew window, reject absent/invalid signatures, and prove this against the deployed image in the synthetic pilot.
- Configure Chatwoot Active Record Encryption keys: the inspected webhook model encrypts its secret only when encryption is configured. Keep Architech's verifier copy in a secret manager rather than an ordinary integration row.
- Receive events on a tenant-neutral endpoint, deduplicate by delivery ID (with a deterministic digest fallback), resolve `account_id` only through the server-side integration map, verify that any external reference belongs to that organization, and optionally re-fetch security-sensitive conversation state from Chatwoot. Apply only allowlisted facts/transitions and remain safe under retry or reordering.
- Retain an event digest and restricted processing result for audit. Store the raw PII-bearing payload only when operationally necessary, encrypted and under a short explicit retention period.
- Treat deletion as a workflow: tombstone locally, revoke access, enqueue Chatwoot contact/conversation/attachment cleanup, retry, record acknowledgement, and wait for the declared backup-expiry boundary. A successful contact-delete response alone does not prove complete erasure.
- Choose backup retention through legal and operational review before launch; do not silently adopt an arbitrary example such as 30 days. A restore procedure must replay erasure tombstones before restored services become available so deleted PII cannot reappear.
- Version consent text and store purpose, source, actor, capture time, withdrawal time, and evidence hash.
- Keep customer phone encrypted; reveal it only to the minimum workflow explicitly authorized by the customer. Cross-broker APIs never return it.

### 9.5 Evolution account, callback, and failure-domain controls

- Add an Architech-owned, RLS-protected account registry with CUID local IDs, organization ownership, transport, provider deployment, opaque Evolution instance name/ID, Meta and Chatwoot mappings, desired/observed state, secret references, risk-policy acceptance, commands/events, and deletion tombstones.
- On specifically WhatsApp-consented lead creation, atomically persist an encrypted purpose-scoped destination, assignment/audit, and one high-priority send outbox row. The current `Lead.phoneMasked` cannot support a post-commit send, while its default idempotency material contains submitted phone/message values; replace that with ciphertext plus a keyed lookup digest and opaque/HMAC idempotency before implementation.
- A hot account-partitioned worker selects only an active account owned by the lead's brokerage, rechecks consent/suppression/state/quota, decrypts in memory, calls Evolution directly, and records provider acceptance separately from delivery/read. Target ≤1-second provider acceptance only as a measured SLO; Evolution's asynchronous Chatwoot mirror requires reconciliation.
- Browsers, mobile clients, Chatwoot agents, n8n, and Typebot never receive Evolution global/instance credentials. Manager and port 8080 remain private/disabled; all calls pass through an account-partitioned Architech worker/gateway.
- Reuse Evolution's native live text/media bridge for Evolution-backed Chatwoot API inboxes, but manually provision each inbox so its callback points to Architech. Set Evolution `autoCreate=false`; disable its Chatwoot bot contact and contact/history import initially. Verify Chatwoot timestamp/raw-body HMAC/delivery ID, then resolve deployment/account/inbox/org and enforce active state, consent, suppression, policy window, and quota before private forwarding.
- Configure Evolution events with private TLS/mTLS and JWT header support, but do not treat its JWT as a body signature. Validate schema, resolve instance server-side, deduplicate, re-fetch high-impact state, and strip the `apikey` field before logging/persistence.
- Pause is a local send gate; logout revokes Baileys session state; delete is a tombstone-driven multi-store workflow. Stable Evolution deletion does not prove Chatwoot/media/backup erasure.
- Text interaction state is transport-neutral. Lists/buttons have per-release capability flags and text fallback. Genuine WhatsApp Flows, flow tokens, data exchange, and response validation require official Meta and therefore remain disabled/outside the hosting-only baseline unless separately cost-approved.
- Pin source/image/PG/Redis by digest; disable telemetry and unnecessary integrations/storage; benchmark reconnect storms and set account-per-shard caps from SLO/blast radius. Strict tenants get separate Evolution/PG/Redis/storage/keys/logs/backups.

### 9.6 Residency, hosting-only cost, and optional external onboarding

- The mandatory baseline must require no payment beyond self-hosted infrastructure and the brokerage's existing phone/SIM/data service: use Chatwoot Community Edition and pinned self-hosted Evolution/Baileys; disable Cloud/Premium/Enterprise, Meta billing, paid AI/voice/SMS/email/monitoring, managed automation, and other metered add-ons.
- Comply with Evolution `2.3.7`'s administrator-visible usage-notification/license conditions and obtain legal confirmation that no commercial license is triggered. Keep Manager/frontends disabled rather than modifying/removing their branding.
- Maintain a release and quarterly billing inventory proving no mandatory license, payment method, metered API key, or automatic paid fallback. If an upstream version changes commercial terms, retain the approved pin while security permits or replace/review it—never silently incur a fee.
- Place controllable Chatwoot/Evolution databases, Redis, object storage, logs, and backups in the chosen region. The Chatwoot push relay and FCM/APNs remain external data flows even when no service fee is charged; approve their privacy terms and keep a disable/fallback plan.
- Build a measured hosting cost model for compute, PostgreSQL, Redis, object storage/egress, backups, self-hosted monitoring, maintenance, reconnect incidents, and number-loss interruption. These are real hosting/operating costs, not vendor message fees.
- Official Meta Cloud/Flows require separate cost/policy approval and onboarding; they are outside the hosting-only baseline and never an automatic fallback.

## 10. Recommended delivery order

Run a synthetic-data Chatwoot spike in parallel with P0. Deploy the exact self-hosted image, create two brokerage accounts and test agents, then verify the official Android and iOS apps on physical devices: background/terminated push, correct-account assignment, no cross-account delivery, generic notification text, token refresh, logout/login, agent deactivation, webhook signature verification/deduplication, and whether an Architech HTTPS link is usable from the app. This spike validates deployment behavior; it does not permit real broker data before P0 isolation passes.

| Phase | Deliverable | Exit gate |
|---|---|---|
| **P0** | Architech tenant context, PostgreSQL RLS, non-bypass app role, two-org CI | No private cross-tenant read/write through web, jobs, raw queries, or pool reuse |
| **P1** | Locality assignment, direct/cold-caller routing, lead lifecycle, audit, broker PWA notifications | Lead reaches the correct employee; unassigned fallback and handoff are auditable |
| **P2a** | Provider-neutral WhatsApp registry, encrypted lead contact point/safe dedup, commands/events/reconciliation, transactional fast outbox, self-hosted Chatwoot Community API-inbox provisioning/webhooks/mobile | Correct brokerage only; no raw destination in ordinary lead/outbox/idempotency data; retries idempotent; minimized push works on physical iOS/Android; billing inventory proves no required paid license/SaaS/API/add-on or Meta fallback |
| **P2b** | Required private Evolution/Baileys lead-follow-up adapter, HMAC gateway, add/QR/pair/pause/logout/delete/re-pair, near-immediate direct send and API-send mirror into Chatwoot | Synthetic lead reaches only the correct brokerage number/inbox/assignee; speed and acceptance/delivery states are measured; two-org isolation, callback forgery/replay, concurrent lifecycle, reconnect/shard, consent/STOP, orphan, erasure, and restore tests pass; real numbers remain disabled until named risk approval/canary |
| **P2c** | Hosting-only deterministic text interaction state and capability-gated Evolution lists/buttons/fallback; disabled interface/design for possible future Meta Flows | Text always works; interactive non-delivery falls back; no Meta billing/runtime dependency and no false genuine-Flow claim |
| **P3** | Sanitized demand/supply publications, deterministic matching, dual-close, negotiated splits | Two brokerages can match and close without either receiving customer contact data |
| **P4** | Consent withdrawal and erasure orchestrator across Architech, Chatwoot, media, and backups | Rehearsed erasure completes or visibly escalates; no silent partial success |
| **P5** | Simple commission/salary/expense ledger | Broker can reconcile deal income and operating expense without pretending it is statutory accounting |
| **Later** | ERPNext + Frappe HR + India Compliance integration | Triggered by real India accounting/payroll requirements, not speculative scope |

## 11. Re-evaluation triggers

Reconsider the recommendation if one of these becomes true:

- DeskcommCRM establishes a stable public API and migration contract, enforces service-role tenant scoping mechanically, completes an external security review, demonstrates sustained upgrade history, and ships a proven mobile/offline strategy.
- BottleCRM ships real push, durable offline sync, a production WhatsApp/omnichannel inbox, and privacy lifecycle APIs.
- Open Mercato reaches a stable 1.x line with hard tenant isolation, mature mobile, and a verified communications module.
- Native broker CRM—not omnichannel conversation—is proven to be the dominant field workflow. That would justify a BottleCRM-style mobile pilot or a dedicated Architech mobile client.
- Launch tenants contractually reject the default Chatwoot relay or require branded/embedded native workflow. That triggers the custom-app/direct-FCM path, not a change of canonical CRM.
- India statutory accounting/payroll moves into the launch-critical path. That promotes the Frappe stack earlier; it does not move the broker channel out of Architech.
- Evolution publishes a stable successor that separates provider secrets from API credentials, removes secrets from instance/event responses, authenticates the Chatwoot callback, adds safe idempotent lifecycle semantics and first-class official Flow support, and passes the local test matrix. That may permit `EVOLUTION_META_CLOUD`; it does not move tenant/account authority out of Architech.
- The business no longer accepts unofficial-client/number-loss risk. Keep the implemented Evolution adapter disabled; any official Meta replacement is a separate cost-changing decision, not a silent fallback or another disguised QR gateway.
- Chatwoot, Evolution, the push path, or another required dependency introduces a mandatory license, seat/message, API, or SaaS charge. Freeze the approved version only while secure and legally supportable, otherwise replace/review the component before deployment.

## 12. Final classification

### Adopt

- **Architech as the canonical broker/privacy/network and WhatsApp account-control system.**
- **Self-hosted Chatwoot Community as the bounded inbox/native-mobile/push subsystem and the termination point only if optional official Meta is separately enabled.**
- **Evolution API as the required private, feature-flagged Baileys adapter for near-immediate consented lead follow-up from brokerage-owned numbers, with production activation gated separately from implementation.**
- **A hosting-only commercial baseline: Chatwoot Community and pinned self-hosted Evolution/Baileys; no required vendor subscription, seat/message fee, Meta billing, paid add-on, or custom mobile fork.**
- **Official Chatwoot mobile app after the push-relay privacy gate, before any fork.**
- **Frappe/ERPNext later, when statutory finance justifies it.**

### Borrow selectively

- BottleCRM isolation and CI patterns.
- DeskcommCRM RLS, event, consent/erasure, Meta, and Web Push patterns.
- wacrm Meta normalization and migration checks.
- InsulaCRM distribution and deterministic real-estate matching ideas.
- Open Mercato module/event conventions.
- open_crm consent, immutable audit, and acceptance-test practices.

### Reject as current production replacements

- DeskcommCRM, BottleCRM, wacrm, InsulaCRM, Open Mercato, Ever Gauzy, open_crm, Vocero, and channel-only WhatsApp gateways.
- Twenty as an additional canonical CRM in the current architecture.
- Reverse-engineered WhatsApp-Web/QR integrations as the default or claimed-compliant production path. Evolution/Baileys is the explicit exception only after its documented activation gate; otherwise it remains disabled.

**Bottom line:** the search found several excellent implementation references and one serious new same-stack challenger. Evolution reduces custom linked-device/session work but introduces risks that require an Architech gateway and explicit activation decision. The Architech + Chatwoot authority boundary does not change; the required Evolution functionality is added only as a gated provider adapter.

## 13. Primary sources and inspected revisions

All snapshots below were recorded on 02 Sep 2026. Full SHAs are used so later repository changes cannot silently alter the evidence.

| Project | Canonical source | Immutable commit inspected | License posture at inspection |
|---|---|---|---|
| Architech | this repository | branch `arena/01a06189-architech` from `bc56d95c47094a01a7013e9f1f595dcc5e184086` | No repository-level license |
| Chatwoot | https://github.com/chatwoot/chatwoot | broad review `08b9992c4c352407a9d40f3871c6784008efb8a6`; push/webhook recheck `9c7177005b3e2466f1de731da75192f8c9592e4b`; `v4.17.1` API-inbox HMAC/Flow recheck `b354a9550e1fb59fa537a9c384232cb076213e72` | MIT core; separate `enterprise/` terms |
| Evolution API | https://github.com/evolution-foundation/evolution-api | `cd800f2976e1e5b682fbf86a01ee4d85ae61f370` (`2.3.7`, 05 Dec 2025) | Apache 2.0 text plus additional logo/usage-notification conditions; GitHub `NOASSERTION` |
| Chatwoot mobile | https://github.com/chatwoot/chatwoot-mobile-app | `228a069c28f7ab8fdf0a59e22f7fa02e71d4ca10` | MIT |
| BottleCRM | https://github.com/Django-CRM/Django-CRM | `989dc0373444a152ddb951588406f4e93e38c6ee` (`v1.9.1`, 17 Aug 2026) | MIT |
| DeskcommCRM | https://github.com/melgarafael/DeskcommCRM | `4b280e8a573d6ed6a94908c7f1fbb01772d6a9e8` (`v1.12.0`, 02 Sep 2026) | MIT |
| wacrm | https://github.com/ArnasDon/wacrm | `98b5bd26e8feacacfd4b74ff58411acb8154d212` | MIT |
| InsulaCRM | https://github.com/InsulaCRM/InsulaCRM | `ddf430e0a344b31f2cb588d4977a405b3b841312` (`v1.1.0`) | MIT |
| Open Mercato | https://github.com/open-mercato/open-mercato | `8b492325d3db29c431cca43674dcc93f894110be` (`v0.7.0`) | MIT |
| Ever Gauzy | https://github.com/ever-co/ever-gauzy | `fe004fe999272d495d7e33636d5b53495e2749be` | AGPL-3.0 |
| open_crm | https://github.com/aeml/open_crm | `93798e1a1159794f44f2105eb762085e7cf315c5` | MIT |
| Vocero | https://github.com/kevinrivm/vocero-crm | `73e93c1483cddf48b0053c1bc233321ee72abe87` | MIT |
| Frappe CRM | https://github.com/frappe/crm | `0b99b4ee26596d823e51f0de1bf7066b95104ed1` | AGPL-3.0 |
| ERPNext | https://github.com/frappe/erpnext | `4944df8733c5f129ca0a231bd81661c7158c55fe` | GPL-3.0 |
| Frappe HR | https://github.com/frappe/hrms | `f0d4c06cdd2ee49ec5b1dcc705488e647a1d0720` | GPL-3.0 |
| India Compliance | https://github.com/resilient-tech/india-compliance | `3b5ec3ba0c5bdd12178c1bfbfebff7038cb812a2` | GPL-3.0 |
| OpenBSP API | https://github.com/matiasbattocchia/open-bsp-api | `e6c53d0e130cb412a1af6344a108c9256e37ff6a` | Unlicense |
| Whatomate | https://github.com/shridarpatil/whatomate | `23bee8cd2341f9363901a0c1ef8db6aff8f08774` | AGPL-3.0 |
| MultiWA | https://github.com/ribato22/MultiWA | `ff51e79dd83da6fd5dee71765dfaf0ea71ae0d24` | MIT |
| OpenWA | https://github.com/rmyndharis/OpenWA | `31cc9926347eb30675605168c994fc5e33aece2a` | MIT |

There are no reused numbered citations in this document; links point directly to canonical sources. Operational Chatwoot behavior was also checked against the official [self-hosted Community/Premium description](https://www.chatwoot.com/hc/user-guide/articles/1750735898-purchasing-a-paid-self_hosted-chatwoot-license-a-step_by_step-guide), [custom mobile-app guide](https://developers.chatwoot.com/self-hosted/custom-mobile-app), [push notification decision table](https://www.chatwoot.com/hc/handbook/articles/1687935909-push-notification), and [account-webhook API documentation](https://developers.chatwoot.com/api-reference/webhooks/add-a-webhook), all accessed on 02 Sep 2026. Evolution release/image/provider/lifecycle/webhook/Chatwoot/interactive evidence and current Meta pricing/Flow/policy sources are enumerated in [`evolution-api-adoption-assessment.md`](./evolution-api-adoption-assessment.md).
