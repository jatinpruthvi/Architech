import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getSessionContractForRequest } from "@/lib/auth/live";
import type { AuthSession } from "@/lib/auth/roles";

/**
 * Read the broker session from within a React Server Component.
 *
 * Route handlers should keep using `authorizeRequest` from @/lib/auth/guards,
 * which takes a Request. For RSCs there is no inbound Request, so we build a
 * synthetic one from the request URL and cookie header exposed by Next.js.
 *
 * Per-request memo (PERF-R5-003): the `(techno)` layout resolves the session
 * for its navigation chrome, and every page below it resolves it again for its
 * own data — so one navigation in live mode paid for two Better Auth
 * resolutions (session token → claims → organization), and more wherever a
 * nested server component asks too (`owners/OwnersList`). `cache` is scoped to
 * a single render, so every caller in one request shares one result. Same
 * class as the listing page's P0.5 fix. The reader takes no arguments — the
 * cookie jar it reads is already request-scoped — so the request itself is the
 * only cache key, and no cross-request sharing is possible.
 */
export const getTechnoSession = cache(async (): Promise<AuthSession | null> => {
  const cookieStore = await cookies();
  const cookie = cookieStore.toString();
  const url =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
  const request = new Request(url + "/broker", {
    headers: { cookie },
  });
  const contract = await getSessionContractForRequest(request);
  return contract.session;
});

export async function requireTechnoSession(): Promise<AuthSession> {
  const session = await getTechnoSession();
  if (!session) {
    throw new Error("TECHNO_NO_SESSION: route must be wrapped in RequireSession");
  }
  if (!session.organization?.id) {
    throw new Error("TECHNO_NO_ORG: broker organization is required");
  }
  return session;
}
