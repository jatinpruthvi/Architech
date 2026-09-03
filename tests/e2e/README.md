# End-to-end suites

Real HTTP against a real production server. Boots `next start` on an ephemeral
port, drives it with a cookie jar, asserts on status codes, headers, cookies and
served HTML.

```bash
pnpm test:e2e        # build, then run every suite
pnpm test:e2e:only   # run against the existing .next build (fast iteration)

node tests/e2e/auth-flows.mjs demo   # one mode of one suite
node tests/e2e/auth-flows.mjs live
```

## What is here

| Suite | Covers |
| --- | --- |
| `public-journeys.mjs` | Public routes render; SSR is real; trailing-slash grammar; true 404s; robots/sitemap/JSON-LD/canonicals; security headers; search and listing journeys; public API contracts |
| `auth-flows.mjs` | Sign in, sign up, sign out, session persistence, role landing, owner/broker declaration, CSRF, throttling, privilege-escalation guards — in **both** `demo` and live `better-auth` modes |
| `harness.mjs` | Server lifecycle, cookie jar, HTTP client, assertions, runner |

## Why HTTP and not a browser

The regressions this codebase actually suffers are server-side: cookies,
redirects, status codes, session revocation, CSRF, role gates. Those are HTTP
facts, and asserting them over HTTP is the most direct test available. Running
against `next start` also catches the class of bug that only appears in a
production build — routes that 500 when built, prerender failures,
trailing-slash redirects.

Browser-level behaviour (rendering, keyboard, ARIA) is covered separately by
`pnpm test:a11y` in `tests/a11y`, which uses Playwright.

The limitation is honest: these suites cannot assert on client state after
hydration. Where a flow depends on that, the test asserts the server contract
the client consumes and says so in a comment.

## CI

Not yet wired into `.github/workflows/ci.yml` — the automation token in use
cannot modify workflow files. **Add this step manually**, right after the
"No-JavaScript SEO smoke tests" step, so it reuses the build already produced:

```yaml
      - name: End-to-end flows
        run: pnpm test:e2e:only
```

Until then, run `pnpm test:e2e` locally before pushing auth or routing changes.

## Writing a new check

Each test states the regression it prevents. A test whose failure message does
not tell you what broke, and why it matters, is worth very little at 2am.

```js
await test("a captured token STOPS working after sign-out", async () => {
  // …why this exists: sign-out once cleared the cookie without revoking the
  // session, so a copied token still authenticated.
});
```

Two harness details worth knowing:

- **`client.fork()`** gives you a fresh browser profile *and* a distinct client
  IP. Independent scenarios must use it, otherwise they share the sign-in
  throttle's budget and the suite throttles itself.
- **`client.fork({ clientIp })`** pins the address. Use it when the throttle is
  the thing under test.

## Verifying the suite actually works

A test that cannot fail is worse than no test. Both of these were confirmed by
deliberately breaking the code and watching the right check go red:

- removing the `Origin` header from the internal sign-out call → *"a captured
  token STOPS working after sign-out"* fails;
- honouring a request-supplied `role` at sign-up → *"a self-declared broker gets
  the DECLARATION and none of the AUTHORITY"* fails.

Do this whenever you add a security-relevant check.

## Bugs these suites found

Written after the features they cover, and they immediately surfaced four real
defects in a production build that dev-mode testing had missed:

1. **Sign-out never revoked the session.** Better Auth rejected the internal
   call with `MISSING_OR_NULL_ORIGIN`; the code only checked for cookies, so it
   cleared the browser cookie and reported success while the token stayed live.
   A captured token kept working indefinitely.
2. **Sign-up was broken on any host that was not `BETTER_AUTH_URL`** —
   `INVALID_ORIGIN`, surfaced to users as "We could not create that account".
   This would have broken every preview deployment.
3. **A rate-limited sign-in was reported as a wrong password.** Better Auth
   throttles before checking credentials; the 429 was folded into the generic
   401, telling users with the correct password that it was wrong.
4. **Every user shared one rate-limit bucket.** The internal call dropped the
   client's IP headers, so Better Auth fell back to a single shared bucket and
   one noisy client could throttle the whole deployment.

## Known limitation, deliberately pinned

Live auth uses Better Auth's **in-memory adapter**, so accounts and sessions
live in process memory. This is not merely "lost on restart": if the runtime
ever serves from more than one worker, each holds a different set of users and
the same credentials will succeed or fail depending on which worker answers.

Live mode is therefore **single-process only** until the Prisma adapter lands
(`docs/auth/live-better-auth-handoff.md`). The live suite pins its server to one
worker so the flows are testable; the limitation itself is documented in
`client/src/lib/auth/server-auth.ts`.
