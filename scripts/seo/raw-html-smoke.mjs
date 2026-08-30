#!/usr/bin/env node
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function includes(html, needle, route) {
  assert(html.includes(needle), `${route} raw HTML missing ${JSON.stringify(needle)}`);
}

function matches(html, pattern, route, label) {
  assert(pattern.test(html), `${route} raw HTML missing ${label}: ${pattern}`);
}

/* SERP length budget (StudyArena round-12, contestant C §7). Google truncates
   a title past ~60 characters and a description past ~155, and the tail is
   usually the number that would have earned the click. Measured across the
   prerendered routes, 131 titles and 419 of 438 descriptions were over budget
   with nothing checking, because the suite only asserted a <title> existed.

   These run against served HTML rather than the builders, so they fail on the
   string Google actually receives — including the brand suffix the layout
   appends, which a builder alone would not see. */
const SERP_TITLE_MAX = 60;
const SERP_DESCRIPTION_MAX = 155;

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/gi, "'")
    .replace(/&#0?39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function pageTitle(html, route) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/);
  assert(match, `${route} has no <title>`);
  return decodeEntities(match[1]);
}

function metaDescription(html, route) {
  const match =
    html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/) ||
    html.match(/<meta[^>]+content="([^"]*)"[^>]+name="description"/);
  assert(match, `${route} has no meta description`);
  return decodeEntities(match[1]);
}

function assertSerpBudget(html, route) {
  const title = pageTitle(html, route);
  assert(
    title.length <= SERP_TITLE_MAX,
    `${route} title is ${title.length} chars, over the ${SERP_TITLE_MAX} SERP budget: ${JSON.stringify(title)}`,
  );
  assert(!title.includes("\u2026"), `${route} title is truncated: ${JSON.stringify(title)}`);

  const description = metaDescription(html, route);
  assert(
    description.length <= SERP_DESCRIPTION_MAX,
    `${route} description is ${description.length} chars, over the ${SERP_DESCRIPTION_MAX} SERP budget: ${JSON.stringify(description)}`,
  );
  // An ellipsis in the SERP reads as a broken site. If a name outgrows the
  // budget the copy should be rewritten, not silently cut.
  assert(!description.includes("\u2026"), `${route} description is truncated: ${JSON.stringify(description)}`);
}

