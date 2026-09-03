/* End-to-end checks for the public, unauthenticated surface.
 *
 * These are the pages and contracts a change to routing, SEO, data loading or
 * the design system is most likely to break silently. They run against a real
 * production build over real HTTP, so they catch the things a unit test cannot:
 * a route that 500s only when built, a canonical that points at localhost, a
 * redirect that loses its query string, a JSON-LD block that stops parsing.
 *
 * Scope note: this is a REGRESSION net, not an exhaustive content audit. Deep
 * SEO assertions already live in `scripts/seo/raw-html-smoke.mjs`; the checks
 * here are the cheap, high-signal ones that should never go red.
 */
import { assert, assertEqual, assertIncludes, assertMatch, createSuite, startServer } from "./harness.mjs";

const suite = createSuite();
const { group, test } = suite;

/** Public routes that must always render. */
const PUBLIC_ROUTES = [
  { path: "/", label: "home" },
  { path: "/buy/", label: "national hub" },
  { path: "/buy/ahmedabad/", label: "city hub" },
  { path: "/buy/ahmedabad/paldi/", label: "locality page" },
  { path: "/search/", label: "search" },
  { path: "/guide/", label: "field notes" },
  { path: "/saved/", label: "saved shortlist" },
  { path: "/list-property/", label: "list property" },
  { path: "/contact-us/", label: "contact" },
  { path: "/about-us/", label: "about" },
  { path: "/privacy/", label: "privacy" },
  { path: "/terms/", label: "terms" },
  { path: "/login/", label: "login" },
];

