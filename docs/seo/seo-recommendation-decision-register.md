# Architech Google-First SEO Recommendation Decision Register

**Author:** Manus AI  
**Review date:** 27 August 2026  
**Scope:** Contestants A, B, C, E, and F from the supplied StudyArena round-11 SEO documents, compared with Architech’s current codebase and Google Search Central guidance.

## Executive decision

The five documents converge on a strong strategy: Ahmedabad-first topical depth, verified property and locality data, crawlable server-rendered pages, disciplined faceted navigation, accurate structured data, local authority, and measurable technical quality. Architech should retain that strategy. The main changes are not rejections of the core ideas; they are guardrails that prevent doorway pages, unsupported claims, duplicate inventory, fabricated reviews, invalid structured data, and misleading performance promises.

Google’s own guidance confirms that SEO is about helping Google crawl, index, and understand useful content, not finding a secret ranking shortcut [1]. It recommends descriptive URLs, logical topical organization, unique and current people-first content, relevant links, and duplicate-URL control [1]. Google’s spam policies make scaled content abuse, doorway pages, hidden text, keyword stuffing, link spam, and cloaking unacceptable [2]. Structured data must describe visible content and should favor fewer complete and accurate properties over incomplete markup [3]. Core Web Vitals should be measured at the 75th percentile using LCP, INP, and CLS rather than a generic Lighthouse score [4].

## Decision legend

| Decision | Meaning for Architech |
|---|---|
| **Keep** | Implement or preserve as stated, subject to normal validation. |
| **Adapt** | Keep the goal, but change the mechanism to fit Ahmedabad, truthful data, Google policy, or the current application architecture. |
| **Conditional** | Implement only when the required verified source, consent, rights, moderation, or production data exists. |
| **Reject** | Do not implement because the recommendation creates a clear policy, quality, privacy, security, or measurement risk. |

## Cross-document recommendation review

