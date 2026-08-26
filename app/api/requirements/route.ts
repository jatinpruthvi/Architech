import { NextResponse } from "next/server";
import { enforceMutationSafety } from "@/lib/auth/request-safety";
import { createRequirement, type RequirementInput } from "@/lib/requirements";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const safetyResponse = enforceMutationSafety(request);
  if (safetyResponse) return safetyResponse;

  let body: Partial<RequirementInput>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Request body must be JSON."] }, { status: 400 });
  }

  const result = createRequirement(body as RequirementInput);
  if (!result.ok) return NextResponse.json(result, { status: result.status });

  return NextResponse.json(result, {
    status: result.duplicate ? 200 : 201,
    headers: {
      "Cache-Control": "no-store",
      "X-Architech-Requirement-Mode": "MASKED",
    },
  });
}
