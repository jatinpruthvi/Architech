# AI visibility surfaces: robots policy, llms.txt, llms-full.txt, image sitemap

**Date:** 7 September 2026
**Branch:** `arena/01a07a66-architech`
**Scope:** four discovery surfaces for AI and image search. No change to page HTML, structured data, or the existing page sitemaps.

## Why this work happened

The question asked was "do we have added detail for llms.txt, llm-full.txt and sitemap.xml for better visibility to AI". The honest audit answer was: the sitemap is substantially built and good, the JSON-LD entity graph is broad (23 schema.org types), and **neither llms.txt nor llms-full.txt existed** — but the largest actual gap was none of those three.

`app/robots.ts` emitted a single `userAgent: "*"` rule. The project had therefore never made a *decision* about AI crawlers; it had made a silence, and the default reading of that silence grants every training crawler the whole corpus.

## What shipped

### 1. Explicit AI-crawler policy (`client/src/lib/seo/ai-crawlers.ts`)

Ten crawlers, each classified by **purpose** with a recorded rationale:

| Purpose | Crawlers | Default posture |
|---|---|---|
| `search` — fetches to cite, live, with a link | OAI-SearchBot, ChatGPT-User, PerplexityBot, Google-Extended | Allowed **exactly when** `PUBLIC_INDEXING_ENABLED` is on |
| `training` — ingests into a model | GPTBot, ClaudeBot, CCBot, Bytespider, meta-externalagent, Applebot-Extended | Disallowed |

The split is not cosmetic. Search/grounding traffic is ordinary search visibility and follows the same gate as everything else. Training ingestion is a different consent question, and two governance gates already name it:

- **LEG-003 (broker media rights)** — the rights record covers *display on this site*. Training is a different usage scope and is not granted.
- **LEG-008 (AI and generated content)** — no-invention rules and provenance. The corpus is currently illustrative demo inventory pending India Post/RERA verification.

`Google-Extended` is deliberately on the *search* side: it is not a crawler UA (Googlebot still crawls), so blocking it forfeits AI Overview citations without reducing crawl load.

Operators can override with `ARCHITECH_AI_CRAWLER_POLICY` = `default` | `allow-all` | `deny-all`. Ordering is fail-closed: `deny-all` beats everything, and **indexing-off beats `allow-all`** — a pre-launch site never invites an AI crawler in, however the policy reads. An unrecognised value degrades to `default` rather than throwing, because a typo in an env var must not take `robots.txt` down.

Verified output from a production build with `PUBLIC_INDEXING_ENABLED=true`:

```
User-Agent: *                 Allow: /   Disallow: /saved/ /search/ /login/
User-Agent: OAI-SearchBot     Allow: /   Disallow: /saved/ /search/ /login/
User-Agent: Google-Extended   Allow: /   Disallow: /saved/ /search/ /login/
User-Agent: GPTBot            Disallow: /
User-Agent: CCBot             Disallow: /
```

Allowed search bots receive the **same** exclusion list as the wildcard rule rather than a bare `Allow: /` — thin, private and infinite-space surfaces are thin whoever is asking. The list is passed in from `app/robots.ts` rather than re-derived, so the two rule sets cannot drift.

### 2. `/llms.txt` — supplemental index

Built strictly to the normative constraint, which the architecture states in three places (`final-three-phase-architecture.md` §7.3, §13, v5 register):

> "`llms.txt` may be generated as an optional supplemental resource index. It must not replace HTML, XML sitemaps, canonical URLs, robots rules, or normal crawlable links."

Derived entirely from the same `SeoPage` registry and the same publishable filter (registry-indexable **AND** quality-gate approved) the sitemap uses, so it cannot advertise a page the gate held back and cannot rot into listing 404s. Grouped under the existing `SITEMAP_SEGMENTS` headings, with each page described by its own registry `primaryIntent`.

Two deliberate details:

- **A `## Data provenance` section is emitted into the file itself.** A caveat that lives only in the HTML is lost the moment content is extracted — which is exactly what this file invites.
- **Segments cap at 200 links** and then point at the corresponding XML sitemap. An index that is 40,000 lines long is a corpus wearing an index's name.

Empty (bar a one-line explanation) while indexing is gated off.

### 3. `/llms-full.txt` — full-text corpus, double-gated

Behind `ARCHITECH_LLMS_FULL_ENABLED` **in addition to** `PUBLIC_INDEXING_ENABLED`.

The second gate is the point. `llms.txt` republishes URLs already in the sitemap, so enabling it reveals nothing new. `llms-full.txt` republishes *content*, in the single most ingestible form there is — one flat text file, no markup, no rate limit, no rendering. For this project that content is currently unverified demo prices, availability and RERA badges, and the repository's loudest standing rule is never to present invented property facts as real. There is also no undo: a page can be de-indexed, an ingested corpus cannot be recalled.