| Theme | Sources | Decision | Architech treatment |
|---|---|---|---|
| Start with one city wedge | A, B, C, E, F | **Keep** | Ahmedabad remains the launch wedge. Expansion is gated on useful coverage and qualified organic demand rather than a calendar date. |
| Win hyperlocal long-tail intent | A, B, C, E, F | **Keep** | Build locality, project, landmark, BHK, budget, rental, and RERA-intent pages only where inventory and supporting information are genuinely useful. |
| Clean hierarchical URLs | A, B, E, F | **Keep** | Continue using `/buy/ahmedabad/`, locality, guide, listing, developer, and tool paths with trailing-slash canonical policy. |
| Project and society pages | B, C, E, F | **Adapt** | Add project pages when Architech has verified project identity, RERA/source records, current inventory, and distinct editorial/data value. Do not mass-create empty society pages. |
| Programmatic SEO | A, B, C, E, F | **Adapt** | Use a controlled page registry and quality gates. A generated page needs distinct data, useful copy, internal links, a stable canonical, and a reason to exist. No location-name substitution pages. |
| Index every filter combination | A, C | **Reject** | Arbitrary combinations create thin and duplicate pages. Keep filters crawlable for users but noindex them until a qualified-intent gate proves demand, stable inventory, unique supporting content, and a clean URL. |
| Selectively index valuable facets | A, B, E, F | **Keep** | Implement a future qualified facet gate, not blanket indexing. Minimum inventory, search demand, unique content, stable URL, and canonical ownership must all pass. |
| Noindex filter/sort/pagination URLs | A, B, C, E, F | **Adapt** | Use HTML `noindex,follow` and canonical rules for non-indexable states. Do not rely on `robots.txt` disallow for pages where Google must see the noindex directive. Pagination policy must preserve legitimate crawl paths. |
| Canonicals for duplicate listings | A, B, C, E, F | **Keep** | Maintain one canonical page per property/unit where possible; consolidate duplicate broker submissions or mark duplicates as non-indexable. Never canonicalize unrelated pages to the homepage. |
| Expired listing handling | A, B, E, F | **Keep** | Preserve useful sold/expired pages with visible status and alternatives when they have continuing value; use 301 only for a genuinely equivalent replacement and 410 when no useful page remains. |
| Locality data and price trends | A, B, C, E, F | **Conditional** | Publish only sourced, methodologically documented numbers with sample size, period, geography, and update date. Never invent sold prices, appreciation, rent, distances, or reviews. |
| Original local photography | A, C, E | **Conditional** | Use only owned, licensed, partner-authorized, or user-uploaded media with rights metadata and moderation. Keep captions and alt text factual. |
| Resident reviews | A, B, C, E, F | **Conditional** | Accept genuine consented reviews after moderation and retention controls. Never seed, fabricate, summarize as if firsthand, or add Review/AggregateRating schema without eligible genuine content. |
| RERA registration and verification | A, B, C, E, F | **Conditional** | Show registration data and official links only when verified through an approved source and attached to the correct project/listing. Keep correction and freshness history visible. |
| Local expert authors and bylines | A, B, C, E, F | **Keep** | Use named, real contributors with role, credentials, locality expertise, editorial responsibility, and correction path. Do not create synthetic author identities. |
| Organization / RealEstateAgent schema | A, B, C, E, F | **Conditional** | Keep Organization and appropriate agent/provider entities when the visible page supports them and identity data is real. Do not add office addresses, RERA IDs, or service areas before activation. |
| RealEstateListing / Residence / Apartment schema | A, B, C, E, F | **Keep** | Continue accurate JSON-LD for visible listing facts. Treat schema as semantic assistance, not a rich-result guarantee. Validate output and omit unknown fields. |
| FAQPage schema | A, B, C, E | **Conditional** | Use only for visible, editorially approved FAQs that qualify under Google’s current feature guidance. Do not add FAQ markup to manufacture snippets on every page. |
| BreadcrumbList and ItemList | A, B, C, E, F | **Keep** | Keep breadcrumbs on public routes and ItemList on genuine collection pages. Ensure URLs are absolute where schema consumers require them. |
| VideoObject and ImageObject | A, B, C, E | **Conditional** | Add only for real videos/floor plans with rights, duration, thumbnail, visible placement, and accurate metadata. |
| Google Business Profile | A, C, E, F | **Adapt** | Create a profile for each eligible staffed customer-facing location, with consistent real-world details. Do not create duplicate neighborhood profiles for one office or pretend to have local offices. |
| Original reports and linkable data assets | A, B, C, E, F | **Keep** | Build Ahmedabad price/rent/yield/RERA methodology assets when source data supports them. Publish methodology, scope, sample size, limitations, and update history. |
| Local editorial and partner links | A, B, C, E, F | **Keep** | Pursue relevant, voluntary citations from local media, universities, builders, societies, architecture sites, and associations. Record provenance and disclosures. |
| Guest posts / directory links | A, B, C, E, F | **Adapt** | Editorial partnerships may be useful, but no paid ranking links, bulk directories, PBNs, reciprocal link schemes, or optimized anchor campaigns. Qualify sponsored/paid links correctly. |
| Map Pack as a local advantage | A, C, E | **Adapt** | Local visibility is useful, but it depends on a real eligible business, accurate profile, and genuine reputation. It is not guaranteed and should not drive duplicate profiles. |
| SSR / SSG / ISR | A, B, C, E, F | **Keep** | Next.js server-rendered and statically generated public pages remain the foundation. The current raw-HTML SEO smoke suite protects this. |
| Image WebP/AVIF, dimensions, lazy loading | A, B, C, E, F | **Keep** | Continue responsive optimized images, explicit dimensions, eager loading only for likely LCP media, and lazy loading below the fold. Verify with field data. |
| PageSpeed score 90+ | C | **Reject as a ranking requirement** | Use CWV thresholds and route budgets instead. A Lighthouse score is a lab diagnostic, not a guarantee or substitute for field performance. |
| LCP <= 2.5s, INP < 200ms, CLS < 0.1 | A, B, C, F | **Keep** | Retain these as 75th-percentile targets, monitored in Search Console and RUM. |
| Sitemap segmentation | A, B, E, F | **Adapt** | Maintain indexable route registry and move toward segmented property, locality, guide, and project sitemaps when URL scale requires it. `lastmod` must come from meaningful source changes, not the current request time. |
| Accurate sitemap lastmod | A, B, E, F | **Keep** | Replace blanket `new Date()` values with deterministic route/entity modification dates when production data is available. |
| Search Console and analytics | A, B, C, E, F | **Keep** | Keep Search Console operations and privacy-aware analytics. Use real account activation for submitted URLs, coverage, query, and field-data decisions. |
| Google Indexing API for ordinary listings | A | **Keep the prohibition** | Do not use the Indexing API as a shortcut for ordinary real-estate pages. Use sitemaps, internal links, and Search Console inspection. |
| Google autocomplete scraping or automated rank checks | A, E | **Reject** | Do not automate queries against Google in ways that violate Google terms or create machine-generated traffic. Use approved data sources, Search Console, and manual research. |
| Monthly crawl-log analysis | B, E, F | **Adapt** | Add production crawl and Search Console monitoring when server logs/provider access is active. Until then, use route registries, sitemap audits, and coverage snapshots. |
| YouTube tours and embeds | A, C, E | **Conditional** | Use only rights-cleared, real tours with visible embeds and accurate VideoObject metadata. Do not embed scraped or unlicensed footage. |
| Tools: EMI, stamp duty, rental yield, affordability | A, B, E, F | **Keep with safeguards** | Build calculators with transparent assumptions, state-specific inputs, disclaimers, and non-personalized educational positioning. Do not present financial or legal outputs as advice. |
| Competitive ranking promises and timelines | A, B, C, E, F | **Reject as promises** | Use measurable goals—qualified impressions, indexed valuable pages, leads, coverage, and CWV—not guaranteed rankings or traffic growth percentages. |
| “Beat Housing.com” head-term strategy | A, B, C, E, F | **Adapt** | Compete on Ahmedabad depth, freshness, provenance, project/locality intent, and useful tools. Do not frame domain authority or time-to-rank as controllable. |

