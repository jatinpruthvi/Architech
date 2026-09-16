# TechnoProperty Endpoint Catalog

> Cataloged 2026-09-15. All endpoints under `https://ahmedabad.technoproperty.in/`.
> Excluded per user directive: `myactivities.php`, `faqs.php`.

---

## 1. Listing / DataTable Endpoints

All listing pages use server-side DataTables with AJAX. The **main** listing pages (`ResidentialRent/Sell`, `CommercialRent/Sell`, `listproperty`) share one endpoint. Premium and Important have their own.

### `ajaxpropertydatatable.php` — Main listing (shared)

**Used by:** ResidentialRent.php, ResidentialSell.php, CommercialRent.php, CommercialSell.php, listproperty.php, brokersproperty.php (when broker mode is online)

**Method:** POST (application/x-www-form-urlencoded)

**Minimal params (verified working):**
```
draw=1&start=0&length=25&searchvalue=all&propertytype=<guid>&countcategory=<display+name>&initiallisting=1&order[0][column]=3&order[0][dir]=desc
```

**Full params (from DataTable init):**
```
draw=1&columns[0][data]=0&columns[0][name]=&columns[0][searchable]=true&columns[0][orderable]=false&...
start=0&length=25
searchvalue=<filter>    # "all" | "deleted" | "uploaded" | "self" | saved-search-id
propertytype=<guid>     # category UUID from categories.mjs
countcategory=<name>    # display name e.g. "Residential Rent"
initiallisting=1        # REQUIRED — 0 returns global 31557 list instead of filtered
listingsearch=<text>    # text search (optional)
premise=<text>          # premise filter (optional)
order[0][column]=3&order[0][dir]=desc  # date column, newest first
```

**TerraPi:** YES — returns `{"_tpx":1,...}` encrypted payload on first call. Requires `tpxDecrypt()`.

**Category GUIDs:**
| Category | propertytype | countcategory | Total |
|---|---|---|---|
| Residential Rent | `c7f77b53-1a4c-4fe7-1c9e-5147f5e13535` | `Residential Rent` | ~1960 |
| Residential Sell | `337b7338-d305-ae3c-304b-5147f5ccf3f9` | `Residential Sell` | ~18190 |
| Commercial Rent | `a40ec292-c8dd-bb7f-6470-5147f5b8e625` | `Commercial Rent` | ~3785 |
| Commercial Sell | `b2e312a4-7af1-2c47-0082-5147f5fd18a3` | `Commercial Sell` | ~7618 |
| (All/listproperty) | *(empty)* | *(empty)* | ~31553 |

**Note:** The page's own DataTable uses jQuery `$.ajax()` which goes through TerraPi interceptor (adds anti-bot headers → server returns raw JSON). Our `page.evaluate(fetch())` bypasses this → server returns 403 with `_tpx` encrypted payload → `tpxDecrypt()` decrypts it.

---

### `ajaxpremiumpropdatatable.php` — Premium listing

**Used by:** premiumPropList.php

**Method:** POST

**Key params (captured from live page):**
```
draw=1
columns[0..18][data]=0..18  (full column defs — 19 columns)
columns[0..18][searchable]=true
columns[0..18][orderable]=false (except col 3 = true)
order[0][column]=3&order[0][dir]=desc
start=0&length=25
search[value]=&search[regex]=false
premium_filter=premiumproperty   ← KEY: distinguishes premium from main
searchvalue=                      ← empty string (NOT "all")
```

**Counts:** ~1848 properties

**TerraPi:** YES — same encryption as main.

---

### `ajaximppropdatatable.php` — Important / Shortlisted listing

**Used by:** importantPropList.php

**Method:** POST

**Key params (captured from live page):**
```
draw=1
columns[0..18][data]=0..18
columns[0..18][searchable]=true
columns[0..18][orderable]=false (except col 3 = true)
order[0][column]=3&order[0][dir]=desc
start=0&length=25
search[value]=&search[regex]=false
searchvalue=                      ← empty string (NOT "all")
```

**Counts:** ~135 properties (shortlisted by current broker)

**TerraPi:** YES.

---

