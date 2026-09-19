import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/* PERF-R5-004 guard: internal API calls use the app's canonical URL form.
 *
 * This app deploys with `trailingSlash: true` (next.config.ts:86), so Next
 * serves every route at the slashed path and 308-redirects the bare one — the
 * same fact the auth mount contract documents (`src/app/api/auth/[...all]/
 * route.ts`) and locks in `api-contract.test.ts`. Verified against a real
 * production server: `POST /api/observability/web-vitals` → `308` →
 * `/api/observability/web-vitals/`, for GET/POST/PUT/DELETE alike.
 *
 * Why it matters beyond one wasted round trip: the RUM reporter calls
 * `navigator.sendBeacon()`, and `sendBeacon` returns true whether or not the
 * request is ever delivered. Browsers are not consistent about following
 * redirects for suspended requests — Chromium issue 40232823 ("doesn't follow
 * the server redirect", observed from Chrome 93), Firefox bug 1137553
 * ("sendBeacon does not honor redirects") — so a beacon aimed at the bare path
 * can be dropped silently, with no client-side error to notice. Every call
 * site now uses the slashed path, so the question no longer arises.
 *
 * The scan reads non-test source, ignores prose (these files' own comments
 * discuss URLs), and keys on the call positions that actually make a request:
 * fetch/sendBeacon/beacon arguments and assignments to a URL/path variable. */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      out.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Any `/api/...` string/template literal on this line that is not slashed. */
function bareUrlsOnLine(line: string): string[] {
  const found: string[] = [];
  for (const match of line.matchAll(/["'`](\/api\/[^"'`\s]*)["'`]/g)) {
    const url = match[1];
    if (url.includes("//")) continue;
    /* A query string is appended after the path, so the slash goes before it. */
    if (url.split("?")[0].endsWith("/")) continue;
    if (/\.(json|xml|txt|webmanifest|png|jpg|jpeg|svg|ico)$/.test(url)) continue;
    found.push(url);
  }
  return found;
}

/* Call positions only. The brief for this round was "technical changes, not
   functionality", and a bare URL in a *response payload* is a published string,
   not a request: `observability/health` advertises `rumEndpoint` and
   `observability/status` lists its siblings, both for monitors that follow
   redirects. Rewriting those would edit a monitoring contract (and the test
   that pins the value), which is a product decision rather than a perf fix — so
   they are tolerated here and recorded in the report instead. A bare URL that
   is actually *called* is what this guard fails on. */

/** A line is a call site when it fetches/beacons or assigns a URL to a name. */
function isCallSite(line: string): boolean {
  return /\b(fetch|sendBeacon)\s*\(/.test(line) || /=[^;]*["'`]\/api\//.test(line);
}

function bareCallSiteUrls(src: string): string[] {
  const found: string[] = [];
  for (const line of stripComments(src).split("\n")) {
    if (!isCallSite(line)) continue;
    found.push(...bareUrlsOnLine(line));
  }
  return found;
}

describe("PERF-R5-004: internal API calls use the canonical slashed path", () => {
  const files = sourceFiles(join(repoRoot, "src"));

  it("no non-test source calls an internal API at the bare (308-redirecting) path", () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const url of bareCallSiteUrls(readFileSync(file, "utf8"))) {
        offenders.push(`${relative(repoRoot, file)}  ${url}`);
      }
    }
    expect(
      offenders,
      "These internal API URLs omit the trailing slash the app serves (trailingSlash: true), " +
        "so every call pays a 308 hop — and a sendBeacon aimed at one can be dropped silently " +
        "in browsers that do not follow redirects. Add the trailing slash.",
    ).toEqual([]);
  });

  /* The RUM beacon is the call site where a redirect may mean data loss rather
     than a slow request, so it is pinned by name. */
  it("the RUM reporter beacons to the slashed endpoint", () => {
    const reporter = stripComments(
      readFileSync(join(repoRoot, "src/components/architech/WebVitalsReporter.tsx"), "utf8"),
    );
    expect(reporter).toMatch(/sendBeacon\("\/api\/observability\/web-vitals\/"/);
    expect(reporter).toMatch(/fetch\("\/api\/observability\/web-vitals\/"/);
  });

  /* A scanner that matched nothing would pass forever. */
  it("the scan detects a bare call-site URL and tolerates a slashed one", () => {
    expect(bareCallSiteUrls('await fetch("/api/broker/leads", {})')).toEqual(["/api/broker/leads"]);
    expect(bareCallSiteUrls('await fetch("/api/broker/leads/", {})')).toEqual([]);
    expect(bareCallSiteUrls('const path = action ? "/api/a" : "/api/b";')).toEqual(["/api/a", "/api/b"]);
    expect(bareCallSiteUrls('navigator.sendBeacon("/api/observability/web-vitals", blob);')).toEqual(["/api/observability/web-vitals"]);
    expect(bareCallSiteUrls('// prose about fetch("/api/broker/leads") without a slash')).toEqual([]);
    expect(bareCallSiteUrls('/* prose about fetch("/api/broker/leads") */')).toEqual([]);
  });

  /* The deliberate exception, pinned so it stays deliberate: these are payload
     strings for monitors, not requests this app makes. */
  it("tolerates advertised endpoint strings in observability payloads", () => {
    const health = readFileSync(join(repoRoot, "src/app/api/observability/health/route.ts"), "utf8");
    const status = readFileSync(join(repoRoot, "src/app/api/observability/status/route.ts"), "utf8");
    expect(bareCallSiteUrls(health)).toEqual([]);
    expect(bareCallSiteUrls(status)).toEqual([]);
  });
});
