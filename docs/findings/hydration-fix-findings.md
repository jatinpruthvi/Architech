# Homepage hydration fix findings

## Reproduction

The attached React warning showed two categories of differences on the homepage. `bis_skin_checked="1"` was injected across many unrelated DOM elements, including metadata wrappers, the header, tabs, cards, and footer; this is browser/DOM instrumentation rather than application-rendered content. The application-owned difference was the hidden Radix `TabsContent` child text (`Buy homes search mode` / `Rent homes search mode`) in the hero search tree.

## Fix

Removed the hidden `TabsContent` children and unused `TabsContent` import from `client/src/pages/Home.tsx`. The visible buy/rent `Tabs`, controlled intent state, query input, keyboard suggestions, navigation, and accessible combobox/search semantics remain unchanged. Added the restored managed preview hostname to `next.config.ts` `allowedDevOrigins` and restarted the dev server to prevent cross-origin dev-resource warnings in the browser.

## Verification

The managed homepage renders on desktop and mobile. The browser console is clean after a fresh reload. TypeScript, ESLint, 242 unit tests, production build via `pnpm build:ci`, and the 9-route raw HTML SEO smoke suite pass. The fix does not remove intended motion, search behavior, accessibility, or crawlable page content.