## 2. Property Data Endpoints

### `ajaxgetinfo.php` — Contact/Owner reveal

**Method:** POST

**Params:**
```
proprow=<btn_id>    # MUST be full id including "getcntinfo_" prefix
ajax=true
```

**Response shape (JSON):**
```json
{"status":"success","html":"Owner Name<br>9879111496"}
{"status":"fail","html":"Try Again<br>Refresh page..."}
```

**Notes:**
- The `proprow` value is the HTML `id` attribute of the contact button element, e.g. `getcntinfo_MTA2NzM3IyMwOTE1MjY`
- PHP splits on `_` and reads key[1] — bare token (without prefix) → "Undefined array key 1" error
- Heavy batch requests (>2000) get rate-limited → many `{"status":"fail"}` responses
- Parse: split HTML on `<br>` → name is part[0], phone is part[1] (10-digit)
- **TerraPi:** YES

---

### `ajaxgetimages.php` — Gallery image URLs

**Method:** POST

**Params:**
```
propertyId=<propid>   # The UUID property id (from data attribute)
ajax=true
```

**Response shape (HTML):**
```html
<div class="tp-gallery" data-gallery>
  <script type="application/json" class="js-gallery-images">
    ["https://s3.amazonaws.com/...", ...]
  </script>
</div>
```

**Parse regex:**
```regex
/<script[^>]*class="js-gallery-images"[^>]*>\s*(\[[\s\S]*?\])\s*<\/script>/
```

**TerraPi:** YES

---

### `ajaxMorePropInfo.php` — Extended property details

**Status: UNREACHABLE on current pages.** The trigger element `[id^="showMoreInfo_"]` does not exist on current ResidentialRent/Sell or CommercialRent/Sell DataTable rows (verified via full DOM scan of 25 rendered rows). Appears to be legacy code retained from an older version. Not worth wiring into crawler.

---

### `ajaxgetwhatsappmsg.php` — WhatsApp share link

**Status: UNREACHABLE on current pages.** The trigger element `[id^="wtsappid_"]` does not exist in desktop DataTable rows (25-row DOM scan confirmed). The visible button is `whatsapplink_<propId>` (which common.min.js handles client-side without calling this endpoint). The `wtsappid_` element is likely only present in mobile cards or the expandable side panel, neither of which render in our headless/desktop DataTable context. Not worth wiring.

---

## 3. Filtered Search Endpoints

### `ajaxsavedsearch.php` — Saved search list

**Used by:** filteredPropList.php (left sidebar panel)

**Method:** GET

**Params:**
```
action=list     ← REQUIRED (returns 400 "Invalid action specified" without it)
```

**Response (JSON):**
```json
{"success":true,"data":[],"count":0}
```

**Status:** Confirmed working. Currently returns empty array (no saved searches for this broker account).

**TerraPi:** NO — returns raw JSON.

---

### `ajaxpaginationlist.php` — Paginated property cards (filtered search)

**Used by:** filteredPropList.php (when clicking saved search or typing search)

**Method:** POST

**Params (saved search click):**
```
pagenum=1&searchvalue=<saved_search_id>&propertytype=<listfilterproptype>
```

**Params (text search):**
```
pagenum=1&searchvalue=<search_term>    # min 3 chars
```

**Params (blanket load):**
```
&nomenu=true&ajax=true
```

**Params (pagination display):**
```
show=<numRecords>&pagenum=<pageNum>&propertytype=<listfilterproptype>
&mobileSearch=<search>&mobileorderby=<order>
```

**Response:** HTML fragments (property cards to append to `#resultDiv`)

**Notes:** 
- `listfilterproptype` = value of `#listfilterproptype` hidden input on the page
- The auto-load loop (`propertylisting(divid)`) calls repeatedly with increasing pagenum until "NO RECORD" is returned
- **TerraPi:** Likely YES

---

## 4. Mutation Endpoints (Write/Action)

These modify data on the server. Not needed for crawling, but documented for completeness.

### `ajaxpropnoteupdate.php` — Update special note
- POST: `{value, rownum, field="splnote"}`
- Used by inline edit on note columns

