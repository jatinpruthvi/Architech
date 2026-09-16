# Property Crawler System — Full Documentation

## Architecture Overview

Two independent crawlers sharing one core library:

```
automation/
├── housing-lib.mjs              ← shared core: engines, cookie mgmt, profile resolution, HTML fetch
├── housing-crawler.mjs          ← housing.com crawler (CLI, multi-engine)
├── full-crawl.mjs               ← addressbox.com crawler (browser-based, click-pagination)
├── visible-browser.mjs          ← headed Camoufox launcher (manual login / debug)
├── extract-data.mjs             ← CLI extractor for housing.com JSON/HTML
├── crawl-data.json              ← housing.com output (listings)
├── crawler-state.json           ← housing.com checkpoint (resume)
├── crawl-ahmedabad.json         ← housing.com 6559 listings (Ahmedabad search)
├── crawler-state-ahmedabad.json ← housing.com checkpoint (nextPage 222, totalPages 484)
├── addressbox-links.json        ← addressbox.com unique detail URLs
├── addressbox-properties.json   ← addressbox.com crawled property details
├── addressbox-cookies.json      ← addressbox.com auth cookies (JWT)
└── vendor/
    └── curl-impersonate/
        ├── curl-impersonate.exe  ← Chrome 116 TLS fingerprint impersonation binary
        └── curl_chrome136.bat
```

Profiles (outside workspace):
```
~/.camofox/profiles/
  ├── {sha256("jatin").slice(0,32)}/        ← jatin profile (property crawls)
  │   └── storage-state.json                (cookies, localStorage, sessionStorage)
  └── {sha256("mcp-user").slice(0,32)}/     ← default MCP profile
      └── storage-state.json
```

---

## File-by-File Reference

### `housing-lib.mjs` — Shared Engine Core

| Export | Purpose |
|---|---|
| `profilePathFor(userId)` | Hash of userId → path to `storage-state.json` |
| `cookieHeader(url, profilePath)` | Reads storage-state, filters cookies by domain/path/secure, returns `name=value; ...` header string |
| `fetchHtmlImp(url, {profilePath, customCookies})` | Fetches via curl-impersonate (TLS fingerprint of Chrome 116), injects profile cookies, saves to temp file, parses `__DONE__ {status} {finalUrl}` |
| `fetchHtml(url)` | Plain `node-fetch` (no TLS impersonation) |
| `extractInitialState(html)` | Regex-extracts `window.__INITIAL_STATE__` JSON from housing.com HTML |
| `summarizeSearchListing(l)` | Normalises raw search listing shape into clean object |
| `summarizeListingDetail(d)` | Normalises raw listing detail shape into clean object |
| `summarizePage(st, url)` | Wraps page-level data extraction |
| `extractData(state, url)` | Full detail extractor (price, deposit, brokerage, coords, amenities, images, developer, etc.) |
| `sellerInfo(sellers)` | Extracts contact_name, brokerage, etc. from the sellers array |

Key internals:

```
IMP_RECIPE   = curl-impersonate flags (ciphers, curves, HTTP/2, ECH, ALPS, TLS grease)
CHROME_UA    = Chrome 136 user-agent string
CURL_BIN     = vendor/curl-impersonate/curl-impersonate.exe
DEFAULT_PROFILE = ~/.camofox/profiles/a75a86.../storage-state.json
```

---

### `housing-crawler.mjs` — housing.com CLI Crawler

Three engines (priority order with `--curl` / `--browser` / default):

| Engine | Flag | How it works |
|---|---|---|
| http (default) | (none) | `fetchHtml` → node-fetch → look for `__INITIAL_STATE__` |
| curl | `--curl` | `fetchHtmlImp` → curl-impersonate with profile cookies → look for `__INITIAL_STATE__` |
| browser | `--browser` | Camoufox browser via API (localhost:9377) → extract via RSC/JS evaluation |

CLI flags:

