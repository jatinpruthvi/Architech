# Addressbox feature mapping for Architech

## Product direction

Addressbox demonstrates a broad Ahmedabad/Gandhinagar marketplace: category-led discovery, search by locality/project/developer, project and property rails, developer/partner discovery, requirement capture, post-property conversion, investment content, and programmatic SEO clusters. Architech will adopt these capabilities while preserving its own Amdavad Modern visual language, evidence-first trust model, Ahmedabad launch scope, and Google-first crawlable URLs.

| Observed capability | Architech destination | Phase-1 treatment | Live-service gate |
|---|---|---|---|
| Buy / rent / residential / commercial / PG / plot / land / bank auction categories | Search route and homepage discovery bar | Implement URL-synced category and transaction controls, with honest empty states for categories without verified inventory | Live inventory import is pending |
| Locality, project, developer search | Home search and `/search/` | Extend query matching to project/developer/category vocabulary and preserve shareable URLs | Search index/database population is pending |
| Trending and top-rated project rails | Home page and future project index | Implement curated, evidence-labeled project rail using Architech-owned fixture metadata | Partner/project feed is pending |
| Requirement capture / zero-brokerage lead form | Sitewide requirement drawer plus `/requirements/` | Implement validation, consent, rate-limit-safe POST contract, and clear confirmation state | Production CRM/email/WhatsApp routing is pending |
| Post property | Existing `/list-property/` and broker onboarding | Preserve and strengthen the current seller funnel | Auth, media storage, and moderation credentials are pending |
| Developer and locality directories | `/developers/` plus existing locality hubs | Add crawlable directory pages and internal links using only verified/illustrative labels | Verified developer dataset is pending |
| Investment opportunity | `/investment/` editorial entry point | Add an evidence-based investment lens page without financial recommendations | Legal/editorial approval is pending |
| Blogs, news, and intent clusters | Existing `/guide/` editorial hub | Add category and locality cross-links, not thin duplicate pages | Editorial production workflow is pending |
| Floating “tell us your requirement” conversion affordance | Header/home/listing pages | Add accessible drawer/modal with mobile-safe presentation | Lead delivery provider is pending |
| Partner logos and brokerage claims | Trust/methodology surfaces | Replace copied third-party logos and unverifiable claims with Architech evidence modules | Partner agreements are pending |

## Authenticated agent parity mapping

| Addressbox agent capability | Architech treatment | Gate or safety rule |
|---|---|---|
| Dashboard KPIs and quick actions | Unified protected Agent Workspace at `/broker/dashboard` and `/broker/agent/` | Counts are zero or derived from Architech drafts; no fabricated deals, calls, or testimonials |
| My Inquiry, follow-up, and all leads | Agent Workspace inquiry section with filter/table contract | Real inquiries require persisted lead source, consent, and organization scoping |
| Subscription and entitlements | Explicit Entitlements section with provider-gate messaging | No payment or paid plan claims in Phase 1; Stripe/payment activation remains separate |
| My, newspaper, agent, and owner inventory | Separate source-aware inventory sections with provenance labels and honest empty states | Import only approved inventory; contact data stays protected |
| AI Voice Call and analytics | AI Suite section with voice capability card and metrics contract | Provider, consent, retention, and usage budget required; no calls are launched during inspection |
| AI Property Video Studio | AI Suite section with media workflow card | Storage, moderation, generation provider, and subscription entitlement required |
| Bulk messages and custom chatbot | AI Suite gated capability cards | Messaging provider, opt-out, reply audit, and budget required |
| Bank auctions and property tenders | Dedicated source-specific sections with deadline/provenance field contracts | Source documents and legal/editorial review required; not ordinary listings |
| Shortlisted and contacted properties | Durable workflow sections and existing saved/lead contracts | Persist events with account/organization scope and consent audit |
| Manage requirements and profile | Agent Workspace requirements/profile sections and existing secure APIs | Authenticated ownership, deletion/revocation, and privacy controls required |
| Five-step Post Property wizard | Existing broker listing flow remains the creation path; Agent Workspace links to it | Per-step validation, draft persistence, media moderation, and publish review required |

