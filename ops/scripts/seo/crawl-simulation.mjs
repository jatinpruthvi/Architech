#!/usr/bin/env node
/* Crawl simulation (P1-SEO-003): walk the site the way Googlebot's HTML pass
   does — links first, no JavaScript — and prove the public link graph is
   healthy end to end.

   Checks:
     1. No internal href resolves to 4xx/5xx.
     2. Every HTML page's rel=canonical self-references its final URL.
     3. Sitemap ⊆ crawl: every URL the sitemap advertises is reachable by
        links (a sitemap entry with no inbound link is a promise Google cannot
        corroborate — orphan detection).
     4. Click depth: every sitemap page is discoverable within MAX_DEPTH of
        the home page, distribution printed.
     5. Interactive surfaces keep their robots meta (noindex) when crawled.

   Usage:
     node scripts/seo/crawl-simulation.mjs            (builds nothing; boots `next start`)
     CRAWL_BASE_URL=http://127.0.0.1:3000 node scripts/seo/crawl-simulation.mjs
                                                      (crawl an already-running server)
*/
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const MAX_PAGES = 1500;
const MAX_DEPTH = 4;
const CONCURRENCY = 4;

function fail(message) {
  throw new Error(message);
}

/* Canonical-builder links are ABSOLUTE (the urls.ts builders mint
   SITE_URL-based hrefs), so same-origin detection must consider both the
   served origin (this preview/CI box) and the canonical production origin. */
const CANONICAL_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://architech-demo.example.com").origin;
  } catch {
    return "https://architech-demo.example.com";
  }
})();

function normalizePath(rawHref, baseOrigin) {
  if (!rawHref || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:") || rawHref.startsWith("javascript:")) return null;
  let pathname = null;
  if (rawHref.startsWith("/")) {
    pathname = rawHref;
  } else if (rawHref.startsWith("http://") || rawHref.startsWith("https://")) {
    try {
      const parsed = new URL(rawHref);
      if (parsed.origin !== baseOrigin && parsed.origin !== CANONICAL_ORIGIN) return null; // genuinely off-site
      pathname = parsed.pathname + parsed.search;
    } catch {
      return null;
    }
  } else {
    return null; // protocol-relative or schemeless junk
  }
  const withoutHash = pathname.split("#")[0];
  if (withoutHash.startsWith("/api/") || withoutHash.startsWith("/_next/")) return null;
  const clean = withoutHash.split("?")[0];
  if (/\.\w{2,4}$/.test(clean) && !clean.endsWith(".html")) return null; // assets, xml, ico, webmanifest…
  return clean;
}

function extractLinks(html, baseOrigin) {
  const links = new Set();
  for (const match of html.matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>/gi)) {
    const norm = normalizePath(match[1], baseOrigin);
    if (norm) links.add(norm);
  }
  return [...links];
}

function canonicalPath(html) {
  const match = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"[^>]*>/i) || html.match(/<link[^>]+href="([^"]+)"[^>]+rel="canonical"[^>]*>/i);
  if (!match) return null;
  try {
    return new URL(match[1]).pathname;
  } catch {
    return null;
  }
}

function robotsNoindex(html) {
  const meta = html.match(/<meta[^>]+name="robots"[^>]+content="([^"]+)"/i) || html.match(/<meta[^>]+content="([^"]+)"[^>]+name="robots"/i);
  return meta ? /noindex/i.test(meta[1]) : false;
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(baseUrl, child) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl, { redirect: "manual" });
      if (response.status > 0) return;
    } catch {
      /* not up yet */
    }
    if (child && child.exitCode !== null) fail(`next start exited with ${child.exitCode}`);
    await new Promise((r) => setTimeout(r, 400));
  }
  fail(`server at ${baseUrl} did not become ready in time`);
}

async function fetchPage(baseUrl, route) {
  const response = await fetch(`${baseUrl}${route}`, { redirect: "follow" });
  const text = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  // Final path after redirects, so canonical comparison uses the served URL.
  const finalPath = new URL(response.url).pathname;
  return { status: response.status, html: contentType.includes("text/html") ? text : "", contentType, finalPath };
}

const externalBase = process.env.CRAWL_BASE_URL ?? null;
let baseUrl = externalBase;
let child = null;
let serverOutput = "";

if (!externalBase) {
  const port = await findFreePort();
  baseUrl = `http://127.0.0.1:${port}`;
  const nextBin = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");
  child = spawn(nextBin, ["start", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: root,
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      /* The simulation exists to audit the INDEXED surface — sitemap ⊆ crawl,
         click depth — so the booted server deliberately enables indexing.
         Production keeps its real env; this only affects this local process.
         (HTML pages are prerendered at build time, so the metadata inside
         them still reflects the build env; sitemap/robots render live.) */
      PUBLIC_INDEXING_ENABLED: process.env.PUBLIC_INDEXING_ENABLED ?? "true",
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  });
  child.stdout.on("data", (chunk) => (serverOutput += chunk.toString()));
  child.stderr.on("data", (chunk) => (serverOutput += chunk.toString()));
}

const problems = [];
const note = (message) => problems.push(message);