```bash
node housing-crawler.mjs \
  --curl                        # use curl-impersonate engine
  --profile jatin               # which Camoufox profile
  --resume                      # resume from checkpoint state file
  --deep                        # also crawl detail pages for each listing
  --delay 2500                  # ms between requests (default 2500)
  --max-pages 0                 # stop after N search pages (0 = unlimited)
  --max-listings 0              # stop after N listings (0 = unlimited)
  --cooldown 0                  # pause N minutes if 406 blocked
  --out crawl-data.json         # output listings file
  --state crawler-state.json    # checkpoint state file
  'https://housing.com/search/...'   # seed URL(s)
```

State file format (crawler-state.json):

```json
{
  "seenListingIds": [63313459],
  "listings": [],
  "deepIds": [],
  "pagesFetched": 100,
  "nextPage": 101,
  "totalPages": 484,
  "startedAt": "2026-08-13T..."
}
```

Output format (crawl-data.json):

```json
[
  {
    "id": 63313459,
    "title": "2 BHK Flat...",
    "url": "https://housing.com/in/...",
    "price": 25000,
    "locality": "Memnagar",
    "bedrooms": 2,
    "bathrooms": 2,
    "area_sqft": 1080,
    "deposit": 75000,
    "brokerage": 0,
    "maintenance": 2500,
    "furnishing": "semi_furnished",
    "facing": "East",
    "available_from": "2026-09-01",
    "coordinates": { "lat": 23.03, "lng": 72.54 },
    "amenities": ["lift", "parking"],
    "images": ["url1", "url2"],
    "developer": { "name": "...", "logo": "..." },
    "sellers": [{ "name": "...", "brokerage": 0, "phone": "..." }],
    "rera_number": "PR/GJ/..."
  }
]
```

---

### `full-crawl.mjs` — addressbox.com Browser Crawler

Uses `camoufox-js` directly (no API server) with the jatin profile.

Two-phase flow:

**Phase 1 — Collect links (click-pagination):**

1. Navigate to search page (`BASE_SEARCH`)
2. Extract all `<a href*="propertydetail">` links from DOM
3. Click the `Next >` pagination button (real mechanism — `?page=N` is ignored by the site)
4. Wait for the `searchProperty` API response, then extract new unique links
5. Stop when `Next >` disappears or no new links after 3 consecutive clicks
6. Save deduped links to `addressbox-links.json`

**Phase 2 — Crawl details:**

1. Load each detail URL in browser
2. Evaluate DOM to extract title, price, details, headers, tables, images
3. Save progress every 5 properties (resume-safe)
4. Dedup by `pid` extracted from `?pid=` param

CLI flags:

```bash
AB_MAX_PAGES=20 node full-crawl.mjs    # limit pages in Phase 1
```

Output files:

| File | Content |
|---|---|
| `addressbox-links.json` | Array of unique detail URLs with `?pid=XXX` |
| `addressbox-properties.json` | Array of crawled property objects |

Detail object shape:

```json
{
  "url": "https://www.addressbox.com/propertydetail/...",
  "scrapedAt": "2026-08-13T...",
  "title": "2 BHK Flat/Apartment for Rent in Sun Breez Towers",
  "price": "₹ 25,000 Onwards",
  "details": ["..."],
  "headers": ["..."],
  "tables": [],
  "images": ["https://..."]
}
```

---

### `visible-browser.mjs` — Headed Camoufox Launcher

```bash
node visible-browser.mjs
```

Opens a visible Chrome window with the jatin profile. Useful for manual login, cookie refresh, or debugging. Cookie changes persist to the profile directory automatically.

---

### `extract-data.mjs` — housing.com Data Extractor

```bash
node extract-data.mjs crawl-data.json           # from processed crawl
node extract-data.mjs raw-response.json          # from raw __INITIAL_STATE__
node extract-data.mjs saved-page.html            # from saved HTML
```

Reads `__INITIAL_STATE__` from the input, runs `extractData()`, outputs clean JSON.

---

