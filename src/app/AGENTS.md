# app/ — Next.js App Router

Filesystem routing. Each folder is a URL segment; `page.tsx` renders it,
`route.ts` under `api/` is an endpoint, `layout.tsx`/`template.tsx` wrap.

## Layout

- Product surfaces: `buy/`, `rent/`, `listing/`, `property/`, `property-search/`,
  `search/`, `compare/`, `collections/`, `locations/`, `developers/`,
  `price-index/`, `home-loan/`, `investment/`, `guide/`, `blogs/`
- Role dashboards: `broker/`, `agent/`, `agents/`, `dashboard/`, `admin/`
- Company/legal: `about-us/`, `contact-us/`, `privacy/`, `terms/`, `review/`,
  `requirements/`, `list-property/`, `login/`, `saved/`, `saved-searches/`
- Discovery plumbing: `api/`, `sitemap/`, `sitemap.xml`, `robots.ts`,
  `llms.txt`, `llms-full.txt` (AI-crawler surfaces)

## Rules

- Pages are thin: heavy logic belongs in `src/lib/`, UI in `src/components/`.
- Public crawlability is gated by `PUBLIC_INDEXING_ENABLED` + `proxy.ts` — do not bypass.
- Metadata/structured data per route follows the SEO contracts in
  `ops/config/governance/contracts/` and `docs/seo/`.
- Root-level `layout.tsx`, `error.tsx`, `global-error.tsx`, `not-found.tsx`,
  `template.tsx`, `robots.ts` are conventional Next.js files.

## See also

Root `AGENTS.md` for commands and locked files; `../AGENTS.md` for the code
these routes compose.
