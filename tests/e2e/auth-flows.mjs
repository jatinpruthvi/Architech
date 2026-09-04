/* End-to-end authentication and listing-attribution flows.
 *
 * These run against a real production server over real HTTP with a real cookie
 * jar, in BOTH auth modes (`demo` and live `better-auth`), because the two take
 * genuinely different code paths and a regression in one is invisible to the
 * other.
 *
 * Each check states the regression it exists to catch. Several of them pin bugs
 * that were actually shipped and found by hand:
 *
 *   · sign-out cleared the cookie but never revoked the session server-side, so
 *     a copied token still authenticated;
 *   · the CSRF guard no-opped whenever NEXT_PUBLIC_SITE_URL was unset;
 *   · demo sign-out deleted the cookie, which fell back to the "no cookie ⇒
 *     broker admin" contract and signed the user straight back in;
 *   · client fetches to "/api/auth/login" hit a 308 because of trailingSlash.
 */
import { assert, assertEqual, assertIncludes, assertMatch, assertNotIncludes, createSuite, startServer } from "./harness.mjs";

const DEMO = {
  brokerAdmin: { email: "broker-admin@example.com", password: "demo-broker-1234" },
  buyer: { email: "buyer@example.com", password: "demo-buyer-1234" },
  moderator: { email: "moderator@example.com", password: "demo-moderator-1234" },
  brokerMember: { email: "broker-member@example.com", password: "demo-member-1234" },
};

/* `BETTER_AUTH_URL` is one of the three variables `validateBetterAuthEnvironment`
   treats as required, so omitting it makes the app correctly report itself
   not-configured. The harness fills it in per-server because the port is
   ephemeral (see `liveModeFlows`). */
const LIVE_ENV = {
  ARCHITECH_AUTH_SOURCE: "better-auth",
  BETTER_AUTH_SECRET: "e2e-secret-".padEnd(40, "x"),
  DATABASE_URL: "postgres://unused-by-memory-adapter",
};

const suite = createSuite();
const { group, test } = suite;

/* ================================================================== *
 * DEMO MODE
 * ================================================================== */