## Key Findings (anti-bot landscape)

### housing.com

- Protected by **Akamai Bot Manager** (`_abck`, `ak_bmsc`, `bm_sz` cookies)
- 406 "Request Rejected" is **IP-level** rate limiting (all engines blocked simultaneously)
- Block clears after 15–60+ minute cooldown
- curl-impersonate (Chrome 116 TLS fingerprint) bypasses TLS fingerprinting
- Real browser profile cookies are required to pass the JavaScript challenge
- Search pages contain `window.__INITIAL_STATE__` with all listing/detail data
- Login persisted via `hasLoginAuth=true` cookie (70 cookies in storage-state)

### addressbox.com

- No Akamai/Cloudflare — returns 200 OK, but data is **client-rendered** (Next.js RSC)
- `?page=N` URL query is **ignored** — same content every time
- Real pagination is **click-driven** via `Next >` button
- Backend API: `POST /fun_api/v1/searchProperty?page=N&limit=10&nearby=false`
  - Body: `{"property_id":101375,"sub_property_id":[106876],"listing_type":"RENT","city":"Ahmedabad"}`
  - Returns structured JSON with `meta.totalRecords`, `seo_url`, and 40+ fields per record
- Detail pages require `pid` (encoded via `ea.Bo()` in frontend JS — not in API response)
- `pid` can only be obtained from the browser DOM (rendered after client-side JS)

---

## How to Adapt for Another Website

### Step 1: Reconnaissance

Questions to answer:

```
□ What page type?  (WordPress / Next.js / React SPA / server-rendered)
□ Is there Akamai/Cloudflare/bot protection?
□ How does listing pagination work?  (?page=N / click / infinite scroll / API)
□ Where does data live?  (SSR HTML / __NEXT_DATA__ / RSC stream / JS API)
□ What does a detail page look like?
□ Are there login-gated pages you need?
```

How to test:

```bash
# Check for bot protection
curl -v -o /dev/null "https://target-site.com" 2>&1 | grep -i "akamai\|cloudflare\|_abck\|406"

# Check SSR vs SPA
curl -s "https://target-site.com/page" | grep -o "__INITIAL_STATE__\|__NEXT_DATA__\|self.__next_f.push"

# Check API-based pagination (use browser DevTools Network tab → filter XHR → look for JSON)
# Check cookie requirements (save from browser, try curl with/without)
```

### Step 2: Set Up Profile & Cookies

```bash
# Create a named profile (one-time)
npx.cmd camofox-browser profile create mysite-user

# Open visible browser and log in
node visible-browser.mjs   # change PROFILE_DIR to your profile hash
```

Profile hash = `sha256("mysite-user").slice(0, 32)` stored at:
```
~/.camofox/profiles/{hash}/storage-state.json
```

### Step 3: Choose Crawler Type

| Site behaviour | Best approach | Example file |
|---|---|---|
| Server-rendered HTML with `__INITIAL_STATE__` | curl-impersonate (fast, no browser) | `housing-crawler.mjs` |
| Client-rendered (Next.js RSC, React SPA) | Camoufox browser (JS execution required) | `full-crawl.mjs` |
| Has a public/internal API returning JSON | curl POST with cookies (fastest) | `test-search-api-post.mjs` pattern |

### Step 4: Build the Link Collector

**Browser click-pagination** (like `full-crawl.mjs`):

```javascript
// Adapt these constants:
const BASE_SEARCH = 'https://newsite.com/search/rent-in-city';
const LINK_SELECTOR = 'a[href*="/property/"]';       // your detail link pattern
const NEXT_SELECTOR = 'a.next-page';                  // your pagination button
const RESPONSE_URL_FILTER = 'searchProperty';         // API call that loads new results

// Key function: extract unique links after each page load
async function extract(page) {
  const raw = await page.evaluate((sel) => {
    return [...document.querySelectorAll(sel)]
      .map(a => a.href).filter(Boolean);
  }, LINK_SELECTOR);

  // Dedup by your unique key (pid, slug, id — whatever distinguishes listings)
  return [...new Set(raw)];
}
```

