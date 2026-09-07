/* AI-crawler policy for robots.txt.
 *
 * Why this module exists: `app/robots.ts` emitted a single `userAgent: "*"`
 * rule, which means the project had never made a DECISION about AI crawlers —
 * it had made a silence. Silence is not neutral. Under the default
 * interpretation of robots.txt, a wildcard allow lets `GPTBot`, `CCBot`,
 * `ClaudeBot` and friends ingest the entire corpus, and `Google-Extended`
 * (the control for AI Overviews / Gemini grounding) reads the wildcard too.
 *
 * That matters here more than on a typical site for two reasons the
 * governance docs already name:
 *
 *   - LEG-003 (broker media rights) — public assets carry a rights record
 *     covering *display on this site*. Training ingestion is a different
 *     usage scope, and the rights record does not currently grant it.
 *   - LEG-008 (AI and generated content) — no-invention rules and provenance.
 *     Everything currently in the corpus is ILLUSTRATIVE DEMO DATA pending
 *     India Post / RERA verification. Feeding unverified property facts,
 *     prices and RERA numbers to a training crawler manufactures exactly the
 *     confident-but-wrong grounding the no-invention rule exists to prevent.
 *
 * The split this file encodes:
 *
 *   - SEARCH/GROUNDING crawlers (OAI-SearchBot, PerplexityBot,
 *     Google-Extended) — these fetch a page to CITE it, live, with a link.
 *     That is ordinary search visibility and it follows the same gate as
 *     everything else: allowed exactly when `PUBLIC_INDEXING_ENABLED` is on.
 *   - TRAINING crawlers (GPTBot, CCBot, ClaudeBot, Bytespider, …) — these
 *     ingest into a model. Denied by default, because consent for that has
 *     not been established and cannot be un-given once a crawl happens.
 *
 * The distinction is not always clean (a vendor may use one UA for both), so
 * it is expressed as data below with an explicit `rationale` per bot rather
 * than a clever rule. Operators can override the whole posture with
 * `ARCHITECH_AI_CRAWLER_POLICY`.
 *
 * Pure: no clock, no I/O, no request. */
import type { RuntimeEnvironment } from "./runtime";
import { isPublicIndexingEnabled } from "./runtime";

/** What a crawler is fetching FOR — the axis the consent question turns on. */
export type AiCrawlerPurpose = "search" | "training";

export type AiCrawlerAgent = {
  /** Exact `User-agent` token as the vendor documents it (case-insensitive
      when matched, but written here as published). */
  userAgent: string;
  vendor: string;
  purpose: AiCrawlerPurpose;
  /** Why this bot sits on this side of the line. Kept in the data so a future
      reader can re-litigate the call without guessing the reasoning. */
  rationale: string;
};

/* Deliberately not exhaustive: an unlisted AI crawler falls through to the
   `*` rule, which is the conservative outcome while indexing is gated off and
   the ordinary-search outcome once it is on. Adding a bot here is a decision,
   so each addition should carry its rationale. */
