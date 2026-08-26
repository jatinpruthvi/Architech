# Product Gap Alignment — Architech (Ahmedabad-first, production-grade)

**Date:** 25 Aug 2026  
**Method:** Reviewed the two suggested real-estate checklists against current `main`. Each item is classified:

- ✅ **Implemented** — real data/flow, working.
- 🔧 **Aligned & implemented in this batch** — genuinely missing but market-relevant, deterministic, production-grade (no external accounts).
- 🧩 **Surface vs. gated** — page/contract exists; a live provider/auth/legal is required (deliberately not fabricated).
- ❌ **Rejected** — does **not** align with the production foundation for this product, and is not fabricated.

> **Context that drives most rejections:** this is an **Indian (Ahmedabad)** market, not a US/Canada listing portal. The regulatory source is **Gujarat RERA**, not **MLS/IDX**. The product is a **high-trust discovery platform**, not an escrow/transaction/PM SaaS. Many suggestions (MLS, school ratings, walk score, HOA, escrow, DocuSign, fair-housing) are US-specific or require external data/providers we do not have and should not pretend to have.

---

## What this batch implemented (genuinely missing, market-aligned)

| # | Feature | Workstream | Deliverable |
|---|---|---|---|
| 1 | **Investment analysis metrics** (gross yield, GRM, cap rate, cash-on-cash) | `P1-INVEST-001` | Deterministic `investment/metrics.ts` + `POST /api/investment/metrics` + an illustrative calculator on `/investment`. Pure calculator — never a valuation/advice. |
| 2 | **Price trends by area** (min/median/max price, avg price-per-sqft, availability mix, new-construction count) | `P1-DATA-007` | `realestate/price-trends.ts` + `GET /api/localities/:slug/price-trends` + a derived "Price trends" panel on the locality page. Derived from live facts, never invented. |
| 3 | **Deterministic lead scoring** (hot/warm/cold) | `P1-LEAD-002` | `leads/scoring.ts` + a score badge on the broker lead inbox. Transparent heuristic from structured signals — not a black-box ML model. |

## Aligned (already implemented, no work needed)

| Suggested feature | Where it stands |
|---|---|
| Property listing CRUD, details, gallery | Listing form + moderation + repository + persistence adapter; `Pic` pipeline with WebP/lazy. |
| Search & filters (price, beds, type, amenities) | `/api/search`, multi-select filters (BHK, price, RERA, **availability incl. Ready/New-launch/Resale**), FTS plan, sort, pagination. |
| Map-based search | MapLibre + OSM pins, clusters, list/map sync, search-this-area, no-WebGL fallback. |
| Saved searches / favorites / alerts | Saved-search persistence + `/saved-searches` + saved-homes + `notify` flag. |
| Mortgage / EMI calculator | `/home-loan` educational EMI calculator. |
| Comparison tool | `CompareTray` (side-by-side, 3-4 homes). |
| Agent profiles & reviews | Added last batch — `agent/profile.ts`, `RealEstateAgent` JSON-LD, "Your partner" + rating surface. |
| Agent dashboard / lead management | Agent workspace + moderation queue + broker lead inbox (masked/consent/status/revoke). |
| Admin panel (approve/reject listings, moderation) | Moderation queue + admin listing routes. |
| CMS / guides / blog | Structured guide system, `/blogs`, `/investment`, `/about-us`, `/contact-us`, `/developers`, field notes. |
| Property history & comparable sales | Added last batch — `listing/history.ts`, "Price & history" + same-locality comparables. |
| Listing performance analytics | Added last batch — idempotent views/saves/inquiries via `/api/listings/:id/stats`. |
| SEO (sitemap, schema, meta, OG) | Registry-driven sitemap; schema for `Residence`/`Place`/`Article`/`FinancialProduct`/`WebPage`/`RealEstateAgent`; robots; no-JS raw-HTML smoke. |
| Performance (WebP, lazy, budgets) | WebP derivatives, lazy load, budgets gate. |
| Dark mode, accessibility, i18n, responsive, WAAG | Theme toggle; `axe`/Playwright a11y suite; en/hi dictionaries + `<html lang>` + Devanagari search aliases. |
| Auth roles, 2FA/passkeys (contract), rate-limit, input validation, HTTPS/security headers, data retention, consent-revoke | `better-auth` contract, role guards, mutation-safety (rate limit/payload/origin), security headers, media retention + lead consent-revoke. |

