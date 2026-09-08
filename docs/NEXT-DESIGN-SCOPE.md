# Architech — Next Design Scope

A prioritized backlog for evolving the current Saffron Survey visual system into a more complete, high-confidence real-estate product. Items are intentionally small enough to ship and verify independently.

## Interaction and motion

1. Migrate property save to `ActionButton` with saved, saving, and undo states.
2. Migrate compare actions to `ActionButton` with a visible compare-count transition.
3. Migrate login submission to the shared async action primitive.
4. Migrate listing submission actions to shared loading and success states.
5. Migrate broker draft actions to shared loading and error states.
6. Add inline error announcements and first-invalid-field focus to forms.
7. Add success and failure states to media upload controls.
8. Add a consistent toast contract for save, compare, copy, and share actions.
9. Add a motion-token table for fast, standard, slow, and spring transitions.
10. Add browser tests for reduced-motion and keyboard focus behavior.

## Search and discovery

11. Add active-filter chips with one-click removal.
12. Add a visible active-filter count to mobile filter controls.
13. Add a pending-filter state before applying mobile filters.
14. Add geometry-matched listing skeletons for result loading.
15. Animate result-count updates without shifting the result grid.
16. Add a designed no-results state with recovery suggestions.
17. Preserve query and filter state on browser back navigation.
18. Add recent-search removal and clear-all controls.
19. Add keyboard-complete search suggestions with highlighted matches.
20. Add a synchronized map/list selection state with accessible announcements.

## Mobile experience

21. Add a sticky mobile search and filter action bar on result pages.
22. Add a bottom-sheet filter transition with focus trapping.
23. Add swipe-friendly listing-card actions without hiding keyboard controls.
24. Keep save and compare actions inside 44px touch targets.
25. Collapse the mobile header after scrolling while preserving the search action.
26. Add safe-area padding for sticky actions on modern mobile browsers.
27. Add mobile-specific empty, loading, and error layouts.
28. Test the core discovery flow at 320px, 375px, and 430px widths.

## Trust and content design

29. Add a listing freshness timeline using only verified repository facts.
30. Add a clear source and verification status block to listing detail pages.
31. Add a consistent trust badge vocabulary across cards and detail pages.
32. Add an honest concept-preview treatment where fixture data is shown.
33. Add a locality comparison layout with evidence links.
34. Add a “what was checked” disclosure for verified listing fields.
35. Add a structured report-a-listing issue flow.

## Design-system quality

36. Create shared `StatusBadge`, `EmptyState`, and `LoadingSkeleton` primitives.
37. Audit all action labels for consistent verb-first language.
38. Audit all icon-only controls for accessible names and tooltip consistency.
39. Audit color contrast for hover, pressed, disabled, and dark-theme states.
40. Add visual regression coverage for homepage, search, listing, and mobile drawer states.

## Recommended delivery order

- **Slice A:** 1–10 — interaction foundation
- **Slice B:** 11–20 — discovery workflow
- **Slice C:** 21–28 — mobile experience
- **Slice D:** 29–35 — trust and content
- **Slice E:** 36–40 — design-system hardening

The existing reusable `ActionButton` is the starting point for Slice A. No item should introduce listing facts, prices, availability, RERA claims, or partner claims that are not already supported by repository data.