## What Architech already has

Architech already contains the most important foundation: Ahmedabad-first route architecture, canonical URL helpers, a formal SEO page registry, lifecycle-aware listing indexability, noindex handling for arbitrary search, robots and sitemap routes, raw-HTML SEO smoke tests, structured listing/locality JSON-LD, source and freshness concepts, RERA provenance contracts, an authority/outreach governance layer, and a production indexing switch. These should be extended rather than replaced.

## Highest-priority implementation sequence

| Priority | Implementation | Acceptance measure |
|---|---|---|
| P0 | Make SEO route metadata and JSON-LD use only visible, approved, sourced facts. | No unsupported facts in rendered HTML or JSON-LD; regression tests cover omissions. |
| P0 | Keep arbitrary search facets non-indexable while designing a qualified-facet gate. | Search/filter/sort routes remain noindex; locality and listing pages remain indexable where approved. |
| P0 | Make sitemap freshness deterministic. | `lastmod` changes only when the underlying route/entity changes. |
| P1 | Enrich locality/project pages only with verified data blocks and editorial review. | Each page passes content, source, author, freshness, internal-link, and minimum-value gates. |
| P1 | Add an image/video rights and evidence layer to visible media metadata. | Media cannot become public SEO content without rights, moderation, and alt/caption checks. |
| P1 | Build original Ahmedabad data assets and a compliant authority workflow. | Every asset has methodology, source, owner, disclosure, and outreach provenance. |
| P1 | Improve Search Console and field-performance monitoring after credentials are activated. | Weekly coverage/CWV/canonical checks and issue thresholds are operational. |
| P2 | Add selectively indexable project, landmark, and tool pages as inventory and research justify them. | No doorway patterns; each page has distinct demand, content, and internal-link value. |

## References

[1]: https://developers.google.com/search/docs/fundamentals/seo-starter-guide "Google Search Central: SEO Starter Guide"
[2]: https://developers.google.com/search/docs/essentials/spam-policies "Google Search Central: Spam Policies for Google Web Search"
[3]: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data "Google Search Central: Introduction to Structured Data Markup in Google Search"
[4]: https://developers.google.com/search/docs/appearance/core-web-vitals "Google Search Central: Understanding Core Web Vitals and Google Search Results"
