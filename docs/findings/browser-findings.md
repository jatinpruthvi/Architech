# Chrome Inspection Findings — 2026-08-25

## Current preview
- Browser session: sandbox Chrome preview of Architech.
- Homepage title: `Architech — Find the place before the address. Homes in Ahmedabad.`
- Primary page rendered and links are visible.
- Homepage contains a hero image, search controls, listing cards, locality index, methodology accordion, and footer.

## Navigation test
- Clicking `EXPLORE AHMEDABAD` successfully navigated to `/buy/ahmedabad/`.
- Route title/content rendered: `Buy in Ahmedabad — localities with verified context · Architech`.
- Six locality links are visible: Paldi, Navrangpura, Prahlad Nagar, Thaltej, Bopal, Satellite.
- The page exposes trust metrics and footer links.

## Visual observation
- The browser screenshot shows a very dark hero area on the homepage and large green/yellow accessibility annotation boxes around controls. The annotations are browser inspection overlays, not confirmed application styling defects.
- The Ahmedabad locality route rendered without an obvious blank or error state in the initial viewport.

## Next checks
- Test locality detail links, search form, listing detail links, theme/Hindi controls, accordion content, saved route, list-property flow, and mobile layout.
- Inspect browser console/network logs and source if a flow fails.

## Paldi route inspection
- Clicking Paldi from `/buy/ahmedabad/` successfully navigated to `/buy/ahmedabad/paldi/`.
- Route title/content rendered and includes locality facts, nearby links, listing cards, trust panel, and footer.
- Scrolling one viewport produced a screenshot where most content was visually blank while only small link outlines/annotations were visible. This is a likely render/animation/visibility defect to investigate, although browser inspection annotations may affect the screenshot.
- The route still reports substantial page content below the fold (`2708` pixels), so this is not an obvious missing-route or 404 failure.

## Computed-style check
- Chrome console had no runtime output or errors.
- DOM inspection found `document.body.scrollHeight = 4000` and `main.scrollHeight = 3461`.
- Representative Paldi headings, paragraphs, and sections had `display: block`, `visibility: visible`, `opacity: 1`, and `transform: none`.
- The apparent blank region is therefore not explained by a global opacity/visibility state; the next check should focus on the exact viewport-intersecting nodes, stacking/positioning, and any layout offset caused by the sticky header or scroll state.

## Search-route interaction
- Header navigation from Paldi to `/search/` succeeded.
- The search page exposed a query field, filter buttons, sort combobox, listing cards, and a `SEARCH THIS AREA` action.
- Attempting to input into the previously indexed query field failed because Chrome reported the element index was stale and the current DOM had no stamped clickable elements. This indicates the page snapshot can mutate during route hydration/transition; refresh the browser view before retrying and check whether the search control remains usable after hydration.

## Chrome session reset and reload
- After the stale search-field interaction, Chrome’s page unexpectedly reset to `about:blank` when refreshed.
- Reopening the managed Architech preview succeeded and restored the homepage with all expected primary controls.
- This points to a browser-session or route-transition instability in addition to the confirmed hidden Reveal nodes; it should be separated from actual application failures during subsequent tests.

## Clean search submission test
- Direct navigation to `/search/` succeeded and exposed the search field and filters.
- Entering `Paldi` and pressing Enter did not preserve the query: Chrome ended at `/search/?`, the field returned to its placeholder, and the result summary still showed all four demo homes.
- This is a confirmed functional defect in query submission or URL/state synchronization, separate from the Reveal visibility issue.

## Search button submission test
- Filling the field without submitting visibly showed `Paldi` in the input.
- Clicking the visible Search button then reset the field to its placeholder and kept the URL at `/search/?` with all four homes.
- The issue is reproducible with both Enter and the visible button, so the defect is in the React form/route transition rather than only keyboard automation.

## Console validation attempt
- Chrome console remained free of application errors after the search failure.
- A native-event validation script was attempted but failed before execution because the browser console accepts JavaScript, not TypeScript syntax (`as HTMLInputElement`). No application behavior was changed by this attempt.

## Filter interaction test
- Clicking `3 BHK +` did not update the URL or results.
- DOM inspection immediately afterward showed `aria-pressed="false"` and the inactive filter classes, confirming the handler did not produce a persistent state change.
- The current search controls therefore share a reproducible interaction failure in Chrome: the query and filter actions both appear to respond visually only transiently, then revert to the URL-derived state.

## DOM handler confirmation
- Triggering the same `3 BHK +` filter through the page’s native DOM `button.click()` also left `aria-pressed="false"` and the URL unchanged.
- The failure is not caused by the browser’s element-index targeting. The next diagnostic focus is client hydration or bundle loading, because server-rendered links work while client-only button handlers do not.

## Hydration repair verification
- Next.js was restarted after adding the managed `*.manus.computer` preview origin to `allowedDevOrigins`.
- The homepage reloaded successfully, and navigation to `/search/` now shows the MapLibre canvas, result images, sort value `FRESHEST FIRST`, and hydrated client UI that was missing before.
- The large blank search/results region is no longer present in the Chrome screenshot; the Atlas Lens and listing cards are visibly rendered.
- This strongly confirms that blocked cross-origin Next.js dev chunks were the root cause of the inert controls and hidden Reveal content.