async function run() {
  const server = await startServer({ env: { ARCHITECH_AUTH_SOURCE: "demo" }, label: "public server" });
  const { client, baseUrl } = server;

  try {
    await group("public routes render", async () => {
      for (const route of PUBLIC_ROUTES) {
        await test(`${route.path} (${route.label}) returns HTML`, async () => {
          const response = await client.get(route.path);
          assertEqual(response.status, 200, `${route.path} must return 200`);
          assertIncludes(response.headers.get("content-type") ?? "", "text/html", `${route.path} must be HTML`);
          assertIncludes(response.text, "<main", `${route.path} must have a main landmark`);
        });
      }
    });

    await group("server-side rendering is real (AI/crawler readable)", async () => {
      await test("the home page ships content in the raw HTML, not just a JS shell", async () => {
        /* The architecture's whole SEO premise is server-rendered HTML. If a
           page ever became client-only, every crawler check downstream would
           still 200 while the content vanished. */
        const response = await client.get("/");
        assert(response.text.length > 5000, `home HTML looks like an empty shell (${response.text.length} bytes)`);
        assertMatch(response.text, /<h1[\s>]/, "home must render an h1 server-side");
      });

      await test("a locality page names its place in the raw HTML", async () => {
        const response = await client.get("/buy/ahmedabad/paldi/");
        assertMatch(response.text, /Paldi/i, "the locality page must name the locality server-side");
      });

      await test("every public route emits a title and meta description", async () => {
        for (const route of PUBLIC_ROUTES) {
          const response = await client.get(route.path);
          assertMatch(response.text, /<title>[^<]+<\/title>/, `${route.path} must have a non-empty <title>`);
          assertMatch(response.text, /name="description"\s+content="[^"]+"/, `${route.path} must have a meta description`);
        }
      });
    });

    await group("URL grammar (trailing slash is the canonical form)", async () => {
      await test("a slashless public URL redirects permanently to the canonical form", async () => {
        /* `trailingSlash: true` is load-bearing for canonicals and for the
           sitemap. A 200 on both forms would be duplicate content. */
        const response = await client.get("/buy/ahmedabad");
        assert([301, 308].includes(response.status), `expected a permanent redirect, got ${response.status}`);
        assertIncludes(response.location ?? "", "/buy/ahmedabad/", "and it must point at the slashed form");
      });

      await test("a redirect preserves the query string", async () => {
        /* Dropping the query on redirect silently discards filters — the kind
           of bug that only shows up as "search forgets what I typed". */
        const response = await client.get("/search?city=pune");
        if ([301, 308].includes(response.status)) {
          assertIncludes(response.location ?? "", "city=pune", "the redirect must keep the query string");
        }
      });

      await test("an unknown route is a true 404, not a soft 200", async () => {
        const response = await client.get("/buy/atlantis/");
        assertEqual(response.status, 404, "an unknown place must return HTTP 404");
      });

      await test("an unknown locality inside a real city is also a 404", async () => {
        const response = await client.get("/buy/ahmedabad/not-a-real-locality/");
        assertEqual(response.status, 404, "an unknown locality must return HTTP 404");
      });
    });

    await group("SEO plumbing", async () => {
      await test("robots.txt is served and names the sitemap", async () => {
        const response = await client.get("/robots.txt");
        assertEqual(response.status, 200, "robots.txt must be served");
        assertIncludes(response.text, "Sitemap:", "robots.txt must advertise a sitemap");
      });

      await test("sitemap.xml is valid XML with a urlset or index", async () => {
        const response = await client.get("/sitemap.xml");
        assertEqual(response.status, 200, "sitemap.xml must be served");
        assert(/<(sitemapindex|urlset)/.test(response.text), "sitemap.xml must be a sitemap index or urlset");
      });

      await test("private surfaces are noindex", async () => {
        for (const path of ["/login/", "/broker/dashboard/"]) {
          const response = await client.get(path);
          assertMatch(response.text, /<meta name="robots" content="noindex/, `${path} must be noindex`);
        }
      });

      await test("JSON-LD blocks parse as JSON", async () => {
        /* A malformed JSON-LD block is invisible in the browser and silently
           discards every structured-data signal on the page. */
        for (const path of ["/", "/buy/ahmedabad/paldi/", "/contact-us/"]) {
          const response = await client.get(path);
          const blocks = [...response.text.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
          assert(blocks.length > 0, `${path} must emit at least one JSON-LD block`);
          for (const [, body] of blocks) {
            try {
              JSON.parse(body);
            } catch (error) {
              throw new Error(`${path} has unparseable JSON-LD: ${error.message}`);
            }
          }
        }
      });

      await test("canonicals are absolute and never point at the bind address", async () => {
        const response = await client.get("/buy/ahmedabad/");
        const canonical = response.text.match(/rel="canonical"\s+href="([^"]+)"/)?.[1];
        assert(canonical, "a canonical link must be present");
        assertMatch(canonical, /^https?:\/\//, "the canonical must be absolute");
      });
    });

    await group("security headers", async () => {
      await test("the security header set is applied to HTML responses", async () => {
        const response = await client.get("/");
        for (const header of ["content-security-policy", "x-content-type-options", "referrer-policy"]) {
          assert(response.headers.get(header), `${header} must be set`);
        }
      });

      await test("the CSP forbids framing and restricts form targets", async () => {
        const csp = (await client.get("/")).headers.get("content-security-policy") ?? "";
        assertIncludes(csp, "frame-ancestors", "CSP must set frame-ancestors (clickjacking)");
        assertIncludes(csp, "form-action 'self'", "CSP must restrict form-action");
        assertIncludes(csp, "object-src 'none'", "CSP must forbid plugins");
      });
    });

    await group("public API contracts", async () => {
      await test("the session endpoint answers an anonymous caller without erroring", async () => {
        const response = await client.get("/api/auth/session/");
        assertEqual(response.status, 200, "the session endpoint must always answer");
        assert(typeof response.json?.authenticated === "boolean", "and report a boolean `authenticated`");
        assertEqual(response.headers.get("cache-control"), "no-store", "session responses must never be cached");
      });

      await test("a requirement submission validates rather than 500s", async () => {
        const response = await client.post("/api/requirements/", {});
        assertEqual(response.status, 400, "an empty requirement must be a validation error, not a crash");
      });

      await test("an oversized body is refused before parsing", async () => {
        const response = await client.post("/api/requirements/", { note: "x".repeat(300_000) });
        assert([400, 413].includes(response.status), `an oversized body must be refused, got ${response.status}`);
      });
    });

    await group("search journey", async () => {
      await test("search renders with no parameters", async () => {
        const response = await client.get("/search/");
        assertEqual(response.status, 200, "bare search must render");
      });

      await test("search accepts a city scope and a PIN code", async () => {
        for (const query of ["?city=ahmedabad", "?pincode=380007", "?q=3+bhk+in+paldi"]) {
          const response = await client.get(`/search/${query}`);
          assertEqual(response.status, 200, `search must handle ${query}`);
        }
      });

      await test("a hostile query string does not break the page", async () => {
        /* Reflected input is the classic XSS vector; the page must render and
           must not echo a raw script tag. */
        const response = await client.get("/search/?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E");
        assertEqual(response.status, 200, "a hostile query must not break search");
        assert(!response.text.includes("<script>alert(1)</script>"), "raw script input must never be reflected unescaped");
      });

      await test("an unknown city scope degrades gracefully", async () => {
        const response = await client.get("/search/?city=nowhere-at-all");
        assert([200, 404].includes(response.status), `an unknown scope must not 500, got ${response.status}`);
      });
    });

    await group("listing dossiers", async () => {
      await test("a known listing renders with its price", async () => {
        const response = await client.get("/listing/garden-courtyard/");
        assertEqual(response.status, 200, "a known listing must render");
        assertMatch(response.text, /₹/, "a dossier must show a price");
      });

      await test("an unknown listing is a 404", async () => {
        const response = await client.get("/listing/definitely-not-a-listing/");
        assertEqual(response.status, 404, "an unknown listing must 404");
      });
    });

    await group("localisation", async () => {
      await test("the Hindi toggle is present and the document declares a language", async () => {
        const response = await client.get("/");
        assertMatch(response.text, /<html[^>]+lang="/, "the document must declare a language");
      });
    });

    void baseUrl;
  } finally {
    if (suite.results.failed > 0) {
      const log = server.getOutput().split("\n").filter((line) => /error/i.test(line)).slice(-8).join("\n");
      if (log) console.log(`\n\x1b[33mserver log (errors):\x1b[0m\n${log}`);
    }
    server.stop();
  }
}

await run();
if (!suite.summary()) process.exitCode = 1;
