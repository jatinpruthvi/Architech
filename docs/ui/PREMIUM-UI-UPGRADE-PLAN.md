# Premium UI Upgrade — Audit & Plan

**Date:** 13 September 2026
**Scope:** Whole public site (homepage, discovery, listing dossier, shared primitives)
**Status:** Phase 1 (reference-independent) ready to implement · Phase 2 (reference-matching) blocked

## 0. Open item

The reference image this pass is meant to match **has not been received** — no attachment reached
the workspace, and the follow-up URL was not supplied. Phase 2 cannot start without it.

Phase 1 below is deliberately **reference-independent**: every item is a defect or anti-pattern
that will need fixing under any target design, so none of it is wasted work.

## 1. Skills applied

| Skill | Role in this pass |
|---|---|
| `.skills/taste-skill/skills/redesign-skill/SKILL.md` | Primary method: scan → diagnose → fix in place, never rewrite. Source of the audit checklist (typography, colour, layout, states, components, content) and the fix-priority order. |
| `.skills/taste-skill/skills/image-to-code-skill/SKILL.md` | Phase 2 driver. Anti-slop rules (§16 nested boxes, §17 micro-UI clutter, §29 anti-AI-slop, §31 section rhythm, §32 density) and the copy-discipline/anti-drift rules applied to Phase 1 as well. |
| `.skills/impeccable/skill/SKILL.src.md` | Design authority + craft floor; "refinement preserves, redesign replaces" governs how far Phase 1 may go. |
| `.skills/genjutsu/skills/_jutsu/ui-ux-pro-max/SKILL.md` | Priority-ordered UX rules (a11y → touch → perf → layout → type/colour). |
| `.skills/motion-design-skill/`, `.skills/skills/skills/improve-animations/` | Motion restraint: 150–240ms micro transitions, once-only reveals, no continuous decorative motion. |

## 2. Verified baseline (before changing anything)

Measured, not assumed:

```
pnpm audit:contrast   ✓ every solid fill + label pairing clears WCAG in both themes
pnpm audit:mobile     14/14 routes @360px · 0 overflow · 0 tap-risk · 0 fixed-grid
GET /                 200 · 181 KB · ~0.78s
```

Reduced-motion coverage was audited in detail and is **genuinely thorough** — `theme.css:952–973`
neutralises every animated motif, including `.search-spring-in { opacity: 1 }`, which would
otherwise leave the hero search invisible under `prefers-reduced-motion: reduce`. That is
correctly handled; it is called out here so it is not "fixed" twice or regressed.

**The foundations are sound. The gap is visual identity and systematic design discipline, not correctness.**

## 3. Findings

### P0 — systemic, high blast radius

**F1 · 164 `!important` type overrides on the `.stamp` primitive.**
`.stamp` is defined at 12px uppercase mono, `0.06em` tracking (`theme.css:250`). Call sites then
override it downward at **164** places (`stamp !text-[10px]` / `!text-[11px]`); **217** arbitrary
`!text-[10px]`/`[11px]` overrides exist repo-wide. When 164 call sites out-`!important` a primitive,
the primitive's default is wrong. 10px uppercase mono with wide tracking is below a comfortable
reading floor, and on the dark hero these sit at `text-cream/80`–`/90`, compounding the loss.
*Fix:* add a real `.stamp-xs` size step and raise the default label floor to 12px; delete the overrides.

**F2 · Hardcoded 100% stat with no denominator.** `Home.tsx:119` renders
`<NumberTicker value={100} suffix="%" />`. This contradicts the repository's own
no-fabricated-claims rule — the same page's FAQ states its dates are "deterministic demo data".
`redesign-skill` flags exactly this pattern ("fake round numbers"). *Fix:* use the real, already-passed
counts (`listingCount`, `localityCount`, `cityCount`) or a qualitative line.

