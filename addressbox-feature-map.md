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
