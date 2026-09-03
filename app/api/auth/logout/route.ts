/* Sign-out endpoint.
 *
 * POST-only: a GET logout can be triggered by any <img> tag on any site, which
 * is a real (if low-severity) cross-site annoyance, so the same mutation-safety
 * guard as every other state change applies here too.
 */
import { NextResponse } from "next/server";
import { signOutCookies } from "@/lib/auth/credential-flow";
import { enforceMutationSafety } from "@/lib/auth/request-safety";
import { LOGIN_PATH } from "@/lib/auth/redirects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unsafe = enforceMutationSafety(request);
  if (unsafe) return unsafe;

  const response = NextResponse.json({ ok: true, redirectTo: LOGIN_PATH }, { headers: { "Cache-Control": "no-store" } });
  for (const cookie of await signOutCookies(request)) response.headers.append("set-cookie", cookie);
  return response;
}