**F3 · Coloured italic `<em>` is load-bearing across 81 sites.**
`.display em { color: var(--brick) }` (`theme.css:281`) is used **81** times in screens/components.
Every section heading uses the same device, so headings read as one repeated template rather than a
hierarchy — precisely the flattened "section rhythm" the image-to-code skill warns against (§31).
The repository's own review already ruled this the wrong direction and it is still unshipped.
*Fix:* reserve coloured `<em>` for occasional editorial voice; carry emphasis with scale and weight.

### P1 — structural

**F4 · Hero layer overload + infinite decorative motion.** `Home.tsx:74–97` stacks nine layers: two
radial gradients, a linear scrim, an extra warm wash, `.grain`, `.ember-bloom`, `.glow-sweep`, and a
floating photo card. `ember-bloom` (7s) and `glow-sweep` (11s) (`theme.css:336`, `:352`) are
**infinite**. The repo's own review says "no continuous decorative motion"; the image-to-code skill
bans "too many glowing edges" and "floating blobs everywhere". *Fix:* one background field + one
accent; any motion once-only.

**F5 · Gradient-clipped headline.** `Home.tsx:102–103` sets `text-transparent bg-clip-text
bg-gradient-to-br …` on the `h1` and again on the inner `em`. Banned as a "generic gradient headline
trick", and it adds a real failure mode: if the painted gradient leaves the glyph box, the headline
renders invisible. *Fix:* solid `cream` headline.

**F6 · Nested container on the primary action.** `Home.tsx:109` wraps `HeroSearch` in a
`rounded-[2rem] p-2` div — box-inside-box around the most important control on the site
(image-to-code §16).

**F7 · Arbitrary radii bypass the token scale.** 9 hardcoded `rounded-[Nrem]` values (2rem, 1.75rem,
1.25rem, 0.875rem) in JSX while `--radius-sm/md/lg/xl` already exist (`theme.css:16–19`).

**F8 · Type system contradicts the documented decision.** The design review names
Fraunces / Archivo / IBM Plex Mono. `theme.css:52–54` ships Space Grotesk + Instrument Sans + IBM
Plex Mono. Code and docs disagree; this must be resolved deliberately, not drifted into.

### P2 — polish

**F9 · The same decorative device three times.** `Home.tsx:192`, `:237`, `:133` repeat a trailing
`stamp !text-[10px]` figcaption label ("Study frame", "Concept-preview imagery", "Coordinates ©
OpenStreetMap contributors").

**F10 · Two competing magic-number height systems in one hero.** `min-h-[560px] md:min-h-[640px]`
(section, `:74`) vs `min-h-[540px] md:min-h-[620px]` (inner container, `:99`).

**F11 · Hero micro-label clutter.** "Field note 01" (`:94`), a kicker, three stat stamps, a bouncing
scroll cue (`:121`), and a demo note (`:123`) — the image-to-code skill's §17 cites this exact class
of clutter ("00 orchestration layer").

## 4. Plan

**Phase 1 — reference-independent (can start immediately)**
1. F2 — remove the fabricated 100% stat. *(smallest, highest credibility cost)*
2. F1 — introduce `.stamp-xs`, raise the label floor, retire the overrides.
3. F3 — strip schematic coloured-italic emphasis from headings.
4. F4 – F7, F9 – F11 — recompose the hero: one background field, one accent, solid headline, no
   nested box, token radii, single height system, fewer micro-labels.
5. F8 — settle the type system and write the decision down.

**Phase 2 — reference-matching (blocked on the image)**
Image-to-code workflow: analyse the reference section by section → extract type scale, colour logic,
spacing, component and radius language → translate section by section → verify no drift. Direction
selected: **match the reference closely**, overriding the current palette/type system where they conflict.

## 5. Guardrails

Phase 1 must not regress: the passing contrast audit; 14/14 mobile routes with zero overflow and zero
tap-risk; the reduced-motion block at `theme.css:952–973`; search URL state; keyboard combobox
behaviour; SSR/SEO raw-HTML smoke; image dimensions; and the no-fabricated-claims rule.
Every change is verified with `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm audit:contrast`,
`pnpm audit:mobile`.
