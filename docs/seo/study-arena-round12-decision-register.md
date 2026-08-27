# StudyArena Round 12 feedback decision register

**Author:** Manus AI  
**Review date:** 27 August 2026  
**Scope:** Contestants A–F, supplied as six Markdown feedback files, reviewed against Architech’s Ahmedabad-first codebase and the existing SEO decision register.

## Executive decision

The six responses agree on the same defensible competitive strategy: own Ahmedabad deeply before expanding, prioritize locality and project-level intent over broad national head terms, publish useful original data rather than generic copy, keep important content server-rendered, control faceted crawl paths, and earn authority through real local relationships and data journalism. Architech already implements much of this foundation. This review therefore extends the existing architecture rather than replacing it.

The implementation rule is strict: every recommendation that can be represented truthfully in routes, metadata, schemas, data contracts, quality gates, UI, tests, or governance is accepted or adapted into the codebase. Recommendations requiring real-world accounts, verified third-party data, physical business eligibility, genuine user content, legal review, or earned editorial relationships remain explicit activation gates. Recommendations that encourage scraping, fake reviews, paid links, doorway pages, unsupported claims, or ranking guarantees are rejected.

## Consolidated decisions

| Feedback theme | Decision | Current Architech treatment |
|---|---|---|
| Ahmedabad as one-city beachhead | Keep | Ahmedabad remains the launch market with locality, listing, guide, RERA, calculator, and investment routes. |
| Hyperlocal locality/project/society pages | Adapt | Use the existing route registry and add pages only when verified inventory and unique local evidence support them; do not mass-create empty pages. |
| Programmatic SEO at scale | Adapt | Require a quality gate before indexability: stable canonical, meaningful inventory/data, distinct copy, source/update metadata, and parent/sibling internal links. |
| “Near” pages for schools, transit, and employment hubs | Conditional | The route pattern is code-feasible, but pages remain gated until verified amenity data and original editorial value exist. |
| Price trends, rental yield, and transaction reports | Keep with provenance | Existing trend/metric contracts are extended only with source, period, geography, sample size, methodology, and update date. No fabricated values. |
| Answer-first numeric opener and tables | Keep | Locality and tool surfaces already lead with compact factual summaries and tables; future templates must use the same visible-first structure. |
| Facet whitelist and noindex combinations | Keep | Arbitrary search/filter/sort pages remain `noindex,follow`; the facet contract is tested and canonical policy is preserved. |
| Crawlable pagination and stable property URLs | Keep | Public pages use ordinary HTML links and stable listing URLs; private/search combinations remain non-indexable. |
| Expired, sold, removed, and duplicate listings | Keep | Lifecycle decisions distinguish 200, 301, 404, and 410 behavior; useful expired pages may remain visible with status and alternatives when supported by data. |
| RERA and government source references | Conditional | Existing provenance and correction workflows support this only after official-source verification and correct entity matching. |
| Named authors, credentials, methodology, and update date | Keep | Editorial pages must expose real author/source/methodology metadata; synthetic authors and unsupported credentials are not permitted. |
| Organization, RealEstateAgent, Residence, Offer, ImageObject, VideoObject, BreadcrumbList | Adapt | Emit only when visible, accurate, rights-cleared, and supported by the page. Schema is not treated as a ranking guarantee. |
| FAQPage on every page | Reject blanket rule | Use only for visible, reviewed FAQs that qualify; do not add FAQ markup solely for snippets. |
| Google Business Profile and local pack | External/conditional | Code can expose consistent organization details and governance; claiming a real eligible profile, office, phone, hours, and reviews requires user-controlled activation. |
| Genuine reviews and resident/broker quotes | External/conditional | Accept only consented, moderated, real submissions. Never fabricate, seed, paraphrase as firsthand, or add rating markup without eligible content. |
| Original photos, videos, and floor plans | Conditional | Existing media rights, moderation, EXIF, takedown, and storage contracts are the required gate before public use. |
| Original reports and data journalism | Keep with gate | Authority/outreach registry, methodology documentation, and disclosure records are code-supported; publication and journalist relationships are external work. |
| Paid links, PBNs, bulk directories, expired-domain redirects, scraped listings | Reject | These are outside acceptable Architech quality, policy, or provenance boundaries. |
| Lighthouse 90+ or guaranteed rankings | Reject as promises | Use field Core Web Vitals, route budgets, indexed useful pages, qualified impressions, and leads as measurable outcomes. |
| Google Search Console, GA4, YouTube, GBP, journalists, associations | External activation | The codebase has contracts, privacy gates, and documentation; real account setup, uploads, outreach, and consent require user-controlled credentials and relationships. |
| Calculators for EMI, stamp duty, affordability, and yield | Keep with safeguards | Existing investment and ownership tools remain educational, transparent about assumptions, and non-personalized. Legal/financial review is external. |
| Massive launch batches such as 500–3,000 pages | Reject as a fixed quota | Architech uses quality-gated, evidence-backed expansion rather than a page-count target. |

## Code-covered implementation checklist

Architech now has, or has been extended with, the following controls: Ahmedabad-first route hierarchy; stable canonical builders; server-rendered public pages; lifecycle-aware listing indexability; truthful listing and locality JSON-LD; noindex faceted search; deterministic sitemap freshness; source and RERA provenance; trust signals; media rights and moderation contracts; named editorial/source concepts; authority/outreach governance; price-trend and investment metric contracts; private buyer collections; broker draft lifecycle operations; and regression suites for these contracts.

The remaining safe extension point is the **quality-gated page registry**. A locality, project, landmark, or tool page may become indexable only when the page has a stable canonical, approved status, meaningful unique content, current source metadata, a valid parent link, and enough verified data to justify its existence. Pages that do not pass remain useful to users but are `noindex,follow` and excluded from XML sitemaps.

## External-only activation gates

The feedback correctly identifies activities that cannot be completed by code alone: registering and maintaining a real Google Business Profile; collecting genuine reviews; obtaining official government/IGR/RERA data access; publishing rights-cleared video; obtaining professional legal or financial review; connecting live GSC/GA4/Sentry/R2/Better Auth providers; building relationships with builders, societies, media, associations, and journalists; and revoking the previously exposed GitHub token. These are documented as activation tasks rather than falsely marked complete.

## References

The source files for this register are `studyarena-round12-contestant-a.md` through `studyarena-round12-contestant-f.md` in `/home/ubuntu/upload/`. The implementation also follows the primary Google guidance already recorded in `seo-recommendation-decision-register.md`: [1] [2] [3] [4].

[1]: https://developers.google.com/search/docs/fundamentals/seo-starter-guide "Google Search Central: SEO Starter Guide"
[2]: https://developers.google.com/search/docs/essentials/spam-policies "Google Search Central: Spam Policies"
[3]: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data "Google Search Central: Introduction to Structured Data"
[4]: https://developers.google.com/search/docs/appearance/core-web-vitals "Google Search Central: Core Web Vitals"