## Implementation guardrails

No Addressbox branding, wording, project cards, logos, or imagery will be copied. Any counts or inventory claims will remain clearly labeled as demo/illustrative until sourced. New URLs will be canonical, indexability-aware, and linked from crawlable parent pages. Requirements will not be submitted during inspection or verification; tests will use invalid local values or controlled fixture requests only.

## Full public surface audit

The Addressbox homepage confirms these public capability families: contact header, requirements capture, investment-opportunity handoff, post-property CTA, residential/commercial/PG-co-living/plot/land/bank-auction category tabs, buy/rent intent, city selector for Ahmedabad/Gandhinagar, locality/project/developer autocomplete, category/property-type search, recent-search chips, personal property manager, zero-brokerage and verified-listing claims, partner/developer logo rails, trending projects, commercial property rails, locality rails, owner-property rails, developer directory rails, short-form/video content, and a persistent tell-us-your-requirement rail. The footer also exposes company, contact, legal, buy/sell/rent, home-loan, sitemap, blogs, requirements, feedback, social, and mobile-app download destinations.

Architech already covers the high-value public equivalents with Ahmedabad-first routes for buy/search, listing details, locality and city guides, developers, investment, requirements, list-property, saved homes/searches, privacy/terms, and trust/RERA methodology. The remaining parity work is to make the public discovery controls and content rails visibly equivalent while keeping third-party partner claims, inventory counts, and external investment handoffs behind verified-source and legal gates.

Addressbox’s About page adds an explainer/FAQ surface, a business-partner conversion, and a public “list property” CTA. Its Contact page adds address, phone, email, and a contact form with first name, last name, mobile number, email, and message. Architech should provide equivalent trust and contact surfaces, but use owned Ahmedabad contact details only when approved and route enquiries through the existing consent/rate-limit/audit contract rather than copying Addressbox contact data.

The Home Loan route adds a lead form for name, mobile, email, amount, whether a property is finalized, captcha, and consent; a four-step “how it works” explainer; a lender partner rail; and an interactive EMI calculator with loan amount, tenure, interest rate, EMI, interest, and payable-total outputs. Architech can safely implement an educational EMI calculator and a clearly labeled eligibility enquiry form, but lender rates, partner logos, financial recommendations, and application handling require verified commercial partners, current disclosures, consent, and legal review.

The public Review route is a feedback capture form with a required five-star rating, name, mobile number, optional email, optional narrative review, and submit action. Architech must not seed or invent reviews, ratings, or testimonials. It may expose an honest feedback form only when a persisted moderation and privacy contract exists, and public review display must remain empty until real consented submissions are approved.

The Blogs route is an editorial index with a large chronological feed of article cards, date labels, images, and READ MORE actions focused on Ahmedabad/Gandhinagar locality, property-type, rental, buying, metro, and investment queries. Architech’s existing guide hub covers the same authority intent more safely; a `/blogs/` compatibility route should point users to the editorial hub and expose only Architech-owned, reviewed articles rather than manufacturing a large thin archive.

The HTML sitemap is a major crawlable hub with BUY/RENT and Ahmedabad/Gandhinagar controls, residential/commercial/plot clusters, property type, BHK, budget, ready-to-move/new-property, locality, project, and developer links. The property-search route then provides a search input, Property Type, Localities, Posted By, Budget, Sale Type, BHK, More Filters, sort order, result count, pagination, property/project cards, RERA/source badges, brochure actions, and contact-builder/agent actions. Architech’s `/search/` and `/sitemap.xml` cover the base contract but need an HTML `/sitemap.html` hub and route aliases for high-intent property-search URLs; all result counts and source labels must remain derived from verified inventory or clearly empty.

