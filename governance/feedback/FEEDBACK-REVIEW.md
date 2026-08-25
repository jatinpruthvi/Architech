# Architecture Governance Feedback Review

## Decision summary

The attached suggestions are strong and should be implemented. They identify the primary risk in the current archive: not missing product ideas, but ambiguity about which document is normative, repeated requirements, unresolved contradictions, and insufficiently executable contracts and acceptance criteria.

The accepted approach is **governance tightening without capability removal**. Premium UI, real motion, maps, 3D, semantic search, LLM fallback, media, RERA, broker operations, leads, Google SEO, Hindi foundations, and off-page authority remain approved. The changes make ownership, readiness, activation, evidence, and reversal rules explicit.

## Keep, change, add, or reject decisions

| ID | Suggestion | Decision | Implementation |
|---|---|---|---|
| GOV-001 | Establish one authoritative document. | Keep | `final-three-phase-architecture.md` is normative. Historical recommendations are non-normative. |
| GOV-002 | Add stable decision and requirement IDs. | Keep | Add IDs in `DECISION-LOG.md`, `REQUIREMENTS.md`, `IMPLEMENTATION-MATRIX.md`, and contract documents. |
| GOV-003 | Resolve direct-contact versus masked-contact leads. | Keep and resolve | Public listing pages use masked contact by default. Direct contact is an explicit consented, policy-controlled mode with audit events. |
| GOV-004 | Resolve Railway versus Railway/Fly.io ambiguity. | Keep and resolve | Railway is the primary production persistent-services platform. Containers remain portable; Fly.io is a recovery/migration option, not a co-equal production path. |
| GOV-005 | Resolve “everything in Phase 1” versus later activation. | Keep and resolve | Separate contract readiness, implementation readiness, activation readiness, and public exposure. No approved capability is deleted. |
| GOV-006 | Separate architecture anticipation from Phase 1 production activation. | Keep | Use status values `planned`, `contracted`, `implemented`, `validated`, `enabled`, and `retired`. |
| GOV-007 | Replace unsupported claims and guaranteed SEO outcomes. | Keep | Use hypotheses, measurable targets, evidence, and explicit non-guarantees. |
| GOV-008 | Add legal approval gates. | Keep | Add legal gates for RERA ingestion, personal data, broker media rights, public-record republication, email, paid/sponsored links, and commercial lead workflows. |
| GOV-009 | Define measurable budgets. | Keep | Add budgets for Core Web Vitals, JavaScript, API latency, map performance, availability, RPO/RTO, storage, media, jobs, and cost. |
| GOV-010 | Create executable domain contracts. | Keep | Add typed contract definitions and acceptance requirements for listings, brokers, leads, moderation, media, RERA, SEO pages, and lifecycle. |
| GOV-011 | Reduce duplication. | Keep with preservation | Historical files remain unchanged for auditability. New implementation work uses only the normative document and governance files. |
| GOV-012 | Validate technical claims at implementation time. | Keep | Use stable technology families and verification gates; do not treat future patch versions or vendor behavior as permanent facts. |
| GOV-013 | Add README table of contents and reading order. | Keep | README now points to the normative document, governance documents, historical archive, and implementation matrix. |
| GOV-014 | Make ARCHIVE_INDEX historical. | Keep | `ARCHIVE_INDEX.md` is explicitly historical. README is the project entry point. |
| GOV-015 | Split product requirements, architecture, examples, and vendor research. | Keep | New governance files separate requirements, decisions, contracts, and implementation. Historical files are not rewritten into separate versions. |
| GOV-016 | Add must/should/could tiers. | Change | Use `required`, `important`, `activation-gated`, and `optional` rather than removing advanced capabilities from the approved architecture. |
| GOV-017 | Convert crawl/index guidance into testable URL rules. | Keep | Add URL, canonical, indexability, facet, pagination, lifecycle, and sitemap acceptance rules. |
| GOV-018 | Define page-authority registry ownership. | Keep | SEO/content owns page policy; domain owners own entity evidence; engineering owns generators and audits; legal approves regulated claims. |
| GOV-019 | Add adoption gates for operational and scale technologies. | Keep | Every scale-dependent technology has an entry condition, benchmark, owner, rollback, and exit condition. |
| GOV-020 | Add v6→v7 changelog and fix stale wording. | Keep | Historical version files are preserved; the decision log records the final status and supersession. |
| GOV-021 | Add v8 supersession manifest. | Keep | `SUPERSESSION-MANIFEST.md` identifies the normative source and historical documents. |
| GOV-022 | Add final implementation/acceptance matrix. | Keep | `IMPLEMENTATION-MATRIX.md` maps work IDs to owners, dependencies, evidence, and acceptance. |
| GOV-023 | Add off-page owners, deliverables, baselines, attribution, and outreach governance. | Keep | Add off-page workstream rows and compliance rules to the matrix. |
| GOV-024 | Add work IDs, dependencies, estimates, owners, entry and exit criteria. | Keep | Add executable workstream registry. Estimates remain planning ranges, not commitments. |
| GOV-025 | Complete lead-state/retry/deletion behavior. | Keep | Add lead contract with consent, masked/direct modes, delivery states, retry policy, retention, deletion, and audit rules. |
| GOV-026 | Add numeric React Compiler gates. | Keep | Compiler adoption requires bundle, render, correctness, and regression thresholds; it is not enabled blindly. |
| GOV-027 | Add SEO schemas, thresholds, pagination rules, and audit cost controls. | Keep | Add machine-readable rules to contracts and matrix. |
| GOV-028 | Link every decision to final integration and evidence. | Keep | Decision IDs link to normative section, work ID, acceptance test, and reversal trigger. |

