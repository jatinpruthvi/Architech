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
 * source switch (docs/auth/live-better-auth-handoff.md). */

export const runtime = "nodejs";

export const { GET, POST } = toNextJsHandler(getAuthServer().handler);
