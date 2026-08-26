# Open-source real-estate research

## Candidate reviewed

**ahzamkidwai/Modern-Real-Estate-Marketplace** — https://github.com/ahzamkidwai/Modern-Real-Estate-Marketplace

The repository is a public React/Node/MongoDB marketplace with property listings, property details, search filters, authentication, file upload, and interactive-map references. GitHub shows a small project with 25 commits and a last visible commit in April 2024. The repository page links to a `LICENSE` item, but the license text has not yet been verified; therefore no code or asset should be copied or imported. The useful takeaway for Architech is the feature taxonomy only: listing dossier, filter vocabulary, saved/favorite workflow, authentication boundary, and map/list pairing.

## Safety decision

Do not clone-and-run or import this repository. Continue by verifying the license file and reviewing more maintained candidates. Prefer permissively licensed standalone assets or small, well-scoped libraries; reuse patterns only after checking license, maintenance, security, and fit with Architech’s existing Next.js/React architecture.


## Additional candidates reviewed

**eevan7a9/real-estate-management** — https://github.com/eevan7a9/real-estate-management

GitHub identifies this as Apache-2.0 licensed, public, non-archived, and actively maintained relative to the other candidates, with 656 commits visible on the repository page. Its scope is a web/mobile property-management solution using Ionic, Angular, Fastify, Leaflet, Chart.js, and MongoDB. It is useful as a reference for map popups, property-manager workflows, and operational dashboards, but its Angular/Ionic architecture is not a drop-in fit for Architech’s Next.js application. No code or assets were imported.

**nainemom/melkmap** — https://github.com/nainemom/melkmap

GitHub identifies this as MIT licensed, public, and non-archived. The README describes an interactive real-estate price visualizer with map visualization, filtering, price heatmaps, responsive UI, and a React/TypeScript/Vite/Tailwind stack; the latest visible commit was June 2025. It is a useful pattern reference for a future Ahmedabad locality price-context layer, but it crawls Divar.ir in its own market and must not be adapted for Ahmedabad without approved data sources, terms-of-service review, provenance, and rate limits.

## Recommendation

Use open repositories as reference material only. The best pattern candidates are `eevan7a9/real-estate-management` for operational/map interaction ideas and `nainemom/melkmap` for price-visualization concepts. Do not import third-party images, logos, scraped listings, or unreviewed dependencies. Architech’s current generated Ahmedabad imagery and existing MapLibre/SEO/trust architecture are safer for Phase 1; any future price layer should use approved government/open data or consented inventory with explicit source timestamps.


## Focused repository comparison

**bradtraversy/house-marketplace** — https://github.com/bradtraversy/house-marketplace

This is a clear tutorial-sized React/Firebase marketplace for buying and renting homes, with listing creation, geocoding, and a Leaflet map directory. GitHub shows 323 stars, 39 commits, and the last visible commit in November 2022. Its README does not expose a license badge in the reviewed page, so license rights require direct repository verification before reuse. It is useful for learning the simplest buyer/seller flow, but it is not a current architectural base for Architech.

**AHMAD-JX/Hozn-RealEstate-Fullstack** — https://github.com/AHMAD-JX/Hozn-RealEstate-Fullstack

This public repository is MIT licensed and uses React, Next.js, TypeScript, Express, PostgreSQL, and Sequelize. Its README describes JWT authentication, profile management, property CRUD, buying/selling endpoints, and a small full-stack API. GitHub shows 171 stars, six commits, and the last visible commit in 2025. The stack is closer to Architech than tutorial repositories, but its small commit history and JWT/Express/Sequelize design make it a reference rather than a safe replacement for Architech’s existing authorization, Prisma, provenance, SEO, and moderation architecture.

## Interim ranking

| Candidate | License signal | Relevant strengths | Main risk | Recommendation |
|---|---|---|---|---|
| `eevan7a9/real-estate-management` | Apache-2.0 | Operational property management, map interaction, notifications, verification concepts | Angular/Ionic/Fastify/MongoDB; not a Next.js base | Best reference for broker operations and map workflow |
| `AHMAD-JX/Hozn-RealEstate-Fullstack` | MIT | Closest stack family; auth, profile, property CRUD, Postgres | Very small history; simpler security and SEO model | Best reference for API vocabulary, not a code base |
| `nainemom/melkmap` | MIT | Price visualization, filters, map/heatmap concepts | Iran-specific crawler/data source and separate Vite stack | Best reference for future market-context visualization |
| `bradtraversy/house-marketplace` | License not confirmed in reviewed page | Simple buy/rent/list flow and Leaflet map | Tutorial-era React/Firebase, last visible commit 2022 | Learning reference only |

The conclusion is that no reviewed repository is a better foundation than the current Architech codebase. Architech already has the strongest fit for the user’s requirements: Next.js, Ahmedabad-first crawlable information architecture, evidence/provenance controls, privacy-aware leads, broker organization scoping, moderation, and the existing Amdavad Modern UI. Reuse should be limited to ideas, field vocabulary, and isolated patterns after license review—not wholesale code or assets.