## Resolved contradictions

### Direct contact and masked contact

The default public behavior is masked contact. A user may submit a consented lead without exposing a personal phone number directly to a broker. Direct contact can be enabled only when the user explicitly chooses it, the broker is eligible, consent is recorded, rate limits and abuse controls pass, and the event is auditable. The user interface must clearly show which mode is active.

### Railway and Fly.io

Railway is the single primary production platform for persistent services. The application remains containerized and exportable. Fly.io can be documented as a recovery or future migration target, but the team must not maintain two equal production runbooks in Phase 1.

### Phase 1 scope and later activation

A capability may be contract-ready, implemented, validated, enabled, or publicly exposed. Phase 1 establishes contracts and the complete foundation. Later phases may activate advanced layers or broader coverage after benchmarks pass. This is not deletion or redesign.

## Non-guarantee policy

The architecture must not claim that the platform will be “unbeatable,” will outrank a named competitor, or will achieve guaranteed SEO, Core Web Vitals, conversion, or AI-citation outcomes. Every target is a measurable hypothesis with a measurement source, owner, review date, and reversal trigger.

## Legal gates

No regulated or externally sourced feature reaches public production without the relevant legal gate:

| Gate | Required evidence |
|---|---|
| RERA ingestion | Source permission/terms review, field mapping, provenance, update policy, correction process, and legal approval. |
| Personal data | Privacy notice, purpose, consent, retention, deletion, processor inventory, access controls, and incident process. |
| Broker media | Upload consent, ownership/license evidence, takedown process, moderation, and attribution policy. |
| Public records | Republication and caching review, source attribution, correction procedure, and permitted-use decision. |
| Email and messaging | Consent, template review, unsubscribe, deliverability, rate limits, and retention. |
| Paid/sponsored links | Disclosure, `rel="sponsored"`/`nofollow`, editorial separation, and finance/legal approval. |
| Commercial leads | Consent, attribution, dispute process, fraud controls, broker terms, and billing approval. |

## Final governance principle

The recommendation is accepted because it makes the project easier for humans and AI systems to implement without weakening the product ambition. The project now has one source of truth, stable IDs, explicit contracts, measurable gates, legal checkpoints, and a historical archive.
