import { NextResponse } from "next/server";
import { enforceMutationSafety } from "@/lib/auth/request-safety";
import { getSessionContractForRequest } from "@/lib/auth/live";
import type { RequirementInput } from "@/lib/requirements";
import { createRequirementForServer, listRequirementsForUserServer } from "@/lib/requirements.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* A person's own requirement briefs.
 *
 * Deliberately NOT behind `authorizeRequest`: there is no permission to add,
 * because the resource is not organizational. The scope IS the session — the
 * user id comes from the verified session contract and is the only thing the
 * query filters on, so a signed-out caller gets an empty list and a signed-in
 * caller can only ever see their own briefs. There is no parameter a caller
 * could supply to widen that.
 */
export async function GET(request: Request) {
  const contract = await getSessionContractForRequest(request);
  const userId = contract.session?.user.id;
  if (!userId) {
    return NextResponse.json(
      { ok: true, requirements: [], count: 0 },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  const requirements = await listRequirementsForUserServer(userId);
  return NextResponse.json(
    { ok: true, requirements, count: requirements.length },
    { headers: { "Cache-Control": "no-store", "X-Architech-Requirement-Mode": "MASKED" } },
  );
}

export async function POST(request: Request) {
  const safetyResponse = enforceMutationSafety(request);
  if (safetyResponse) return safetyResponse;

  let body: Partial<RequirementInput>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Request body must be JSON."] }, { status: 400 });
  }

  /* Ownership is assigned from the SESSION, never from the body. Trusting a
     client-supplied `userId` would let anyone file a requirement onto a
     stranger's dashboard — or, worse, read it back later by claiming the same
     id. The spread order matters: the session value must land last so a
     forged field in the payload is overwritten rather than merged. */
  const contract = await getSessionContractForRequest(request);
  const input = { ...(body as RequirementInput), userId: contract.session?.user.id ?? null };

  const result = await createRequirementForServer(input);
  if (!result.ok) return NextResponse.json(result, { status: result.status });

  return NextResponse.json(result, {
    status: result.duplicate ? 200 : 201,
    headers: {
      "Cache-Control": "no-store",
      "X-Architech-Requirement-Mode": "MASKED",
    },
  });
}
