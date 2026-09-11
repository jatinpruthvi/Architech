# UI/UX and Motion Review

## Decision

The attached recommendation is directionally correct: visual design context, reusable component access, current technical documentation, and browser validation are the four useful capability layers. For Architech, the current free-first workflow remains the right choice. Context7 and Playwright are already available, and the repository already contains a shadcn-style component vocabulary. Figma MCP is optional rather than a prerequisite because the Editorial Terracotta direction, generated Ahmedabad assets, and live preview already provide a coherent visual source of truth.

| Recommendation | Decision | Reason |
|---|---|---|
| Figma MCP | Defer, keep optional | Useful for a formal external design system, but adding it now would create a second visual authority and is not necessary for the current Ahmedabad slice. |
| shadcn/ui MCP | Adapt as a component discipline | The project already has the shadcn primitives. The important outcome is consistent component contracts and states, not another registry dependency. |
| Playwright MCP | Keep as a quality gate | Browser interaction, keyboard paths, responsive checks, screenshots, and console validation directly support this project’s UX goals. |
| Context7 | Keep for exact documentation | Useful when adopting current React, Tailwind, Motion, or browser APIs; it should inform implementation but never become a runtime dependency. |
| Whimsical/diagram tools | Defer | The information architecture is already documented in the repository. A diagram tool can be introduced when the public SEO graph or broker workflow becomes more complex. |
| Heavy 3D/WebGL motion | Decline for launch | It increases performance and accessibility risk without improving the trust-first real-estate task. |

## Motion direction

Architech should feel like a well-edited property journal becoming responsive to the reader, not like a game or a generic SaaS dashboard. Motion is therefore used to establish hierarchy, continuity, and confidence. The hero image receives a barely perceptible Ken Burns treatment; route content enters with a short page transition; property cards reveal as they enter the viewport; locality rows lift slightly on hover; and primary actions give a tactile press response. These behaviors use CSS transforms and opacity, IntersectionObserver, and existing React primitives rather than a paid service or a heavy animation runtime.

The motion system respects three rules. First, high-frequency interactions remain fast and quiet. Second, motion never hides crawlable content or changes the information architecture. Third, `prefers-reduced-motion` removes non-essential animation while keeping the content and focus states intact.

## Advanced but appropriate enhancements

The next valuable advanced behavior is not decorative 3D. It is a progressive, evidence-aware interface: locality context can reveal as the reader reaches it, listing cards can expose source and freshness details without layout jumps, and search controls can animate their state changes while keeping URL state and keyboard behavior stable. A future map can use the existing map component as context rather than replacing the listing stream. Any future Framer Motion adoption should be justified by a specific interaction that CSS cannot express, and should be isolated behind a small motion component boundary.

## Scope of this pass

This pass adds a reusable page-entry animation, a reduced-motion-aware viewport reveal primitive, a slow hero image treatment, tactile primary actions, and more deliberate locality-row hover movement. It does not add WebGL, a new external design dependency, or motion that affects SEO-visible content, layout stability, or essential navigation.

## Review conclusion

The recommendation should be accepted as a workflow principle, not copied as a requirement to install every listed MCP. The improved UI/UX should come from stronger visual decisions, better content states, and disciplined motion choreography. Architech now follows that approach while remaining free-first and performance-conscious.
