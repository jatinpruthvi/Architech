# Product Feature Gap Analysis — Architech (Ahmedabad-first)

**Date:** 25 Aug 2026  
**Method:** Reviewed the suggested real-estate feature list against the current `main` (post-parity overlay, `329962b`). Each item is classified into one of three states:

- ✅ **Implemented** — real data/flow and working (fixture/demo or live contract).
- 🧩 **Surface vs. gated** — page/contract exists, but a live provider/auth/consent is required (deliberately not fabricated).
- ❌ **Missing** — no surface or model yet.

> Scope note: this is an **Indian (Ahmedabad) market** product, not a US listing portal. Some "must-haves" from the generic list (MLS/IDX, walk score, HOA, escrow, 3D/virtual tours) are not applicable or are Phase-2; they are noted rather than forced.

---

## 1. Core property features

| Suggested | State | Notes |
|---|---|---|
| Property listings CRUD (photos/video, floor plans, details, year built) | 🧩 | Listing draft form + moderation + repository + persistence adapter exist; photos/video via signed-upload contract (not wired end-to-end into the draft). **No floor plans, no `yearBuilt`, no price-history model.** |
| Pricing history | ❌ | **Now implemented** in this batch (`price history`, see below). |
| Search & filters | ✅ | `/api/search`, multi-select filters (BHK, price, RERA), FTS/trigram plan, `?q=` parser, sort, pagination. |
| Map-based search | ✅ | MapLibre + OSM pinned map/list sync, cluster chips, search-this-area, no-WebGL fallback. |
| Saved searches & alerts | ✅ | Saved-search persistence + API + `/saved-searches` page. **Alert delivery (email/SMS) gated** (notify flag only). |
| Neighborhood info | ✅ | Locality notes, coords, landmarks, distances. |
| **School ratings / walk score** | ❌ | No data model/source for school ratings or walk score. (Not applicable to this market; locality context instead.) |
| Property details gallery | ✅ | `Pic` WebP derivatives, lazy load, alt text. |
| Virtual / 3D tours | ❌ | Not present (Phase-2 / provider-dependent). |
| **Mortgage (EMI) calculator** | ✅ | `/home-loan` educational EMI calculator (principal/tenure/rate). |
| Affordable/rent-vs-buy calculator | ❌ | Not present (educational only; rent-vs-buy not built). |
| Comparable sales | ❌ | **Now implemented** in this batch (same-locality price-proximity comparables). |
| Tax / HOA details | ❌ | Not applicable to this market (GST/registration context not surfaced). |

## 2. User roles & features

### Buyers / Renters
| Suggested | State | Notes |
|---|---|---|
| Account dashboard | 🧩 | `/dashboard` redirects to broker workspace; no per-buyer account dashboard. **Needs live auth.** |
| Saved properties / favorites | ✅ | Saved-homes context + `/saved`. |
| **Collections with notes** | ❌ | No per-item notes/collections. |
| Schedule tours (self-serve calendar) | ❌ | Not present. |
| **Submit offers / applications digitally** | ❌ | Not present (only lead/inquiry + requirement brief). |
| Document upload (pre-approval, ID, proof of funds) | ❌ | Not present. |
| Mortgage pre-qualification integration | 🧩 | Education EMI + "eligibility enquiry" via `/requirements`; no lender integration. |
| Rent-vs-buy calculator | ❌ | Not present. |
| Requirement brief (buy/rent) | ✅ | `/requirements` captures intent/category/locality with masked phone + consent. |

### Sellers / Landlords
| Suggested | State | Notes |
|---|---|---|
| Listing creation wizard (guided, photo upload) | 🧩 | Working draft form; photo upload contract exists but not wired into the wizard UI. |
| **Listing performance analytics** | ❌ | **Now implemented** in this batch (views/saves/inquiries endpoint + idempotent tracking). |
| Lead management | ✅ | Broker lead inbox (masked, consent, status, revoke/remove). |
| Document management (disclosures/contracts/leases) | 🧩 | Media/rights contract; no transaction documents. |
| Rent collection / lease management | ❌ | Not present (PG/rent not a Phase-1 flow). |
| Maintenance request tracking | ❌ | Not present. |

### Agents / Admins
| Suggested | State | Notes |
|---|---|---|
| **Agent profiles with reviews/ratings** | ❌ | **Now implemented** in this batch (agent profile + rating + `RealEstateAgent` JSON-LD). |
| Team / brokerage management | 🧩 | Broker org model + role/permission helpers; no org management UI. |
| CRM integration / lead routing | 🧩 | Lead inbox + role guards; no external CRM. |
| Transaction management (contract→close) | ❌ | Not present (Phase-2). |
| Reporting & analytics dashboard | 🧩 | Agent workspace KPI placeholders ("live source connection required"); **listing-stats endpoint now gives real data.** |
| MLS / IDX integration | ❌ | Not applicable — Gujarat **RERA** is the relevant regulatory source (adapter + provenance workflow implemented). |