The rent route confirms that parity must preserve a distinct rent intent, rental-specific metadata such as monthly rent, furnishing, property age, floor, preferred tenant, and agent contact, plus contextual Post Property, Home Loan, EMI Calculator, and requirement-capture actions. Architech should use the same reusable search model for buy and rent while keeping transaction intent in the URL and not mixing rental results with sale inventory.

The project-detail dossier includes breadcrumbs, project/developer/location identity, share and shortlist controls, Contact Builder, Book a Visit, Brochure, media/gallery with Request for Image, structured project facts, RERA registration, available sizes and price bands, address/description, map and nearby places, floor-plan entries, amenities, related video, developer performance, and recommended properties. Architech’s listing dossier already has evidence and contact foundations; parity requires route aliases and careful field-level provenance so a missing image, price-on-request value, or unverified RERA record is represented honestly rather than filled with a placeholder claim.

## Implemented public parity pass

Architech now exposes About, Contact, Home Loan, Feedback, HTML Sitemap, and `/blogs/` compatibility destinations. The public footer and a compact More entry in the header link these surfaces. `/blogs/` redirects to the owned `/guide/` hub to avoid thin duplicate editorial pages. `/property-search/*` and `/property/*` compatibility routes translate Addressbox-style buy/rent/category paths into Architech’s existing URL-synced `/search/` flow with Ahmedabad/Gandhinagar intent preserved.

The Home Loan surface includes a live educational EMI calculation for principal, tenure, rate, interest, and total payable; it does not claim lender eligibility or advice. Contact and Feedback preserve the interaction model but remain non-transmitting preview gates until approved inbox, moderation, consent, and retention providers are activated. The homepage review-like testimonial rail was replaced with a truthful evidence/feedback explanation; no invented reviews, ratings, or testimonials are displayed.

The remaining parity gates are real inventory/search indexing, persistent contact/feedback/eligibility storage, approved lender integrations, authenticated broker persistence, media/brochure delivery, Gujarat RERA synchronization, and production privacy/legal approval. These are provider or governance requirements, not missing UI routes.


## Minimum parity audit and open-source research — August 2026

The minimum Addressbox-equivalent surface is implemented in Architech: Ahmedabad-first buy/rent/category discovery; locality/project/developer search vocabulary; project/listing dossiers; saved homes and saved searches; requirements capture; list-property and staged broker listing flow; contact and feedback entry points; educational home-loan EMI calculator; blogs compatibility redirect to owned field notes; HTML sitemap; public About and Contact routes; and the authenticated agent workspace covering inquiries, leads, entitlements, source-aware inventory, AI-gated tools, bank auctions, tenders, shortlist/contact history, requirements, profile, and listing submission. The application preserves explicit empty states and source/provenance labels instead of presenting unverified inventory as live fact.

The remaining items are not missing UI routes: persistent production contact/feedback/eligibility delivery, live inventory/search indexing, lender integrations, Better Auth production sessions, media/brochure storage, Gujarat RERA synchronization, messaging/AI providers, and legal/privacy approvals remain activation gates. These must be connected only after credentials, consent, retention, moderation, and source governance are approved.

A GitHub scan identified useful reference candidates but no asset repository should be imported automatically. `eevan7a9/real-estate-management` is Apache-2.0 and active enough to study property-manager/buyer workflows; `AHMAD-JX/Hozn-RealEstate-Fullstack`, `nainemom/melkmap`, and `RealEstateWebTools/property_web_scraper` are MIT-licensed and provide possible references for marketplace structure, price visualization, or data tooling. The scraper repository is not approved for production use because source-site terms, consent, provenance, and rate limits must be reviewed independently. `ahzamkidwai/Modern-Real-Estate-Marketplace` exposes useful feature taxonomy but its license still requires direct verification before any reuse. No third-party code or imagery was copied into Architech; current imagery remains Architech-owned/generated or otherwise managed through the existing asset workflow.
