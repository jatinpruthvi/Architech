# Architech Design Brainstorm

## Three stylistic approaches

### Theme Name: Editorial Terracotta
Very warm, editorial, and human: deep ink typography, mineral neutrals, sun-baked terracotta, and property photography treated like a considered magazine spread. It makes real-estate discovery feel trustworthy and culturally grounded rather than transactional.

**Probability:** 0.07

### Theme Name: Quiet Coastal Modern
A light, airy system built around sea-glass neutrals, pale stone, soft blue, and generous whitespace. It feels calm and premium, with a strong emphasis on clarity, mobile legibility, and effortless browsing.

**Probability:** 0.04

### Theme Name: Midnight Atlas
A dark cartographic direction with electric route accents, luminous map layers, and cinematic property imagery. It is energetic and technology-forward, but reserved for one clearly differentiated slot because it is common in product concepts.

**Probability:** 0.03

## Chosen approach: Editorial Terracotta

### Design Movement
Contemporary editorial modernism with Indian material warmth: a meeting of architecture magazine layouts, refined hospitality branding, and high-trust marketplace clarity.

### Core Principles
1. **Trust before spectacle:** RERA evidence, locality context, price, broker identity, and freshness are visually prominent.
2. **Editorial composition:** Use asymmetric compositions, ruled content bands, quiet paper-like surfaces, and image-led storytelling instead of generic centered SaaS sections.
3. **Warm precision:** Terracotta warmth is balanced by deep ink, mineral surfaces, and measured typography so the experience feels premium and dependable.
4. **Progressive richness:** Motion, map layers, video, and 3D enhance discovery without blocking content, SEO, accessibility, or low-end devices.

### Color Philosophy
Architech uses a signature burnt-clay terracotta as a human, ownable accent: it suggests material, place, and built form without becoming loud. Deep ink anchors the system with editorial authority; parchment and limestone surfaces create a calm reading environment; a restrained blue-green is reserved for verified/trust and map interaction states. Color communicates meaning: terracotta invites action, ink communicates confidence, and mineral surfaces create breathing room.

### Layout Paradigm
Use an offset editorial frame: full-bleed visual moments are paired with left-anchored content rails, asymmetric image crops, and intentional “margin notes” for facts, RERA evidence, source information, and freshness. Public pages should feel composed like a well-designed property journal while retaining fast scanning for price, location, and actions. Avoid repetitive centered hero-plus-three-cards patterns.

### Signature Elements
1. **The Clay Line:** a thin terracotta rule that marks section transitions, active filters, and verified states.
2. **Atlas Notes:** compact side annotations for locality facts, source provenance, RERA status, and last-updated context.
3. **Material Frames:** gallery and card imagery with subtle limestone borders and editorial captions rather than generic rounded image tiles.

### Interaction Philosophy
Interactions should feel like handling a well-made physical catalogue: immediate, tactile, and purposeful. Search expands with confidence; cards lift only slightly; drawers feel spatially connected to their trigger; map selections echo into the result list; saved and comparison actions provide quiet confirmation. Keyboard actions are instant; rich motion is reserved for occasional transitions and narrative reveals.

### Animation
Use transform and opacity only for UI motion. Hero reveal: a slow editorial sequence of image crop, heading rise, and search field settling, with a static image fallback. Scroll sections: short, staggered 30–60ms reveals only when content enters the viewport. Cards: 160–220ms hover/focus lift with no layout shift. Drawers and filter sheets: 220–320ms origin-aware movement. Gallery transitions: 240–360ms crossfade/slide with stable dimensions. Map/list selection: 160–220ms emphasis pulse. Always implement `prefers-reduced-motion`, no-WebGL, low-power, and no-JavaScript fallbacks.

### Typography System
Use **Bricolage Grotesque** for display headlines and a Devanagari-capable, highly legible sans-serif for body/application copy, with a carefully verified fallback stack. Use large expressive headlines only where they do not displace the search task. Price numerals use a tabular numeric treatment. Headline hierarchy: display 64/1.0 desktop, 44/1.05 tablet, 36/1.08 mobile; section headings 32/1.1, 26/1.15, 22/1.2; body 16/1.5; compact metadata 13/1.35. Locality names and Hindi text must be tested for wrapping before final font lock.

### Brand Essence
**Architech is a high-trust India real-estate discovery platform for buyers, renters, and broker partners who want to understand a place—not just scroll listings—through verified context, rich media, and intelligent search.**

**Personality:** grounded, discerning, generous.

### Brand Voice
Headlines sound observant and confident, never inflated. CTAs are direct and specific. Microcopy explains evidence, freshness, and next steps in plain language.

Example headline: **Find the neighbourhood before you choose the address.**

Example CTA: **Explore verified homes in Bandra West**

### Wordmark & Logo
The mark is a bold geometric “A” formed from two offset architectural planes, with a small terracotta notch suggesting a doorway or map pin. It must work as a text-free symbol at favicon size and as a compact wordmark lockup in the header.

### Signature Brand Color
**Clay 620 — `#B65A3A`**. Use it sparingly for primary action, the Clay Line motif, selected states, and trust-adjacent editorial accents. Never use it as a full-page wash.

### Style Decisions
- The public product is light-first; dark surfaces are limited to hero overlays, map controls, and selected editorial moments.
- No purple gradients, no generic glassmorphism, no over-rounded everything, and no default Inter-only typography.
- The homepage, locality page, results page, and listing detail page must share one visual grammar before the design is considered ready.
- Motion is real but subordinate to content, Google crawlability, accessibility, and low-end performance.
- Every non-homepage page must include one unique Amdavad Modern structural motif—an arch frame, stepwell layering, oversized index numeral, coordinate stamp, or field-note annotation—so utility routes do not rely on one repeated hero composition.
- Contact, feedback, loan, and other utility surfaces are field-office ledgers: mono labels, ruled groups, clay dividers, explicit trust-green evidence cues, and visible consent/provider gates instead of generic beige form cards.
- Empty or low-inventory search states are curated field notes with locality context, source/freshness explanation, nearby alternatives, and a clear next step rather than a blank message.
- Trust green marks verified, source-reviewed, RERA, moderation, and freshness meaning; brick remains the action and editorial emphasis color.
- Public feedback language must describe a real moderation gate and never imply fabricated or seeded reviews, ratings, or testimonials.


---

## Decision update — August 2026: Amdavad Modern

Editorial Terracotta was superseded by **Amdavad Modern**, a direction rooted in Ahmedabad's own architecture: Louis Kahn's IIM-A brick geometry, Corbusier's plaster planes, and Adalaj stepwell layering.

- **Palette:** Kahn brick red `#a8432a`, warm plaster `#f4eee2`, deep ink `#1b1612`, ember `#eeb195`, trust green `#2f6b5a` (reserved for verification states).
- **Typography:** Fraunces (display, optical sizing), Archivo (UI), IBM Plex Mono (data stamps), Noto Sans Devanagari.
- **Signature motifs:** arch-framed imagery, film grain, oversized index numerals, mono coordinate stamps, "trust in layers" stepwell storytelling.
- **Motion:** token-driven (\`--dur-1..4\`, \`--ease-out-expo\`, \`--ease-spring\`), Magic-UI-style components (number ticker, border beam, shimmer, tilt, word reveal, marquee), full reduced-motion fallbacks.
