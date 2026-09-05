# Architech Non-Payment Functionality Audit

**Prepared for:** Architech Ahmedabad-first launch  
**Scope:** Compare the three supplied real-estate functionality checklists with the current Architech implementation.  
**Explicit exclusion:** Payment processing, subscriptions, rent collection, escrow payments, invoices, receipts, commission billing, and payment-management screens are excluded from the product scope.

## Executive assessment

Architech is not missing the basic discovery foundation described in the attachments. The current application already has Ahmedabad-locality discovery, URL-synchronized search, reviewed property-type and availability facets, map/list presentation, public listing detail pages, saved homes, saved searches, requirements capture, broker onboarding, listing drafts, media rights capture, moderation, RERA provenance, masked lead handling, broker lead replies, an agent workspace, bilingual controls, structured SEO surfaces, sitemaps, guides, and security controls.

The largest remaining gaps are not generic real-estate features imported from the US. They are operational completeness gaps around **editing and managing broker listings**, **richer Ahmedabad property metadata**, **public broker discovery**, **notification delivery**, **buyer organization of saved homes**, and **transparent inventory/media workflows**. Several attached items should not be added because they are US/Canada-centric, require unverified third-party data, create legal risk, or are unnecessary for an Ahmedabad-first broker marketplace.

## Current coverage map

| Capability from attachments | Current Architech status | Assessment |
|---|---|---|
| Public property listings and detail pages | Implemented through public listing, locality, city, guide, and search routes | Keep and continue enriching with verified data |
| Broker listing creation | Implemented through `/broker/listings/new`, draft validation, source packet readiness, media rights, and moderation submission | Strong foundation; edit/resume/delete remains incomplete |
| Property CRUD | Create and read are implemented; moderation lifecycle exists; complete edit/delete/archive UI is not yet exposed | **High-value gap** |
| Property status | Draft, in-review, active, sold, expired, removed, duplicate, and archived lifecycle contracts exist | Keep; expose safe broker/admin actions where authorized |
| Photos and videos | Rights-aware signed-upload contract, local preview, provider-aware completion, attach/detach, EXIF policy, derivatives, moderation, takedown, and deletion exist | Strong pipeline; gallery ordering and floor-plan/video presentation need completion |
| Virtual tours and 360-degree media | No dedicated public viewer or reviewed media kind/presentation | Phase 2; do not block launch |
| Floor plans | No dedicated floor-plan upload/display experience | **High-value Ahmedabad listing gap**, can reuse media moderation |
| Search and filters | Query, Ahmedabad localities, buy/rent, categories, BHK, price, RERA, property type, availability, map/list, sort, URL synchronization, and suggestions exist | Strong; baths, amenities, area range, parking, and furnishing are missing |
| Saved homes/favorites | Implemented with saved homes UI and device persistence | Keep; collections and private notes are missing |
| Saved searches | Implemented with API and managed page | Delivery alerts are not connected to live email/SMS/push |
| Recent searches | Not identified as a durable user-facing feature | Medium-value gap; implement locally first |
| Buyer accounts | Session/auth contracts and saved-search routes exist, but live Better Auth activation is pending | Activation gate plus profile completion |
| Agent profiles | Broker organization and agent workspace contracts exist; a complete public agent directory/profile surface is not evident | **High-value gap** |
| Contact agent/inquiry | Implemented with consent, masked phone, idempotency, broker inbox, replies, deletion, and audit trail | Strong; **notification pipeline now lands** (lead event spine + Resend-gated dispatch, PII-free copy, per-recipient idempotency) — actual sending stays provider-gated per the providers section |
| Direct agent chat | Not implemented; current model is structured lead inquiry and reply | Phase 2; keep structured inbox first for safety and auditability |
| Tour scheduling/open-house calendar | Not implemented as a real calendar workflow | Phase 2; start with request-a-tour lead intent, not calendar integration |
| Offers/applications/contracts/e-signature | Not implemented | Phase 3 and legal/provider gated; not required for discovery launch |
| Map-based discovery | Implemented with synchronized map/list and locality context | Keep; draw/polygon search is later |
| Nearby places | Locality landmarks and contextual map information exist; live POI categories are limited | Phase 2 using reviewed source data |
| Street View/commute/geolocation | Not implemented as dedicated flows | Phase 2/3; external-data and privacy gates apply |
| Mortgage/home-loan calculator | Home-loan route exists | Add affordability and rent-vs-buy only if calculations are clearly labelled as estimates |
| Compare properties | Compare context and AI compare endpoint exist | Keep; add a more explicit public compare surface if user testing shows need |
| Agent/admin operations | Agent workspace, broker dashboard, leads, listings, moderation, RERA, media, requirements, and authority/outreach surfaces exist | Strong Phase 1 foundation |
| Listing analytics | Operational observability exists, but broker-facing views/saves/inquiry analytics are limited | **High-value broker gap** |
| CMS/content | Guides, blogs compatibility route, locality/city/RERA guide surfaces, and sitemap exist | Strong SEO foundation; editorial CMS workflow remains partly manual |
| SEO and AI-search readiness | Canonicals, registry, metadata, JSON-LD, sitemap, HTML sitemap, crawlable guides, indexability gates, raw HTML smoke tests, and source-aware copy exist | Strong; continue adding verified content rather than generic pages |
| Security/accessibility | Auth guards, organization scoping, rate/request controls, consent, validation, headers, keyboard checks, axe public smoke, and reduced-motion support exist | **Broker-route axe coverage added** (`pnpm test:a11y:broker` — guarded desk routes scanned on the Next runtime with the preview demo hatch; verifies real content renders past the session gate before scanning). 2FA/CAPTCHA remain external-provider gaps tied to §4 auth go-live |
| Mobile responsiveness, dark mode, bilingual UI | Implemented and visually verified | Keep; PWA/offline/native app are not launch requirements |

