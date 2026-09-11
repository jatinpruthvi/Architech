# client/ — Application code

`client/src/` holds all React + TypeScript application code (aliased `@/…`).
The Next.js routes in `app/` compose from here.

## Layout

- `components/` — `ui/` (shadcn primitives), `architech/` (product components),
  `broker/`, `magicui/`
- `lib/` — **business logic, organized by domain**: `listing/`, `leads/`, `broker/`,
  `seo/`, `governance/`, `location/`, `filters/`, `auth/`, `db/`, `analytics/`,
  `i18n`, `search/`, `dashboard/`, …
- `hooks/`, `contexts/` — React hooks and providers
- `pages/` — shared page-level compositions used by routes
- `stories/` — Storybook stories (`.storybook/` at repo root configures it)
- `test/` — test helpers/stubs; `theme.css` — design tokens

## Rules

- **Colocate tests**: unit tests live next to the code as `*.test.ts` (vitest picks
  up `client/src/**/*.test.ts`).
- Server-only modules import `server-only`; vitest stubs it (see `vitest.config.ts`).
- Some `lib/` modules import JSON snapshots from `config/data/location/` via
  relative paths — do not move those files casually.
- Path alias: `@/` → `client/src/`, `@shared/` → `shared/`.

## See also

Root `AGENTS.md`; `docs/ui/` for theme docs; `docs/findings/` for past UI debugging.
