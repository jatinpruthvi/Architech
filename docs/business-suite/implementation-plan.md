# Business suite — step-by-step implementation plan

**Date:** 08 Sep 2026
**Status:** The master execution plan for the business suite program this conversation designed: Frappe CRM/ERPNext integration, the WhatsApp tab, the transport, lead ingestion (portals, Meta, B2B aggregators), and the feature-list coverage. Per-phase specifications live in the sibling design documents; this plan sequences them, assigns them to repositories, and defines done.
**Specs referenced:** [`frappe-crm-whatsapp-tab-integration.md`](../broker-suite/frappe-crm-whatsapp-tab-integration.md) · [`waha-transport-assessment.md`](../broker-suite/waha-transport-assessment.md) · [`lead-ingestion-contract.md`](./lead-ingestion-contract.md) · [`real-estate-portal-lead-ingestion.md`](./real-estate-portal-lead-ingestion.md) · [`meta-lead-sources.md`](./meta-lead-sources.md) · [`feature-coverage-mapping.md`](./feature-coverage-mapping.md) · [`decision.md`](../broker-suite/decision.md) (v8) · [`repositories-and-db-sharing-design.md`](../broker-suite/repositories-and-db-sharing-design.md) · [`erpnext-consumability-schema-constraints.md`](../broker-suite/erpnext-consumability-schema-constraints.md)

---

## 0. The program in one view

```text
Phase 0  Decisions & amendments ........ governance only, unblocks everything
Phase 1  Dev foundation ................ bench site, pinned apps, CI
Phase 2  business_suite_core ........... the Frappe app (ingestion contract, writer, routing)
Phase 3  Transport + WhatsApp tab ...... WAHA, gateway (in Architech), the chat tab
Phase 4  Lead-source adapters .......... Meta, MagicBricks, 99acres, Housing, CSV
Phase 5  Metrics spine ................. campaigns, funnels, source/city reports
Phase 6  Pilot .......................... one real business on real numbers
Phase 7  Productization ................. sold product, profiles, legal gates
```

Critical path: **0 → 1 → 2 → 3 → 4 → 6** (5 runs parallel to 4; 7 starts only after 6 passes). Estimated effort for a small team (1–2 developers): P0 ≈ S, P1 ≈ M, P2 ≈ L, P3 ≈ L, P4 ≈ M, P5 ≈ M, P6 ≈ M build + weeks of live soak, P7 ≈ L. (S = days, M = 1–2 weeks, L = 3–6 weeks.)

## 1. Working model — repositories, branches, worktrees

This is already decided at architecture level by [`repositories-and-db-sharing-design.md`](../broker-suite/repositories-and-db-sharing-design.md) §1; this section makes it operational.

### 1.1 Repositories

| Repo | Role | Contents | Write model |
|---|---|---|---|
| **`jatinpruthvi/Architech`** (this repo) | Public platform + **normative home** | Next.js app, Prisma, governance, all design docs, **the gateway module**, lead projection, outbox workers | Feature branches → PR → main; existing CI gates apply |
| **`business_suite_core`** (NEW — create in Phase 1) | The integration hub on every Frappe site | Frappe app: ingestion API, contract doctypes, CRM writer, dedupe/merge, routing config, audit/erasure, mobile PWA actions (`Call from SIM`, result sheet), `deploy/` (compose + bench scripts + transport pinning) | Its own repo, trunk-based, semver tags |
| **`business_suite_whatsapp`** (NEW — create in Phase 3) | The WhatsApp-tab adapter (unofficial transport) | The four contract doctypes (`WhatsApp Settings/Account/Message/Templates`) + send/ingest adapter + roles | Small second repo, same model — **must be separately installable** (see below) |
| Upstream (pinned, **never forked**): `frappe/frappe v16.33.0`, `frappe/crm v1.83.0`, `frappe/erpnext v16.34.1`, `frappe/hrms v16.17.1`, `resilient-tech/india-compliance v16.9.0`, `devlikeapro/waha 2026.8.2` (pilot transport) | Vendors | Installed by version pin, not by branch | Immutable-commit/image pins recorded in `deploy/` |

**Why new repositories and not branches/folders of Architech:** different stack (Python/Frappe vs Node/Next), different release cadence, and — decisively — `bench get-app` installs a Frappe app from a **git repository whose root is the app** (verified in `frappe/bench` source: the clone is renamed to the app name and expected at `apps/<name>`; there is no subdirectory/monorepo install path). An app nested inside the Architech monorepo cannot be installed that way. A branch is also the wrong tool: branches imply an eventual merge back, and this code will never merge into a Next.js repo. **Verdict: new repositories.**

