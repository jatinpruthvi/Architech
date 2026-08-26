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
