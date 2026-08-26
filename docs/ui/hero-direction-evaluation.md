# Architech Hero Direction Evaluation

## Executive recommendation

The strongest direction for Architech is **not a wholesale replacement with a generic luxury-home SVG or stock photograph**. The recommended path is to retain the current Ahmedabad-specific architectural hero and refine it using **Attachment 3, Design 01 Golden-hour Modern**, as the implementation standard: prominent search in the first viewport, a deliberate text-safe zone, responsive art direction, a directional scrim, explicit image dimensions, and an eager high-priority hero asset.

This choice preserves what already makes Architech distinctive: the current homepage uses an Ahmedabad architectural image, an editorial headline, a centered search composition, trust-oriented metrics, and a dark Amdavad Modern palette [1]. The attachments provide useful technical and art-direction rules, but most of their example subjects are generic villas, suburban homes, coastal properties, US-style brokerages, or stock-photo compositions. They should therefore be treated as references rather than copied hero assets.

## Comparison of the five supplied directions

| Source | Strongest contribution | Fit for Architech | Decision |
|---|---|---:|---|
| Attachment 1: multi-concept SVG pack | Lightweight, scalable vector scenes with built-in text-safe gradients and several page-specific variants | Medium | Keep as a fallback or campaign illustration system; do not replace the photographic homepage hero with a generic SVG.
| Attachment 2: 17-prompt hero image pack | Broad page coverage, reusable prompt structure, negative prompts, responsive dimensions, and a clear generation order | Medium-high as an art-direction library | Adapt prompts for Ahmedabad and Architech’s palette; do not use US-specific or generic neighbourhood assumptions.
| Attachment 3: four hero directions and technical specification | Best balance of conversion hierarchy, search-first composition, text-safe zone, responsive crops, accessibility, and performance rules | **Highest** | Adopt as the primary implementation standard, specifically Design 01 Golden-hour Modern.
| Attachment 4: Unsplash and generic CSS implementation | Fast stock-image experimentation and basic overlay guidance | Medium-low | Use only for temporary comparison or secondary pages; do not hotlink production hero assets or use its generic blue/rounded implementation.
| Attachment 5: detailed SVG hero set | High control over gradients, contrast overlays, and deterministic visual assets | Medium | Keep as a reference for a future no-photo fallback; the mansion/pool aesthetic is too generic for the Ahmedabad homepage.

## Why Attachment 3 is the best foundation

Attachment 3 matches Architech’s existing product behavior more closely than the other documents. It explicitly prioritizes the search bar as the main homepage action, keeps the headline concise, reserves a text-safe area, and specifies separate desktop and mobile crops. Those principles reinforce the existing centered-search hero instead of fighting it. The current implementation already places the search controls inside the first viewport and maintains the headline as real HTML text rather than baking it into imagery [1].

Its strongest technical guidance should be adopted with a few corrections. The hero should use a responsive `<picture>` or equivalent image component with AVIF/WebP and a JPEG fallback, explicit dimensions, `fetchpriority="high"`, and no lazy loading. It should retain the existing dark gradient scrim because the homepage headline and search controls are rendered over the image [1]. The hero image itself should remain decorative with an empty alternative text value when the content is fully repeated by the real HTML heading; the current implementation can keep a descriptive alt only if the image is treated as meaningful Ahmedabad context rather than decoration.

## Brand and Ahmedabad fit

The current hero is more ownable than a generic villa, suburban house, or coastal scene because it visually anchors the product in Ahmedabad’s architectural character. A replacement should therefore include one or more verifiable local cues: brick and concrete architecture, warm late-afternoon haze, a recognisable Ahmedabad urban texture, or a documented locality-specific context. It should not imply a specific real building unless Architech has permission and provenance for that image.

The recommended visual mood is **warm architectural dusk with controlled amber light, charcoal shadows, and a restrained teal/ember accent relationship**. This supports the existing Amdavad Modern system more faithfully than the blue-button, rounded-search-bar, or generic luxury-pool treatments in the attachments. The image should place the strongest architectural mass toward the right or background, leaving the central text/search region readable without an overly heavy black wash.

## Conversion and information hierarchy

The hero should preserve the following order: Ahmedabad context marker, short editorial headline, one-sentence trust-oriented subhead, search intent/category controls, search input, locality quick links, and evidence/stat strip. This is already present in the current homepage composition [1]. The attachment guidance to shorten the headline is useful, but Architech’s existing two-line editorial headline is a deliberate brand device and should not be reduced merely to satisfy a generic six-word rule.

The search action should remain the primary CTA. A secondary button such as “Explore properties” would be lower priority and should not compete visually with the search form. Payment, mortgage, pre-approval, or financing CTAs from generic real-estate templates are not appropriate for the current product scope.

## Responsive and accessibility requirements

The final hero should maintain a dedicated portrait crop rather than relying only on a desktop image cropped by CSS. On mobile, the focal architecture should remain visible without placing the headline over a bright window or sky. The search control must remain keyboard reachable, the input must have a real accessible label, focus rings must remain visible, and the image must never contain the only copy or trust claim.

The directional scrim should be tested against the actual image crop at desktop and mobile widths. A generic 45% black overlay is not sufficient on every photograph; the scrim should be stronger where text sits and fade toward the architectural focal point. Motion should remain limited to the existing slow image treatment and entrance reveals, with the reduced-motion path preserved.

## Performance and asset policy

The attached documents correctly emphasize that the hero is an LCP-sensitive asset, but their byte budgets should be treated as targets rather than universal guarantees. Architech’s existing performance gate should remain the source of truth [2]. The production asset should be uploaded through the project’s managed asset workflow, not hotlinked from Unsplash. The source image should have documented provenance, permitted commercial use, and a stable derivative pipeline.

A practical target is one desktop WebP/AVIF derivative, one portrait mobile derivative, explicit intrinsic dimensions, and a JPEG fallback only where necessary. The image should be visually inspected after compression; a technically small image that produces banding, muddy shadows, or unreadable architecture is not an improvement.

## Final decision

**Keep the current Ahmedabad hero composition and refine it according to Attachment 3, Design 01.** Use Attachment 2 to create an Ahmedabad-specific generation brief for future page heroes. Use Attachments 1 and 5 only as deterministic fallback or campaign illustration references. Use Attachment 4 only for temporary, secondary, or internally reviewed stock comparisons; do not make it the production homepage source.

The next implementation should be a focused hero asset refresh rather than a layout rewrite: create a locally relevant wide hero with a right-weighted architectural focal point, produce a portrait crop, preserve the existing HTML search hierarchy, verify contrast and reduced motion, then run the existing performance and accessibility suites.

## References

[1]: ../../client/src/pages/Home.tsx "Current Architech homepage hero and search composition"
[2]: ../../performance/budgets.json "Architech performance budget source"
[3]: ../../../upload/can-you-please-create-hero-style-images-for-my-real-estate-website(3).md "User-supplied hero direction and technical guide"
[4]: ../../../upload/can-you-please-create-hero-style-images-for-my-real-estate-website(4).md "User-supplied stock-image and generic implementation guide"
[5]: ../../../upload/can-you-please-create-hero-style-images-for-my-real-estate-website(2).md "User-supplied hero prompt pack"