try {
  await waitForServer(baseUrl, child);
  console.log(`crawl-simulation: target ${baseUrl}${externalBase ? " (external)" : ""}`);

  /* BFS frontier. depth[route] = clicks from home; a route keeps the smallest
     depth at which it was first seen. */
  const visited = new Map(); // route -> { depth, status, canonical, noindex }
  const frontier = [{ route: "/", depth: 0 }];
  let crawled = 0;

  while (frontier.length > 0 && visited.size < MAX_PAGES) {
    const batch = [];
    while (frontier.length > 0 && batch.length < CONCURRENCY) batch.push(frontier.shift());
    const results = await Promise.all(
      batch.map(async ({ route, depth }) => {
        if (visited.has(route)) return null;
        const page = await fetchPage(baseUrl, route).catch((error) => ({ status: 0, html: "", contentType: "", finalPath: route, error }));
        return { route, depth, page };
      }),
    );
    for (const result of results) {
      if (!result || visited.has(result.route)) continue;
      const { route, depth, page } = result;
      crawled += 1;
      visited.set(route, {
        depth,
        status: page.status,
        finalPath: page.finalPath,
        canonical: page.html ? canonicalPath(page.html) : null,
        noindex: page.html ? robotsNoindex(page.html) : null,
        contentType: page.contentType,
      });

      if (page.status >= 400 || page.status === 0) {
        note(`${route} returned HTTP ${page.status}${page.error ? ` (${page.error.message})` : ""}`);
        continue;
      }
      if (page.html) {
        for (const next of extractLinks(page.html, new URL(baseUrl).origin)) {
          if (!visited.has(next) && depth + 1 <= MAX_DEPTH + 2) frontier.push({ route: next, depth: depth + 1 });
        }
      }
    }
  }

  console.log(`crawl-simulation: crawled ${crawled} pages`);

  // --- 1. canonicals ------------------------------------------------------
  let canonicalChecked = 0;
  for (const [route, info] of visited) {
    if (info.status !== 200 || !info.contentType.includes("text/html")) continue;
    if (route.endsWith(".html")) continue; // file-style URLs canonicalize to themselves without a slash
    canonicalChecked += 1;
    const expected = info.finalPath.endsWith("/") || /\.(html|xml)$/.test(info.finalPath) ? info.finalPath : `${info.finalPath}/`;
    if (info.canonical !== expected) note(`${route}: canonical is ${info.canonical ?? "MISSING"}, expected ${expected}`);
  }

  // --- 2. robots meta on interactive surfaces -----------------------------
  for (const surface of ["/search/", "/saved/", "/saved-searches/", "/compare/", "/collections/"]) {
    if (!visited.has(surface)) continue;
    if (visited.get(surface).noindex !== true) note(`${surface} must keep noindex in robots meta`);
  }

  // --- 3+4. sitemap ⊆ crawl, click depth ----------------------------------
  const sitemapIndex = await fetchText(baseUrl, "/sitemap.xml");
  const segmentPaths = [...sitemapIndex.matchAll(/<loc>[^<]*?(\/sitemap\/[^<]+\.xml)<\/loc>/g)].map((m) => m[1]);
  const sitemapLocs = new Set();
  // The index sitemap may also carry page URLs directly; include those too.
  for (const m of sitemapIndex.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const p = new URL(m[1]).pathname;
    if (!p.endsWith(".xml")) sitemapLocs.add(p);
  }
  for (const segment of segmentPaths) {
    const xml = await fetchText(baseUrl, segment);
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) sitemapLocs.add(new URL(m[1]).pathname);
  }

  let orphans = 0;
  let tooDeep = 0;
  const depthHistogram = {};
  for (const loc of sitemapLocs) {
    const seen = visited.get(loc) ?? visited.get(loc.endsWith("/") ? loc.slice(0, -1) : `${loc}/`);
    if (!seen || seen.status >= 400 || seen.status === 0) {
      orphans += 1;
      if (orphans <= 15) note(`sitemap advertises ${loc} but no crawl path reaches it (status ${seen?.status ?? "unvisited"})`);
      continue;
    }
    depthHistogram[seen.depth] = (depthHistogram[seen.depth] ?? 0) + 1;
    if (seen.depth > MAX_DEPTH) {
      tooDeep += 1;
      if (tooDeep <= 15) note(`${loc} is ${seen.depth} clicks from home (max ${MAX_DEPTH})`);
    }
  }

  // --- report ---------------------------------------------------------------
  console.log(`crawl-simulation: sitemap urls=${sitemapLocs.size} (segments: ${segmentPaths.length || "index-only"})`);
  console.log(`crawl-simulation: canonical checks=${canonicalChecked}`);
  console.log(`crawl-simulation: click-depth histogram=${JSON.stringify(depthHistogram)}`);
  if (problems.length > 0) {
    console.error(`\ncrawl-simulation FAILED with ${problems.length} problem(s):`);
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exitCode = 1;
  } else {
    console.log("crawl-simulation: all checks passed — no broken links, self-canonicals hold, sitemap ⊆ crawl, depth within budget");
  }
} catch (error) {
  console.error(serverOutput.trim());
  console.error(error);
  process.exitCode = 1;
} finally {
  if (child && child.exitCode === null) {
    if (process.platform === "win32") child.kill("SIGTERM");
    else process.kill(-child.pid, "SIGTERM");
  }
}

async function fetchText(base, route) {
  const response = await fetch(`${base}${route}`, { redirect: "follow" });
  return response.text();
}
