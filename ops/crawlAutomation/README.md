# crawlAutomation — TechnoProperty Broker Crawler

Headless-browser crawler for the `ahmedabad.technoproperty.in` broker portal.
Pulls property listings (via the site's DataTables AJAX endpoints), reveals
owner contact details, fetches gallery images, and stores everything in
SQLite. Exports CSVs and a status dashboard for analysis.

## Architecture

```
ops/crawlAutomation/
├── crawl.mjs            # CLI entry point (full/delta/export/status)
├── lib/
│   ├── browser.mjs      # Camoufox launch, session/auth, login fallback
│   ├── categories.mjs   # Category catalog (keys, urls, endpoint GUIDs)
│   ├── db.mjs           # SQLite schema + all persistence helpers
│   └── parse.mjs        # Row/detail HTML parsing, fingerprinting
├── ENDPOINTS.md         # Verified reverse-engineering of the portal's APIs
├── research/            # Full investigation trail (see below)
├── data/                # SQLite DB (runtime, gitignored)
├── exports/             # CSV exports + dashboard (runtime, gitignored)
├── .env                 # Local credentials (gitignored — see .env.example)
└── package.json
```

## `research/` — reverse-engineering trail

Captured site assets and one-off investigation scripts from when the portal's
DataTable/TerraPi APIs were reverse-engineered. Reference material, not used at
runtime:

- `probe/`, `probe3/` — the portal's original JS bundles (`propertyList.js`,
  `common.min.js`, `datatable-listing.min.js`, jQuery plugins, etc.) as served
  at crawl time.
- `tp-*` — endpoint probes + raw response captures (`tp-dt-rows.json`,
  `tp-browser-ajax.json`, `tp-ResidentialRent.html`, `tp-dashboard.html`, …).
- `probe-*`, `test-*`, `analyze-*`, `inspect-*`, `find-*` — scripts used to
  map the DataTable parameters, `_tpx` decryption, contact/gallery endpoints.
- `crawl.md`, `installation.md`, `opencode.json` — working notes preserved from
  the original workspace (some reference the housing.com/addressbox tooling
  stack that is **not** part of this project).

## Prerequisites

- **Node.js ≥ 20** (developed on v26)
- **Camoufox browser** (an anti-detect Firefox fork), fetched once via:
  ```bash
  npm install camoufox-js
  npx camoufox-js fetch
  ```
  The browser binary lives in a per-user cache (`~/.cache/camoufox`, or set
  `CAMOUFOX_INSTALL_DIR`). A Camoufox **profile** must hold an existing
  logged-in portal session; the crawler re-verifies/renews the session on
  every run and falls back to form-login with `.env` credentials if needed.
- **Native build toolchain** for `better-sqlite3` (prebuilt binaries are used
  automatically on common platforms).

## Setup

```bash
cd ops/crawlAutomation
npm install
npx camoufox-js fetch        # first time only — downloads the browser

# create local credentials + profile config
cp .env.example .env
# edit .env: TECHNO_USERNAME, TECHNO_PASSWORD, TECHNO_PROFILE_DIR
```

`.env` variables:

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `TECHNO_USERNAME` | auto-login* | — | Portal username (only used if no valid session exists) |
| `TECHNO_PASSWORD` | auto-login* | — | Portal password |
| `TECHNO_PROFILE_DIR` | no | Win: dev profile; Linux/macOS: `~/.camofox/profiles/technoproperty` | Camoufox profile dir that holds a logged-in session |
| `TECHNO_BASE_URL` | no | `https://ahmedabad.technoproperty.in` | Portal base URL |
| `CAMOUFOX_HEADLESS` | no | headless on Linux/macOS, headed on Windows | `1` = headless, `0` = headed browser |

\* A valid Camoufox profile session is the primary path; credentials are only
needed when the crawler must re-login from scratch.

## Usage

```bash
node crawl.mjs --status                  # DB stats + last crawl report
node crawl.mjs --full                    # full crawl of ALL categories
node crawl.mjs --delta                   # incremental delta on all categories
node crawl.mjs --full --category Important          # one category
node crawl.mjs --full --category Important,ResidentialRent   # several
node crawl.mjs --full -c Important --no-meta   # skip contact/image backfill
node crawl.mjs --export                  # write CSVs to exports/
```

| Flag | Meaning |
|---|---|
| `--full` / `full` | Re-crawl categories completely; reconcile removed properties |
| `--delta` / `delta` | Incremental; fetch only new/changed rows + backfill contacts/images |
| `--export` / `export` | Export current DB to `exports/properties-<timestamp>.csv` |
| `--status` / `status` | Show DB stats + last crawl (default) |
| `-c, --category` | Comma-separated category keys (default: all) |
| `--no-meta` | Skip contacts + gallery-image backfill (faster, listings only) |
| `--headless` / `--headed` | Force headless/headed browser (overrides `CAMOUFOX_HEADLESS`) |
| `--check` / `check` | Environment diagnostic: deps, browser binary, headless smoke test (no portal access) |

### Category keys

`ResidentialRent`, `ResidentialSell`, `CommercialRent`, `CommercialSell`,
`Premium`, `Important`.

## Linux / headless server setup