## Rejected — does NOT align with the production foundation (with reason)

| Category | Item(s) | Why rejected |
|---|---|---|
| **Data source not available** | MLS/IDX & RETS/RESO feed | N/A — Indian market uses **Gujarat RERA**; a RERA adapter + provenance workflow already exists. |
| **Data source not available** | School ratings (GreatSchools), walk/transit/bike score, parcel boundaries, flood/fire/earthquake risk, zoning/permits, energy rating (EPC/Energy Star), property-tax records | No accessible feed for the Ahmedabad market; fabricating would break the trust foundation. These belong behind a future data-provision agreement, not fabricated now. |
| **US-specific context** | HOA fees/rules & filter, fair-housing (US), state disclosures (US forms) | Not applicable to the Indian residential market / legal framework being used. (Accessibility/WCAG is already covered separately.) |
| **Transaction/legal providers required** | Offer management, digital signatures (DocuSign/HelloSign), escrow tracking, inspection scheduling, appraisal, closing checklist, document vault, timeline | Require legal approval + provider + buyer auth. **Phase-2 / gated**, not fabricated. |
| **Rental/PM SaaS (out of scope)** | Tenant screening, lease management, rent collection, maintenance requests, move-in/out inspections, 1099/P&L/Schedule E accounting | The product is a buy/resale discovery platform, not a property-management SaaS. Gated/out of scope for Phase 1. |
| **Mobile-app/provider features** | AR view, offline maps, voice search, push geofencing, native mobile app | Require native app or provider SDKs; out of current web-first scope. |
| **Machine-learning infra** | AVM (AI valuation), market price prediction, image recognition, AI chatbot/voice assistant | Need a trained model + data pipeline. Presenting heuristic output as "AI valuation" would violate the trust foundation. (Deterministic assist/explain/compare already exist; I implemented **deterministic** lead scoring and price trends instead, honestly labelled.) |
| **Search needs data/providers** | Polygon/draw search, commute-time search (Google), school-district filter, foreclosure/short-sale filter | Require data feeds (US-market concepts) or Google APIs not applicable/available. |
| **Not applicable** | Currency converter, measurement-unit converter (sqft↔sqm) | The product is INR-only and consistently uses sq ft; adding a converter adds surface without market need. |
| **CRM/marketing/accounting/analytics integrations** | Follow Up Boss, Mailchimp, QuickBooks, Stripe Identity, Mixpanel, Persona, Twilio, SendGrid, Slack, Hotjar, BoomTown, KVCore, LionDesk | Provider accounts + legal/approval required; gated/Phase-2. Not fabricated. |
| **KYC/AML**, **license verification**, **agent license status** | — | KYC/AML needs a provider + legal. **Broker verification** already exists as `VerificationStatus`; agent-license lookup needs a data source. |
| **Advanced admin/business** | Revenue analytics (commission splits), franchise/brokerage white-label, referral network, team splits/multi-office | Require multi-tenant org data + business models; Phase-2. |

## Front-of-mind next steps (production-grade, no external accounts)

1. **Collections with notes on saved homes** (user-level `localStorage` + context + `/collections` page).
2. **Buyer/renter account dashboard** (favorites + saved searches + alerts) once live auth is enabled.
3. **Agent directory** (`/agents` or `/agent/:slug`) surfacing broker profiles + reviews + listings.
4. **Real notification provider abstraction** (email/SMS/push contracts) — gated on provider accounts.

## Blocked on external accounts (not fabricated)
Live Better Auth (2FA/passkeys), R2 media processing, Gujarat RERA live source, Search Console live ingestion, Sentry/log drains, notification delivery, lender pre-qualification, transaction/e-signature/escrow, and final production provisioning.

---

## Validation of this batch
```bash
pnpm check   # tsc
pnpm lint
pnpm test    # 58 files / 274 tests
pnpm build
pnpm test:seo  # 9 routes
pnpm test:perf
pnpm db:validate
pnpm security:audit / ops:audit / release:audit / provisioning:audit
```