It stays closed in development too, because a dev default of "on" is how a flag reaches production.

When gated off the route answers **200 with an explanation, not 404** — a 404 reads as "no such file" and invites a retry, while an explanation records a deliberate decision.

The corpus is assembled from **registry metadata only** (`primaryIntent`, `targetQuery`, `freshnessPolicy`), not rendered page HTML. Extracting body text would mean shipping an HTML-to-text stripper whose failure mode is leaking markup and navigation chrome into a corpus. Widening this to real page bodies is follow-up work that belongs with the verified-inventory milestone.

**Trigger to open:** verified inventory **and** LEG-003 **and** LEG-008.

### 4. `/sitemap/images.xml` — image sitemap

§7.4 of the normative architecture specifies `/sitemaps/images-{n}.xml` and `/sitemaps/videos-{n}.xml`; the page segments shipped and these did not. This closes the image half.

This is worth more than either llms file: Google documents and actively consumes image sitemap extensions **today**, property search is image-led, and images delivered through a JS gallery or a transform CDN are precisely the case Google names as needing a sitemap to be found at all.

- Same publishable gate — media for a held-back page is never advertised.
- Absolute, canonical URLs only; a relative path is dropped rather than guessed at.
- Resolves to the **original** asset, not a width-parameterised transform URL, so one image is not indexed N times as N renditions.
- Gallery de-duplicated against the hero photo; per-listing real title and note as `image:title` / `image:caption`, no templated filler.
- Advertised from `/sitemap.xml`, dated from the newest listing page (photographs change when the listing does).

It is a **static** route sitting beside `/sitemap/[segment]` (Next resolves static segments first) and is deliberately **not** added to `SITEMAP_SEGMENTS`: those segments partition the `SeoPage` registry one-page-one-sitemap, and media is a different unit of enumeration.

**Video is not implemented** — the corpus has no video assets, and a video sitemap requires a thumbnail, title, description and content/player URL per entry. An empty `<video:video>` shell would advertise a capability that does not exist.

## Verification

| Gate | Result |
|---|---|
| `tsc --noEmit` | pass |
| `pnpm lint` (app + client/src) | pass, 0 warnings |
| Unit tests | **1860 passed** / 49 skipped, 170 files (was 1807 — **+53 new**) |
| Production build | pass; `/llms.txt`, `/llms-full.txt`, `/sitemap/images.xml` all registered |
| SEO smoke | pass — 19 routes, **8 sitemaps**, **2 AI index files** |
| Crawl simulation | pass — 494 pages crawled, no broken links, self-canonicals hold, sitemap ⊆ crawl |
| Performance budgets | pass |
| Release / ops / provisioning audits | pass |

New coverage: `ai-crawlers.test.ts` (19), `llms.test.ts` (19), `image-sitemap.test.ts` (15).

The tests pin the properties that actually matter rather than restating the implementation — that indexing-off beats `allow-all`, that `GPTBot`/`CCBot`/`ClaudeBot` stay classified as training, that neither text file leaks a page URL while gated, that `llms-full` needs both flags in both directions, and that a hostile listing title cannot emit invalid XML.

## One defect found en route (pre-existing, unrelated)

The crawl simulation failed on `sitemap advertises /listing/listing_uh0014/ but no crawl path reaches it`. Stashing all changes reproduced it **identically**, so it was not caused by this work.

Root cause: `listing_uh0014` ("E2E moderation apartment") was left `ACTIVE` in the local dev database by a previous E2E harness run. It is not in the fixture graph, so no hub links to it, but the prisma-composed registry advertises it — a genuine orphan submission of exactly the kind D5-04 exists to prevent. Deleted from the local database; the crawl then passed. **No product code was changed for this.**

Worth noting as an ops observation: the E2E harness creates ACTIVE listings in whatever database it points at and does not clean them up. Against a database that also serves the sitemap, that is an orphan-URL source. Out of scope here, but it is the same class of problem as the sandbox `pg_trgm` defect fixed on 7 Sep.

## Honest limits

- **`llms.txt` has no confirmed consumer.** No major AI vendor has publicly committed to reading it. It is cheap, standards-shaped and harmless; it is not a ranking mechanism, and it is built here as the *supplemental* file the architecture permits — not as a visibility strategy.
- **The measurable AI-visibility levers remain the ones already shipped**: server-rendered HTML, the 23-type JSON-LD entity graph, honest `lastmod`, crawlable internal links, and the quality gate. This work adds a deliberate consent policy and an image surface; it does not change those fundamentals.
- **`llms-full.txt` is inert until the inventory is real.** Shipping it enabled today would publish demo prices as fact.
