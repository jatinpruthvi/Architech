# On-page SEO audit from a prompts.chat prompt — 7 Sep 2026

Prompt sourced from prompts.chat, evaluated against repo standards, adapted,
and executed. This is the provenance and adaptation record required by the
retrieval playbook in `docs/ai/ai-prompt-library.md` (Section C, Step 4).

## Retrieval path

| Step | Result |
|---|---|
| 1 — bounded MCP probe | `POST https://prompts.chat/api/mcp` → `http_code=000` (sandbox egress blocked, exactly as the playbook predicts). **Not retried**, per the playbook's explicit instruction. |
| 2 — tool-side fetch | Path A (`/prompts?q=SEO`) and Path B (`/tags/seo`, 16 prompts) both succeeded, plus `site:prompts.chat` search. |

## Candidates evaluated

| Prompt | Author | Verdict |
|---|---|---|
| **Claude Opus as SEO Auditor** | `@musatoktas` | **Selected as the base.** Its rules are unusually strict: "do not give generic advice", "do not hallucinate issues", "only report issues you can VERIFY on the live site", "for every issue give the EXACT URL". That is the repo's own evidence-over-vibes standard, written as a prompt. |
| SEO Optimization Agent Role | `@wkaandemir` | Harvested its on-page checklist (title ≤ 60, description ≤ 160, single H1, alt text, schema, internal links). |
| SEO Auditor Agent Role | `@wkaandemir` | Overlaps the above; nothing additional. |
| High-Ranking SEO Content Creator | `@seoshubham608` | **Rejected.** Explicitly recommends "strategic keyword stuffing". Directly contradicts the repo's content rules and modern ranking behaviour. |
| Vibe Coding with Modern Designs and SEO | `@adarssshhh0-pixel` | **Rejected.** Framer-specific, no relevance to a Next.js App Router codebase. |
| Apple Store ASO / App Store Localization | various | **Rejected.** ASO, not web SEO. |

## Adaptation log

What was kept, and what was deliberately dropped:

1. **Kept** the evidence discipline verbatim — every finding carries an exact
   URL and the measured value.
2. **Dropped** the output-in-Turkish instruction and the travel-vertical
   specifics (visa pages, hotel cards) — artifacts of the original author's
   site.
3. **Dropped keyword-density, "keyword in first 100 words", and word-count
   minimums.** These would push the repo to pad copy with keywords, and
   Architech's standing rule is that copy states verified facts only. Adopting
   them would have made the site worse.
4. **Automated it instead of answering it once.** The prompt produces a report;
   a report goes stale the next deploy. The checks it prescribes now live in
   `scripts/seo/onpage-audit.mjs`, wired into `pnpm test:seo`.
5. **Added a rule the prompt lacks:** duplicate-title detection across the
   corpus (cannibalisation), which matters on a 524-page programmatic site.
6. **Skips `noindex` pages by design** — flagging pages we deliberately exclude
   would be noise that trains people to ignore the audit.

## Findings — 11 verified defects

All measured on rendered HTML from a production build. Every one passed
`tsc`, lint, and the full unit suite, because nothing in the repo measured the
string a searcher actually sees after the layout's title template is applied.

| # | Issue | Evidence | Severity |
|---|---|---|---|
| 1 | Double-branded titles on 10 standing pages | `/agents/` rendered `Verified agents & partners · Architech · Architech` — page hardcoded a brand the root layout already appends | High |
| 2 | Rent titles over budget | `/rent/ahmedabad/` at **72 chars**, double-branded; truncates in SERP | High |
| 3 | Every city hub title truncated to bare subject | `/buy/ahmedabad/` shipped `Buy in Ahmedabad` (28 chars) — ~20 chars of the strongest ranking element unused, on all 12 hubs | High |
| 4 | City descriptions dropping their second clause | 7 cities published a 70-char description against a 155 budget | Medium |
| 5 | `/locations/` description at 180 chars | Truncated mid-sentence in the SERP | Medium |

### Root cause of 2–4

`composeSerpText` **stops** at the first part that does not fit. That is
correct and deliberate: a trailing clause without the clause it qualifies is
worse than nothing (the file documents a past bug where a listing shipped
titled `— ₹11,000 / mo`).

The defect was that `citySerpTitle` and `citySerpDescription` passed *mutually
exclusive alternatives* straight into that function, so the longest option
blocked every shorter one. `localitySerpTitle` already solved this with
`fitTail`, which picks the longest candidate that fits. The fix applies the
existing, proven mechanism to the three call sites that skipped it.

### Investigated and dismissed

- **`/search/` has no `<h1>`.** It is `robots: noindex` under the
  faceted-navigation rule, so it is not an indexing defect. The audit now skips
  noindex pages rather than reporting it.
- **`/buy/ahmedabad/thaltej/` reported at 61 chars.** A false positive in my
  first audit pass: `&amp;` counts as 5 raw characters but 1 to Google. The
  script now decodes HTML entities before measuring.

## Result

```
onpage-audit: 524 sitemap URLs checked (0 noindex skipped), 0 errors, 0 warnings
```

Regression cover in `client/src/lib/seo/serp-budget.test.ts`: titles must fit
60 characters **with** the appended brand suffix, must not brand themselves,
rent copy must never inherit sale wording, and every real city hub must earn a
qualifying tail clause.

The audit runs inside the existing `raw-html-smoke` server, so CI pays for no
extra build. With `PUBLIC_INDEXING_ENABLED` off the sitemap is legitimately
empty and the audit skips loudly rather than failing.

## Verification

`tsc --noEmit` clean · lint clean · **1972 tests passing** · `build:ci`
succeeds · SEO smoke 19 routes / 8 sitemaps / 2 AI index files · on-page audit
524 URLs, 0 errors · crawl-simulation 578 pages, no orphans · performance
budgets pass.