async function demoModeFlows() {
  const server = await startServer({ env: { ARCHITECH_AUTH_SOURCE: "demo" }, label: "demo-mode server" });
  const { client } = server;

  try {
    await group("demo mode · page delivery", async () => {
      await test("GET /login/ returns a real sign-in page", async () => {
        const page = await client.get("/login/");
        assertEqual(page.status, 200, "login page must render");
        assertIncludes(page.text, "login-email", "login page must contain the email field");
        assertIncludes(page.text, "login-password", "login page must contain the password field");
      });

      await test("login page is noindex (it has no discovery value)", async () => {
        const page = await client.get("/login/");
        assertMatch(page.text, /<meta name="robots" content="noindex/, "login page must be noindex");
      });

      await test("robots.txt keeps the login page out of the index", async () => {
        /* robots.txt is PRERENDERED, so `PUBLIC_INDEXING_ENABLED` is a build
           input, not a runtime one. Both shapes are correct and both must keep
           /login/ out: the blanket disallow when indexing is off, or the
           explicit path when it is on. Asserting only the latter made this test
           fail against a default build for the wrong reason. */
        const robots = await client.get("/robots.txt");
        const blanket = robots.text.includes("Disallow: /");
        const explicit = robots.text.includes("Disallow: /login/");
        assert(blanket || explicit, `robots.txt must exclude /login/, got:\n${robots.text}`);
      });

      await test("register mode renders the owner/broker declaration", async () => {
        const page = await client.get("/login/?mode=register");
        assertEqual(page.status, 200, "register mode must render");
        assertIncludes(page.text, "I am listing as", "sign-up must ask owner vs broker");
        assertIncludes(page.text, "Broker / agent", "sign-up must offer the broker option");
      });
    });

    await group("demo mode · sign in", async () => {
      await test("signs in and sets an HttpOnly, SameSite session cookie", async () => {
        const fresh = client.fork();
        const response = await fresh.post("/api/auth/login/", DEMO.brokerAdmin);
        assertEqual(response.status, 200, "valid credentials must sign in");
        assertEqual(response.json.ok, true, "response must report ok");
        const cookie = response.setCookie.join(" ");
        assertIncludes(cookie, "HttpOnly", "session cookie must be HttpOnly (not readable by page scripts)");
        assertIncludes(cookie, "SameSite=Lax", "session cookie must set SameSite");
        assertEqual(response.headers.get("cache-control"), "no-store", "auth responses must never be cached");
      });

      await test("the canonical login URL does not redirect (trailingSlash regression)", async () => {
        /* The client fetches "/api/auth/login/". If that ever 308s, the POST
           body is at risk and the browser flow breaks silently. */
        const fresh = client.fork();
        const response = await fresh.post("/api/auth/login/", DEMO.buyer);
        assert(response.status !== 308 && response.status !== 307, `login must not redirect, got ${response.status}`);
      });

      await test("each role lands somewhere it can actually open", async () => {
        /* Buyers and brokers share the one role-aware /dashboard/, which
           composes a different panel set per persona. Moderators still land on
           the moderation queue. Landing is asserted by actually opening the
           page with the session cookie: a redirectTo pointing at a 404 or a
           bounce back to /login/ would satisfy a string compare but not a
           user. */
        for (const [account, expected] of [
          [DEMO.brokerAdmin, "/dashboard/"],
          [DEMO.buyer, "/dashboard/"],
          [DEMO.moderator, "/admin/moderation/listings/"],
        ]) {
          const fresh = client.fork();
          const response = await fresh.post("/api/auth/login/", account);
          assertEqual(response.json.redirectTo, expected, `${account.email} must land on ${expected}`);

          const landing = await fresh.get(expected);
          assertEqual(landing.status, 200, `${account.email} must be able to OPEN ${expected}, got ${landing.status}`);
        }
      });

      await test("session survives on the next request via the cookie", async () => {
        const fresh = client.fork();
        await fresh.post("/api/auth/login/", DEMO.buyer);
        const session = await fresh.get("/api/auth/session/");
        assertEqual(session.json.authenticated, true, "session must persist across requests");
        assertEqual(session.json.session.user.email, DEMO.buyer.email, "session must be the account that signed in");
      });

      await test("a wrong password and an unknown email are indistinguishable", async () => {
        /* Account enumeration: differing status/message lets an attacker
           validate a credential-stuffing list against this endpoint. */
        const wrongPassword = await client.fork().post("/api/auth/login/", { email: DEMO.buyer.email, password: "definitely-not-it" });
        const unknownEmail = await client.fork().post("/api/auth/login/", { email: "nobody-here@example.com", password: "definitely-not-it" });
        assertEqual(wrongPassword.status, 401, "wrong password must be 401");
        assertEqual(unknownEmail.status, 401, "unknown email must be 401");
        assertEqual(wrongPassword.json.message, unknownEmail.json.message, "failure messages must be identical");
        assertEqual(wrongPassword.json.error, unknownEmail.json.error, "failure codes must be identical");
      });

      await test("a failed sign-in mints no cookie", async () => {
        const response = await client.fork().post("/api/auth/login/", { email: DEMO.buyer.email, password: "wrong-password-here" });
        assertEqual(response.setCookie.length, 0, "a failed sign-in must not set any cookie");
      });

      await test("malformed input is rejected with per-field issues", async () => {
        const response = await client.fork().post("/api/auth/login/", { email: "not-an-email", password: "x" });
        assertEqual(response.status, 400, "malformed credentials must be 400");
        const fields = response.json.issues.map((issue) => issue.field).sort();
        assertEqual(fields.join(","), "email,password", "both bad fields must be reported at once");
      });

      await test("a non-JSON body fails cleanly", async () => {
        const response = await client.fork().post("/api/auth/login/", "{not json", { headers: { "content-type": "application/json" } });
        assertEqual(response.status, 400, "a malformed body must be 400");
        assertEqual(response.json.error, "INVALID_BODY", "and must name the problem");
      });
    });

    await group("demo mode · sign out", async () => {
      await test("sign-out actually signs out (does not fall back to the implicit session)", async () => {
        /* The demo contract is "no cookie ⇒ broker admin". If sign-out merely
           DELETED the cookie, the next request would be signed straight back
           in as the broker. This is that regression. */
        const fresh = client.fork();
        await fresh.post("/api/auth/login/", DEMO.buyer);
        await fresh.post("/api/auth/logout/", {});
        const after = await fresh.get("/api/auth/session/");
        assertEqual(after.json.authenticated, false, "sign-out must leave nobody signed in");
        assertEqual(after.json.session, null, "and must report a null session");
      });

      await test("the historical no-cookie demo contract is unchanged", async () => {
        /* Broker and moderation fixtures depend on this. Breaking it would
           break them in a way that looks unrelated. */
        const anonymous = await client.fork().get("/api/auth/session/");
        assertEqual(anonymous.json.authenticated, true, "a cookieless demo request keeps the implicit session");
        assertEqual(anonymous.json.session.user.role, "BROKER_ADMIN", "and it is the broker admin");
      });
    });

    await group("demo mode · CSRF and abuse limits", async () => {
      await test("a cross-site sign-in attempt is rejected", async () => {
        const response = await client.fork().post("/api/auth/login/", DEMO.buyer, { origin: "https://evil.example.com" });
        assertEqual(response.status, 403, "cross-origin sign-in must be rejected");
      });

      await test("cross-site sign-out is rejected too", async () => {
        const fresh = client.fork();
        await fresh.post("/api/auth/login/", DEMO.buyer);
        const response = await fresh.post("/api/auth/logout/", {}, { origin: "https://evil.example.com" });
        assertEqual(response.status, 403, "cross-origin sign-out must be rejected");
        const still = await fresh.get("/api/auth/session/");
        assertEqual(still.json.authenticated, true, "and must not have signed the user out");
      });

      await test("a distributed burst against ONE account is throttled", async () => {
        /* Every guess comes from a DIFFERENT address, so only the per-email
           budget can catch this. That is the whole reason the limiter is keyed
           on both: an address-only limiter sees nothing here. */
        const email = DEMO.moderator.email;
        let throttled = false;
        for (let attempt = 0; attempt < 12; attempt += 1) {
          const attacker = client.fork({ clientIp: `198.51.100.${attempt + 1}` });
          const response = await attacker.post("/api/auth/login/", { email, password: `wrong-password-${attempt}` });
          if (response.status === 429) {
            throttled = true;
            assert(response.headers.get("retry-after"), "a 429 must tell the client when to retry");
            break;
          }
        }
        assert(throttled, "a distributed brute force on one account must be throttled");
      });

      await test("one address spraying MANY accounts is throttled", async () => {
        /* The mirror case: one host, many victims. Only the per-address budget
           sees this one. */
        const sprayer = client.fork({ clientIp: "192.0.2.77" });
        let throttled = false;
        for (let attempt = 0; attempt < 26; attempt += 1) {
          const response = await sprayer.post("/api/auth/login/", { email: `victim${attempt}@example.com`, password: "some-password-guess" });
          if (response.status === 429) { throttled = true; break; }
        }
        assert(throttled, "credential spraying from one address must be throttled");
      });

      await test("throttling one attacker does not lock out everyone else", async () => {
        /* A limiter that shared a bucket across clients would turn one
           attacker into a denial of service for real users. */
        const attacker = client.fork({ clientIp: "192.0.2.88" });
        for (let attempt = 0; attempt < 26; attempt += 1) {
          await attacker.post("/api/auth/login/", { email: `spray${attempt}@example.com`, password: "guessing-away" });
        }
        const bystander = client.fork({ clientIp: "192.0.2.200" });
        const response = await bystander.post("/api/auth/login/", DEMO.brokerMember);
        assertEqual(response.status, 200, "an unrelated user must still be able to sign in");
      });
    });

    await group("demo mode · registration honesty", async () => {
      await test("registration refuses rather than faking an account that would vanish", async () => {
        const response = await client.fork().post("/api/auth/register/", {
          name: "New Person", email: "new-person@example.com", password: "password123", listerType: "OWNER",
        });
        assertEqual(response.status, 503, "demo mode has no user store, so sign-up must refuse");
        assertEqual(response.json.error, "REGISTRATION_UNAVAILABLE", "and must say why");
      });
    });

    await group("demo mode · protected surfaces", async () => {
      await test("broker APIs reject a signed-out caller", async () => {
        const fresh = client.fork();
        await fresh.post("/api/auth/login/", DEMO.buyer);
        await fresh.post("/api/auth/logout/", {});
        const response = await fresh.post("/api/broker/listings/", { title: "attempt" });
        assert([401, 403, 503].includes(response.status), `signed-out broker POST must be denied, got ${response.status}`);
      });

      await test("demo credentials cannot mutate anything in a PRODUCTION build", async () => {
        /* A deliberate and important property: `authorizeRequest` refuses every
           `better-auth-contract-demo` session when NODE_ENV=production. It is
           what makes the unsigned demo cookie safe to ship. These E2E runs use
           `next start`, so this is the real production behaviour — which also
           means listing-draft flows cannot be exercised here in demo mode, and
           are covered at the unit level in lib/broker/workflow.test.ts instead. */
        const fresh = client.fork();
        await fresh.post("/api/auth/login/", DEMO.brokerAdmin);
        const response = await fresh.post("/api/broker/listings/", draftPayload());
        assertEqual(response.status, 503, "a demo session must not mutate in production");
        assertEqual(response.json.error, "DEMO_AUTH_DISABLED", "and must say exactly why");
      });

      await test("a buyer session is refused by broker APIs", async () => {
        const fresh = client.fork();
        await fresh.post("/api/auth/login/", DEMO.buyer);
        const response = await fresh.post("/api/broker/listings/", { title: "attempt" });
        assert([403, 503].includes(response.status), `a buyer must never create a draft, got ${response.status}`);
      });

      await test("a buyer session is refused by the moderation queue", async () => {
        const fresh = client.fork();
        await fresh.post("/api/auth/login/", DEMO.buyer);
        const response = await fresh.get("/api/admin/moderation/listings/");
        assert([403, 503].includes(response.status), `a buyer must never read moderation, got ${response.status}`);
      });

      await test("protected pages still render a shell (the guard is client-side by design)", async () => {
        /* The page shell is not the security boundary — the APIs are. This
           asserts the documented split rather than a false expectation. */
        const page = await client.fork().get("/broker/dashboard/");
        assertEqual(page.status, 200, "the dashboard shell renders; its DATA is what is guarded");
      });
    });

    await group("demo mode · listing attribution declaration", async () => {
      /* Draft creation cannot run here (demo auth is disabled for mutations in
         a production build, asserted above), so these check the part that IS
         observable end to end: the declaration the listing form reads to
         pre-select its checkbox. The draft-level default/override behaviour is
         covered in client/src/lib/broker/workflow.test.ts. */
      await test("the broker-admin account declares BROKER", async () => {
        const fresh = client.fork();
        const response = await fresh.post("/api/auth/login/", DEMO.brokerAdmin);
        assertEqual(response.status, 200, `sign-in must succeed: ${response.text.slice(0, 200)}`);
        assertEqual(response.json.session.user.listerType, "BROKER", "broker admin must declare BROKER so the form pre-ticks it");
      });

      await test("the buyer account declares OWNER", async () => {
        const fresh = client.fork();
        const response = await fresh.post("/api/auth/login/", DEMO.buyer);
        assertEqual(response.json.session.user.listerType, "OWNER", "a plain account must default to the weaker claim");
      });

      await test("the declaration is readable from the session endpoint the form uses", async () => {
        const fresh = client.fork();
        await fresh.post("/api/auth/login/", DEMO.brokerMember);
        const session = await fresh.get("/api/auth/session/");
        assertEqual(session.json.session.user.listerType, "BROKER", "the listing form reads this to pre-select attribution");
      });
    });

  } finally {
    server.stop();
  }
}

/** A valid listing draft body; override any field per test. */
function draftPayload(overrides = {}) {
  return {
    title: "A verified garden apartment in Paldi",
    citySlug: "ahmedabad",
    localitySlug: "paldi",
    postalCode: "380007",
    priceInr: 18500000,
    bhk: 3,
    areaSqft: 1482,
    propertyType: "APARTMENT",
    availability: "READY_TO_MOVE",
    description: "A verified apartment draft with enough source context for moderation review.",
    reraNumber: "GJ/RERA/AHM/2026/04821-DEMO",
    mediaRightsConfirmed: true,
    listerType: "BROKER",
    details: { bathrooms: 2, parkingSpaces: 1, furnishing: "UNFURNISHED", facing: "EAST", amenities: [] },
    ...overrides,
  };
}

/* ================================================================== *
 * LIVE BETTER AUTH MODE
 * ================================================================== */

async function liveModeFlows() {
  const server = await startServer({ env: LIVE_ENV, label: "live-auth server", needsAuthUrl: true, singleWorker: true });
  const { client, baseUrl } = server;

  try {
    await group("live mode · registration", async () => {
      await test("creates an account and immediately signs it in", async () => {
        const fresh = client.fork();
        const response = await fresh.post("/api/auth/register/", {
          name: "Meena Owner", email: "meena@example.com", password: "password123", listerType: "OWNER",
        });
        assertEqual(response.status, 200, `sign-up must succeed: ${response.text.slice(0, 300)}`);
        assertEqual(response.json.session.user.email, "meena@example.com", "the new account must be signed in");
        assertIncludes(response.setCookie.join(" "), "better-auth.session_token", "sign-up must mint a live session cookie");

        const session = await fresh.get("/api/auth/session/");
        assertEqual(session.json.authenticated, true, "the minted cookie must resolve on the next request");
      });

      await test("a self-declared broker gets the DECLARATION and none of the AUTHORITY", async () => {
        /* The central security property of this feature. The request asks to
           be a broker twice over — a declaration and an explicit role — and
           must receive only the harmless one. */
        const fresh = client.fork();
        const response = await fresh.post("/api/auth/register/", {
          name: "Ravi Broker", email: "ravi@example.com", password: "password123",
          listerType: "BROKER", role: "BROKER_ADMIN",
        });
        assertEqual(response.status, 200, "sign-up must succeed");
        const user = response.json.session.user;
        assertEqual(user.listerType, "BROKER", "the declaration is honoured (it defaults the listing form)");
        assertEqual(user.role, "BUYER", "the ROLE must stay BUYER — a self-assigned role is a privilege escalation");
        assertEqual(response.json.session.organization ?? null, null, "no organization may be attached");
        assertEqual(response.json.session.permissions.includes("lead.inbox.read"), false, "no broker permission may leak in");
        assertEqual(response.json.session.permissions.includes("listing.draft.create"), false, "including listing creation");
        assertEqual(response.json.redirectTo, "/dashboard/", "and they land on the buyer dashboard, not a broker surface");
      });

      await test("a declared broker still cannot touch broker APIs", async () => {
        const fresh = client.fork();
        await fresh.post("/api/auth/register/", {
          name: "Sunil Broker", email: "sunil@example.com", password: "password123", listerType: "BROKER",
        });
        const response = await fresh.post("/api/broker/listings/", draftPayload());
        assertEqual(response.status, 403, "the declaration must not open the broker workspace");
      });

      await test("sign-up requires an explicit owner/broker answer", async () => {
        const response = await client.fork().post("/api/auth/register/", {
          name: "No Declaration", email: "nodecl@example.com", password: "password123",
        });
        assertEqual(response.status, 400, "an absent declaration must be refused, not defaulted");
        assert(response.json.issues.some((issue) => issue.field === "listerType"), "and must name the field");
      });

      await test("sign-up rejects an unreviewed declaration", async () => {
        const response = await client.fork().post("/api/auth/register/", {
          name: "Bad Declaration", email: "baddecl@example.com", password: "password123", listerType: "ADMIN",
        });
        assertEqual(response.status, 400, "junk must not be coerced into a valid declaration");
      });

      await test("a weak password is refused before any account exists", async () => {
        const response = await client.fork().post("/api/auth/register/", {
          name: "Weak Pass", email: "weak@example.com", password: "short", listerType: "OWNER",
        });
        assertEqual(response.status, 400, "a short password must be refused");
      });

      await test("a duplicate email is reported as such", async () => {
        const payload = { name: "Dupe", email: "dupe@example.com", password: "password123", listerType: "OWNER" };
        const first = await client.fork().post("/api/auth/register/", payload);
        assertEqual(first.status, 200, "the first sign-up succeeds");
        const second = await client.fork().post("/api/auth/register/", payload);
        assertEqual(second.status, 409, "the second must conflict");
        assertEqual(second.json.error, "ACCOUNT_EXISTS", "and say why");
      });
    });

    await group("live mode · sign in", async () => {
      await test("signs in with the credentials the account was created with", async () => {
        const fresh = client.fork();
        await fresh.post("/api/auth/register/", { name: "Round Trip", email: "roundtrip@example.com", password: "password123", listerType: "OWNER" });
        const jarless = client.fork();
        const response = await jarless.post("/api/auth/login/", { email: "roundtrip@example.com", password: "password123" });
        assertEqual(response.status, 200, `sign-in must succeed: ${response.text.slice(0, 300)}`);
        assertEqual(response.json.session.user.email, "roundtrip@example.com", "and be the right account");
      });

      await test("the declaration survives a fresh sign-in", async () => {
        const setup = client.fork();
        await setup.post("/api/auth/register/", { name: "Persisted Decl", email: "persist@example.com", password: "password123", listerType: "BROKER" });
        const fresh = client.fork();
        const response = await fresh.post("/api/auth/login/", { email: "persist@example.com", password: "password123" });
        assertEqual(response.json.session.user.listerType, "BROKER", "the stored declaration must come back on sign-in");
      });

      await test("a wrong password is rejected and mints nothing", async () => {
        const setup = client.fork();
        await setup.post("/api/auth/register/", { name: "Wrong Pass", email: "wrongpass@example.com", password: "password123", listerType: "OWNER" });
        const response = await client.fork().post("/api/auth/login/", { email: "wrongpass@example.com", password: "not-the-password" });
        assertEqual(response.status, 401, "a wrong password must be 401");
        assertEqual(response.setCookie.length, 0, "and must mint no cookie");
      });

      await test("an off-site ?next= is ignored in favour of the role landing", async () => {
        const setup = client.fork();
        await setup.post("/api/auth/register/", { name: "Redirect Probe", email: "redirect@example.com", password: "password123", listerType: "OWNER" });
        const hostile = await client.fork().post("/api/auth/login/", {
          email: "redirect@example.com", password: "password123", next: "https://evil.example.com/",
        });
        assertEqual(hostile.json.redirectTo, "/dashboard/", "an off-site destination must be discarded (open redirect)");

        const safe = await client.fork().post("/api/auth/login/", {
          email: "redirect@example.com", password: "password123", next: "/search/?city=pune",
        });
        assertEqual(safe.json.redirectTo, "/search/?city=pune", "a same-site destination must be honoured");
      });
    });

    await group("live mode · sign out revokes the session", async () => {
      await test("a captured token STOPS working after sign-out", async () => {
        /* The shipped bug this pins: sign-out returned cookie-clearing headers
           but never revoked the session, so anyone holding a copy of the token
           (a second device, or an attacker who captured it) stayed signed in.
           Asserting on the Set-Cookie headers alone did not catch it — only
           replaying the token does. */
        const fresh = client.fork();
        await fresh.post("/api/auth/register/", { name: "Revoke Me", email: "revoke@example.com", password: "password123", listerType: "OWNER" });

        const capturedToken = fresh.jar.get("better-auth.session_token");
        assert(capturedToken, "a live session token must exist to capture");

        const before = await fresh.get("/api/auth/session/");
        assertEqual(before.json.authenticated, true, "the session works before sign-out");

        await fresh.post("/api/auth/logout/", {});

        const attacker = client.fork();
        attacker.jar.applySetCookie([`better-auth.session_token=${capturedToken}`]);
        const replay = await attacker.get("/api/auth/session/");
        assertEqual(replay.json.authenticated, false, "the captured token must be DEAD after sign-out");
        assertEqual(replay.json.session, null, "and resolve to no session");
      });

      await test("the signing-out browser is signed out too", async () => {
        const fresh = client.fork();
        await fresh.post("/api/auth/register/", { name: "Sign Out", email: "signout@example.com", password: "password123", listerType: "OWNER" });
        await fresh.post("/api/auth/logout/", {});
        const after = await fresh.get("/api/auth/session/");
        assertEqual(after.json.authenticated, false, "the browser that signed out must be signed out");
      });

      await test("one browser signing out does not sign out an unrelated account", async () => {
        const alice = client.fork();
        await alice.post("/api/auth/register/", { name: "Alice", email: "alice@example.com", password: "password123", listerType: "OWNER" });
        const bob = client.fork();
        await bob.post("/api/auth/register/", { name: "Bob", email: "bob@example.com", password: "password123", listerType: "OWNER" });

        await alice.post("/api/auth/logout/", {});

        const bobSession = await bob.get("/api/auth/session/");
        assertEqual(bobSession.json.authenticated, true, "Bob must stay signed in when Alice signs out");
        assertEqual(bobSession.json.session.user.email, "bob@example.com", "and still be Bob");
      });
    });

    await group("live mode · session isolation", async () => {
      await test("two accounts never see each other's session", async () => {
        const one = client.fork();
        await one.post("/api/auth/register/", { name: "Iso One", email: "iso1@example.com", password: "password123", listerType: "OWNER" });
        const two = client.fork();
        await two.post("/api/auth/register/", { name: "Iso Two", email: "iso2@example.com", password: "password123", listerType: "BROKER" });

        const sessionOne = await one.get("/api/auth/session/");
        const sessionTwo = await two.get("/api/auth/session/");
        assertEqual(sessionOne.json.session.user.email, "iso1@example.com", "profile one sees itself");
        assertEqual(sessionTwo.json.session.user.email, "iso2@example.com", "profile two sees itself");
        assertEqual(sessionOne.json.session.user.listerType, "OWNER", "and keeps its own declaration");
        assertEqual(sessionTwo.json.session.user.listerType, "BROKER", "and so does the other");
      });

      await test("a garbage token is not a session", async () => {
        const forged = client.fork();
        forged.jar.applySetCookie(["better-auth.session_token=totally-made-up-token"]);
        const response = await forged.get("/api/auth/session/");
        assertEqual(response.json.authenticated, false, "a forged token must not authenticate");
      });

      await test("no session at all is not a session either", async () => {
        /* In live mode there is no implicit demo fallback: an anonymous
           request must be anonymous. */
        const response = await client.fork().get("/api/auth/session/");
        assertEqual(response.json.authenticated, false, "live mode must not hand out an implicit session");
      });

      await test("the live session cookie is HttpOnly", async () => {
        const fresh = client.fork();
        const response = await fresh.post("/api/auth/register/", { name: "Cookie Flags", email: "flags@example.com", password: "password123", listerType: "OWNER" });
        const sessionCookie = response.setCookie.find((cookie) => cookie.startsWith("better-auth.session_token="));
        assert(sessionCookie, "a session cookie must be set");
        assertIncludes(sessionCookie, "HttpOnly", "the live session cookie must be HttpOnly");
      });
    });

    await group("live mode · CSRF", async () => {
      await test("cross-site sign-up is rejected", async () => {
        const response = await client.fork().post("/api/auth/register/", {
          name: "CSRF Probe", email: "csrf@example.com", password: "password123", listerType: "OWNER",
        }, { origin: "https://evil.example.com" });
        assertEqual(response.status, 403, "cross-origin sign-up must be rejected");
      });

      await test("the Origin guard works even though the site URL matches the host", async () => {
        /* Regression: the whole Origin arm was once gated on
           NEXT_PUBLIC_SITE_URL being set, so it silently no-opped. */
        const response = await client.fork().post("/api/auth/login/", { email: "meena@example.com", password: "password123" }, { origin: "http://attacker.invalid" });
        assertEqual(response.status, 403, "a foreign Origin must be rejected");
        assertNotIncludes(String(baseUrl), "attacker.invalid", "sanity: the probe origin is genuinely foreign");
      });
    });

    await group("live mode · provider throttling is reported honestly", async () => {
      await test("a provider rate-limit surfaces as 429, never as a wrong password", async () => {
        /* Better Auth rate-limits BEFORE it checks the credential. Reporting
           that as 401 told a user with the CORRECT password that it was wrong,
           and hid an operational signal. Hammer one address with VALID
           credentials so a 401 can only mean the mapping is wrong. */
        const setup = client.fork();
        await setup.post("/api/auth/register/", { name: "Throttle", email: "throttle@example.com", password: "password123", listerType: "OWNER" });

        const hammer = client.fork({ clientIp: "198.18.0.9" });
        let sawThrottle = false;
        for (let attempt = 0; attempt < 15; attempt += 1) {
          const response = await hammer.post("/api/auth/login/", { email: "throttle@example.com", password: "password123" });
          if (response.status === 429) {
            sawThrottle = true;
            assertEqual(response.json.error, "TOO_MANY_ATTEMPTS", "a throttle must be reported as a throttle");
            break;
          }
          assertEqual(response.status, 200, `correct credentials must not 401 while being throttled: ${response.text.slice(0, 160)}`);
        }
        assert(sawThrottle, "repeated sign-ins must eventually be throttled");
      });
    });

    await group("live mode · demo credentials are inert", async () => {
      await test("demo passwords do not work against a live deployment", async () => {
        /* The demo roster is published in the repo. If those credentials ever
           authenticated in live mode, every deployment would ship with known
           logins. */
        for (const account of Object.values(DEMO)) {
          const response = await client.fork().post("/api/auth/login/", account);
          assertEqual(response.status, 401, `${account.email} must NOT sign in against live auth`);
        }
      });
    });
  } finally {
    if (suite.results.failed > 0) {
      const log = server.getOutput().split("\n").filter((line) => /error|warn/i.test(line)).slice(-8).join("\n");
      if (log) console.log(`\n\x1b[33mserver log (errors/warnings):\x1b[0m\n${log}`);
    }
    server.stop();
  }
}

/* ================================================================== *
 * Runner
 * ================================================================== */

const only = process.argv[2];

try {
  if (!only || only === "demo") await demoModeFlows();
  if (!only || only === "live") await liveModeFlows();
} catch (error) {
  console.error(`\n\x1b[31mHarness error:\x1b[0m ${error.message}`);
  process.exitCode = 1;
}

if (!suite.summary()) process.exitCode = 1;
