# Phase 1 Safe AI Assistance Contracts

**Date:** 24 Aug 2026

This slice adds AI-assisted product contracts without enabling an external model by default.

## Provider mode

```text
ARCHITECH_AI_PROVIDER=disabled | deterministic | external
```

Default:

```text
disabled
```

## Guardrails

AI assistance must follow these rules:

1. never invent property, price, RERA, legal, or availability facts;
2. derive output from visible structured facts;
3. keep AI-generated SEO/Hindi content out of indexable surfaces until editorial review;
4. never auto-approve broker listings or media.

## Added contracts

```text
GET  /api/ai/search-assist?q=...
GET  /api/ai/compare?left=...&right=...
POST /api/ai/moderation-assist
```

## Current implementation

The implementation is deterministic and safe:

- query helper maps natural language to filters/locality hints;
- locality/listing explanations use only repository facts;
- moderation assistant flags risky claims and missing evidence;
- all moderation AI remains advisory.

## Production handoff

Before using an external LLM:

1. add provider abstraction and secret inventory;
2. log prompt/model/version;
3. add cost/latency telemetry;
4. add safety tests for no-invention rules;
5. add human review for editorial/indexable content;
6. keep deterministic search primary.
