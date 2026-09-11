# Design: Mobile install — finish the PWA the site already claims to be

**Date:** 2026-09-11
**Status:** Approved in chat (11 Sep 2026) — full slice, offline shell only, quiet install button, no store listing
**Supersedes:** the line "PWA/offline/native app are not launch requirements" in `docs/audits/non-payment-functionality-audit.md`
**Closes:** F9 follow-up from `docs/audits/IMPROVEMENT-REVIEW-2.md` (the manifest shipped there did not work)

## 1. The problem

The owner's ask: make the site mobile friendly and installable as an app, with minimum effort.

Measurement first. `pnpm audit:mobile` against the dev server returned, for all 14
audited routes at a 360px baseline: **0 horizontal-overflow, 0 tap-target risk,
0 fixed grid columns**. The responsive layer is genuinely finished — `.touch-44`
(`src/theme.css:573`), `.safe-bottom` (`:823`), `.mobile-discovery-rail`
(`:649`, used by `src/screens/ResultsPage.tsx`), the `vaul` drawer,
`FilterSheet`, `StickyBar` and the header's mobile nav all exist and are clean.

So this was never a "make it responsive" task. It was an installability task, and
there the site was **advertising an app it could not deliver**. Verified on
11 Sep 2026 against `http://127.0.0.1:3000`:

| # | Finding | Evidence |
|---|---|---|
| 1 | Manifest icons 404 → no installable icon set | `GET /icons/icon-192.png` → **404**, `GET /icons/icon-512.png` → **404**; the real files are `/icon-192.png` (200) and `/icon-512.png` (200) |
| 2 | No service worker anywhere | `GET /sw.js` → **404**; zero `serviceWorker` references under `src/` or `ops/` |
| 3 | `viewport-fit=cover` missing → every `env(safe-area-inset-*)` in `theme.css` computes to **0px** on notched iPhones, so the mobile rail and sticky bar sit under the home indicator | Served head: `<meta name="viewport" content="width=device-width, initial-scale=1"/>` |
| 4 | The static publisher would pin a service worker `immutable` for a year and serve the manifest as `application/octet-stream` | `ops/scripts/publish-server.mjs` gave every non-`index.html` file `max-age=31536000, immutable`, and `.webmanifest` was absent from `MIME_TYPES` |
| 5 | `public/icon-512-maskable.png` is a byte-identical copy of `icon-512.png` (md5 `b3f86596…`), referenced by nothing | `md5sum` |

The docs had already committed the product to this shape — `docs/broker-suite/decision.md`
("It remains an online PWA"), `docs/broker-suite/open-source-ecosystem-evaluation.md`
("the Architech broker UI remains the mobile-responsive/PWA surface") and
`docs/broker-suite/evolution-api-adoption-assessment.md` ("Architech PWA") all
describe an installable app. Only the code disagreed.

## 2. Decision: PWA, not a native wrapper

| Option | Cost | Verdict |
|---|---|---|
| **A. Fix + finish the PWA** | ~1 day, 0 new dependencies | **Chosen.** One codebase, one URL, home-screen install, standalone window |
| B. A + Play Store TWA (PWABuilder/Bubblewrap) | +½ day, $25, `assetlinks.json` | Deferred by the owner; needs no code changes to become possible later |
| C. Capacitor / React Native | Weeks, second codebase, store review, dual maintenance | Rejected — the opposite of "minimum efforts", buys nothing not already present |

Chromium no longer requires a service worker for the install prompt (a valid
manifest over HTTPS is enough), so fixing the icon paths alone restores Android
installability; the worker is what makes it a real app on iOS, where the only
install path is Safari → Share → Add to Home Screen.

**Why a hand-written `public/sw.js` instead of `next-pwa`/Serwist:** this repo is
Next 16.3.2 built with Turbopack (`next build --help` lists `--webpack` as the
opt-out), and the established Next PWA plugins are webpack-only. A plain file in
`public/` is copied verbatim by `ops/scripts/materialize-static-publish.mjs`, so
it works identically on the Next server and on the static `dist/index.js`
publisher — no build step, no dependency, no generator to keep in sync.

## 3. Scope approved by the owner

1. **Offline behaviour:** shell only. Precache the fallback page, manifest and
   icons; navigations are network-first with `/offline.html` on failure;
   content-hashed build assets are cache-first; **`/api/` is never cached** — a
   stale lead list is worse than a spinner.
2. **Install affordance:** quiet. No proactive nag sheet. The button appears only
   when the browser proves install is possible (`beforeinstallprompt`) or on iOS,
   where it opens a three-step Share → Add to Home Screen dialog. "Not now"
   suppresses it for 14 days via `localStorage`.
3. **Store listing:** none.

## 4. What shipped

