# Recommendation v6 Feedback Decision Report
## Decision for Recommendation v7

### Executive decision

The feedback is high quality and should be accepted almost entirely. It identifies implementation gaps rather than asking to remove capabilities. Recommendation v7 therefore **keeps the full v6 architecture**, changes ambiguous or contradictory decisions, and adds the missing production contracts.

The only item that is not accepted literally is the suggestion to make Next.js 16 conditional on whether it is stable. Current official documentation identifies **Next.js 16.3**, published August 3, 2026, and recommends upgrading existing apps to 16.3.[1] Therefore v7 uses Next.js 16.3 or the latest stable 16.x patch available at implementation time, with version pinning and a release-note verification gate.

## Decision table

| Feedback item | Decision | v7 treatment | Reason |
|---|---|---|---|
| Next.js 16 + Cache Components | Keep, update | Pin latest stable 16.x, currently 16.3 according to official release documentation; verify exact patch before implementation. | The architecture is correct and current. |
| `proxy.ts` | Keep, verify | Use `proxy.ts` for the selected Next.js 16.x version; confirm API against the pinned version’s documentation during bootstrap. | Avoids rework while retaining a version guard. |
| PostGIS | Keep | Remains mandatory. | Essential for distance, boundaries, nearby search, and viewport queries. |
| Provider-neutral search abstraction | Keep | Remains the search contract. | Prevents a future provider migration from changing UI/API behavior. |
| OpenTelemetry + Sentry + Pino + Web Vitals | Keep | Remains the four-layer observability stack. | Covers portable traces, issues, structured logs, and field performance. |
| WebAuthn/passkeys | Keep | Remains alongside Better Auth, 2FA, magic links, and recovery. | Stronger account security for brokers and users. |
| Storybook | Keep with scope | Covers design-system primitives, compound components, token variants, and the result card state matrix; not full pages. | Prevents visual drift without turning Storybook into a second application. |
| IndexNow | Keep | Remains event-driven after canonical validation and sitemap updates. | Improves change notification to participating engines, without guaranteeing indexing. |
| React Compiler | Keep with gates | Add numerical thresholds: no more than 10% hydration/interaction regression, no route bundle growth beyond approved budget, no test failures, no memory regression. | Makes opt-in measurable. |
| Two icon families | Change | Lucide is the primary icon system; Phosphor is allowed only for approved marketing/hero art direction. | Removes engineer-by-engineer ambiguity. |
| Natural-language parser | Change | Use a hybrid parser: deterministic rules first, LLM fallback only for ambiguous or zero-result queries; validate output with Zod and never invent facts. | Balances cost, latency, determinism, and ambiguity handling. |
| Removed map performance claim | Keep with protocol | Add a repeatable Redmi Note-class Android/Chrome/4x CPU-throttle benchmark using production-sized data and actual layers. | Replaces an unsupported universal claim with a measurable test. |
| Listing detail optional fields | Change | Hide absent furnishing/availability/area/etc. fields; render a valid useful page from minimum required facts. | Prevents blank, null, or misleading content. |
| Search Console/Bing API | Add | Nightly Trigger.dev jobs use Google Search Console API and Bing Webmaster REST API; legacy Bing SOAP/POX is not used because Microsoft documents retirement on August 31, 2026.[2] | Makes the authority dashboard data-driven. |
| Lenis scope | Change | Lenis only in `app/(marketing)/`: home, static guides, about, methodology. Never in `app/(app)/`: results, listings, dashboard, saved, compare. | Protects interaction, accessibility, and application navigation. |
| Security controls | Keep and add | Add subdomain registry and DNS cleanup order before cloud resource deletion. | Prevents subdomain takeover after decommissioning. |
| LCP budget | Change | Split targets: 2.5s desktop fast connection, 3.5s mobile 4G, 4.5s mobile 3G/reduced-motion mode; report actual field and lab data separately. | Makes India-specific performance targets honest and actionable. |
| Workstream order | Change | Sitemaps/freshness before internal graph/orphan monitoring. | Sitemap membership is an input to authority auditing. |
| Lead system | Add | Make it a dedicated workstream with explicit model, masked-contact workflow, routing, notifications, spam controls, analytics, and consent. | Leads are a core business system, not a small detail feature. |
| Connection pooling | Add | Use PgBouncer transaction pooling for serverless or Prisma Accelerate after compatibility/cost review; document one selected production provider. | Prevents connection exhaustion. |
| Backups/restore | Add | Hourly production backups where supported, daily minimum, 30-day retention minimum, encrypted storage, quarterly restore drill, measured RPO/RTO. | A release gate needs an operational implementation. |
| Description moderation | Add | Plain text by default; server-side DOMPurify only if controlled rich text is introduced; RERA format validation; first-submission moderation queue. | Reduces XSS, spam, false claims, and unsafe HTML. |
| Privacy | Add | Dedicated India DPDP Act posture, consent/notice, purpose limitation, retention, deletion/export, processor inventory, PII redaction, and EU GDPR assessment if applicable. | The platform processes contact, lead, saved-search, and location data. The DPDP Act applies to covered digital personal-data processing in India.[3] |
| Email provider | Add | Use Resend + React Email for transactional email in v1 of the operational system; keep provider abstraction and Postmark as fallback evaluation. | Alerts and broker notifications need a concrete transport. |
| Prisma migration workflow | Add | Commit migration files; run `prisma migrate deploy` in CI/CD pre-deployment; never use `prisma db push` in production. | Prevents uncontrolled production schema drift. |

## Feedback accepted without change

The following v6 sections remain intact: public page graph, canonical URL grammar, page-authority layers, qualified intent criteria, listing lifecycle, page templates, internal-link architecture, event-driven SEO pipeline, JSON-LD/entity graph, media lifecycle, motion guardrails, security baseline, RERA provenance, release gates, graceful degradation, and full first-phase requirement.

## Feedback that requires legal or product-owner confirmation

The lead model is implemented in v7 as **masked contact with broker notification and analytics**, because it provides the best balance of user privacy, lead quality, and operational visibility. Pay-per-lead billing is not silently introduced; it remains a later commercial extension of the same lead entity.

The email provider is set to **Resend + React Email** for the initial implementation. The provider is wrapped behind an email interface so it can be replaced if deliverability, regional requirements, cost, or compliance review favors Postmark.

The privacy section is an implementation posture, not legal advice. India counsel must confirm DPDP obligations, notices, consent, retention, breach handling, children’s-data rules, and cross-border processor arrangements. EU GDPR review is required only when the product targets or monitors people in the EU in a way that brings GDPR into scope.

## Sources verified

[1] Next.js 16.3 is officially documented as released on August 3, 2026, and the release provides current 16.x direction.[1]  
[2] Google provides a Search Console API, and Microsoft documents Bing Webmaster REST APIs and the August 31, 2026 retirement of legacy SOAP/POX APIs.[2]  
[3] The official Digital Personal Data Protection Act, 2023 defines digital personal data, Data Fiduciaries, Data Processors, consent, lawful purposes, and application to processing in India.[3]

## References

[1]: https://nextjs.org/blog/next-16-3 "Next.js 16.3 release announcement"
[2]: https://developers.google.com/webmaster-tools "Google Search Console API"; https://learn.microsoft.com/en-us/bingwebmaster/ "Bing Webmaster API"
[3]: https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf "Digital Personal Data Protection Act, 2023"

## Final recommendation

Accept the feedback. Do not remove the advanced stack. Use v7 as the implementation baseline, with the version pin, lead model, privacy posture, provider choices, measurable performance tests, and operational runbooks treated as mandatory pre-development decisions.
