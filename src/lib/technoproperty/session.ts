import "server-only";
import { cookies } from "next/headers";
import { getSessionContractForRequest } from "@/lib/auth/live";
import type { AuthSession } from "@/lib/auth/roles";

/**
 * Read the broker session from within a React Server Component.
 *
 * Route handlers should keep using `authorizeRequest` from @/lib/auth/guards,
 * which takes a Request. For RSCs there is no inbound Request, so we build a
 * synthetic one from the request URL and cookie header exposed by Next.js.
 */
export async function getTechnoSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.toString();
  const url =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
  const request = new Request(url + "/broker", {
    headers: { cookie },
  });
  const contract = await getSessionContractForRequest(request);
  return contract.session;
}

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
