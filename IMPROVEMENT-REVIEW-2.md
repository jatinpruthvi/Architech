# Architech — Audit Round 2 (post-implementation)

> ## ✅ Status update — 23 Aug 2026 (same day)
> **Implemented:** F1 (local git re-synced onto remote main; push pending fresh token) · F2 (38 unused ui files + 23 orphaned packages removed → 16 runtime deps) · F3 (route-level code splitting, homepage-only initial bundle) · F4 (`?q=` now really filters: locality/title/BHK/price-ceiling matching + 5 new tests) · F5 (absolute `og:url`/`og:image` via `VITE_SITE_URL`) · F6 (wouter pinned 3.7.1) · F7 (accurate srcset widths) · F8 (saved hydration flash fixed) · F9 (PWA manifest + 3 icons) · F10 (**real compare tray**: 2-home selection, floating tray, side-by-side drawer).
> **Remaining:** push PR #2 (needs token) · dark mode · Hindi toggle · Next.js migration.
**Date:** 23 Aug 2026 · Round 1 (`IMPROVEMENT-REVIEW.md`) fully implemented · This round re-inspects the *current* state.

---

## 1. Updated scorecard

| Area | Round 1 | Now | Remaining gap |
|---|---|---|---|
| Visual design & motion | A | **A** | — |
| Accessibility | B | **A−** | keyboard nav done, contrast 0 violations; component-level SR testing left |
| Performance | B− | **B+** | WebP/srcset/preload done; **no route code-splitting** |
| SEO readiness | D | **C−** | meta/OG/titles/robots done; SSR still needs Next.js |
| Code quality & tooling | C+ | **B+** | lint/tests/CI added; **31 unused ui components remain** |
| Data layer | D | **C** | saves persist; q-param & compare still cosmetic |
| Repo hygiene | C+ | **B** | docs refreshed; **git history desynced** ⚠️ |

---

## 2. New findings — item by item

### 🔴 F1. Git history desynced from GitHub (critical, repo integrity)
The sandbox snapshot preserved every **file** but lost recent **git internals**: local `HEAD` sits at the pre-PR commit `ac21b89`, while GitHub `main` is at the squash merge `92ea52a`. Last session's local commit is gone from history (its 45 file changes are all safely present in the working tree, verified).
**Fix:** fetch remote `main`, branch from `92ea52a`, commit the current working tree, push as PR #2. Do this *before* any other repo work. *(Effort: 10 min — needs a fresh GitHub token.)*

### 🟠 F2. 31 of 46 shadcn ui components are dead code
Used by the app: `accordion, dialog, drawer, select, sonner, tabs, tooltip` (+ `button, input, label, separator, sheet, skeleton, textarea, toggle` referenced only internally — mostly by *other unused* components). Unused: `alert-dialog, alert, aspect-ratio, avatar, badge, breadcrumb, button-group, card, checkbox, collapsible, context-menu, dropdown-menu, empty, field, hover-card, input-group, item, kbd, menubar, navigation-menu, pagination, popover, progress, radio-group, scroll-area, sidebar, slider, spinner, switch, table, toggle-group` — plus ~14 now-orphaned `@radix-ui/*` packages and the `useMobile` hook (only `sidebar` uses it).
**Fix:** delete unused ui files, prune orphaned radix deps, keep a short allowlist. Cuts install size, lint surface, and upgrade risk. *(Effort: ~45 min with dependency-order care.)*

### 🟠 F3. No route-level code splitting
One 491 KB JS bundle (150 KB gzip) ships everything — the listing dialog, drawer, select, accordion — to a user who only opens the homepage.
**Fix:** `React.lazy()` + `Suspense` per route with a branded skeleton fallback; expect ~35–45% smaller initial JS. *(Effort: ~30 min.)*

### 🟠 F4. `?q=` is displayed but ignored by results
`/search?q=Thaltej` shows “· ‘Thaltej’” in the header, but all 4 homes still render — a silent lie in the UI.
**Fix:** match query tokens against locality/title/BHK (e.g., "Thaltej" → Thaltej homes; "2 BHK" → bhk=2) and show a per-query empty state. *(Effort: ~45 min incl. tests.)*

