import "server-only";
import { NextResponse } from "next/server";
import { getSessionContractForRequest } from "./live";
import { enforceMutationSafety } from "./request-safety";
import { requirePermission, type AuthSession } from "./roles";

export type RouteAccess = { session: AuthSession } | { response: NextResponse };

type AccessOptions = {
  permission: string;
  organizationId?: string;
};

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: code, errors: [message] }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function authorizeRequest(request: Request, options: AccessOptions): Promise<RouteAccess> {
  const safetyResponse = enforceMutationSafety(request);
  if (safetyResponse) return { response: safetyResponse };
  const contract = await getSessionContractForRequest(request);

  if (contract.source === "better-auth-not-configured") {
    return { response: jsonError(503, "AUTH_NOT_CONFIGURED", "Authentication is not configured for this environment.") };
  }

  if (!contract.session) {
    return { response: jsonError(401, "AUTH_REQUIRED", "A signed-in session is required.") };
  }

  if (process.env.NODE_ENV === "production" && contract.session.source === "better-auth-contract-demo") {
    return { response: jsonError(503, "DEMO_AUTH_DISABLED", "Demo authentication is disabled in production.") };
  }

  if (!requirePermission(contract.session, options.permission)) {
    return { response: jsonError(403, "FORBIDDEN", "The current session does not have the required permission.") };
  }

  if (options.organizationId && contract.session.organization?.id !== options.organizationId) {
    return { response: jsonError(403, "ORGANIZATION_SCOPE_MISMATCH", "The current session cannot access this organization.") };
  }

  return { session: contract.session };
}

export function isAuthorized(access: RouteAccess): access is { session: AuthSession } {
  return "session" in access;
}