### `ajaxupdate.php` — Inline cell edit
- POST: `{value, rownum, field}`
- Used by non-note inline edits

### `ajaxrentedoutprop.php` — Toggle rented/sold status
- POST: `{propertyId, propchecked, ajax:true}`
- Returns `"SUCCESS"` on success

### `ajaximpproperty.php` — Mark/unmark property as important
- POST: `{propertyId, propchecked, ajax:true}`

### `ajaximppremise.php` — Mark/unmark premise as important
- POST: `{premiseId, premisechecked, ajax:true}`

### `ajaximpbroker.php` — Mark/unmark broker as important
- POST: `{brokerId, brokerchecked, ajax:true}`

### `ajaxlistproperty.php` — List/unlist property
- POST: `{propertyId, propchecked, ajax:true}`

### `ajaxbrokerupdate.php` — Toggle broker list status
- POST: `{field:"listbroker", value, rownum, ajax:true}`

### `addnewdropdown.php` — Add new dropdown option
- POST: `{val, tablename, typeofprop, ajax, multi}`

---

## 5. Analytics/Utility Endpoints

### `ajaxdetectdevice.php` — Device/user-agent logging
- POST: `{pagename, browsername, browserver, osname, devicename, ajax:true}`
- Fires on every page load

### `log_action.php` — Copy/restriction logging
- Called via `navigator.sendBeacon()` from protect.js
- Logs: selection, copy, contextmenu, print_attempt

### `brokerpropertycount.php` — Broker property counts (dashboard)
- GET: returns HTML section with live broker property counts
- Useful as session health probe

### `ajaxbrokerareacount.php` — Area-based broker counts
- GET with params: currently returns "Invalid request" (needs investigation)
- Referenced from topareadata.php

### `ajax_notification.php` — Notification management
- POST: `{action:"mark_read", notification_id}`

---

## 6. Pages (Non-AJAX)

| Page | Has DataTable | Uses Endpoint |
|---|---|---|
| dashboard.php | No | brokerpropertycount.php |
| filteredPropList.php | Yes (client-side) | ajaxpaginationlist.php, ajaxsavedsearch.php |
| ResidentialRent.php | Yes (server-side) | ajaxpropertydatatable.php |
| ResidentialSell.php | Yes (server-side) | ajaxpropertydatatable.php |
| CommercialRent.php | Yes (server-side) | ajaxpropertydatatable.php |
| CommercialSell.php | Yes (server-side) | ajaxpropertydatatable.php |
| listproperty.php | Yes (server-side) | ajaxpropertydatatable.php |
| brokersproperty.php | Yes (server-side) | ajaxpropertydatatable.php |
| premiumPropList.php | Yes (server-side) | ajaxpremiumpropdatatable.php |
| importantPropList.php | Yes (server-side) | ajaximppropdatatable.php |
| topareadata.php | No | ajaxbrokerareacount.php |
| notifications.php | No | — (page-only) |
| suggestions.php | No | — |
| updateprofile.php | No | — |

**Locked/offline:**
- brokersproperty.php → `brokerMode=offline` (needs separate kaizenproperty.org portal)
- myactivities.php → EXCLUDED per user
- faqs.php → EXCLUDED per user

---

## 7. Session & Auth Notes

- **Single-session account:** Session TTL appears short (~1-2 min for API calls). Multiple rapid requests from different page contexts can invalidate the session.
- **Session probe:** `GET brokerpropertycount.php` → returns `<section...` HTML when authed, login page HTML when not.
- **TerraPi intercept:** Server-side TerraPi (`_tpx`) encrypts responses for protected endpoints. jQuery `$.ajax()` goes through client-side interceptor that adds anti-bot headers → server returns raw JSON. Raw `fetch()` bypasses interceptor → server returns `403` with `_tpx` encrypted payload.
- **Anti-CSRF:** `initiallisting=1` is REQUIRED for main DataTable; `0` returns unfiltered 31557 list.
- **Premium filter:** empty `searchvalue` + `premium_filter=premiumproperty` (NOT `searchvalue=all`)
- **Important filter:** empty `searchvalue` only (no special filter param)
