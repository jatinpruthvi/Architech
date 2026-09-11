import { toNextJsHandler } from "better-auth/next-js";
import { getAuthServer } from "@/lib/auth/server-auth";

/* Better Auth endpoint mount (I-1/M-2).
 *
 * Without these routes a deployment can resolve a session but never create
 * one: sign-up/sign-in/session live under `/api/auth/*` (the standard Better
 * Auth client base path). The handler routes through the same server-auth
 * singleton the session contract uses, so a cookie minted here resolves in
 * `getSessionContractForRequest` on the next request.
 *
 * Routes are mounted in every mode: in `demo` mode broker APIs still use the
 * demo session, but sign-ups validate that the live wiring works before the
 * source switch (docs/auth/live-better-auth-handoff.md).
 *
 * This app deploys with `trailingSlash: true`, so Next hands the handler
 * `/api/auth/sign-up/email/`. Better Auth matches endpoint paths exactly, so
 * the trailing slash is stripped before dispatch — otherwise every auth route
 * would 404 behind the global trailing-slash rewrite. */

export const runtime = "nodejs";

const auth = getAuthServer();
const handler = toNextJsHandler({ handler: (request: Request) => auth.handler(request) });

function withoutTrailingSlash(request: Request): Request {
  const url = new URL(request.url);
  if (!url.pathname.endsWith("/")) return request;
  url.pathname = url.pathname.replace(/\/+$/, "");
  return new Request(url, request);
}

export const GET = (request: Request) => handler.GET(withoutTrailingSlash(request));
export const POST = (request: Request) => handler.POST(withoutTrailingSlash(request));
export const PUT = (request: Request) => handler.PUT(withoutTrailingSlash(request));
export const PATCH = (request: Request) => handler.PATCH(withoutTrailingSlash(request));
export const DELETE = (request: Request) => handler.DELETE(withoutTrailingSlash(request));