**API-based pagination** (like the searchProperty POST):

```javascript
// Step 1: Capture the real API endpoint using DevTools Network tab
// Step 2: Replicate it with curl-impersonate

const BODY = JSON.stringify({ city: "Ahmedabad", listing_type: "RENT" });
const r = await fetchHtmlImp(API_URL + '?page=' + pageNum + '&limit=20', {
  profilePath: PROFILE,
  // for POST, use curl directly (fetchHtmlImp is GET-only)
});

// If the API returns structured JSON:
const data = JSON.parse(r.body);
const links = data.data.map(item => ({
  id: item.property_basic_details_id,
  slug: item.seo_url,
  // pid may need browser extraction or reverse-engineering
}));
```

### Step 5: Build the Detail Extractor

**Option A — Browser DOM extraction** (adaptable to any site):

```javascript
const data = await page.evaluate(() => ({
  title: document.querySelector('h1')?.textContent?.trim(),
  price: document.querySelector('[class*="price"]')?.textContent?.trim(),
  area: document.querySelector('[class*="area"]')?.textContent,
  // Add your site's selectors here
}));
```

**Option B — SSR HTML extraction** (if detail page is server-rendered):

```javascript
const r = await fetchHtmlImp(detailUrl + '?pid=' + pid, { profilePath: PROFILE });
const state = extractInitialState(r.body);  // for housing.com-style sites
// or use node-html-parser:
const root = parse(r.body);
const title = root.querySelector('h1')?.textContent;
```

### Step 6: Handle Anti-Bot Measures

| Protection | Countermeasure |
|---|---|
| Akamai (`_abck` / 406 block) | curl-impersonate with profile cookies + delay 2–3s between requests |
| Cloudflare | Camoufox browser + profile cookies (bypasses JS challenges) |
| Rate limiting (IP-based) | Cooldown mode, rotate profiles, add delay |
| Login-required content | Save authenticated session in profile, refresh JWT before expiry |

### Step 7: Checkpoint & Resume

Always save state every N items so you can resume:

```javascript
if ((i + 1) % 10 === 0) {
  writeFileSync(STATE_FILE, JSON.stringify(state));
}
```

Resume logic:

```javascript
if (existsSync(STATE_FILE)) {
  state = JSON.parse(readFileSync(STATE_FILE));
  console.log(`Resuming from page ${state.nextPage}`);
}
```

---

## Quick-Start Copy Template

To clone `full-crawl.mjs` for a new site, change these 5 things:

```javascript
const PROFILE_DIR = 'C:\\Users\\Mishay\\.camofox\\profiles\\{YOUR_PROFILE_HASH}';
const BASE_SEARCH = 'https://newsite.com/search/your-query';
const LINKS_FILE = 'newsite-links.json';
const OUTPUT_FILE = 'newsite-properties.json';

// In the extract() function:
const LINK_SELECTOR = 'a[href*="/propertydetail/"]';  // your link pattern

// In the clickNext() function:
const NEXT_TEXT = 'Next >';   // your pagination button text

// In crawlDetails():
const DETAIL_EXTRACT = () => { /* your selectors here */ };
```

Run:

```bash
node full-crawl.mjs
```

---

## Current Data Status

| Dataset | Records | Pages | Status |
|---|---|---|---|
| housing.com Ahmedabad search | 6,559 listings | 221 / 484 crawled | Blocked at page 222 (Akamai cooldown). Resume ready. |
| housing.com Ahmedabad deep | 3 detail pages | 6,559 total | Deep crawl not yet run (~4.5 hours at 2.5s delay) |
| addressbox.com Ahmedabad | 30 properties | 3 pages tested | Phase 1 (link collection) works. Full 402-record crawl pending. |
| addressbox.com detail | 30 properties | full | All crawled, 0 errors, 0 duplicates |