async function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForServer(baseUrl, child) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < 30_000) {
    if (child.exitCode !== null) {
      throw new Error(`next start exited early with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(baseUrl, { redirect: "manual" });
      if (response.status < 500) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${baseUrl}${lastError ? `: ${lastError.message}` : ""}`);
}

async function fetchHtml(baseUrl, route) {
  const response = await fetch(`${baseUrl}${route}`, { redirect: "manual" });
  assert(response.status === 200, `${route} expected HTTP 200, received ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  assert(contentType.includes("text/html"), `${route} expected text/html, received ${contentType}`);
  return response.text();
}

async function fetchXml(baseUrl, route) {
  const response = await fetch(`${baseUrl}${route}`, { redirect: "manual" });
  assert(response.status === 200, `${route} expected HTTP 200, received ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  assert(contentType.includes("xml"), `${route} expected XML, received ${contentType}`);
  return response.text();
}

/* The sitemap index and one child sitemap per content type. Public indexing is
   gated off in this build, so the URLs are expected to be empty — what these
   checks protect is routing, content type, and XML shape. */
const sitemapChecks = [
  { route: "/sitemap.xml", root: "sitemapindex" },
  { route: "/sitemap/pages.xml", root: "urlset" },
  { route: "/sitemap/cities.xml", root: "urlset" },
  { route: "/sitemap/localities.xml", root: "urlset" },
  { route: "/sitemap/listings.xml", root: "urlset" },
  { route: "/sitemap/guides.xml", root: "urlset" },
];

function assertCommonSeo(html, route) {
  includes(html, "<title", route);
  includes(html, "rel=\"canonical\"", route);
  includes(html, "application/ld+json", route);
  assertSerpBudget(html, route);
}

function assertNoindex(html, route) {
  matches(html, /<meta[^>]+name=\"robots\"[^>]+content=\"[^\"]*noindex[^\"]*\"/i, route, "noindex robots meta");
}

const routeChecks = [
  {
    route: "/",
    check(html) {
      assertCommonSeo(html, "/");
      includes(html, "Find the", "/");
      includes(html, "href=\"/buy/ahmedabad/\"", "/");
      includes(html, "@type\":\"WebSite", "/");
      includes(html, "@type\":\"Organization", "/");
    },
  },
  {
    route: "/buy/ahmedabad/",
    check(html) {
      assertCommonSeo(html, "/buy/ahmedabad/");
      includes(html, "Buy in", "/buy/ahmedabad/");
      includes(html, "Paldi", "/buy/ahmedabad/");
      includes(html, "\"trustScore\"", "/buy/ahmedabad/");
      includes(html, "trust in this area", "/buy/ahmedabad/");

      includes(html, "href=\"/buy/ahmedabad/paldi/\"", "/buy/ahmedabad/");
      matches(html, /<title>Buy in Ahmedabad[^<]*· Architech<\/title>/, "/buy/ahmedabad/", "route title");
    },
  },
  {
    route: "/buy/ahmedabad/paldi/",
    check(html) {
      assertCommonSeo(html, "/buy/ahmedabad/paldi/");
      includes(html, "Homes in Paldi", "/buy/ahmedabad/paldi/");
      includes(html, "\"trustScore\"", "/buy/ahmedabad/paldi/");
      includes(html, "RERA coverage", "/buy/ahmedabad/paldi/");

      includes(html, "Paldi", "/buy/ahmedabad/paldi/");
      includes(html, "@type\":\"Place", "/buy/ahmedabad/paldi/");
      includes(html, "@type\":\"BreadcrumbList", "/buy/ahmedabad/paldi/");
      matches(html, /<title>Paldi, Ahmedabad[^<]*· Architech<\/title>/, "/buy/ahmedabad/paldi/", "route title");
    },
  },
  {
    // National hub above the city hubs — must expose every city as a crawlable link.
    route: "/buy/",
    check(html) {
      assertCommonSeo(html, "/buy/");
      includes(html, "Buy property in India", "/buy/");
      includes(html, "href=\"/buy/ahmedabad/\"", "/buy/");
      includes(html, "href=\"/buy/mumbai/\"", "/buy/");
      includes(html, "href=\"/buy/bengaluru/\"", "/buy/");
      includes(html, "@type\":\"ItemList", "/buy/");
      matches(html, /<title>Buy property in India[^<]*· Architech<\/title>/, "/buy/", "route title");
    },
  },
  {
    // A second city proves the hub template is registry-driven, not Ahmedabad-only.
    route: "/buy/mumbai/",
    check(html) {
      assertCommonSeo(html, "/buy/mumbai/");
      includes(html, "Buy in", "/buy/mumbai/");
      includes(html, "Bandra West", "/buy/mumbai/");
      includes(html, "MahaRERA", "/buy/mumbai/");
      includes(html, "href=\"/buy/mumbai/bandra-west/\"", "/buy/mumbai/");
      matches(html, /<title>Buy in Mumbai[^<]*· Architech<\/title>/, "/buy/mumbai/", "route title");
    },
  },
  {
    route: "/buy/mumbai/bandra-west/",
    check(html) {
      assertCommonSeo(html, "/buy/mumbai/bandra-west/");
      includes(html, "Homes in Bandra West", "/buy/mumbai/bandra-west/");
      includes(html, "@type\":\"Place", "/buy/mumbai/bandra-west/");
      includes(html, "@type\":\"BreadcrumbList", "/buy/mumbai/bandra-west/");
      // Breadcrumbs must climb to the owning city, never to a hardcoded one.
      includes(html, "href=\"/buy/mumbai/\"", "/buy/mumbai/bandra-west/");
      matches(html, /<title>Bandra West, Mumbai[^<]*· Architech<\/title>/, "/buy/mumbai/bandra-west/", "route title");
    },
  },
  {
    route: "/list-property/",
    check(html) {
      assertCommonSeo(html, "/list-property/");
      includes(html, "List your property", "/list-property/");
      includes(html, "source trail", "/list-property/");
      includes(html, "@type\":\"WebPage", "/list-property/");
      includes(html, "rel=\"canonical\"", "/list-property/");
    },
  },
  {
    route: "/listing/garden-courtyard/",
    check(html) {
      assertCommonSeo(html, "/listing/garden-courtyard/");
      includes(html, "A garden courtyard in Paldi", "/listing/garden-courtyard/");
      includes(html, "₹1.85 Cr", "/listing/garden-courtyard/");
      includes(html, "\"name\":\"trustScore\"", "/listing/garden-courtyard/");
      includes(html, "\"@type\":\"RealEstateAgent\"", "/listing/garden-courtyard/");
      includes(html, "\"name\":\"priceHistory\"", "/listing/garden-courtyard/");

      includes(html, "\"additionalProperty\"", "/listing/garden-courtyard/");
      includes(html, "Trust score", "/listing/garden-courtyard/");
      includes(html, "RERA verified", "/listing/garden-courtyard/");

      includes(html, "Paldi", "/listing/garden-courtyard/");
      // Contestant C §3: the specific type, not the generic Residence. This
      // listing is a Flat/Apartment, so it must be typed Apartment.
      includes(html, "@type\":\"Apartment", "/listing/garden-courtyard/");
      // §6: an absolute freshness stamp the reader can actually check.
      includes(html, "<time dateTime=\"", "/listing/garden-courtyard/");
      includes(html, "Updated on", "/listing/garden-courtyard/");
      // The city comes from the listing, never a hardcoded launch city.
      includes(html, "Paldi, Ahmedabad", "/listing/garden-courtyard/");
      includes(html, "@type\":\"RealEstateListing\"", "/listing/garden-courtyard/");
      includes(html, "@type\":\"Offer\"", "/listing/garden-courtyard/");
      includes(html, "numberOfBathroomsTotal", "/listing/garden-courtyard/");
      includes(html, "@type\":\"BreadcrumbList", "/listing/garden-courtyard/");
      matches(html, /<title>A garden courtyard in Paldi[^<]*₹1\.85 Cr[^<]*· Architech<\/title>/, "/listing/garden-courtyard/", "route title");
    },
  },
  {
    route: "/guide/",
    check(html) {
      assertCommonSeo(html, "/guide/");
      includes(html, "Ahmedabad", "/guide/");
      includes(html, "@type\":\"CollectionPage", "/guide/");
      matches(html, /"url":"https:\/\/[^\"]+\/guide\//, "/guide/", "absolute guide ItemList URL");
    },
  },
  {
    route: "/guide/city/ahmedabad/home-buying-guide/",
    check(html) {
      assertCommonSeo(html, "/guide/city/ahmedabad/home-buying-guide/");
      includes(html, "@type\":\"Article", "/guide/city/ahmedabad/home-buying-guide/");
      includes(html, "Editorial method", "/guide/city/ahmedabad/home-buying-guide/");
      matches(html, /\"image\":\"https:\/\/[^\"]+\"/, "/guide/city/ahmedabad/home-buying-guide/", "absolute Article image URL");
    },
  },
  {
    route: "/search/",
    check(html) {
      assertCommonSeo(html, "/search/");
      assertNoindex(html, "/search/");
      includes(html, "Search homes across India", "/search/");
    },
  },
  {
    route: "/collections/",
    check(html) {
      assertCommonSeo(html, "/collections/");
      assertNoindex(html, "/collections/");
      includes(html, "Private working set", "/collections/");
      includes(html, "No collections yet", "/collections/");
    },
  },
  {
    route: "/privacy/",
    check(html) {
      assertCommonSeo(html, "/privacy/");
      includes(html, "Privacy", "/privacy/");
    },
  },
  {
    route: "/terms/",
    check(html) {
      assertCommonSeo(html, "/terms/");
      includes(html, "Terms", "/terms/");
    },
  },
];

const port = await findFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const nextBin = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");
const child = spawn(nextBin, ["start", "-H", "127.0.0.1", "-p", String(port)], {
  cwd: root,
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  stdio: ["ignore", "pipe", "pipe"],
  detached: process.platform !== "win32",
});

let output = "";
child.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

try {
  await waitForServer(baseUrl, child);
  for (const item of routeChecks) {
    const html = await fetchHtml(baseUrl, item.route);
    item.check(html);
    console.log(`✓ raw HTML SEO checks passed for ${item.route}`);
  }
  for (const item of sitemapChecks) {
    const xml = await fetchXml(baseUrl, item.route);
    includes(xml, `<${item.root}`, item.route);
    console.log(`✓ sitemap checks passed for ${item.route}`);
  }
  const unknownSegment = await fetch(`${baseUrl}/sitemap/not-a-segment.xml`, { redirect: "manual" });
  assert(unknownSegment.status === 404, `unknown sitemap segment expected HTTP 404, received ${unknownSegment.status}`);
  console.log("✓ unknown sitemap segment returns 404");
  console.log(`SEO smoke passed for ${routeChecks.length} routes and ${sitemapChecks.length} sitemaps.`);
} catch (error) {
  console.error(output.trim());
  console.error(error);
  process.exitCode = 1;
} finally {
  if (child.exitCode === null) {
    if (process.platform === "win32") child.kill("SIGTERM");
    else process.kill(-child.pid, "SIGTERM");
  }
}
