# AGENTS.md — Repository Navigation Map

**Architech** — India real-estate discovery platform. Next.js 16 (App Router) · React 19 · TypeScript strict · Prisma 7 + PostGIS · Tailwind 4 · pnpm.

## The golden rule

**Do not grep from the repository root.** Route yourself with the tables below, `cd` into
the area you are changing, and read that area's `AGENTS.md` first. Every major directory
has one. For documentation questions, search inside `docs/` — never at the root.

## Repository map

| Directory | What lives there | Go here when… |
|---|---|---|
| `app/` | Next.js App Router: routes, pages, API handlers, sitemaps, metadata | Changing a page, route, API endpoint, robots/sitemap |
| `client/src/` | All React code: components, hooks, contexts, **business logic in `lib/`** | Changing UI components, client logic, styles, theme |
| `shared/` | Constants shared by server + client (`@shared/*`) | Adding a cross-boundary constant |
| `scripts/` | Build, CI, audits, data pipelines (plain `.mjs`, stdlib-first) | Changing build, tooling, audit or import scripts |
| `tests/` | Playwright (a11y, ui, a11y-broker) + real-HTTP e2e suites | Adding/changing browser or e2e tests |
| `prisma/` | `schema.prisma`, migrations, seeds | Changing the database |
| `public/` | Static assets, fonts-derived icons, vendored MapLibre | Adding static files |
| `config/` | Machine-readable operational contracts (read by scripts/tests) | Env matrices, secret inventory, budgets, release/legal evidence |
| `docs/` | **All human documentation** (100+ files, categorized) | Any question that isn't code |

## Task → folder routing

| I need to… | Go to |
|---|---|
| Change a page/route UI | `app/<route>/` → then `client/src/` |
| Add/modify an API endpoint | `app/api/` |
| Add a UI component | `client/src/components/` (`ui/` = shadcn primitives, `architech/` = product components) |
| Change business logic / data shaping | `client/src/lib/<domain>/` (leads, listing, seo, broker, governance, …) |
| Change styling / theme tokens | `client/src/theme.css` + `client/src/components/ui/` |
| Change the database schema | `prisma/schema.prisma` + `prisma migrate` |
| Add an npm script / audit | `package.json` + `scripts/<domain>/` |
| Add a unit test | Colocate: `client/src/**\/*.test.ts` (vitest) |
| Add e2e / a11y / UI test | `tests/e2e/`, `tests/a11y/`, `tests/ui/` |
| Find env/secrets/release/legal contracts | `config/governance/` |
| Find performance budgets | `config/performance/budgets.json` |
| Find SEO monitoring config | `config/seo/search-console.config.json` |
| Find reference datasets (LGD, India Post) | `config/data/location/` |
| Find design/architecture decisions | `docs/architecture/`, `config/governance/decisions/` |
| Find current status & plans | `docs/planning/` (STATUS.md, PHASE-1-IMPLEMENTATION-PLAN.md) |
| Find past audits / debugging findings | `docs/audits/`, `docs/findings/` |

## Documentation search order

1. This file's routing table (above)
2. `docs/MARKDOWN-DOCUMENTATION-INDEX.md` — generated index of every doc, categorized
3. The matching `docs/` subdirectory (`planning/`, `architecture/`, `audits/`, `findings/`, `research/`, `product/`, `ui/`, `seo/`, `data/`, `guides/`, `history/`, `archive/`, …)
4. Only then a repo-wide grep — and never before checking `docs/history/` is the right place to look

## Framework-locked root files — do NOT move

`app/`, `public/` (Next.js conventions) · `proxy.ts` (Next 16 middleware) ·
`instrumentation.ts`, `instrumentation-client.ts` · `next.config.ts` ·
`sentry.client.config.ts`, `sentry.server.config.ts` · `tsconfig.json` ·
`eslint.config.js` · `postcss.config.mjs` · `vitest.config.ts` ·
`playwright.a11y.config.ts`, `playwright.a11y.broker.config.ts`, `playwright.ui.config.ts` ·
`prisma.config.ts`, `prisma/` · `components.json` (shadcn) · `package.json`, `pnpm-*` ·
`.env*.example`, `vercel.json`, `railway.json`, `docker-compose.production-like.yml`

## Import aliases

- `@/…` → `client/src/…`
- `@shared/…` → `shared/…`
- JSON snapshots under `config/data/` are imported with **relative paths** from
  `client/src/lib/` — keep them stable.

## Commands

```bash
pnpm dev            # dev server (0.0.0.0:3000)
pnpm check          # tsc --noEmit          ← run after any move/rename
pnpm lint           # eslint app client/src
pnpm test           # vitest (unit, colocated)
pnpm quality        # check + lint + test + db:validate
pnpm build          # production build via scripts/build-publish.mjs
pnpm test:seo       # no-JS SEO smoke suite
pnpm test:e2e       # e2e (needs build)
pnpm test:a11y      # playwright a11y
```

Operational audits (stdlib-only, safe to run anytime): `pnpm env:audit`,
`pnpm secrets:audit`, `pnpm ops:audit`, `pnpm release:audit`, `pnpm legal:gates`,
`pnpm security:audit`, `pnpm seo:gsc:audit`, `pnpm location:coverage:audit`.

## Where new files go

| New artifact | Location |
|---|---|
| Route/page | `app/<route>/page.tsx` (+ `client/src/` for heavy client code) |
| Component | `client/src/components/<area>/` |
| Domain logic | `client/src/lib/<domain>/` (+ colocated `.test.ts`) |
| Script | `scripts/<domain>/` (match existing stdlib style) |
| Document | `docs/<category>/` — see `docs/AGENTS.md` |
| Config contract (JSON read by tooling) | `config/<area>/` — see `config/AGENTS.md` |
| Storybook story | `client/src/stories/` |

## Nested AGENTS.md

`app/AGENTS.md` · `client/AGENTS.md` · `scripts/AGENTS.md` · `tests/AGENTS.md` ·
`docs/AGENTS.md` · `config/AGENTS.md` — read the one for the area you're touching.