| File | Change |
|---|---|
| `public/manifest.webmanifest` | Correct icon paths; added `id`, `scope`, `display_override`, `lang`, `categories`, and three `shortcuts` (Buy / Rent / Saved) |
| `public/sw.js` | New. Offline-shell worker; `VERSION`-keyed caches, `skipWaiting`/`clients.claim`, old-cache cleanup |
| `public/offline.html` | New. Self-contained branded fallback (inline CSS only — it must render with no network) |
| `src/lib/pwa/install.ts` | New. Pure decision logic: platform detection (incl. iPadOS's desktop-UA spoof), standalone detection, dismissal cooldown, `resolveInstallAction` |
| `src/lib/pwa/install.test.ts` | New. 13 tests |
| `src/lib/pwa/service-worker.test.ts` | New. 9 tests that execute the **real** `public/sw.js` in a `node:vm` context with a stubbed Cache API — no browser exists in CI, so this is the closest real registration test available |
| `src/components/architech/InstallAppButton.tsx` | New. Header button + mobile-menu row + iOS instructions dialog |
| `src/components/architech/ServiceWorkerRegistrar.tsx` | New. Registers `/sw.js` on `load`, production only |
| `src/app/layout.tsx` | `viewportFit: "cover"`; `appleWebApp` on `metadata` (Next 16 types it there, **not** on `Viewport`); mounts the registrar |
| `src/components/architech/Header.tsx` | Mounts the install button in the desktop row and the mobile menu |
| `src/lib/i18n.ts` | `install` block in `en` and `hi` (the dictionary-parity test enforces both) |
| `next.config.ts` | `no-store` for `/sw.js`, `no-cache` for the manifest; explicit `worker-src 'self'` |
| `ops/scripts/publish-server.mjs` | `.webmanifest` MIME type; `cacheControlFor()` keeps sw/manifest/HTML out of the immutable bucket |
| `ops/scripts/audit/pwa-audit.mjs` | New. HTTP-level installability checks, exit 1 on failure; wired as `pnpm audit:pwa` |
| `ops/scripts/audit/run-pwa-audit.mjs` | New. Boots the static publisher on an ephemeral port and runs the audit against it; wired as `pnpm audit:pwa:ci` and called from `.github/workflows/ci.yml` after the build |
| `ops/scripts/media/generate-maskable-icon.mjs` | New. Stdlib-only PNG decoder/encoder that rebuilds `icon-512-maskable.png` with the mark inside the 80% safe zone on the splash background; `pnpm icons:maskable` |
| `public/icon-512-maskable.png` | Rebuilt (was a byte-copy of `icon-512.png`); now declared in the manifest with `purpose: "maskable"` |
| `.github/workflows/ci.yml` | Added the PWA installability audit step after the production build |

## 5. Verification (all run 11 Sep 2026)

```
npx tsc --noEmit                              → clean
npx eslint src --max-warnings 200             → 0 errors, 0 warnings
npx vitest run                                → 201 files, 2208 passed, 49 skipped
node ops/scripts/audit/mobile-audit.mjs       → 14/14 routes, 0/0/0 findings
node ops/scripts/audit/pwa-audit.mjs :3000    → 30/30 passed (dev server)
pnpm build && node ops/scripts/audit/run-pwa-audit.mjs → 30/30, exit 0 (static publisher)
node ops/scripts/media/generate-maskable-icon.mjs → 512x512, safe zone 410px, corner/centre verified
```

The static-publisher run earned its keep: the first pass returned **6 FAILED**
because `cacheControlFor()` called `path.relative` in a module that only
imports named helpers from `node:path` — every static asset 500'd. Fixed by
importing `relative as toRelative` and `sep`. Header check after the fix:

```
/sw.js                 200  Cache-Control: no-cache   text/javascript; charset=utf-8
/manifest.webmanifest  200  Cache-Control: no-cache   application/manifest+json; charset=utf-8
/icon-512.png          200  Cache-Control: public, max-age=31536000, immutable
```

The audit's negative path is exercised too: pointed at a dead origin it reports
FAIL and exits 1.

Not verified here: an actual on-device install. There is no browser binary in
this sandbox (`npx playwright install chromium` fails to download), so the
Chromium install prompt and the iOS home-screen flow still need one manual pass
on a phone — DevTools → Application → Manifest is enough for the Android side.

## 6. Known follow-ups (deliberately out of scope)

- ~~**Maskable icon.**~~ **Closed in round 2.** `icon-512-maskable.png` is now
  regenerated with the mark inside the 80% safe zone by
  `ops/scripts/media/generate-maskable-icon.mjs` and declared with
  `purpose: "maskable"`; `src/lib/pwa/maskable-icon.test.ts` pins that the asset
  is a real, distinct 512px PNG so the byte-copy regression cannot silently
  return. The generator is stdlib-only (a small PNG decoder/encoder) because
  ops scripts must run without a dependency install. A code review of round 2
  caught a genuine bug in that decoder: PNG Sub/Average/Paeth filters address
  the left neighbour in *bytes per pixel* (6 for 16-bit RGB), not bytes per
  sample (2) — the first icon was built from a corrupted decode (785,920
  wrong samples). The stride is fixed and pinned by
  `maskable-icon.test.ts`, which inflates the filter-0 output and asserts the
  centre pixel is the saturated saffron mark, not the grey smear the bug
  produced.
- **Push notifications.** Needs the iOS 16.4+ push path (manifest + installed
  app + a `push` handler in the worker). The broker channel design already
  assumes in-app notification only, so nothing is blocked.
- **Store listing.** PWABuilder can package this PWA into a TWA unchanged when
  the owner wants a Play Store presence; that needs `assetlinks.json` on the
  production origin and a $25 developer account.