### 🟠 F5. Social meta URLs are relative
`og:image=/images/hero-ahmedabad.jpg` — WhatsApp/Facebook/Twitter require **absolute** URLs, and `og:url` is missing entirely. Works in no production scraper today.
**Fix:** introduce `VITE_SITE_URL` env, emit absolute `og:url`/`og:image` (vite HTML env replacement), document in README. *(Effort: 20 min.)*

### 🟡 F6. Version pin mismatch: wouter
`package.json` says `wouter: ^3.3.5` while the pnpm patch targets exactly `wouter@3.7.1`. It works only because the lockfile currently resolves 3.7.1 — a future `pnpm update` breaks the patch.
**Fix:** pin `"wouter": "3.7.1"`. *(Effort: 2 min.)*

### 🟡 F7. `srcset` width descriptors are inaccurate
`Pic` declares `1600w` for full-size images that are actually 896–1376 px wide. Browsers over-download on large viewports.
**Fix:** emit real widths (e.g., a small width map or rename files with true width suffixes). *(Effort: 20 min.)*

### 🟡 F8. Saved page flashes empty on load
`SavedContext` hydrates from localStorage in `useEffect` (after first paint) → `/saved` briefly renders the empty state before the list pops in.
**Fix:** lazy `useState(() => loadSaved(localStorage))` initializer (SSR-safe guard for later). *(Effort: 10 min.)*

### 🟡 F9. No PWA manifest
India-first product with no `manifest.webmanifest`: not installable, no home-screen icon, no splash theming — cheap wins on mobile retention.
**Fix:** manifest + icons (from favicon arch mark) + `theme_color/background_color`. *(Effort: 30 min.)*

### 🟡 F10. Compare is still a toast-only stub
The compare button now honestly says "coming soon", but the affordance exists page-wide with zero function.
**Fix (choose one):** minimal compare tray (2 homes side-by-side in a drawer — price, ₹/sqft, area, badge rows), or remove the button until the data layer lands.

### 🟢 Smaller polish items
- `template.json` and `components.json` reference the pre-redesign scaffold — annotate or archive (5 min)
- Fonts still load from Google CDN — self-hosting (`@fontsource`) removes third-party dependency + speeds up repeat views (~30 min)
- No analytics at all — consider self-hosted privacy-friendly counters at launch (out of prototype scope)
- Component/E2E test depth: unit tests exist; add @testing-library smoke tests for PropertyCard/Saved flow and one Playwright journey when CI budget allows
- Dark mode and Hindi (हिन्दी) toggle remain the two biggest *product* leaps available in the prototype; both are scaffolded (OKLCH tokens / Devanagari fonts + localized names in `lib/localities.ts`)

### Still structural (unchanged, by design)
SSR/JSON-LD/sitemaps/lifecycle status codes, Storybook, broker onboarding, MapLibre pin-sync → all begin with the **Next.js 16 migration** the architecture mandates.

---

## 3. Recommended order

| # | Item | Effort | Impact |
|---|---|---|---|
| 1 | **F1 — re-sync git & push PR #2** | 10 min | Protects all shipped work |
| 2 | F6 — pin wouter 3.7.1 | 2 min | Prevents future breakage |
| 3 | F8 — saved hydration flash | 10 min | Visible correctness |
| 4 | F4 — make `?q=` real | 45 min | Honesty + search UX |
| 5 | F3 — route code splitting | 30 min | Biggest perf lever left |
| 6 | F2 — ui/dep purge | 45 min | Hygiene, install speed |
| 7 | F5 — absolute OG URLs | 20 min | Sharing actually works in prod |
| 8 | F7 — true srcset widths | 20 min | Bandwidth accuracy |
| 9 | F9 — PWA manifest | 30 min | Mobile India wins |
| 10 | F10 — compare tray or removal | 1–2 hr | Feature completeness |

**Then:** dark mode → Hindi toggle → Next.js migration.
