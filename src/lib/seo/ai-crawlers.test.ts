import { describe, expect, it } from "vitest";
import { AI_CRAWLERS, aiCrawlerPolicy, buildAiCrawlerRules, isAiCrawlerAllowed } from "./ai-crawlers";

/* The contract that matters: consent is fail-closed and purpose-split. These
   tests exist to catch the three ways that breaks — a training bot slipping
   through the default, an AI bot being invited in before indexing is on, and
   an operator override that cannot actually be exercised. */

const INDEXING_ON = { NODE_ENV: "production", PUBLIC_INDEXING_ENABLED: "true" } as const;
const INDEXING_OFF = { NODE_ENV: "production" } as const;

describe("ai crawler policy resolution", () => {
  it("defaults to the conservative posture when unset", () => {
    expect(aiCrawlerPolicy({})).toBe("default");
  });

  it("falls back to default on an unrecognised value rather than throwing", () => {
    // A typo in an env var must not take robots.txt down.
    expect(aiCrawlerPolicy({ ARCHITECH_AI_CRAWLER_POLICY: "allow_all" })).toBe("default");
    expect(aiCrawlerPolicy({ ARCHITECH_AI_CRAWLER_POLICY: "" })).toBe("default");
  });

  it("accepts the two documented overrides, case-insensitively", () => {
    expect(aiCrawlerPolicy({ ARCHITECH_AI_CRAWLER_POLICY: "ALLOW-ALL" })).toBe("allow-all");
    expect(aiCrawlerPolicy({ ARCHITECH_AI_CRAWLER_POLICY: " deny-all " })).toBe("deny-all");
  });
});

describe("purpose split", () => {
  it("classifies every listed crawler as search or training", () => {
    for (const agent of AI_CRAWLERS) {
      expect(["search", "training"]).toContain(agent.purpose);
    }
  });

  it("records a rationale for every crawler", () => {
    // The rationale is the reason a future reader can re-litigate the call.
    for (const agent of AI_CRAWLERS) {
      expect(agent.rationale.length).toBeGreaterThan(20);
    }
  });

  it("lists no duplicate user agents", () => {
    const seen = new Set(AI_CRAWLERS.map((agent) => agent.userAgent.toLowerCase()));
    expect(seen.size).toBe(AI_CRAWLERS.length);
  });

  it("allows search/grounding bots once indexing is on", () => {
    const search = AI_CRAWLERS.filter((agent) => agent.purpose === "search");
    expect(search.length).toBeGreaterThan(0);
    for (const agent of search) expect(isAiCrawlerAllowed(agent, INDEXING_ON)).toBe(true);
  });

  it("denies training bots even with indexing on", () => {
    // LEG-003/LEG-008: display rights are not training rights.
    const training = AI_CRAWLERS.filter((agent) => agent.purpose === "training");
    expect(training.length).toBeGreaterThan(0);
    for (const agent of training) expect(isAiCrawlerAllowed(agent, INDEXING_ON)).toBe(false);
  });

  it("keeps GPTBot and CCBot on the training side", () => {
    // Pinned by name: these are the two whose reclassification would be most
    // consequential and least visible in a diff.
    for (const name of ["GPTBot", "CCBot", "ClaudeBot"]) {
      const agent = AI_CRAWLERS.find((candidate) => candidate.userAgent === name);
      expect(agent?.purpose).toBe("training");
    }
  });

  it("keeps Google-Extended on the search side", () => {
    // Blocking it forfeits AI Overview citations without reducing crawl load.
    expect(AI_CRAWLERS.find((agent) => agent.userAgent === "Google-Extended")?.purpose).toBe("search");
  });
});

describe("fail-closed ordering", () => {
  it("denies every AI crawler while public indexing is gated off", () => {
    for (const agent of AI_CRAWLERS) expect(isAiCrawlerAllowed(agent, INDEXING_OFF)).toBe(false);
  });

  it("keeps indexing-off authoritative over allow-all", () => {
    // A pre-launch site never invites an AI crawler in, however the policy reads.
    const env = { ...INDEXING_OFF, ARCHITECH_AI_CRAWLER_POLICY: "allow-all" };
    for (const agent of AI_CRAWLERS) expect(isAiCrawlerAllowed(agent, env)).toBe(false);
  });

  it("lets deny-all override indexing-on", () => {
    const env = { ...INDEXING_ON, ARCHITECH_AI_CRAWLER_POLICY: "deny-all" };
    for (const agent of AI_CRAWLERS) expect(isAiCrawlerAllowed(agent, env)).toBe(false);
  });

  it("lets allow-all admit training bots once indexing is on", () => {
    const env = { ...INDEXING_ON, ARCHITECH_AI_CRAWLER_POLICY: "allow-all" };
    for (const agent of AI_CRAWLERS) expect(isAiCrawlerAllowed(agent, env)).toBe(true);
  });
});

describe("robots rule generation", () => {
  it("emits one rule per known crawler", () => {
    expect(buildAiCrawlerRules([], INDEXING_ON)).toHaveLength(AI_CRAWLERS.length);
  });

  it("disallows the whole site for a denied crawler", () => {
    const rules = buildAiCrawlerRules(["/search/"], INDEXING_ON);
    const gptbot = rules.find((rule) => rule.userAgent === "GPTBot");
    expect(gptbot).toEqual({ userAgent: "GPTBot", disallow: "/" });
    // Not a partial block — a denied training crawler gets no allow at all.
    expect(gptbot?.allow).toBeUndefined();
  });

  it("gives an allowed crawler the same exclusions as the wildcard rule", () => {
    // Thin/private surfaces are thin/private whoever is asking, and deriving
    // the list twice is how the two rule sets drift apart.
    const shared = ["/saved/", "/search/", "/login/"];
    const rules = buildAiCrawlerRules(shared, INDEXING_ON);
    const perplexity = rules.find((rule) => rule.userAgent === "PerplexityBot");
    expect(perplexity).toEqual({ userAgent: "PerplexityBot", allow: "/", disallow: shared });
  });

  it("omits an empty disallow list rather than emitting a bare directive", () => {
    const rules = buildAiCrawlerRules([], INDEXING_ON);
    expect(rules.find((rule) => rule.userAgent === "OAI-SearchBot")).toEqual({ userAgent: "OAI-SearchBot", allow: "/" });
  });

  it("disallows everything while indexing is gated off", () => {
    for (const rule of buildAiCrawlerRules([], INDEXING_OFF)) {
      expect(rule.disallow).toBe("/");
      expect(rule.allow).toBeUndefined();
    }
  });
});
