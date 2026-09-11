# Hozn-to-Architech Adaptation Strategy

**Prepared by Manus AI — 26 August 2026**

## Decision

Architech remains the production foundation. Hozn is a MIT-licensed reference application with a related React/Next.js/TypeScript/PostgreSQL stack, but its implementation is a small, conventional application using Next.js 14, React 18, Express, Sequelize, JWT authentication, Bootstrap/Sass, Redux, Axios, EmailJS, and several UI plugins.[1] Replacing Architech with Hozn would regress the project’s current Next.js version, Google-first SEO controls, evidence/provenance model, broker organization scoping, moderation lifecycle, consent handling, and Amdavad Modern design system.

The safe approach is **pattern extraction, not code transplantation**. We can study Hozn’s domain vocabulary and flow organization, then implement equivalent behavior inside Architech’s existing contracts.

## Useful patterns to adapt

| Hozn concept | Architech destination | Safe adaptation |
|---|---|---|
| User registration, login, profile edit | Better Auth session and broker profile routes | Keep Architech’s server-side session, role, organization, deletion, and privacy guards; do not copy Hozn’s JWT handlers. |
| Property add/update/delete | Broker listing draft and moderation lifecycle | Map Hozn’s CRUD vocabulary into Architech’s draft states, validation, source trail, media audit, and moderation queue. A listing must never become public merely because a form was saved. |
| Buy/sell property actions | Lead, requirement, shortlist, and contact-history contracts | Treat interest as a consented lead or workflow event; do not model a purchase or sale as an unverified direct mutation. |
| Property list and detail views | Search results and ListingPage dossier | Reuse the idea of a concise result-to-detail journey while preserving Architech’s canonical URL, RERA/source badges, freshness, masked contacts, and related-property logic. |
| Image management | Broker draft media attach, moderation, derivative, and takedown flow | Do not copy Hozn’s image files. Use Architech’s media provider abstraction, EXIF policy, moderation state, and retention controls. |
| Search/filter vocabulary | `filters.ts`, search URL builder, and server search contract | Add only fields that have verified Ahmedabad data support. Keep faceted indexability policy and no-results recovery. |

## Patterns not to import

Hozn’s JWT/Express/Sequelize stack should not replace Better Auth, the Architech repository facades, Prisma contracts, or organization-scoped authorization. Its dependency bundle should not be copied into Architech simply to obtain UI effects; that would add Bootstrap/Sass, Redux, Axios, EmailJS, star-rating, carousel, lightbox, and animation dependencies that overlap with the existing React 19/Tailwind/shadcn/motion strategy.

The repository contains bundled fonts, Font Awesome files, image galleries, rating images, and other public assets. Their individual upstream licenses and redistribution rights were not independently verified. Do not copy those assets, brand treatments, rating graphics, testimonials, or property photos. In particular, rating imagery must not become fabricated reviews or trust evidence in Architech.

## Recommended implementation sequence

First, keep the current Architech code unchanged and record a field mapping between Hozn-style entities and Architech entities. The mapping should distinguish account, organization, property draft, published listing, source record, media asset, lead, requirement, shortlist event, and moderation decision rather than collapsing them into one generic property table.

Second, selectively improve the broker listing flow with any missing field grouping suggested by Hozn, but keep Architech’s staged wizard and provenance rails. Every new field needs a validation rule, source/provenance treatment, privacy classification, and indexability decision.

Third, compare Hozn’s simple list/detail journey with Architech’s search and dossier UX using browser tests. Improve only measurable friction points such as returning from detail to the same search state, retaining filters, showing saved state, and making the next contact action explicit.

Fourth, if a future Ahmedabad market-price visualization is approved, use the Melk Map concept as an interaction reference and Hozn’s property field vocabulary as a data-shape reference. The data itself must come from an approved source with timestamp, methodology, and coverage disclosures.

## Acceptance gates

A Hozn-inspired change is acceptable only if it preserves server-side authorization, organization scoping, consent and idempotency, source provenance, moderation, canonical SEO URLs, keyboard accessibility, reduced-motion behavior, and the current no-fabricated-testimonial rule. It must not add an unreviewed runtime dependency, third-party asset, external credential, scraper, or unverifiable inventory claim.

## References

[1]: https://github.com/AHMAD-JX/Hozn-RealEstate-Fullstack "AHMAD-JX/Hozn-RealEstate-Fullstack — GitHub repository, MIT license, README, stack, and API overview"
