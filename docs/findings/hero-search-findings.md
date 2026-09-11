# Centered hero search refinement findings

Addressbox’s opening surface places a short headline above a compact category/search module that is visibly central in the first viewport. Architech’s current hero keeps the editorial image and headline, but the initial browser viewport shows the headline near the lower portion of the screen and the search module below the fold; the search is not yet the first-viewport anchor.

The next composition should keep the Amdavad Modern image and editorial identity while shortening the vertical stack, giving the headline a controlled desktop width, placing the search frame immediately after the subhead, and reducing the space before the stats rail. On mobile, the search frame must remain full-width with comfortable touch targets and no horizontal overflow.


## Live layout measurement

After the first centering pass, the browser reported a 1,806px hero section. The inner min-height container had a top position of 706px, even though its computed `justify-content` was `flex-start` and the new padding-top was only 143px. The heading began at 898px and the search form at 1,307px in a 1,100px browser viewport. This indicates an existing layout rule or flex/margin interaction is adding a large vertical offset; the next adjustment must neutralize that offset explicitly rather than only changing justify-content.


## Final visual result

The full-bleed grain/image wrapper now uses an explicit important absolute position, preventing it from occupying normal flex flow. The hero stack starts at the top of the section, and the centered search frame is visible in the opening viewport. Desktop shows the editorial heading, search frame, and stats rail as a balanced central composition; mobile shows the same hierarchy without clipping or horizontal overflow, with full-width search controls and touch-sized tabs/buttons.


## Final verification

The final live preview shows the centered search module in the initial viewport on desktop and mobile. The search frame is visually central beneath the editorial heading, category tabs and locality quick links remain readable, and the stats rail no longer pushes the primary action below the fold. The final browser console has no output. The production build and raw HTML SEO smoke passed after the final positioning fix.


## Double focus border on the search bar

Clicking into the hero search box drew two outer borders: the shell's own rounded border plus a second offset ring around the inner text input. A text input matches `:focus-visible` even for a plain mouse click, so the global `input:focus-visible { outline: 3px … ; outline-offset: 3px }` base rule fired on every click. The `focus:outline-none` utility on the input could not cancel it, because Tailwind v4 emits utilities inside `@layer utilities` while that base rule sits in unlayered CSS — unlayered declarations win over any layered rule regardless of specificity.

The fix introduces a shared `.field-shell` contract: controls inside the shell draw no outline of their own, and the shell paints a single 2px focus edge at `outline-offset: 0` so it hugs the existing border instead of reading as a second one. The colour comes from `--field-focus` (ember on the dark hero, brick elsewhere), and a `@supports not selector(:has(input))` fallback keeps one visible edge on engines without `:has()`. The hero composer's redundant `focus-within:ring-1` was removed, and the results search and agent workspace filter now use the same shell. A regression test in `client/src/lib/ui/field-focus.test.ts` locks the contract in place.
