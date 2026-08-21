# Architech Free-First Design and MCP Workflow

## Decision

Use a small, reviewed workflow instead of installing many unrelated MCP servers:

1. **Context7 MCP** for current, version-specific documentation.
2. **Playwright MCP** for route-level browser interaction, responsive checks, keyboard flows, accessibility snapshots, screenshots, and SEO rendering checks.
3. **Storybook MCP** after the shared component system exists. It is currently a preview capability for React projects, so normal Storybook and Playwright remain the fallback.
4. **Chrome DevTools MCP** only when a performance trace, runtime diagnosis, Lighthouse workflow, or deeper browser debugging problem needs it. It overlaps with Playwright and should not be a default duplicate.
5. **Figma MCP** only when an actively maintained Figma source exists. It is optional design input, never the production authority.
6. **Vercel Web Interface Guidelines** as a free review checklist, not an additional MCP dependency.
7. **Lighthouse CLI and axe-core in CI** rather than separate paid or duplicate MCP wrappers.

## Why this is the best solution

Architech needs a consistent component system, attractive visual composition, real motion, strong mobile behavior, accessibility, and Google-friendly public pages. The selected workflow separates responsibilities:

```text
Architech design direction and contracts
→ repository-owned tokens and component contracts
→ Storybook component stories
→ Context7 version-specific implementation guidance
→ React implementation
→ Storybook interaction/accessibility checks
→ Playwright route-level browser validation
→ Chrome DevTools trace when performance diagnosis is needed
→ Lighthouse + axe CI evidence
→ human design and SEO review
```

The project must not allow MCP tools to invent listing facts, prices, availability, RERA claims, broker claims, locality statistics, or SEO evidence. MCP tools assist implementation and validation; domain contracts and verified fixtures remain authoritative.

## Free-first status

| Tool | Status | Usage rule |
|---|---|---|
| Context7 | Enabled for this session | Use for exact installed package documentation; do not make builds depend on it. |
| Playwright MCP | Enabled for this session | Primary UI and route QA tool. |
| Storybook MCP | Recommended after Storybook setup | Preview capability; keep standard Storybook fallback. |
| Chrome DevTools MCP | Optional | Add only for runtime/performance traces or hard browser diagnosis. |
| Figma MCP | Optional | Use only with a maintained design file and workspace access. |
| Vercel Web Interface Guidelines | Free guidance | Use as review rules for interaction, motion, accessibility, responsive behavior, and URL state. |
| Lighthouse | Free open-source CLI | Run in CI/local checks; do not wrap unnecessarily in another MCP. |
| axe-core | Free open-source library | Run through Storybook and Playwright. |

## Security rules

Review every third-party MCP or agent skill before installation. Check source repository, license, maintenance, environment variables, shell access, filesystem access, network access, data retention, and whether the tool is actually needed. Do not install broad filesystem, database, deployment, scraping, or arbitrary code-execution MCPs for convenience.

## Ahmedabad visual decision

The website uses Ahmedabad as the first city and visual source of truth. Public copy, localities, routes, property fixtures, imagery, and examples must use Ahmedabad, Paldi, Prahlad Nagar, Thaltej, Navrangpura, and other approved Ahmedabad localities. Mumbai is historical context only and must not remain in active demo content.

## Visual quality loop

For each shared component and public page:

```text
component contract
→ Storybook story for default/loading/empty/error/partial/reduced-motion states
→ Playwright responsive and keyboard test
→ screenshot at desktop and Redmi Note-class mobile width
→ Lighthouse + axe evidence
→ manual design review
```

Motion must use transform and opacity where possible, remain interruptible, respect `prefers-reduced-motion`, never block public content, and provide a no-WebGL/no-map fallback.

## Sources reviewed

- https://www.toools.design/blog-posts/best-mcp-servers-for-designers
- https://shadcnstudio.com/blog/best-mcp-servers/
- https://www.reddit.com/r/ClaudeCode/comments/1uhsqgm/best_skillsmcp_for_websites_building/
- https://snyk.io/articles/top-claude-skills-ui-ux-engineers/
- https://github.com/punkpeye/awesome-mcp-servers
- https://storybook.js.org/docs/ai/mcp/overview
- https://developer.chrome.com/docs/devtools/agents/get-started
- https://vercel.com/design/guidelines
