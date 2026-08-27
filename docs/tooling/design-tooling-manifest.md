# Architech Design Tooling Manifest

**Status:** reviewed and installed for the 2026 design-finishing workflow. **Scope:** design guidance and development tooling only; no payment features and no paid design-service calls.

## Runtime dependency

| Tool | Current status | License and cost | Approved use |
|---|---|---|---|
| [Motion](https://motion.dev) | Installed as `motion@13.1.1` in the workspace | MIT, free/open source | Use for deliberate React interactions such as route transitions, drawer choreography, layout-preserving list changes, and tactile controls. Keep the existing transform/opacity and reduced-motion rules. |

Motion is a runtime dependency. It must not be used as a reason to animate every element, move layout properties continuously, or replace the project’s server-first architecture.

## Reviewed external skill repositories

The requested repositories were cloned shallowly under `/home/ubuntu/design-tooling/architech-sources/`, outside the deployable Architech project. This keeps reference material, demos, sponsor assets, and unrelated CLIs out of the website bundle while preserving the sources for design work.

| Repository | License observed | Recommended Architech use | Not approved |
|---|---|---|---|
| [CloudAI-X/threejs-skills](https://github.com/cloudai-x/threejs-skills) | MIT | Reference Three.js API and performance guidance if a future architectural visualization slice is explicitly approved | Adding Three.js or WebGL to the core homepage/discovery bundle |
| [greensock/gsap-skills](https://github.com/greensock/gsap-skills) | MIT | Reference timelines, ScrollTrigger, React integration, and performance patterns; GSAP remains optional | Adding GSAP where CSS or Motion already solves the interaction |
| [LottieFiles/motion-design-skill](https://github.com/LottieFiles/motion-design-skill) | MIT | Motion vocabulary, emotion mapping, timing, easing, and choreography review | Adding Lottie runtime or mandatory animation assets |
| [AThevon/genjutsu](https://github.com/AThevon/genjutsu) | MIT | Creative-coding and preview-gate ideas for controlled experiments | Shipping Canvas/Three.js/creative effects without a performance and accessibility case |
| [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | Apache-2.0 in the repository UI | Broad design-review checklist for typography, layout, color, dark mode, responsive behavior, and code quality | Copying the complete multi-agent distribution or unrelated tooling into the app |
| [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | MIT | Anti-slop visual review, design variance, typography, density, and component consistency | Using generic style presets that dilute the Amdavad Modern identity |
| [emilkowalski/skills](https://github.com/emilkowalski/skills) | MIT | Focused animation creation, review, improvement, and opportunity-finding guidance | Installing unrelated Swift, Expo, or library-specific skills for this web app |
| [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | MIT | Searchable design-system and accessibility review concepts, especially anti-pattern detection | Adding its CLI/Python search system to the production runtime |

## MCP connector

The requested **21st.dev** custom MCP connector was created and enabled with the supplied API key. Its standing note restricts use to the documented free search and limited component-install allowance. Do not use 21st AI generation, paid Builder features, paid templates, publishing, or any action that may incur charges. The official MCP page documents a free search allowance of two installs per day and separately identifies AI-credit features; see [the MCP page](https://21st.dev/mcp) and [the pricing page](https://21st.dev/pricing).

The connector is enabled in the Manus session. The local `manus-mcp-cli` verification command could not resolve user-created connectors by name or UID in this sandbox, so no 21st.dev call was made and no paid or quota-consuming operation was attempted. The connector should be used from the connected Manus MCP surface when needed.

## Operating rule

Architech’s visual signature remains **Amdavad Modern**: warm plaster, Kahn brick, deep ink, ember, restrained trust green, editorial typography, architectural geometry, and evidence-led interaction. Before adding any new motion or visual dependency, demonstrate a concrete user benefit, a reduced-motion fallback, a responsive behavior, and a measurable bundle/performance impact.

## References

[1]: https://motion.dev "Motion — JavaScript & React animation library"
[2]: https://github.com/CloudAI-X/threejs-skills "CloudAI-X Three.js Skills"
[3]: https://github.com/greensock/gsap-skills "GSAP AI Skills"
[4]: https://github.com/LottieFiles/motion-design-skill "LottieFiles Motion Design Skill"
[5]: https://github.com/AThevon/genjutsu "genjutsu"
[6]: https://github.com/pbakaus/impeccable "Impeccable"
[7]: https://github.com/Leonxlnx/taste-skill "Taste Skill"
[8]: https://github.com/emilkowalski/skills "Skills for Designers and Engineers"
[9]: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill "UI UX Pro Max Skill"
[10]: https://21st.dev/mcp "21st.dev MCP"
[11]: https://21st.dev/pricing "21st.dev Plans & Pricing"