```bash
# 1. System deps for headless Firefox + better-sqlite3 builds
sudo apt update && sudo apt install -y \
  libgtk-3-0 libasound2 libdbus-glib-1-2 libxt6 libx11-xcb1 \
  build-essential python3

# 2. Install + fetch the Camoufox browser (first time only)
cd ops/crawlAutomation
npm install
npx camoufox-js fetch

# 3. Configure (headless is the default on Linux; no DISPLAY needed)
cp .env.example .env
# edit .env: TECHNO_USERNAME, TECHNO_PASSWORD
# optional: TECHNO_PROFILE_DIR, CAMOUFOX_HEADLESS=1

# 4. Run — first run auto-logs-in via the form and persists the session
#    in ~/.camofox/profiles/technoproperty for subsequent runs
node crawl.mjs --full -c Important --no-meta   # small trial category first
node crawl.mjs --full                          # then the full crawl
```

## How it works

1. **Launch + session** — opens the Camoufox profile, navigates to the
   dashboard, and verifies the session with a real authed probe
   (`brokerpropertycount.php`). If dead, it re-authenticates via the login
   form (with `.env` creds) or reports a failure to log in.
2. **Bulk listing fetch** — for each selected category, the crawler loads the
   page's DataTable via its AJAX endpoint in large batches (up to 1000 rows),
   decrypting the site's TerraPi-protected responses in-page.
3. **Upsert + changes** — every row is fingerprinted (`lib/parse.mjs`); new
   rows are inserted, changed rows are stamped with the current crawl, and a
   `changes` audit row records `added`/`updated`/`removed` events.
4. **Removal reconciliation** — rows that stopped appearing in a category are
   deactivated at the listing level, and a per-crawl **reconcile** pass flips
   the parent property to `active=0` (and clears `categories`) when it no
   longer appears anywhere (see `reconcileActiveProperties` in `lib/db.mjs`).
5. **Meta backfill** — properties lacking contact/details or gallery images
   are queried in waves through `ajaxgetinfo.php` / `ajaxgetimages.php`.
6. **Export** — CSVs are written to `exports/` after every crawl.

## Data model (SQLite — `data/technoproperty.db`)

- **`crawls`** — one row per run: mode, timestamps, status, new/updated/removed counts.
- **`property_listings`** — per-category listing rows (the DataTable row content + fingerprint).
- **`properties`** — deduplicated property master rows: status, last-seen, active flag, category membership, contact + image completion, latest crawl id.
- **`changes`** — audit trail (`added` / `updated` / `removed`) linking a property to a crawl.
- **`categories`** — seeded from `lib/categories.mjs`.
- **`contacts` / `images`** — owner contact details and gallery image URLs fetched during backfill.

Live queries:

```sql
-- All currently active properties
SELECT * FROM properties WHERE active = 1;

-- Change history for a property
SELECT * FROM changes WHERE property_id = '<id>' ORDER BY crawl_id;

-- Non-owners who flagged properties as "Important" (shortlist)
SELECT * FROM properties WHERE active_status_id = '<shortlist-status>' ...
```

## Endpoints

See `ENDPOINTS.md` for the full catalog — listing DataTable endpoints,
contact/image reveal APIs, saved-search endpoints, and the TerraPi
(`_tpx`) encryption notes. Key endpoints:

| Purpose | Endpoint |
|---|---|
| Main listings (Rent/Sell) | `ajaxpropertydatatable.php` |
| Premium listings | `ajaxpremiumpropdatatable.php` |
| Important / shortlist | `ajaximppropdatatable.php` |
| Contact reveal | `ajaxgetinfo.php` (POST `proprow=<full_btn_id>&ajax=true`) |
| Gallery images | `ajaxgetimages.php` (POST `propertyId=<uuid>&ajax=true`) |

## Troubleshooting (headless)

Run `node crawl.mjs --check` first — it pinpoints the failing layer.

| Symptom | Cause | Fix |
|---|---|---|
| `Camoufox browser binary not found` | `fetch` never ran | `npx camoufox-js fetch` (needs internet to GitHub releases) |
| `missing Linux system libraries` / `libgtk…` | headless Firefox system deps absent | `sudo apt install -y libgtk-3-0 libasound2 libdbus-glib-1-2 libxt6 libx11-xcb1 libnss3 libxss1` |
| Smoke test fails with `Target closed` | stale profile lock or bad profile | stop other runs, delete `~/.camofox/profiles/technoproperty/lock` if orphaned |
| `No valid session` + auto-login fails | credentials wrong / site changed / CAPTCHA | verify `.env`, or log in once manually and reuse the profile |
| Everything passes but crawl hangs at login | portal unreachable from that network | verify `curl -sI https://ahmedabad.technoproperty.in` from the same machine |

## Operational notes

- Session TTL is short — the crawler re-auths mid-run and refreshes the
  session between phases.
- The site's DataTables are server-side and TerraPi-encrypted; raw `fetch()`
  gets a `403` + `_tpx` payload, which the crawler decrypts in-page.
- `data\`, `exports\`, and `.env` are gitignored — the repo never contains
  credentials or runtime state. Copy `.env.example` to `.env` locally.