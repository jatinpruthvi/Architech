import { consumeDemoBridgeToken, demoSessionCookieValue, findDemoAccountById } from "@/lib/auth/demo-accounts";
import { landingPathForSession, safeNextPath } from "@/lib/auth/redirects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* One-time demo sign-in bridge for cookie-hostile embeds (see demo-accounts.ts).
 *
 * The login screen opens this route in a TOP-LEVEL tab when the embedded
 * preview refuses to store the session cookie. Top-level context is first-party
 * on the preview host, so a plain cookie is stored unconditionally — no
 * SameSite/CHIPS gymnastics needed.
 *
 * Relative Location on purpose: behind the sandbox proxy the server sees
 * `localhost:3000` while the browser is on the public preview host. An absolute
 * redirect would send the user's browser at their own localhost; a relative one
 * resolves against the host the tab is already on. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const accountId = consumeDemoBridgeToken(token);

  if (!accountId) {
    /* Expired, spent, or bogus: back to sign-in with a flag the page can show.
       Non-committal on purpose — no enumeration value in distinguishing them. */
    return new Response(null, {
      status: 302,
      headers: { Location: "/login/?bridge=expired", "Cache-Control": "no-store" },
    });
  }

  const account = findDemoAccountById(accountId);
  if (!account) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/login/?bridge=expired", "Cache-Control": "no-store" },
    });
  }

  const next = safeNextPath(url.searchParams.get("next")) ?? landingPathForSession(account.session);
  return new Response(null, {
    status: 302,
    headers: {
      Location: next,
      "Cache-Control": "no-store",
      "Set-Cookie": demoSessionCookieValue(account, request),
    },
  });
}