**Why exactly two new repos (core + whatsapp), not one:** the WhatsApp-tab adapter *cannot* be a module of `business_suite_core`, for a hard reason and a soft one. **Hard:** its doctypes are named `WhatsApp Settings`, `WhatsApp Account`, `WhatsApp Message`, `WhatsApp Templates` — the names *are* the CRM-tab contract and cannot be renamed — and they collide with `frappe_whatsapp` (Path A, official Meta). A site opting into Path A must install `frappe_whatsapp`; if our doctypes shipped inside `business_suite_core` (which that site needs for ingestion), the two apps could never coexist. Making the adapter a separate app keeps both paths composable per business: core everywhere; `business_suite_whatsapp` on unofficial-transport sites, `frappe_whatsapp` on official-Meta sites — **mutually exclusive per site, never both**. **Soft:** bench's root-app constraint (above) means separate installability requires separate repos anyway. `deploy/` stays in core and composes both.

**The gateway stays in Architech** (per the sharing design, repo #9: "owned by Architech, uses Architech Postgres"). Concretely: new API routes (`app/api/gateway/…`) + the existing worker/cron patterns, sharing the Prisma schema, tenant registry, and audit tables. Extract to a separate process only if load or blast-radius demands it — do not pre-split.

### 1.2 Branching

- All repos: **short-lived feature branches off main, PR-reviewed, squash-merged**; CI must pass before merge (Architech's existing pipeline; a minimal pytest+build pipeline for each new app).
- **Pinning rule:** `deploy/` references exact upstream tags/SHAs and image digests — never `latest`, never branch heads. Upgrades are a deliberate PR that re-runs the compatibility tests (v8 §13's "exact compatibility lock and staged upgrades").
- **Docs flow:** normative documents live only in Architech (single source of truth); `business_suite_core`'s README links to them rather than copying.
- Immediate housekeeping: this session's design documents sit on the `arena/01a07fb1-architech` branch — **open the PR to main first** (Phase 0, task 0.1) so the specs are the baseline everyone builds against.

### 1.3 Worktrees — when and whether

`git worktree` is for **parallel streams on the same repo** (e.g., keeping the dev server running on one branch while building on another; urgent hotfixes without stashing). It is not a substitute for a repository split and is not needed for the new app (fresh, small repo). Guidance:

- Use one worktree per *concurrently active* Architech stream if you regularly context-switch (e.g., `../architech-gateway` while the main checkout runs the site). Cost: a full `pnpm install` per worktree (~disk + time) and discipline on untracked files.
- Do **not** create worktrees for sequential phases — plain branches are enough.
- Do **not** use a worktree to "quarantine" the business suite — that's what the separate repository is for.

**Bottom line: two new repositories (core in Phase 1, whatsapp in Phase 3), feature branches everywhere, worktrees optional and rare.**

## 2. Phase 0 — Decisions and amendments

**Goal:** every governance change the program requires is recorded, so no later phase implements an unauthorized decision. **Effort: S.**

| # | Task | Detail |
|---|---|---|
| 0.0 | ~~Stabilize main's gates first~~ **DONE (this branch)** | The four `design-token-discipline` failures were fixed by paying debt down, not re-baselining: `EmptyState.tsx`'s `text-ink/65` → semantic `ink-2`; `StatusBadge.tsx` dropped its 10px override (`.stamp` owns size); `ListingPage.tsx`'s three dialog labels moved to the sanctioned `.stamp-sm` step and a comment no longer quotes the literal alpha pattern. Full suite 2,029 passed / 0 failed; tsc clean; lint within budget. Included in this branch's PR (the session is branch-bound, so a separate main-first PR is not possible from here — this PR carries the fix). |
| 0.1 | Merge this session's specs | PR `arena/01a07fb1-architech` → `main` (7 new design/plan docs, 2 updated, the ingestion-contract code + tests; tsc/lint/vitest verified green in this workspace). |
| 0.2 | v8 amendment A — transport | Per [`waha-transport-assessment.md`](../broker-suite/waha-transport-assessment.md) §8: WAHA-on-NOWEB for the pilot; gowamd the sold-product candidate (conditional on its §9 assessment); Evolution `2.3.7` fallback; record that Evolution `2.4.x` failed review (licensing gate). |
| 0.3 | v8 amendment B — WhatsApp history in CRM | Per the tab design §7: replace §7-rule-5 (minimal markers) with bounded history-in-tenant-DB; keep the §8 gates. |
| 0.4 | v8 amendment C — external lead sources | Adopt the consent-class model (contract §2): portal/aggregator leads are human-first-touch; automated first-touch stays first-party-only. |
| 0.5 | Legal-gate register | Open items with owners: Evolution/WAHA unofficial-transport risk acceptance (canary/pause drills); portal ToS per connector; GPL/AGPL review before *sold* deployments; Meta terms for the opt-in official path; DPDP retention numbers per consent class. |

**Gate to exit Phase 0:** decision log entries exist with reversal triggers; no phase below starts on an unrecorded decision.

## 3. Phase 1 — Dev foundation (the bench)

**Goal:** one reproducible local Frappe site with the pinned stack, and CI for the new repo. **Effort: M.**

| # | Task | Detail |
|---|---|---|
| 1.1 | Create `business_suite_core` repo | `bench new-app business_suite_core` scaffold; README (links to Architech specs); LICENSE (MIT — our own code); `.github/workflows/ci.yml` (pytest, semgrep-lite or ruff, build). |
| 1.2 | Dev environment | `deploy/docker-compose.dev.yml`: MariaDB + Redis + a bench container; `deploy/bench-init.sh` installing the **candidate line pins**: `bench get-app https://github.com/frappe/frappe --branch v16.33.0`, `frappe/crm@v1.83.0`, `frappe/erpnext@v16.34.1` (+ `hrms`/`india-compliance` deferred to Phase 7 profiles). One site `dev.localhost` with CRM + ERPNext + core installed. Per v8 §13 these are *candidates* — the exact-commit lock is recorded in `deploy/pins.md` only after the 1.3 install/migration/rollback proof passes. |
| 1.3 | Same-site integration proof | Configure `ERPNext CRM Settings` (verified doctype: `erpnext_site_url`, api key/secret, `create_customer_on_status_change`); script-test: CRM Deal → ERPNext Customer + Quotation idempotently. |
| 1.4 | Fixtures harness | A `tests/` convention for doctype fixtures + the contract fixtures ported from `src/lib/interop/lead-ingestion.test.ts` (the 11 cases become the Python test matrix). |
| 1.5 | Deploy pinning record | `deploy/pins.md`: every upstream tag + SHA + image digest (the WAHA pin lands in Phase 3). |

**Gate:** `bench start` serves CRM and ERPNext on one site; the Deal→Customer test passes twice in a row (idempotency); CI green on an empty test.

## 4. Phase 2 — `business_suite_core` (the app)

**Goal:** the ingestion contract running inside Frappe: every lead source lands as a contract-conformant CRM Lead. **Effort: L.**

| # | Task | Detail (spec source) |
|---|---|---|
| 2.1 | Contract port | `business_suite_core/ingestion/`: the TS contract mirrored in Python — `LEAD_SOURCES`, `CONSENT_CLASSES`, validation, E.164 (reuse the rules from `interop/phone.ts`), varchar-140 bounds, `ingestIdempotencyKey` (hash-never-truncate). Port the 11 tests. |
| 2.2 | Ingestion API | `POST /api/method/business_suite_core.ingest.lead` (token-auth, per-tenant + per-source) implementing the gateway contract §5: 200/duplicate/422/5xx semantics, poison quarantine, rate limits, audit log. |
| 2.3 | CRM writer + custom fields | Lead creation per contract §6: custom fields (`consent_class`, `sources[]` child table, `dedupe_key`, `provider_lead_id`, budgets, intent/bhk/type, project refs); remarks → FCRM Note; `CRM Lead Source` records provisioned from `LEAD_SOURCES`. |
| 2.4 | Dedupe/merge | Merge on `dedupe_key` (+city scope): multi-valued sources, freshest-fields update, merge event log; negative tests (one number × three portals → one lead, three sources). |
| 2.5 | Routing | Locality→owner mapping table + assignment on create (v8 §6); falls back to the admin queue; never cross-business. |
| 2.6 | Audit + erasure | AuditEvent-style log for every accept/reject/merge; the purge job (consent-class retention defaults 180/90/30) with tombstones; export per lead. |
| 2.7 | Outbox projections | `Architech Integration Log` + idempotency doctype per the sharing design §5.3 — already specified there; implement the receiving endpoint. |

**Gate:** contract test matrix green; the three-portal merge test passes; an erasure drill removes a lead end-to-end; `pnpm test` in Architech still green (no Architech changes yet beyond docs).

## 5. Phase 3 — Transport + WhatsApp tab

**Goal:** the lead/deal WhatsApp tab live on the site, with sends and receives flowing through the Architech gateway. **Effort: L.** Spec: the tab design (Path B) + the transport assessment.

| # | Task | Detail |
|---|---|---|
| 3.1 | WAHA (NOWEB) deploy + topology decision | Pinned `2026.8.2` image digest; hardening: API key on, dashboard off-internet, webhook secret, storage defaults audited (contacts/messages off where possible), CORS restricted. `deploy/waha/` in the core repo. **Topology decision (record it):** one shared WAHA with 2026.7 scoped API keys per tenant, or one WAHA instance per tenant — decide on the isolation/blast-radius vs ops-cost trade-off per the transport assessment's checklist; the pilot starts with the simpler option that still isolates tenants at the API-key level. |
| 3.2 | Gateway module in Architech | New `app/api/gateway/*` routes + worker: outbound send (ownership check → account resolve → WAHA `sendText`), inbound webhook receiver (signature, tenant resolve, suppression/STOP, idempotency on message id), ack/status mapping, **capping/timelock → outbox pause logic** (the assessment's pause-before-ban win). Reuses Prisma + auth guards + audit patterns; follows the existing channel-store/cron precedent. |
| 3.3 | `business_suite_whatsapp` (second app, per §1.1) | New small repo; the four doctypes (`WhatsApp Settings/Account/Message/Templates`) exactly per the tab design §5.1 (WAHA event re-mapping: `message`/`message.any`/`message.ack`/`session.status`); `before_insert` send path; inbound ingest endpoint called by the gateway; roles (`add_roles` equivalent — CRM's own hook won't fire for our app name). Install on the site *alongside* core; document the mutual exclusivity with `frappe_whatsapp` (Path A) — never both on one site. |
| 3.4 | Mobile PWA actions (in `business_suite_core`, per v8 §5/§13) | `Call from SIM` (`tel:` + E.164 — port `waMeLink`/`telLink` from `interop/phone.ts`), `Open WhatsApp`, the post-call result sheet (the seven outcomes), assignment badge/SLA surfacing, mandatory next action. These ride the CRM PWA and do not depend on the whatsapp app, so they land in core. |
| 3.5 | End-to-end wiring | Test number on the company SIM: first-touch ack from a consented lead (Phase 2 lead) → visible in the tab; customer reply → tab realtime + notification; employee native-app reply → thread (`fromMe`); reaction/reply threading; ack badges; reconnect/replay without duplicates. |
| 3.6 | Number lifecycle | Pair/pause/logout/delete flows in the gateway; `session.status` (connection) events → account status → tab flag; ops alert. |

**Gate:** the tab-design §8 event matrix passes on a real number behind feature flags; the §5.2-style ownership negative test (unassigned employee cannot send) passes; disconnect drills work.

## 6. Phase 4 — Lead-source adapters

**Goal:** the pilot business's actual lead sources flowing. **Effort: M** (each adapter is S; sequencing per the portal doc §7).

| # | Adapter | Detail |
|---|---|---|
| 4.1 | Architech/website first-party | The `lead.created` InteropOutbox projection emits contract vocabulary (v1); v8 §9 gaps on that path (encrypted contact, opaque idempotency material) fixed here. |
| 4.2 | CSV import (day one) | Portal-dashboard exports → a small mapper → the ingestion API (`csv-import`, `imported-unknown`); gets the broker's backlog in immediately. |
| 4.3 | Meta Instant Forms | Native `lead_syncing` configured (token, page, IG account, form mapping incl. the WhatsApp-checkbox question) + the `business_suite_core` stamping hook (source/consent/phone-E.164) per [`meta-lead-sources.md`](./meta-lead-sources.md) §1. |
| 4.4 | Click-to-WhatsApp | Company number linked to the Meta portfolio; CTWA ad; verify inbound conversation creates the lead (`whatsapp`, `first-party-form`) and lands in the tab. |
| 4.5 | MagicBricks push | Gateway endpoint `/ingest/property-portal-1` (portal ids are anonymous in code — mapping in contract §1) + the verified payload mapping (contract §7); configure on the MB account; freeze the fixture on first live lead. |
| 4.6 | 99acres | Webhook first; pull worker if the account needs it; fixture freeze. |
| 4.7 | Housing.com | Email-their-team activation for push; Id/secret pull worker; fixture freeze. |
| 4.8 | (Later, horizontal) | IndiaMart, JustDial, TradeIndia, Google Ads, Sheets, email-parse — same contract, sequenced by customer demand (these matter for non-real-estate profiles). |

**Gate:** each adapter's round-trip test on live data; drift alert fires on a fixture change; consent classes correct in the DB (spot-check report).

## 7. Phase 5 — Metrics spine

**Goal:** the dashboard items from the feature lists that are custom. **Effort: M.** Runs parallel to Phase 4.

1. Campaign registry doctype (audience → sends → outcomes) — broadcast itself stays gated (Phase 7 decision).
2. Event aggregation: delivered/read/replies per campaign and per source, on the gateway's event log.
3. Conversion funnels (Lead→Deal→Won by source, city/locality — Architech's registry vocabulary).
4. Source/cost reporting: leads per source, per portal package (the paid-lead accounting input).

**Gate:** the numbers reconcile with a hand-counted week of pilot data.

## 8. Phase 6 — Pilot

**Goal:** one real business (internal first), real numbers, real employees, for at least 4–6 weeks. **Effort: M build + soak time.**

1. Provision the business's site (one tenant), onboarding: users/roles, locality routing, templates, consent texts. **Pilot hosting:** a single VPS running the `deploy/` compose stack (bench site + WAHA + MariaDB/Redis + reverse proxy, TLS via Let's Encrypt), encrypted `restic` backups per the blueprint §8 — the same artifacts Phase 7 will productize; the Architech side (gateway) stays on Railway.
2. Company-owned WhatsApp number(s) via QR pairing; canary period with automated sends off.
3. Enable sources per the business's actual accounts (typically: CSV backlog → Meta → one portal).
4. Drills (v8 §14, adapted): employee exit / lost phone / session revocation; STOP and suppression; two-business isolation (second dummy tenant); backup/restore timed.
5. Weekly review cadence: SLA compliance, first-response times, ban-risk telemetry trends, failure logs.
6. **Success metrics agreed with the business up front** (e.g., median first-response time, % leads contacted within SLA, source-level contact→site-visit conversion, tab adoption by employees) — the pilot is judged against numbers, not vibes.

**Gate (go/no-go to Phase 7):** v8 §14's production gates pass — the negative authorization tests, the event matrix, the lifecycle drill, honest call evidence, and a written pilot report.

## 9. Phase 7 — Productization

**Goal:** the sellable suite. **Effort: L.** Only after Phase 6 passes.

1. **Transport decision re-run:** gowamd §9 assessment (source-level, per the checklist); the `gows-plus` license issue outcome; amend the pin accordingly.
2. **Profiles** (Business Core / Trade / Service / Retail / Light Mfg / Real Estate / India Compliance / HR) as install-time app sets per the v8 §11 table.
3. **Provisioning:** brand-neutral control plane (site/release/provider mapping, backup/restore, health, export) — this is where an infra repo split may become warranted.
4. **Commerce:** Shopify via `frappe/ecommerce_integrations`; the WooCommerce custom adapter; catalog sync (official path).
5. **The broadcast decision:** official-Meta paid profile with per-business billing, consent-gated audiences (coverage mapping §4.1) — a product decision with legal, not a default.
6. **Legal gates close:** GPL/AGPL review for distribution, Meta terms, portal ToS register, DPDP retention sign-off.
7. **Sell the pilot story:** hosting/support contracts per the blueprint §9 (outcomes, not licenses).

## 10. Risk register (top 6)

| Risk | Mitigation |
|---|---|
| WhatsApp bans the company number | Official-path opt-in exists; capping/timelock pause logic; canary numbers; CTWA/consented-only automation |
| Upstream breakage (Meta protocol, portal payload drift, Frappe v17 CRM removal) | Fixture drift alerts; pinned digests; the gateway boundary keeps the transport swappable in days, not weeks |
| 1–2 maintainer upstreams go dormant (WAHA, gowamd, gows-plus) | Watch release cadence quarterly; owned whatsmeow/Baileys gateway is the designed exit |
| Consent/DPDP breach via portal leads | Consent classes enforced at the contract level; human-first-touch default; suppression + erasure drills |
| Scope creep back toward Chatwoot/n8n/flow-builders | The v8 prohibitions stand; every addition is an explicit decision-log amendment |
| Small team overrun | The phase gates force shippable increments: after Phase 3 the family business already has a working CRM+WhatsApp stack |

## 11. Standing guards (what this plan never does)

No scraping (portals or WhatsApp). No direct writes into another repo's database — the insert contract only. No `latest` tags. No n8n in the control plane. No shared inbox. No customer PII in logs, idempotency keys, or outbox payloads. No automated first-touch outside first-party consent classes. No new SaaS dependency without a cost-changing decision.

## 12. Definition of done (program level)

The v8 §14 gates + Phase 6's report + this plan's per-phase gates, auditable from the decision log, the CI history, and the fixture/erasure drill records. When those hold, the business suite is a product; until then it is a well-governed internal system — which is exactly what the pilot needs it to be.
