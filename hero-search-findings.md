# Centered hero search refinement findings

Addressbox’s opening surface places a short headline above a compact category/search module that is visibly central in the first viewport. Architech’s current hero keeps the editorial image and headline, but the initial browser viewport shows the headline near the lower portion of the screen and the search module below the fold; the search is not yet the first-viewport anchor.

The next composition should keep the Amdavad Modern image and editorial identity while shortening the vertical stack, giving the headline a controlled desktop width, placing the search frame immediately after the subhead, and reducing the space before the stats rail. On mobile, the search frame must remain full-width with comfortable touch targets and no horizontal overflow.


## Live layout measurement

After the first centering pass, the browser reported a 1,806px hero section. The inner min-height container had a top position of 706px, even though its computed `justify-content` was `flex-start` and the new padding-top was only 143px. The heading began at 898px and the search form at 1,307px in a 1,100px browser viewport. This indicates an existing layout rule or flex/margin interaction is adding a large vertical offset; the next adjustment must neutralize that offset explicitly rather than only changing justify-content.


## Final visual result

The full-bleed grain/image wrapper now uses an explicit important absolute position, preventing it from occupying normal flex flow. The hero stack starts at the top of the section, and the centered search frame is visible in the opening viewport. Desktop shows the editorial heading, search frame, and stats rail as a balanced central composition; mobile shows the same hierarchy without clipping or horizontal overflow, with full-width search controls and touch-sized tabs/buttons.


## Final verification

The final live preview shows the centered search module in the initial viewport on desktop and mobile. The search frame is visually central beneath the editorial heading, category tabs and locality quick links remain readable, and the stats rail no longer pushes the primary action below the fold. The final browser console has no output. The production build and raw HTML SEO smoke passed after the final positioning fix.
