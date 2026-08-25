# Phase 1 — List Your Property (Seller/Owner Entry Point)

**Date:** 25 Aug 2026  
**Workstream:** `P1-BROKER-001`, `P1-SEO-002`, `P1-UI-001`

## Problem

A property could previously be listed only at `/broker/listings/new`, reachable **only** from the broker dashboard/onboarding. There was no public, discoverable path for an owner/seller to reach the listing flow.

## Solution

Added a discoverable **"List your property"** path that funnels an owner/seller to the listing form (the broker operations workspace):

- **Public page** `/list-property/` (`app/list-property/page.tsx` + `client/src/pages/ListProperty.tsx`) explaining the 3-step source-trail process (facts → media rights → submit for review), with a strong **"Start listing"** CTA to `/broker/listings/new`.
- **Entry points:**
  - **Header** — a "List your property" nav item (desktop) and the same item in the mobile menu (via `navItems`).
  - **Footer** — a "List your property" link in the Explore column.
  - **Homepage** — a compact "Own it? List it." band with a CTA.
- **i18n** (en + hi): `nav.list`, `list.*` page copy, `footer.links.listProperty`. i18n dictionary shape-parity is preserved and covered by `i18n.test.ts`.
- **SEO (industrial):**
  - Central URL builders: `listPropertyPath()` / `listPropertyUrl()`.
  - Metadata + `WebPage` JSON-LD on the server page.
  - Registered in the `SeoPage` registry as an indexable public page (`page:list-property`), so it flows into the sitemap; registry tests pin the count + indexability.
  - `raw-html-smoke.mjs` now asserts `/list-property/` emits a title, canonical, JSON-LD, and the no-JS facts.

## Files

```text
app/list-property/page.tsx
client/src/pages/ListProperty.tsx
client/src/lib/seo/urls.ts            (listPropertyPath/Url)
client/src/lib/seo/pages.ts           (registry entry)
client/src/lib/seo/pages.test.ts
client/src/components/architech/Header.tsx
client/src/components/architech/Footer.tsx
client/src/pages/Home.tsx
client/src/lib/i18n.ts
scripts/seo/raw-html-smoke.mjs
docs/product/phase-1-list-property.md
```

## Validation

```bash
pnpm check
pnpm lint
pnpm test          # 46 files / 221 tests
pnpm build
pnpm test:seo      # 5 routes incl. /list-property/
pnpm test:perf
pnpm security:audit
pnpm ops:audit
pnpm release:audit
pnpm provisioning:audit
pnpm db:validate
```

## Note

The listing form itself stays under `/broker/listings/new` (the broker operations workspace, using the demo broker session). Live per-user identity + persist to Postgres remain behind the production auth gate (blocked on Better Auth sessions and DB provisioning).
