# WhatsApp transport — full repository survey and assessment

**Date:** 08 Sep 2026 (expanded same-day from the WAHA-focused assessment after a full-landscape sweep)
**Status:** Findings and recommendation. **Not a decision.** A transport change amends the v8 component selection ([`decision.md`](./decision.md) §2, [`modular-platform-selection.md`](../business-suite/modular-platform-selection.md) §1) through the governance change procedure. This document is the evidence base.
**Trigger:** An external comparison recommending WAHA over Evolution API (sourced from a hosted-WhatsApp-API vendor's marketing blog, `wahttp.com/blog/evolution-api-alternative`), followed by a request to sweep **every** available repository before selecting. Every load-bearing claim was verified against primary sources — cloned source, GitHub API metadata (stars, license detection, push dates, contributors), and official changelogs — per [`upstream-repo-checkout-guide.md`](./upstream-repo-checkout-guide.md).
**Correction to the earlier revision of this document:** the initial WAHA assessment stated "license is now clean — plain Apache-2.0, GOWS included." That was wrong at the engine-binary level and is corrected in §3.1. The file keeps its original name (`waha-transport-assessment.md`) to preserve cross-references; its scope is now the whole landscape.

**Verified sources (all cloned or API-checked today):**

| Repo | Ref / state | Role |
|---|---|---|
| `devlikeapro/waha` | `2026.8.2` (01 Sep 2026), HEAD cloned | Apache-2.0 **core**; NestJS server; 3 engines; capping/timelock telemetry |
| `devlikeapro/gows-plus` | `v1.0.46`, public source, **no license file** | The GOWS engine binary WAHA's Dockerfile downloads at build (`Dockerfile:94-96`, SHA-pinned) |
| `devlikeapro/Baileys` | fork of `WhiskeySockets/Baileys`, **MIT inherited**, pushed 31 Aug 2026 | The engine library WAHA's NOWEB actually pins (`github:devlikeapro/Baileys#fork-master-2026-04-28` in `package.json`) — license-clean, but WAHA-maintained, not upstream |
| `aldinokemal/go-whatsapp-web-multidevice` | `v9.3.0` (29 Aug 2026; five releases in August), 4,725★ (GitHub API, re-verified 08 Sep — third-party trackers showing ~2.1k are stale), HEAD cloned | MIT; Go/Fiber REST server on a **same-day whatsmeow snapshot** (`go.mau.fi/whatsmeow v0.0.0-20260904121843`); ships a built-in Chatwoot module (`src/infrastructure/chatwoot`) and has a community n8n node (`@aldinokemal2104/n8n-nodes-gowa`, v3.2.0) |
| `evolution-foundation/evolution-api` | `2.3.7` and `2.4.0-rc2`, both cloned | NOASSERTION license (Apache-2.0 text + brand conditions); `2.4.0-rc2` contains `src/licensing/` activation gate + 30-min heartbeat; the separate `evolution-api-lite` repo is archived (last push Mar 2025) |
| `wppconnect-team/wppconnect-server` | `v2.10.19` (07 Sep 2026), HEAD cloned | Apache-2.0 server over the LGPL-3.0 `@wppconnect-team/wppconnect` Puppeteer engine |
| `open-wa/wa-automate-nodejs` | HEAD cloned | `LICENSE.md` is the **Hippocratic H-DNH 1.1** license, contradicting its own `package.json` (Apache-2.0) |
| Libraries (API-checked, not cloned) | — | `WhiskeySockets/Baileys` 10,976★ MIT (latest `v7.0.0-rc14`, 29 Jul 2026); `tulir/whatsmeow` 7,252★ MPL-2.0, pushed 04 Sep 2026 (actively maintained — a claim that it went dormant in May 2026 was checked and is false); `wwebjs/whatsapp-web.js` 22,530★ Apache-2.0; `vynect/venom` 6,579★ Apache-2.0 |

---

## 0. Direct answer (after the full sweep)

**No single winner yet — a two-track recommendation with a clear leader:**

1. **Primary candidate: `aldinokemal/go-whatsapp-web-multidevice` (gowamd).** MIT-licensed end to end, the freshest protocol layer of *every* candidate (it tracks whatsmeow at a same-day snapshot; the 2026 tctoken/463 fixes live in whatsmeow), Go single-binary efficiency, a real multi-device session manager, webhooks with secrets, basic auth. It needs a hardening pass (three default-on settings violate our pin/privacy discipline, §3.2) and the §8 source-level assessment.
2. **Conditional candidate: WAHA (engines WEBJS/NOWEB only).** Operationally the most mature server — monthly releases, three engines, scoped API keys, and the **only** ban-risk telemetry endpoints (message capping, reachout timelock). But its headline engine, **GOWS, is blocked**: the binary ships from `devlikeapro/gows-plus`, which has **no license** (§3.1). WAHA+GOWS becomes the recommendation again if/when the author adds a license — that is one upstream issue/PR away, and we should file it.
3. **Evolution `2.3.7` stays the assessed, frozen fallback** (no upgrade path: `2.4.x` requires licensing-server activation, verified in source).

The vendor blog's conclusion (WAHA, for a Chatwoot+n8n stack this project rejected) does not survive contact with v8's license gates once the engine binary's origin is checked — which is exactly why the repo verifies in source rather than trusting comparisons.

## 1. Scope and tiers

The transport need (v8 §2, §7): a self-hosted REST server managing multiple company-owned WhatsApp sessions per business, sending the consented first-touch acknowledgement, streaming inbound/outbound/status events to the private gateway, behind our boundary — never the CRM, never a shared inbox.

| Tier | Meaning | In scope here? |
|---|---|---|
| A. Self-hosted REST API servers | The transport itself | **Yes — primary comparison** |
| B. Protocol libraries | Build-your-own transport | Yes — the v8-named fallback ("an owned pinned Baileys gateway") |
| C. Official Meta Cloud API wrappers | The official path | No — that is Path A of [`frappe-crm-whatsapp-tab-integration.md`](./frappe-crm-whatsapp-tab-integration.md), served by `frappe_whatsapp` |
| D. Hosted/commercial APIs | Per-message SaaS | No — excluded by v8 §12 hosting-only baseline |

## 2. The full landscape (everything found, September 2026)

### 2.1 Tier A — self-hosted REST servers

| Candidate | License (verified) | Engine / architecture | Activity (GitHub API, 08 Sep) | Sessions | Ban-risk telemetry | Verdict |
|---|---|---|---|---|---|---|
| **WAHA** (`devlikeapro/waha`) | Apache-2.0 (core repo) | 3 engines: WEBJS (forked whatsapp-web.js, Chromium), NOWEB (**WAHA's MIT-licensed Baileys fork** — `devlikeapro/Baileys#fork-master-2026-04-28`, pushed 31 Aug 2026 — not upstream Baileys), GOWS (whatsmeow binary from unlicensed `gows-plus`) | `2026.8.2` 01 Sep; pushed 01 Sep; 7,350★; 2 real contributors (devlikepro 1,663, allburov 668) | Multi | **Yes, on all three engines** — `GET /api/sessions/{s}/capping` and `/timelock` (verified in source: `src/core/abc/capping.ts` documents the same payload shape across "GOWS gRPC event, NOWEB Baileys fetch/push, WEBJS injected fetch/local read", and `session.noweb.core.ts` implements both) | **Conditional** — NOWEB is license-clean and keeps full telemetry; GOWS blocked pending upstream license (§3.1) |
| **gowamd** (`aldinokemal/go-whatsapp-web-multidevice`) | MIT (LICENCE.txt, verified) | whatsmeow at a **same-day snapshot**; Go + Fiber; single binary; SQLite default | `v9.3.0`; pushed 04 Sep; 4,725★; 1 primary maintainer (541 commits) + small contributors | Multi (device manager, `device_id`-scoped routes) | None exposed (whatsmeow has the APIs underneath; exposing = fork/PR) | **Primary candidate** |
| **Evolution API** (`evolution-foundation/evolution-api`) | NOASSERTION — Apache-2.0 text + brand-protection conditions (v8 §12 already flags this) | Baileys `7.0.0-rc.9` (Dec 2025); optional official Meta Cloud mode | Stable `2.3.7` 05 Dec 2025; `2.4.0-rc2` 17 May 2026; pushed 14 Jul; 9,560★; org-backed | Multi | None | **Frozen fallback** — `2.4.x` adds licensing-server gate (verified, §5.1) |
| **wppconnect-server** (`wppconnect-team/wppconnect-server`) | Server Apache-2.0; engine lib `@wppconnect-team/wppconnect` is **LGPL-3.0** | Puppeteer/Chromium per session | `v2.10.19` 07 Sep (three releases that day); pushed 07 Sep; 1,050★ (server repo; lib 3.4k★); most human contributors of any candidate (bgastaldi 273, icleitoncosta 211, rodriguesabner 109) | Multi (manager) | None | **Conditional third** — LGPL dependency review + per-session Chromium resource cost |
| **open-wa** (`open-wa/wa-automate-nodejs`) | **Hippocratic H-DNH 1.1** in `LICENSE.md`, contradicting `package.json`'s Apache-2.0 → GitHub NOASSERTION | Puppeteer | Pushed 01 Sep; 3,651★ | Library + server modes | None | **Disqualified** — non-OSI license restricting use by business category, plus an internal license contradiction; unreviewable risk for a sold product |
| **waxum** (`imtaqin/waxum`) | **No license at all** | Rust | Pushed 31 Aug; 111★ | — | — | **Disqualified** — no license = all rights reserved |
| **venom** (`vynect/venom`, moved from orkestral) | Apache-2.0 | Puppeteer | Pushed 10 Aug; 6,579★; last stable reportedly Nov 2024 | Library, not a server | None | Rejected for this tier — library; wrapper required; Chromium cost |
| **sulla** | — | Old venom fork | Dormant | — | — | Dead |
| MultiWA (`ribato22/MultiWA`), Whatomate (`shridarpatil`), OpenWA (`rmyndharis`) | MIT / AGPL-3.0 / MIT | QR gateways | Inspected 02 Sep 2026 in [`open-source-ecosystem-evaluation.md`](./open-source-ecosystem-evaluation.md) §6.7 | — | — | Already rejected: "channel infrastructure, not CRMs… ban and compliance risk" |

### 2.2 Tier B — protocol libraries (the build-your-own fallback)

| Library | License | State | Note |
|---|---|---|---|
| `tulir/whatsmeow` | **MPL-2.0** | 7,252★, pushed 04 Sep, very active (mautrix author) | The Go protocol implementation **where the 2026 tctoken/reachout fixes landed**; the engine inside gowamd and WAHA GOWS. An owned whatsmeow gateway is the clean-license escape hatch, at the cost of building the HTTP/session/webhook layer ourselves |
| `WhiskeySockets/Baileys` | MIT | 10,976★, pushed 06 Sep; `v7.0.0-rc13` (May 2026) | The Node protocol implementation (Evolution NOWEB, WAHA NOWEB). Perpetual RC versioning — pins must be commit-based. This is the "owned pinned Baileys gateway" v8 already names as the strict-license fallback |
| `wwebjs/whatsapp-web.js` | Apache-2.0 | 22,530★ (most starred in the field), pushed 06 Sep | Library only; single session per process; Puppeteer — resource cost. Not a transport server |
| `@wppconnect-team/wppconnect` | LGPL-3.0 | Active | The engine lib under wppconnect-server |
| `whatsapp-mcp` | — | 5,884★ | An MCP server for AI agents, not a message transport — out of scope |

### 2.3 Tier C/D — excluded by design

- **Official-Meta wrappers** (`pywa`, `heyoo`, `alright`, OpenBSP, Whatomate's Meta side): they serve Path A (`frappe_whatsapp`), not the unofficial transport decision. Also: `frappe_whatsapp`'s own transport *is* the official path.
- **Hosted/commercial APIs** (WasenderAPI, WaHttp, Green API, Twilio, 360dialog, Universal API, Meta Cloud itself): excluded by the v8 §12 hosting-only baseline — no mandatory per-message/seat/vendor payment. The source of the WAHA-vs-Evolution comparison we reviewed is itself one of these vendors, which is why its claims were re-verified rather than trusted.

## 3. The findings that decided the ranking

### 3.1 WAHA's GOWS engine ships an unlicensed binary (corrects this document's earlier revision)

Verified today: WAHA's Dockerfile (lines 94–96) downloads the GOWS engine at image-build time from `devlikeapro/gows-plus` releases (`wget …/releases/download/${GOWS_SHA}/gows-${ARCH}`), and the built image copies it in (`COPY --from=gows /go/gows/bin/gows /app/gows`). The `gows-plus` repository publishes full Go source and SHA-pinned binaries (`v1.0.46`: `gows-amd64`, `gows-arm64`, `gows.proto`) — but contains **no license**: GitHub's license detection returns `None`, a recursive tree scan finds no `LICENSE`/`COPYING`/`NOTICE`, and a code search for "license" returns zero items. Under default copyright, that is all-rights-reserved.

Consequences:
- The WAHA *core* (NestJS server, WEBJS/NOWEB wrappers, dashboard) is genuinely Apache-2.0 — using WAHA with **NOWEB or WEBJS** is license-clean (NOWEB's Baileys is MIT).
- The engine carrying WAHA's headline advantages — low RAM, tctoken currency, keepalive tuning, and the resource story the vendor blog sold — is the one component that **fails v8 §12 license review** for a sold deployment.
- This is fixable upstream: file an issue (or PR adding Apache-2.0/MIT) on `gows-plus`. If the author licenses it, WAHA+GOWS returns to the top of the matrix. Until then, "WAHA is pure Apache-2.0" (the vendor blog's claim, which this document initially repeated) is true only of the wrapper, not the shipped engine.

### 3.2 gowamd is the freshest, cleanest full server

`aldinokemal/go-whatsapp-web-multidevice` pins `go.mau.fi/whatsmeow v0.0.0-20260904121843` — a snapshot of whatsmeow from the same week as this survey. Since the 2026 protocol tightening (tctoken lifecycle, 463 reachout-timelock handling) was fixed in whatsmeow itself (see WAHA issues #2050/#2166, fixed in GOWS by porting whatsmeow's work), gowamd rides those fixes directly — no other server tracks the protocol this closely. It is MIT throughout, a single Go binary (the same resource class as GOWS), manages multiple devices (`GetDeviceManager`, per-`device_id` routes, per-device Chatwoot webhooks if ever needed), exposes basic auth, webhooks with a shared secret, and has a documented 49KB README.

Its hardening gaps for our discipline (all config-level, verified in `src/ops/config/settings.go`):
1. **The web UI auto-downloads at runtime** from GitHub releases (`AppUIAutoUpdate = true`, optional `AppUIAssetSHA256` pin) — a supply-chain hole under v8's immutable-digest rule. Disable or pin+mirror.
2. **MCP endpoint is enabled by default** (`McpEnabled = true`) — disable.
3. **Media auto-download is on by default** (`WhatsappAutoDownloadMedia = true`) — a privacy/retention violation for our consent model; disable.

None of these are structural; all three are settings. What gowamd *lacks* vs WAHA: no REST ban-risk telemetry (capping/timelock — would be a small fork or upstream PR; whatsmeow carries the diagnostics underneath), a smaller community (4.7k★ vs 7.3k★, though third-party trackers under-reporting it at ~2.1k are stale), one primary maintainer, and a plainer operational story (no scoped API keys à la WAHA 2026.7, no three-engine hedge). Exposing whatsmeow's capping/timelock diagnostics would be a small fork or upstream PR — which is also an argument for contributing rather than wrapping.

Two corrections from an external review of this document, both validated in source on 08 Sep: gowamd **does** ship a built-in Chatwoot integration (`src/infrastructure/chatwoot`, with registered webhook handlers in `src/cmd/rest.go`) — the claim that it "requires manual webhook wiring" is wrong, though WAHA's Chatwoot module remains far more mature (a dedicated app with per-event consumers); and it has a community **n8n node** (`@aldinokemal2104/n8n-nodes-gowa`, latest 3.2.0). whatsmeow itself is actively maintained (pushed 04 Sep 2026) — an external claim that it went dormant in May 2026 was checked and is false, which keeps the "freshest protocol layer" argument for the whatsmeow family intact.

### 3.3 Deployment context changes which gates bind (internal pilot vs sold product)

The gates above are written for the **sold business suite** (v8 §12's resale context). For an **internal pilot** — one family business, self-hosted, nothing distributed to customers — the binding set shrinks:

| Gate | Sold product | Internal pilot |
|---|---|---|
| License chain (gows-plus, Hippocratic, no-license repos) | Hard blocker | Relaxed but not void: running an unlicensed published binary privately is low practical risk, yet MIT/Apache alternatives exist (WAHA NOWEB, gowamd), so there is no reason to accept gray-zone licensing at all |
| No vendor payment / activation server | Hard | Hard (it is a cost property, not a distribution property) |
| Ban risk / number loss / consent / DPDP suppression | Hard | **Hard — does not relax.** These protect the company's WhatsApp number and customer data, not the product |
| Private-gateway boundary, scoped keys, no internet exposure | Hard | Hard (simpler topology, same boundary) |
| Immutable digest pinning, source review depth | Full assessment | Pin the version; full review can follow the pilot |

The architecture (gateway, `business_suite_whatsapp` adapter, one site per business) is identical in both contexts; only the review depth before go-live differs.

### 3.4 Two candidates disqualified on licenses alone

- **open-wa**: its `LICENSE.md` is the **Hippocratic License H-DNH 1.1** — a non-OSI license that prohibits use by categories of organisations — while its `package.json` claims Apache-2.0. The contradiction alone (what governs?) makes it unreviewable for a product we sell to arbitrary local businesses.
- **waxum** (the Rust "500 sessions in 20MB" newcomer): **no license file at all.**

Both are exactly the trap v8 §12 exists to catch: a compelling feature story wrapped in an unusable license.

## 4. Verification of the original WAHA-suggestion claims

(Kept from the earlier revision; still the evidence base for WAHA's capabilities.)

| Claim | Verdict | Evidence |
|---|---|---|
| WAHA 2026.8.1 message-capping endpoint (`GET /api/sessions/{s}/capping`, `me.messageCapping`) | ✅ | Official changelog #2186 |
| WAHA 2026.8.1 reachout-timelock endpoint (all engines; GOWS refreshes on 463) | ✅ | Official changelog #2219 |
| GOWS keepalive interval config for proxy-reaped tunnels | ✅ | Changelog + config docs |
| GOWS Go/RAM advantage (~512 MB vs 1.5–2 GB) | ⚠️ Direction only | Vendor-sourced figures; unbenchmarked — hypothesis for §8 |
| "Pure Apache-2.0" | ❌ **As corrected** | Core yes; GOWS binary no (§3.1) |
| Three engines, all in the free image since 2026.6.1 | ✅/⚠️ | Free yes (2026.6.1 announcement); "all Apache-2.0" no |
| Monthly releases vs Evolution's frozen stable | ✅ | Release metadata (§2.1) |
| Evolution's edge: official Meta Cloud drop-in | ✅ | Confirmed; WAHA has none (source grep) |
| "Evolution has no equivalent" telemetry | ✅ | Source grep, 2.3.7 and 2.4.0-rc2 |
| "For your stack (Frappe CRM + Chatwoot + n8n)" | ❌ Wrong premise | v8 removed Chatwoot; n8n is "not the control plane" and unnecessary at launch |

## 5. What changed since the v8 assessment

1. **Evolution `2.4.x` requires external license activation.** Verified in `2.4.0-rc2` source: `src/licensing/runtime.ts` installs gate middleware before all business routers, registers license routes, and heartbeats Evolution Foundation's server every 30 minutes. The v8 prohibition of `2.4.x` pending review is now a completed review with a negative result: no upgrade path from the `2.3.7` pin (stable frozen since 05 Dec 2025; Baileys `7.0.0-rc.9`).
2. **WhatsApp tightened the unofficial path in 2026** (463 `NackCallerReachoutTimelocked`, message capping on new-contact messaging, tctoken/privacy-token requirements). This lands exactly on our critical workflow — the **first-touch acknowledgement to a newly submitted lead**. whatsmeow carries the fixes; servers tracking whatsmeow (gowamd; WAHA GOWS if licensed) inherit them; frozen Baileys-RC servers (Evolution `2.3.7`) do not.
3. **WAHA's licensing model resolved** — fully free since 2026.6.1, but with the §3.1 engine-license caveat attached.

## 6. Decision matrix (finalists, against v8 constraints)

| v8 requirement | gowamd | WAHA (NOWEB) | WAHA (GOWS) | wppconnect-server | Evolution 2.3.7 | Owned whatsmeow/Baileys gateway |
|---|---|---|---|---|---|---|
| Clean, sold-product-safe license | **MIT** ✅ | ✅ Apache core + **MIT Baileys fork** | ❌ **unlicensed binary** | ⚠️ LGPL engine review | ⚠️ brand conditions | ✅ (MPL review for whatsmeow / MIT Baileys) |
| No vendor payment / activation server | ✅ | ✅ | ✅ | ✅ | ✅ (2.4.x ❌) | ✅ |
| Protocol currency (tctoken/463) | **Best** (same-day whatsmeow) | ⚠️ WAHA's own Baileys fork (Apr-2026 base, actively pushed 31 Aug) — not upstream | ✅ (whatsmeow port) | ⚠️ browser automation | ❌ frozen Dec 2025 | ✅ (track whatsmeow/Baileys directly) |
| Ban-risk telemetry (pause-before-ban) | ❌ (fork/PR needed) | **✅ capping + timelock verified on NOWEB** (§2.1) | ✅ | ❌ | ❌ | ❌ (build it) |
| Resource footprint (cost-sensitive hosting) | ✅ Go single binary | ⚠️ Node (lighter than Evolution: no PG/Redis required) | ✅ | ❌ Chromium/session | ⚠️ Node + Redis/PG stack | ✅ |
| Multi-session lifecycle per business | ✅ device manager | ✅ | ✅ | ✅ | ✅ | Build it |
| Ops maturity (docs, keys, dashboard, releases) | ⚠️ basic (built-in Chatwoot module, n8n node exist) | **✅ best-in-class** | ✅ | ✅ | ✅ | ❌ build it |
| Bus factor | ⚠️ 1 maintainer | ⚠️ 2 | ⚠️ 2 | ✅ most humans | ✅ org | Ours |
| Official Meta path on same box | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

The official Meta path column no longer decides anything: Path A (`frappe_whatsapp` on the CRM site) is its own separately-gated home — Evolution's drop-in Meta mode stopped being a reason to stay the moment that design landed.

## 7. Risks (honest statement)

1. **Every candidate is a 1–2 maintainer project.** gowamd's author could exit the same way Evolution's foundation pivoted to licensing. Mitigation: the gateway boundary keeps the transport swappable by design; whatsmeow/Baileys underneath are larger, healthier projects; and the libraries are the build-your-own floor.
2. **The two leading candidates fail different gates.** gowamd lacks telemetry; WAHA's best engine lacks a license. Choosing means accepting one known gap and working it (§8) rather than waiting for a perfect option that does not exist.
3. **Vendor-published performance figures remain unbenchmarked** — the RAM claims for GOWS-class engines go into §8 as measurements, not facts.
4. **Browser-engine options (WEBJS, wppconnect, venom, whatsapp-web.js)** are architecturally more resilient to some protocol changes (they run the real web client) but pay per-session Chromium — the opposite of our cost-sensitive multi-session-per-VPS model.
5. **Supply-chain defaults vary.** gowamd's runtime UI download and MCP/media defaults (§3.2) must be locked down; WAHA's image build downloads the GOWS binary from releases (fine when pinned, fatal when unlicensed).

## 8. Recommendation and next actions

**Two deployment contexts, two answers** (the contexts are defined in §3.3):

**A. Internal pilot (one business, self-hosted, nothing distributed):** **WAHA on the NOWEB engine** is the pragmatic first deploy. Validated in source: NOWEB rides WAHA's MIT-licensed Baileys fork (actively pushed), **both** ban-risk telemetry endpoints work on NOWEB (capping payload shape is engine-uniform per `src/core/abc/capping.ts`), and WAHA is a single container with a dashboard and Swagger — the fastest safe starting point. gowamd is an equally license-clean alternative if Go efficiency or protocol freshness matters more than the dashboard. Either way:

- **Skip Chatwoot for the pilot.** It was removed from this architecture for exactly this scale of operation (v8 §4: another deployment, login, data copy and reconciliation path); employees use normal WhatsApp plus the Frappe CRM PWA, and the CRM's per-lead/deal WhatsApp tab (fed by the transport through the `business_suite_whatsapp` adapter) is the single conversation surface. Add Chatwoot later only if a shared-inbox requirement is proven.
- **There is no native WAHA↔Frappe-CRM wiring.** The WhatsApp tab needs the adapter design in [`frappe-crm-whatsapp-tab-integration.md`](./frappe-crm-whatsapp-tab-integration.md) §5 regardless of transport — WAHA's `message`/`message.ack`/`session.status` events replace the Evolution mapping, and the capping/timelock endpoints plug into the gateway's send-pause logic. That adapter, not the transport choice, is the critical-path build.
- The suggested "later, swap WhatsApp source in Chatwoot settings" upgrade path only upgrades a Chatwoot inbox; the CRM tab's official path is `frappe_whatsapp`/Meta (Path A), a separate, already-designed integration.

**B. Sold product (the business suite):** the ranking stands — gowamd primary, WAHA conditional, Evolution frozen.

1. **Adopt gowamd as the primary candidate** for the unofficial WhatsApp transport in the next v8 amendment, **conditional on** the §9 source-level assessment passing, with the §3.2 hardening configuration as part of the pin (UI auto-update off, MCP off, media auto-download off, basic auth on, webhook secret on). WAHA-on-NOWEB is the close second and the documented fallback if the gowamd assessment fails.
2. **File the license issue on `devlikeapro/gows-plus`** (and offer the PR). If GOWS becomes Apache-2.0/MIT, re-run the matrix: WAHA+GOWS then beats both on ops maturity and Go efficiency, and the amendment should pick it instead. Record both outcomes in the decision log so the choice is auditable either way.
3. **Plan a small upstream contribution either way:** exposing whatsmeow's capping/reachout-timelock diagnostics as REST endpoints (gowamd PR) buys the pause-before-ban signal that only WAHA currently has — on whichever server wins.
4. **Evolution `2.3.7` remains the assessed fallback**; log that `2.4.x` failed review (licensing-server gate, §5.1).
5. **The owned whatsmeow/Baileys gateway stays the v8-named exit** if strict licensing or supply-chain demands ever rule out every third-party server.

### 9. Assessment checklist for the pinned candidate (mirrors the Evolution assessment's depth)

1. Clone at the exact release tag; record HEAD SHA and image digest; pin both; verify the Dockerfile's supply chain end to end (for WAHA: including the `gows` binary provenance; for gowamd: confirming the UI is not auto-downloaded in our image).
2. Security posture: auth model (basic auth / API keys / scoped keys), dashboard & Swagger exposure, webhook authentication, CORS, default binds; apply the Evolution §5 non-negotiables (no key exposure to browsers/apps; transport not internet-exposed; the gateway authorizes).
3. Storage defaults per engine: sessions, contacts, messages, media — default-off equivalents and the exact env matrix.
4. First-touch drill on a company-owned test number: new-contact send; tctoken behaviour; observe 463/timelock; confirm capping/timelock reporting (WAHA today; gowamd post-PR or via a temporary fork).
5. Benchmarks: RAM per session, reconnect/keepalive behind the production proxy topology, session stop/restart cleanliness, event latency (worker→send P95 ≤ 1 s target, v8 §7).
6. Event-mapping parity table for `business_suite_whatsapp` (the CRM tab contract is transport-agnostic): send results, inbound, status/ack, session lifecycle, and the employee-native-reply case.
7. Privacy: erasure coverage in the transport's stores; what "delete session" removes; retention configuration.
8. License review at the pinned digest, re-confirmed on every upgrade (this survey's §3 findings are the cautionary examples).

## 10. What this changes in sibling documents

- [`frappe-crm-whatsapp-tab-integration.md`](./frappe-crm-whatsapp-tab-integration.md) §5.3 — the event mapping is written against Evolution; re-map to the selected transport's events (WAHA's are listed in its transport note; gowamd's follow whatsmeow's event shapes). No CRM-side change.
- [`evolution-api-adoption-assessment.md`](./evolution-api-adoption-assessment.md) — status note already records the `2.4.x` ceiling; its credential/lifecycle/consent/idempotency/canary gates remain normative for **whichever** transport is pinned.
- [`decision.md`](./decision.md) §2 row "WhatsApp transport/control" — the amendment replaces the Evolution `2.3.7` pin with the assessed winner of §8, same gates, same private-gateway boundary.
