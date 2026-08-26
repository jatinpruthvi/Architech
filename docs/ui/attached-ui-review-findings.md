# Attached UI Review Findings

**Review date:** 26 August 2026
**Scope:** Six user-provided design/reasoning documents reviewed against the current Architech implementation.

## Sources reviewed

1. `premium-proptech-homepage-prompt-review.md`
2. `studyarena-round10-kimi-k3-max-reasoning.md`
3. `studyarena-round10-gpt-5-6-sol-medium-reasoning.md`
4. `studyarena-round10-contestant-f.md`
5. `studyarena-round10-contestant-c.md`
6. `studyarena-round10-contestant-a.md`

## Consensus worth keeping

The strongest shared direction is an editorial architecture-magazine experience combined with an intelligent, trustworthy property platform. Search must remain the primary interaction, property photography the primary visual element, and trust/provenance the differentiator. The best ideas are a typed omnibox with grouped suggestions and complete keyboard behavior; photo-first listing cards with optional zero-click preview; contextual discovery modules; compact trust and freshness cues; clear loading, empty, error, and success states; server-rendered content with small client islands; intentional mobile behavior; and motion that explains state rather than decorating every surface.

The documents consistently recommend semantic tokens, responsive image dimensions, poster-first media, lazy map enhancement, URL-serializable search state, privacy-aware geolocation only after explicit action, no fake AI/auth/booking claims, and honest performance reporting. These align with Architech's current foundations and should remain central.

## Recommendations to reject or constrain

WebGL or animated mesh hero backgrounds, mandatory video, floating AI chat orbs, dynamic-island navigation, heavy 3D card tilt, cursor-following gradients, mandatory CSS anchor positioning, P3-only color, hover-only navigation, and large experimental browser APIs should remain optional progressive enhancements. They add visual novelty but risk diluting the search journey, hurting low-end mobile performance, complicating accessibility, or making the interface feel like a technology demo.

The Austin/US examples, dollar/ZIP/Fair Housing assumptions, and hard-coded future package versions must not be copied into Architech. Ahmedabad requires INR, `en-IN`/`hi-IN`, Asia/Kolkata, sq ft, km, India-specific address formatting, and Gujarat/RERA language only where legally and editorially approved. Performance numbers are budgets to measure, not guarantees.

## Current Architech UI audit

The current implementation already has strong foundations: Ahmedabad-first content, the centered search hierarchy, RERA/source/freshness language, locality intelligence, coordinate stamps, arch-framed imagery, mono data labels, saved/compare functionality, URL-synced discovery, quick view, accessibility tests, reduced-motion handling, and responsive public routes.

An independent visual review of the rendered homepage corroborated the same issue: the content architecture and trust storytelling are strong, but the first impression still leans toward a dark technology/SaaS marketplace because indigo-purple actions and cool blue emphasis dominate the hero and conversion bands. The reviewer specifically recommended returning primary emphasis to Kahn brick red, warm plaster, deep ink, ember, and restrained trust green; making the hero more asymmetric and architectural; reducing colored italic emphasis; and repeating the arch, field-note, ruled-line, coordinate, and index-number motifs as a system. These recommendations are accepted because they reinforce the already-selected Amdavad Modern direction rather than introducing a new visual language.

The main weakness is visual coherence. The screenshot and current CSS show a dark tech/SaaS first impression with indigo-purple primary actions, cool slate surfaces, and blue/teal emphasis. This conflicts with the selected Amdavad Modern identity, which should be grounded in Kahn brick, warm plaster, deep ink, ember, and restrained verification green. The homepage has strong ideas but its lower sections repeatedly fall back to ordinary cards and SaaS-style bands. The header mark is small and app-icon-like. The hero is polished but still too symmetrical and product-dashboard-like rather than architectural and field-journal-like. Colored italic emphasis is overused as the primary identity device.

The search/results page is functionally strong but still utilitarian in filtering chrome. The shared `PropertyCard` is polished and accessible but reads like a conventional marketplace card; improving it would propagate across search, locality, saved, and related-listing routes. The listing dossier has strong provenance but contains a visible duplicated price-history/agent-trust block that should be removed in a later polish pass. `LocalityIntel` is already one of the best-aligned components and should be used as the visual benchmark rather than redesigned first.

