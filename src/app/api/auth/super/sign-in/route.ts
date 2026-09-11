import { NextResponse } from "next/server";
import { clearLoginAttempts, registerLoginAttempt } from "@/lib/auth/login-throttle";
import { SUPER_ADMIN_COOKIE, SUPER_ADMIN_TTL_SECONDS, mintSuperAdminCookieValue, verifySuperAdminPassword } from "@/lib/auth/super-admin";

export const runtime = "nodejs";

/* The owner's master login (spec §6.2). Password-only, owner-only:
   the credential exists solely in the deployment environment
   (ARCHITECH_SUPER_ADMIN_PASSWORD_HASH), never in the user store, and the
   demo roster can never mint this session. */
export async function POST(request: Request) {
  const secret = process.env.BETTER_AUTH_SECRET;
  const storedHash = process.env.ARCHITECH_SUPER_ADMIN_PASSWORD_HASH;
  if (!secret || !storedHash) {
    return NextResponse.json({ ok: false, error: "SUPER_ADMIN_NOT_CONFIGURED", errors: ["Super-admin sign-in is not configured for this deployment."] }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  let password: string;
  try {
    password = String(((await request.json()) as { password?: unknown }).password ?? "");
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_CREDENTIALS", errors: ["Enter the super-admin password."] }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
  if (!verifySuperAdminPassword(password, storedHash)) {
    const decision = registerLoginAttempt({ ip, email: "super-admin" });
    if (!decision.allowed) {
      return NextResponse.json({ ok: false, error: "THROTTLED", errors: ["Too many attempts. Try again later."], retryAfterSeconds: decision.retryAfterSeconds }, { status: 429, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ ok: false, error: "INVALID_CREDENTIALS", errors: ["Enter the super-admin password."] }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  clearLoginAttempts("super-admin"); // same reset-on-success as credential-flow.ts
  const expiresAt = new Date(Date.now() + SUPER_ADMIN_TTL_SECONDS * 1000);
  const secure = new URL(request.url).protocol === "https:";
  const cookie = `${SUPER_ADMIN_COOKIE}=${encodeURIComponent(mintSuperAdminCookieValue(expiresAt, secret))}; Path=/; Max-Age=${SUPER_ADMIN_TTL_SECONDS}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store", "Set-Cookie": cookie } });
}