## Functionality that should be added

| Priority | Recommended addition | Why it matters for Ahmedabad launch | Suggested phase |
|---|---|---|---|
| P0 | Resume, edit, duplicate, archive, and safely delete broker drafts before review | A listing workflow is incomplete if brokers must restart after correcting price, locality, media, or rights evidence | Phase 1 |
| P0 | Public broker/agent directory and profile pages with verified organization, locality coverage, active listings, response expectations, and contact controls | Builds trust and creates crawlable authority pages without fabricating ratings or testimonials | Phase 1 |
| P0 | Richer listing facts: bathrooms, parking, furnishing, floor, total floors, possession date, amenities, project/developer, and media roles | The attachments correctly identify property detail depth as important; these fields are more relevant to Ahmedabad than MLS/HOA fields | Phase 1 |
| P0 | Dedicated media gallery roles for primary image, gallery image, floor plan, site plan, video, and document-preview metadata | Architech already has rights/moderation contracts; the missing piece is an understandable public and broker presentation | Phase 1 |
| P1 | Broker performance panel for views, saves, inquiries, response time, and listing freshness | Makes the agent workspace operationally useful without payment features | Phase 1/2 |
| P1 | Saved-home collections and private notes | The supplied checklist calls for favorites with notes; this directly improves buyer decision-making and does not require payment | Phase 1/2 |
| P1 | Recent searches and explicit alert preferences | Search saving exists, but users need to see and manage their search history and alert intent | Phase 1/2; delivery providers are a gate |
| P1 | Inquiry intent taxonomy: ask a question, request a call, request a visit, request floor plan, request price update | Provides useful tour/contact behavior without prematurely building a calendar or chat system | Phase 1 |
| P1 | Public FAQ, methodology, locality evidence, and market-report content workflow | Supports Google-first and AI-readable authority while keeping claims source-backed | Phase 1/2 |
| P2 | Nearby POI layers, commute estimates, parcel boundaries, and draw-on-map search | Valuable later, but dependent on reviewed geodata, performance budgets, and privacy decisions | Phase 2 |
| P2 | Request-a-tour scheduling with broker availability windows | More suitable than full self-serve booking for a small Ahmedabad broker network | Phase 2 |
| P2 | Document vault for non-payment listing evidence and buyer documents | Requires storage, retention, access-control, malware scanning, and legal review | Phase 2/3 |
| P2 | AI recommendations, lead prioritization, image tagging, and natural-language search expansion | Existing AI contracts provide a safe boundary, but production use requires consent, budgets, grounding, and evaluation | Phase 2 |
| P3 | Offers, digital signatures, transaction timelines, escrow, inspection/appraisal, lease management, tenant screening, maintenance, AR, native app, and white-label brokerage tools | These are transaction/property-management products, not necessary for an Ahmedabad-first discovery and broker-operations launch | Phase 3 or separate product |

## Items to explicitly reject or defer

The MLS/IDX/RETS/RESO requirements in the attachments are primarily US/Canada-oriented and do not map cleanly to Architech’s Gujarat RERA and broker-provenance model. They should not be added as a generic “must-have.” The correct future integration is a reviewed Gujarat inventory/RERA/developer/broker feed contract with field-level provenance.

School ratings, crime scores, tax records, HOA rules, flood/fire scores, energy ratings, and parcel data should not be copied from US property portals. They may become Ahmedabad locality-data modules only when a reliable, legally usable, reviewed source is selected. Until then, Architech should prefer verified distances, landmarks, RERA evidence, source dates, and clearly labelled locality notes.

Agent reviews and ratings must not be fabricated or seeded. If introduced later, they require genuine authenticated user feedback, moderation, anti-abuse controls, disclosure, and a removal process. Until then, use verified organization status, source coverage, response time, active inventory, and audit-backed trust signals.

Payment features are excluded entirely. This includes online payments, subscriptions, premium placement purchases, application fees, deposits, rent collection, invoices, receipts, escrow payment tracking, commission billing, and payment-management screens.

## Recommended next implementation slice

The highest-value non-payment slice is a **Broker Listing Operations Completion** package: add draft resume/edit/duplicate/archive/delete actions, enrich the listing form with Ahmedabad-relevant facts, make media roles visible in the packet and public gallery, and add structured inquiry intents for visit/floor-plan/call requests. This package improves broker conversion, listing quality, search facets, structured data, and operational safety without requiring a payment provider or unverified external dataset.

The second slice should be **Trustworthy Broker Discovery**: public organization and agent profiles, locality coverage, active inventory, source-review status, response-time evidence, and crawlable profile metadata. It should deliberately avoid ratings, reviews, testimonials, and unsupported performance claims.

The third slice should be **Buyer Organization and Alerts**: saved collections, private notes, recent searches, and alert preferences. Delivery through email, SMS, WhatsApp, or push should remain behind explicit provider and consent gates.

## Decision

Architech does not need every item in the supplied checklists to be competitive. It already covers the discovery and trust foundation better than the generic MVP lists imply. The genuine missing functionality is concentrated in **listing operations, rich Ahmedabad-specific property facts, broker discovery, media presentation, buyer organization, notification delivery, and measurable broker analytics**. Payment features should remain excluded exactly as requested.
