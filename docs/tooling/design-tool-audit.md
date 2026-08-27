# Design Tool Audit — 2026-08-27

## Sources inspected

- [CloudAI-X/threejs-skills](https://github.com/cloudai-x/threejs-skills): public MIT-licensed repository. Its README describes a curated collection of Three.js AI skill files with API references, examples, performance guidance, and integration patterns. It is relevant as optional reference material for architectural visualization, but not a reason to add Three.js to the Architech launch bundle.
- [greensock/gsap-skills](https://github.com/greensock/gsap-skills): public repository with an MIT license shown in the repository UI. It provides official GSAP AI skills covering timelines, ScrollTrigger, plugins, framework usage, and performance. The README states GSAP and its plugins are free, including commercial use, but the project guidance still supports adding GSAP only when a concrete interaction justifies it.

## Initial decision

Keep Three.js and GSAP skill guidance as reviewed, project-local references rather than automatically adding runtime packages. The existing Architech motion contract prioritizes CSS transforms/opacity, reduced-motion support, server-first delivery, and a small client surface. Motion may be installed separately because the user explicitly requested it and it is a focused React animation dependency.

## Pending audit

Inspect the remaining requested repositories, the Motion documentation, and the 21st.dev MCP authentication/pricing model before installing or configuring anything.

## Additional sources inspected

- [LottieFiles/motion-design-skill](https://github.com/LottieFiles/motion-design-skill): public MIT-licensed repository containing an implementation-agnostic motion-design skill focused on emotion mapping, choreography, timing/easing, and UI principles. This is directly useful as design guidance and can be vendored as a reviewed reference without adding Lottie runtime code.
- [AThevon/genjutsu](https://github.com/AThevon/genjutsu): public repository displaying an MIT license and a v3.3.0 release. It provides creative-coding skills for motion, visual systems, web/React/CSS/Three.js/Canvas, and other platforms, with preview gates and audit guidance. It is useful as optional design-process reference; the repository’s broad creative-coding scope should not become a reason to add Three.js or Canvas to the core product.

## Additional sources inspected

- [Impeccable](https://github.com/pbakaus/impeccable): public repository currently displaying an Apache-2.0 license in the GitHub UI. It contains a large multi-agent skill distribution and a redesign-oriented skill with broad audits for typography, color, layout, interaction, content, components, iconography, code quality, dark mode, and responsive behavior. It is highly relevant as a review methodology, but its size and many agent-specific folders argue for copying only the needed redesign guidance rather than importing the entire repository.
- [Taste Skill](https://github.com/Leonxlnx/taste-skill): public repository with an MIT license. Its current documentation describes an anti-slop frontend framework, separate taste/redesign/output skills, a design-variance dial, and practical audits for typography, color, layout, motion, density, dark mode, and component consistency. It is directly useful for Architech’s design review process, but should be installed narrowly by skill name rather than vendoring every research asset and sponsor/demo file.

## Decision update

Impeccable and Taste Skill are approved as review references. They reinforce the existing Architech direction: stronger visual variance, typography, spacing, and motion discipline are more valuable than adding 3D effects. Prefer a narrow project-local reference package or agent-skill installation over copying full repositories into the production bundle.

## Additional sources inspected

- [Emil Kowalski’s skills](https://github.com/emilkowalski/skills): public repository showing an MIT license. It offers focused skills for animation creation, animation review/improvement, finding worthwhile motion opportunities, animation vocabulary, prototyping, and choosing UI libraries. This is a strong fit for Architech’s motion review workflow; install only the focused animation/review skills rather than the whole repository.
- [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill): public repository with an MIT license and a CLI-based install model. It includes searchable design intelligence, style/palette/font guidance, anti-pattern checks, responsive/accessibility recommendations, and a design-review stack. It is useful as a review/reference layer, but the full CLI and its Python search system should not be added to the production web runtime.

## Official Motion and MCP checks

- [Motion](https://motion.dev): official site identifies Motion 13.1.0 as an open-source MIT-licensed animation library for React, JavaScript, and Vue. It explicitly states that the library is free to use. It supports independent transforms, native gestures, layout/exit animation, springs, timelines, and scroll animation, making it a focused dependency for a few high-value interactions rather than a reason to animate every surface.
- [21st.dev MCP endpoint](https://21st.dev/api/mcp): direct GET inspection returned `Method Not Allowed: this endpoint only supports POST.` This confirms the endpoint is an MCP transport endpoint rather than a browsable documentation page; it does not, by itself, establish that the service or the supplied API key is free. The key-authenticated connector must therefore be treated as a user-authorized external service with unknown quota/pricing until its official terms are verified.

## Current recommendation

Install Motion because it is explicitly requested, MIT licensed, free, and compatible with the current React stack. Vendor narrowly selected MIT skill guidance for future reviews, but do not copy entire repositories, their demos, sponsor assets, or production-unrelated CLIs into the app. Add the 21st.dev connector only after confirming the user accepts that the supplied key may represent a paid or quota-limited service; free-only use cannot be guaranteed from the endpoint response alone.

## 21st.dev official MCP and pricing findings

- [21st.dev MCP](https://21st.dev/mcp): the official page says the MCP/CLI can search the catalog, install components, generate UI, and publish work. It documents API-key use for CI/scripts and shows a free search allowance of two installs per day. It separately labels UI generation as using AI credits.
- [21st.dev pricing](https://21st.dev/pricing): the official pricing page shows a paid Builder plan for unlimited marketplace/MCP installs and a separate Builder + AI plan for monthly AI credits. The free MCP/search allowance is therefore limited rather than unlimited. For Architech’s free-only policy, use only the free search/install allowance and do not use 21st AI generation, paid Builder features, paid templates, or any action that could incur charges.

## Connector decision

The supplied 21st.dev API key can be configured as a custom MCP connector with a standing note that limits usage to the free search/install allowance, disallows AI-credit generation and paid assets, and requires checking the service’s current pricing before any new capability. The connector remains an external service and cannot be treated as universally free beyond the documented limited allowance.