## Recommended next UI slice

The highest-value next slice is a **coherent Amdavad Modern discovery pass**, not a technology expansion. It should change several related surfaces together:

1. Reclaim the palette: use brick as the primary action/editorial accent, deep ink and warm paper/plaster as structural surfaces, ember for emphasis, and trust green only for verified/source/freshness meaning. Remove purple/indigo from primary CTA roles; retain a subdued secondary intelligence color only where it has clear semantic meaning.
2. Recompose the hero as an architectural editorial frame: retain the prominent centered search, but add asymmetric material planes, coordinate/source stamps, a visible arch or ruled geometry motif, and a stronger right-weighted architectural focal point. Avoid restoring excessive empty space.
3. Strengthen typography: use Fraunces/Archivo/IBM Plex Mono intentionally, with Fraunces character and scale carrying hierarchy. Reduce reliance on colored italics; reserve italics for occasional editorial voice, not every emphasized phrase.
4. Establish a reusable field-journal card language for `PropertyCard`, bento modules, quick-view, and locality rails: photo-led layout, evidence stamp, freshness line, measured dividers, one signature arch or index motif, and fewer generic rounded containers.
5. Improve the search/results surface with a calm “decision rail”: visible query context, intent/category state, result quality or evidence cue, and more editorial empty/loading states without adding extra clicks.
6. Improve the listing dossier by removing the duplicated trust/history block, clarifying the primary contact action, and presenting facts as a single evidence ledger rather than several similar cards.
7. Add contextual discovery only where it is data-backed: for example, a family-oriented search can surface schools/parks/commute context, while an investment search can surface price trend/rental-yield context. Keep the base modules stable and progressively enhance after query intent is known.
8. Keep motion restrained: 150–240ms micro transitions, 2–4px lifts, immediate photo scrubbing, one subtle pointer/depth response on large media only, once-only section reveals, and no continuous decorative motion. Reduced motion should disable parallax, tilt, autoplay, and scroll-linked effects while preserving functionality.

## Proposed priority table

| Priority | Change | Impact | Risk | Suggested route |
|---|---|---:|---:|---|
| P0 | Replace purple/blue primary visual language with coherent brick/paper/ink/trust semantics | Very high | Medium | `client/src/index.css`, header, hero, CTA primitives |
| P0 | Rework reusable property card into an editorial evidence card | Very high | Medium | `client/src/components/architech/PropertyCard.tsx` |
| P0 | Remove duplicated listing dossier trust/history block | High | Low | `client/src/pages/ListingPage.tsx` |
| P1 | Add architectural field-journal geometry to hero/search/results | High | Medium | `Home.tsx`, `ResultsPage.tsx`, shared motifs |
| P1 | Improve filter/search context and empty states | High | Medium | `ResultsPage.tsx`, search components |
| P1 | Add intent-aware contextual bento content using existing typed data | Medium-high | Medium | homepage discovery modules |
| P2 | Add optional View Transitions or CSS scroll-driven enhancement with fallbacks | Medium | Medium | route/motion utilities |
| P2 | Add optional ambient video after poster/LCP measurement | Medium | High | only after performance validation |
| P3 | WebGL, AI orb, dynamic island, heavy tilt, P3-only color | Uncertain | High | do not include in core release |

## Acceptance gates for the next implementation

The next UI pass should preserve the existing public route structure and must pass TypeScript, lint, unit tests, accessibility tests, production build, raw HTML SEO smoke, and desktop/mobile visual review. It must preserve search URL state, keyboard combobox behavior, screen-reader announcements, reduced-motion fallbacks, image dimensions, and the no-fabricated-reviews rule. It should report the `/search` bundle budget honestly if the inherited small overage remains.

The visual pass is successful when a first-time visitor can identify Ahmedabad, understand Architech's evidence-first promise, search within the first viewport, and distinguish the brand from a generic purple SaaS portal without sacrificing readability or performance.

## Overall conclusion

Adopt the consolidated review's hybrid: use the assistant baseline, GPT-5.6 Sol's product/state/privacy discipline, Kimi's precise search behavior, and Contestant F's acceptance checklist. Borrow Contestants A and C only for restrained contextual composition and progressive enhancement. The next improvement should be a coordinated visual-language and reusable-card pass, not another dependency-heavy feature burst.
