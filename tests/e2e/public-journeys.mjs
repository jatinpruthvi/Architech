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
  { path: "/agents/", label: "agent directory" },
  { path: "/agent/nivasa-partners/", label: "agent profile" },
  { path: "/contact-us/", label: "contact" },
  { path: "/about-us/", label: "about" },
  { path: "/privacy/", label: "privacy" },
  { path: "/terms/", label: "terms" },
  { path: "/login/", label: "login" },
];

async function run() {
  /* ARCHITECH_DEMO_START_SIGNED_OUT makes the no-cookie case anonymous, which
     is what a real deployment does and what the header assertions below need.
     It is set HERE rather than left to the caller's shell so the suite is
     self-contained: a test that only passes when you remember to export
     something is a test that will mislead someone later. */
  const server = await startServer({
    env: { ARCHITECH_AUTH_SOURCE: "demo", ARCHITECH_DEMO_START_SIGNED_OUT: "true" },
    label: "public server",
  });
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

    await group("header account controls", async () => {
      /* The header's account control is client-rendered from /api/auth/session/,
         so these assert on the SHIPPED COMPONENT SOURCE plus the session
         contract that drives it. That is a deliberate compromise: without a
         browser here (see tests/e2e/README.md) this is the strongest available
         guard against the two failures that have actually happened — a
         signed-out visitor with no visible way IN, and a signed-in visitor with
         no visible way OUT. */
      const accountMenu = await import("node:fs/promises").then((fs) =>
        fs.readFile(new URL("../../client/src/components/architech/AccountMenu.tsx", import.meta.url), "utf8"));

      await test("a signed-out visitor is offered a Sign in control", async () => {
        const anonymous = await client.fork().get("/api/auth/session/");
        assertEqual(anonymous.json.authenticated, false, "the preview must start signed out (ARCHITECH_DEMO_START_SIGNED_OUT)");
        assertIncludes(accountMenu, "Sign in", "AccountMenu must render a Sign in control for a null session");
      });

      await test("Sign out is reachable WITHOUT opening the dropdown", async () => {
        /* Sign out used to exist only inside the dropdown, so the header looked
           like it offered no way out until you thought to click your own name. */
        const beforeDropdown = accountMenu.split('role="menu"')[0];
        assertIncludes(beforeDropdown, "Sign out", "Sign out must appear in the header itself, not only inside the dropdown");
      });

      await test("signing in yields a session the header can render", async () => {
        const fresh = client.fork();
        const response = await fresh.post("/api/auth/login/", { email: "buyer@example.com", password: "demo-buyer-1234" });
        assertEqual(response.status, 200, "the demo buyer must sign in");
        const session = await fresh.get("/api/auth/session/");
        assertEqual(session.json.authenticated, true, "the header must see an authenticated session");
        assert(session.json.session.user.name, "and a name to label the account control with");
      });

      await test("signing out returns the header to the signed-out state", async () => {
        const fresh = client.fork();
        await fresh.post("/api/auth/login/", { email: "buyer@example.com", password: "demo-buyer-1234" });
        await fresh.post("/api/auth/logout/", {});
        const session = await fresh.get("/api/auth/session/");
        assertEqual(session.json.authenticated, false, "after sign-out the header must offer Sign in again");
      });
    });

    await group("sign-up is honest about what this deployment can do", async () => {
      /* A user reported "We could not sign you in" when CREATING an account.
         Two separate defects: the failure message named the wrong action, and
         demo mode offered a live-looking Create account tab that can only ever
         answer 503 — discovered after filling the form in. */
      const loginPage = await import("node:fs/promises").then((fs) =>
        fs.readFile(new URL("../../client/src/pages/Login.tsx", import.meta.url), "utf8"));

      await test("the register endpoint refuses clearly, with a reason", async () => {
        const response = await client.fork().post("/api/auth/register/", {
          name: "Preview User", email: "preview-user@example.com", password: "password123", listerType: "OWNER",
        });
        assertEqual(response.status, 503, "demo sign-up must refuse rather than fake an account");
        assertEqual(response.json.error, "REGISTRATION_UNAVAILABLE", "with a machine-readable reason");
        assert((response.json.message ?? "").length > 0, "and a human-readable one the form can display");
      });

      await test("a failed sign-up does not claim it could not SIGN YOU IN", async () => {
        assertIncludes(loginPage, "We could not create your account", "the register path needs its own failure message");
      });

      await test("the session contract exposes whether registration is possible", async () => {
        /* `authProvider` reads "better-auth" even in demo mode, so keying off it
           would silently offer a broken form. `source` is the honest signal. */
        const response = await client.fork().get("/api/auth/session/");
        assertEqual(response.json.source, "better-auth-contract-demo", "demo mode must identify itself in `source`");
      });

      await test("the Create account tab is disabled when sign-up cannot work", async () => {
        assertIncludes(loginPage, "disabled={!registrationAvailable}", "the tab must be disabled, not a dead end");
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