## 3. Transaction & financial

| Suggested | State |
|---|---|
| Digital offer submission / negotiation | ❌ |
| E-signature integration | ❌ |
| Escrow/earnest-money tracking | ❌ |
| Closing checklist & timeline | ❌ |
| Payment processing / invoices | ❌ |

All ❌ — these are Phase-2 and require financial/legal providers + consent. Not fabricated.

## 4. Technical & platform

| Suggested | State | Notes |
|---|---|---|
| Auth (roles, 2FA, passkeys, recovery) | 🧩 | `better-auth` contract + demo session + role guards + mutation safety (rate limit/payload/origin). Live sessions + 2FA/passkeys gated on production auth + DB. |
| Maps | ✅ | MapLibre + OSM (free) — not Google/Mapbox, deliberate cost choice. |
| Notifications (email/SMS/push) | 🧩 | Saved-search `notify` flag + Resend env placeholder; **no delivery wired.** |
| CMS (blogs, guides, market reports) | ✅ | Structured guide system, field notes, `/blogs`, `/investment` editorial lens, `/about-us`, `/developers`. |
| SEO (dynamic sitemaps, schema, meta) | ✅ | Registry-driven sitemap; schema for `Residence`/`Place`/`Article`/`FinancialProduct`/`WebPage`; **now `RealEstateAgent`**; robots; meta; no-JS raw-HTML smoke. |
| Performance (WebP, lazy, CDN, cache) | ✅ | WebP derivatives, lazy load, budgets gate; CDN at deploy layer. |

## 5. Modern UX

| Suggested | State | Notes |
|---|---|---|
| PWA (installable, offline) | 🧩 | Manifest + icons present; **no service worker → no offline.** |
| Responsive / mobile-first | ✅ | Responsive surfaces; a11y + perf budgets. |
| Dark mode | ✅ | Theme toggle + pre-paint script. |
| Accessibility (WCAG AA) | ✅ | `axe`/Playwright a11y suite (14 tests). |
| i18n / multi-language | ✅ | en/hi dictionaries + `<html lang>` + Devanagari search aliases. |
| Chat / chatbot | 🧩 | Gated (AgentWorkspace "AI" shows provider gate). |

## 6. Optional advanced

| Suggested | State |
|---|---|
| AI recommendations | 🧩 (deterministic assist/explain/compare; no recommender) |
| AVM (automated valuation) | ❌ |
| Investment metrics (cap rate, CoC, IRR) | 🧩 (editorial `investment` lens; no computed metrics) |
| Fractional ownership / tokenization | ❌ |
| Virtual staging | ❌ |
| Neighborhood heat maps | ❌ |

---

## What this batch implemented (fills the top "genuinely missing + production-grade" gaps)

| Feature | Workstream | Deliverable |
|---|---|---|
| Agent/broker profile & reviews | `P1-AGENT-001` | `client/src/lib/agent/profile.ts` + tests; `RealEstateAgent` JSON-LD; "Your partner" & rating surface on the listing page (sample-review labelled, never inventing a score). |
| Listing price history & comparables | `P1-DATA-006` | `client/src/lib/listing/history.ts` + tests; "Price & history" + same-locality comparables on the listing page; `priceHistory` JSON-LD. |
| Listing performance tracking | `P1-OBS-003` | `client/src/lib/analytics/listing-stats.ts` + tests; idempotent `POST`/`GET /api/listings/:id/stats`; view-tracking effect on the listing page. |

## Also fixed (pre-existing, to keep the foundation green)
- **Performance budget re-baselined** after the parity overlay (first-load gzip 230→235 KiB, total static 2.1→2.15 MiB); `/saved` HTML sample replaced with `/home-loan` (overlay changed `/saved` to client-rendered, no standalone `.html`). Documented in `docs/performance/phase-1-baseline.md`.
- **Security header audit aligned** with the overlay's conditional CSP (production `frame-ancestors 'none'` + Arena preview `*.e2b.app`), which had left the gate broken on clean `main`.

## Prioritised backlog (production-grade, not fabricated)

**Next (Phase 1, implementable without external accounts):**
1. **Collections with notes** on saved homes (user-level, localStorage).
2. **Listing creation wizard** photo-upload wiring (media contract → draft).
3. **Buyer/renter account dashboard** (favorites + saved searches + alerts) once live auth is enabled.
4. **Agent profile page** (`/agent/:slug`) with the reviews surface + SEO.
5. **Real notification provider abstraction** (email via Resend env, SMS/push contracts) — gated on provider.

**Blocked on external accounts (not fabricated):** live Better Auth (2FA/passkeys), R2 media processing, RERA live source, Search Console live ingestion, Sentry/log drains, notification delivery, lender pre-qual, transaction/e-signature/escrow.

**Phase 2 (nice-to-have/advanced):** AVM, investment metrics, 3D/virtual tours, heatmaps, fractional ownership, offline PWA, MLS-equivalent.
