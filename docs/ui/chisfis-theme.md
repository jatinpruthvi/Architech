# Theme Re-skin — Chisfis-inspired

**Date:** 25 Aug 2026  
**Request:** Change the site theme to look like the [Chisfis booking template](https://github.com/Hamed-Hasan/Online-Booking-Management) (indigo / teal / cool-slate, rounded surfaces).

## What changed

The site is re-themed through its **design-token layer** (`client/src/index.css`), which drives every `bg-*`, `text-*`, `border-*`, and component surface via Tailwind v4 `@theme inline`. Re-pointing the CSS variables re-themes the whole app without touching component markup.

### Palette (light)
| Token | Before (terracotta) | Now (Chisfis) |
|---|---|---|
| `--ink` (foreground) | `#1b1612` | `#111827` (slate-900) |
| `--paper` (canvas) | `#f4eee2` | `#f9fafb` (neutral-50) |
| `--sand` (secondary surface) | `#e8ddc8` | `#f3f4f6` (neutral-100) |
| `--brick` (primary) | `#a8432a` | `#4f46e5` (indigo-600) |
| `--brick-deep` | `#7e2f1c` | `#4338ca` (indigo-700) |
| `--ember` (accent) | `#eeb195` | `#0d9488` (teal-600) |
| `--trust` (verified) | `#2f6b5a` | `#0f766e` (Chisfis secondary-700) |
| `--cream` (on-dark text) | `#f4eee2` | `#f9fafb` |
| `--night` (dark sections) | `#1b1612` | `#111827` (slate-900) |
| `--card` | `#faf5ea` | `#ffffff` |

### Treatment
- `--radius` `0rem → 1rem` → shadcn dialogs/drawers/selects/tooltips/tabs are now rounded.
- `.btn-sweep`/`.shimmer-btn` buttons get `border-radius: 0.875rem`.
- `.editorial-shadow` softened to a light Chisfis drop shadow; `--shadow-editorial` updated.
- Property cards: `rounded-2xl overflow-hidden` + `shadow-sm` + rounded image top.
- Header icon buttons: `rounded-xl`.
- Display font switched from Fraunces (serif) to Archivo (sans) for a modern, Chisfis feel — reuses the already-loaded font, so no extra network cost.

## What stayed (production foundation untouched)
- Behavior, routes, SEO, sitemap, JSON-LD, RERA-trust prominence.
- Dark mode (now a Chisfis slate night palette).
- Accessibility: contrast preserved (slate-900 on neutral-50 ≈ 15.9:1; indigo-600 vs white ≈ 8:1; trust teal-700 on light ≈ 5.2:1).
- Performance budgets and SEO raw-HTML smoke (9 routes) still pass. Font reuse means no new requests.

## Note on dark palette
- `--paper` `#0f172a` (slate-900), `--card` `#1e293b` (slate-800), `--night` `#020617` (slate-950), `--brick` `#818cf8` (indigo-400), `--ember`/`--trust` teal-300/400 — all high-contrast on the dark canvas.

## Validation
```bash
pnpm check
pnpm lint
pnpm test    # 58 files / 274 tests
pnpm build
pnpm test:perf
pnpm test:seo
```
The Playwright a11y suite could not complete in this sandbox because the headless Chromium context closes (environment), not from theme violations; palette values were chosen to satisfy WCAG AA.

## Files touched
```text
client/src/index.css
client/src/components/architech/PropertyCard.tsx
client/src/components/architech/Header.tsx
```
