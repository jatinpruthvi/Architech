# src/ — Application code

`src/` holds all application code: the Next.js App Router (`app/`), all React +
TypeScript code (aliased `@/…`), and cross-boundary constants (`shared/`).

## Layout

- `app/` — Next.js App Router: routes, pages, API handlers, sitemaps, metadata
  (see `app/AGENTS.md`)
- `components/` — `ui/` (shadcn primitives), `architech/` (product components),
  `broker/`, `magicui/`
- `lib/` — **business logic, organized by domain**: `listing/`, `leads/`, `broker/`,
  `seo/`, `governance/`, `location/`, `filters/`, `auth/`, `db/`, `analytics/`,
  `i18n`, `search/`, `dashboard/`, …
- `hooks/`, `contexts/` — React hooks and providers
- `pages/` — shared page-level compositions used by routes
- `stories/` — Storybook stories (`.storybook/` at repo root configures it)
- `shared/` — constants shared across the server/client boundary (aliased `@shared/`)
- `test/` — test helpers/stubs; `theme.css` — design tokens

## Rules

- **Colocate tests**: unit tests live next to the code as `*.test.ts` (vitest picks
  up `src/**/*.test.ts`).
- Server-only modules import `server-only`; vitest stubs it (see `vitest.config.ts`).
- Some `lib/` modules import JSON snapshots from `ops/config/data/location/` via
  relative paths — do not move those files casually.
- Path aliases: `@/` → `src/`, `@shared/` → `src/shared/`.

## See also

Root `AGENTS.md`; `app/AGENTS.md` for routes; `docs/ui/` for theme docs;
`docs/findings/` for past UI debugging.
