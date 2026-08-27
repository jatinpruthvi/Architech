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

function assertCommonSeo(html, route) {
  includes(html, "<title", route);
  includes(html, "rel=\"canonical\"", route);
  includes(html, "application/ld+json", route);
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
      includes(html, "@type\":\"Residence", "/listing/garden-courtyard/");
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
      includes(html, "Search homes in Ahmedabad", "/search/");
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
  console.log(`Raw HTML SEO smoke passed for ${routeChecks.length} routes.`);
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