## Repaired search verification
- After the Next.js origin fix, clicking `3 BHK +` changed the URL to `?filters=3bhk`, set the active state, reduced the result count from 4 to 2, and updated the map markers.
- Filling `Paldi` and clicking Search then changed the URL to `?filters=3bhk&q=Paldi`, retained the query in the input, showed `Clear search “Paldi”`, and reduced the result count to 1.
- Search URL synchronization and filtered results now work as intended in Chrome.

## Listing dossier test
- The filtered result navigated successfully to `/listing/garden-courtyard/` and rendered the full dossier, map, trust panel, partner CTA, and nearby listings.
- Clicking the listing’s Save control scrolled/updated the page without a visible label change in the element snapshot; its exact saved-state semantics need a DOM/local-storage check.
- The listing page itself is no longer blank after hydration repair and exposes the expected interactive RERA, save, and lead controls.

## Hindi interaction
- After the second restart, the homepage language toggle worked: navigation, hero controls, counts, CTAs, footer links, and much of the content changed to Hindi, and the toggle changed to `EN`.
- Some listing titles, badges, locality descriptions, and method labels remain English in Hindi mode. This appears to be an incomplete translation coverage issue rather than a hydration failure and should be reviewed against the intended Phase 1 Hindi scope.

## Theme interaction
- Dark-mode toggle worked after hydration repair; `<html>` received the `dark` class and the document background changed to `rgb(23, 19, 16)` with light heading text.
- Persistence is stored in `localStorage` as `architech.theme = dark` and `architech.lang = hi`.
- Theme behavior is functional. The remaining concern is translation completeness in Hindi mode, not the theme control.

## Seller and broker route
- `/list-property/` rendered correctly in Hindi mode and linked to `/broker/listings/new/`.
- The new listing route rendered a complete broker draft form with title, price, BHK, area, availability, RERA number, locality select, description, media-rights checkbox, and Create draft action.
- The form is visibly hydrated in Chrome, but the browser currently reports a Next DevTools `Rendering...` indicator; validation and draft submission still need a safe check.

## Broker validation test
- Replaced the title with the invalid value `x` and clicked Create draft without changing any other field.
- No draft was created, no route changed, and no backend write was initiated; the form remained on the draft page.
- The validation message was not visible in the extracted text after the click, which may indicate the error panel was inserted below the captured viewport or that its localized styling/content is low contrast. This requires a DOM check before treating validation as fully verified.

## Validation DOM confirmation
- The first browser-click snapshot did not expose validation text, but DOM-triggering the same Create draft button produced all expected validation errors: title length, positive price, minimum area, availability, description length, and media-rights confirmation.
- No draft was created and the route stayed unchanged. The validation logic is functional; the earlier missing message was a viewport/snapshot timing artifact.

## Windows-local smoke test
- After synchronizing and restarting the Windows-local app, `http://127.0.0.1:3000/` returned HTTP 200 with the expected Architech title.
- The local Next.js log also showed a request to `/buy/ahmedabad/satellite/` returning HTTP 404, revealing a broken advertised locality route that must be fixed before final verification.

## Satellite route recovery
- The complete source archive restored the omitted dynamic route files in the Windows-local project. After restart, the active managed Chrome preview rendered `/buy/ahmedabad/satellite/` successfully with its title, Hindi-aware content, map context, nearby locality links, and trust band.
- Chrome’s console was empty on the recovered Satellite route, so the route no longer shows a client runtime or hydration error.
- The earlier Windows 404 was caused by the incomplete local extraction, not by the locality registry or dynamic page implementation.

## Final Chrome smoke
- After the final restart, the homepage rendered from clean code with the six Ahmedabad locality links present, including Satellite.
- Clicking the homepage `खोज शुरू करें` control successfully replaced the visible content with the search experience and preserved the localized Hindi/dark-mode state. The browser snapshot briefly showed `Compiling...` during the first client transition; a follow-up URL/content check is still appropriate after compilation settles.

## Settled search verification
- Once the first transition finished, Chrome showed the canonical `/search/` URL with four homes and all search controls visible.
- Clicking `3 BHK +` changed the URL to `/search/?filters=3bhk`, displayed `सब हटाएँ`, reduced the visible results to two, and updated the map/list content. This confirms client hydration and URL-synced filtering remain functional after the provider and build fixes.

## Delivery verification
The final visual verification covered the homepage, Ahmedabad hub, filtered search, and listing dossier. The independent visual review found that the Amdavad Modern design remains strong and coherent and returned `Style holds up — ship it.`

The final Windows-local smoke test returned HTTP 200 for `/`, `/buy/ahmedabad/`, `/buy/ahmedabad/paldi/`, `/buy/ahmedabad/satellite/`, `/search/`, and `/listing/garden-courtyard/`.