export const AI_CRAWLERS: readonly AiCrawlerAgent[] = [
  {
    userAgent: "OAI-SearchBot",
    vendor: "OpenAI",
    purpose: "search",
    rationale: "Surfaces and links pages in ChatGPT search results; does not train. Ordinary search visibility.",
  },
  {
    userAgent: "ChatGPT-User",
    vendor: "OpenAI",
    purpose: "search",
    rationale: "Fetches a page because a user asked for it in-session. Closer to a browser than a crawler.",
  },
  {
    userAgent: "PerplexityBot",
    vendor: "Perplexity",
    purpose: "search",
    rationale: "Indexes for cited answers with links back. Grounding, not ingestion.",
  },
  {
    userAgent: "Google-Extended",
    vendor: "Google",
    purpose: "search",
    rationale:
      "Controls Gemini/AI Overviews grounding. Not a crawler UA — Googlebot still crawls — so blocking it forfeits AI Overview citations without reducing crawl load.",
  },
  {
    userAgent: "Applebot-Extended",
    vendor: "Apple",
    purpose: "training",
    rationale: "Governs Apple Intelligence training use of Applebot's existing crawl. Training scope; not required for Siri/Spotlight links.",
  },
  {
    userAgent: "GPTBot",
    vendor: "OpenAI",
    purpose: "training",
    rationale: "Ingests for model training. LEG-003 media rights do not extend to training use.",
  },
  {
    userAgent: "ClaudeBot",
    vendor: "Anthropic",
    purpose: "training",
    rationale: "Ingests for model training. Same rights-scope objection as GPTBot.",
  },
  {
    userAgent: "CCBot",
    vendor: "Common Crawl",
    purpose: "training",
    rationale: "Public archive consumed by most training pipelines; an unverified-demo corpus must not enter it.",
  },
  {
    userAgent: "Bytespider",
    vendor: "ByteDance",
    purpose: "training",
    rationale: "Training crawler with a poor robots-compliance record; denied explicitly rather than by wildcard.",
  },
  {
    userAgent: "meta-externalagent",
    vendor: "Meta",
    purpose: "training",
    rationale: "Meta's AI training crawler, split out from the older facebookexternalhit fetcher.",
  },
];

export type AiCrawlerPolicy = "default" | "allow-all" | "deny-all";

/** Operator override.
 *
 *  - `default`   — search bots follow the indexing gate, training bots denied.
 *  - `allow-all` — every listed AI crawler follows the indexing gate. Set this
 *                  only once LEG-003/LEG-008 have cleared training use.
 *  - `deny-all`  — every listed AI crawler is disallowed outright, even with
 *                  indexing on. The posture for a rights dispute or takedown.
 *
 *  An unrecognised value falls back to `default` rather than throwing: a typo
 *  in an env var must not take robots.txt down, and the safe reading of an
 *  unparseable policy is the conservative one. */
export function aiCrawlerPolicy(env: RuntimeEnvironment = process.env): AiCrawlerPolicy {
  const raw = env.ARCHITECH_AI_CRAWLER_POLICY?.trim().toLowerCase();
  if (raw === "allow-all" || raw === "deny-all") return raw;
  return "default";
}

/** Whether one crawler may fetch, given the policy and the indexing gate.
 *
 *  Note the ordering: `deny-all` beats everything, and the indexing gate beats
 *  `allow-all`. A pre-launch site with indexing off never invites an AI
 *  crawler in, no matter how the policy is set — the same fail-closed rule the
 *  sitemap and `publicRobots()` already follow. */
export function isAiCrawlerAllowed(agent: AiCrawlerAgent, env: RuntimeEnvironment = process.env): boolean {
  const policy = aiCrawlerPolicy(env);
  if (policy === "deny-all") return false;
  if (!isPublicIndexingEnabled(env)) return false;
  if (policy === "allow-all") return true;
  return agent.purpose === "search";
}

export type RobotsRule = {
  userAgent: string;
  allow?: string | string[];
  disallow?: string | string[];
};

/** Per-bot robots rules, appended after the wildcard rule.
 *
 *  Allowed search bots get the SAME disallow list as the wildcard rule rather
 *  than a bare allow — `/search`, `/saved` and `/login` are thin, private or
 *  infinite-space surfaces, and that is true whoever is asking. Passing the
 *  list in (instead of re-deriving it) keeps the two rule sets from silently
 *  drifting apart. */
export function buildAiCrawlerRules(sharedDisallow: string[], env: RuntimeEnvironment = process.env): RobotsRule[] {
  return AI_CRAWLERS.map((agent) => {
    if (!isAiCrawlerAllowed(agent, env)) return { userAgent: agent.userAgent, disallow: "/" };
    return { userAgent: agent.userAgent, allow: "/", ...(sharedDisallow.length ? { disallow: sharedDisallow } : {}) };
  });
}
