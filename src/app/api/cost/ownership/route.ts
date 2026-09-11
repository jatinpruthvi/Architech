import { NextResponse } from "next/server";
import { calculateOwnershipCost, validateOwnershipAssumptions, type OwnershipAssumptions } from "@/lib/cost/ownership";

export const runtime = "nodejs";

/** Compute buyer ownership costs from caller-supplied assumptions.

    EMI is always available for valid financing assumptions. State transfer
    charges are returned only for an explicitly matched configured rule (or a
    paired reader override); an unknown state returns null statutory values and
    never falls back to Gujarat or any other jurisdiction. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<OwnershipAssumptions> | null;
  if (!body) return NextResponse.json({ ok: false, errors: ["Request body must be JSON."] }, { status: 400 });

  const normalized: OwnershipAssumptions = {
    state: typeof body.state === "string" ? body.state.trim() : undefined,
    priceInr: Number(body.priceInr),
    loanInr: body.loanInr === undefined || body.loanInr === null ? undefined : Number(body.loanInr),
    tenorYears: body.tenorYears === undefined || body.tenorYears === null ? undefined : Number(body.tenorYears),
    annualRatePct: body.annualRatePct === undefined || body.annualRatePct === null ? undefined : Number(body.annualRatePct),
    downPaymentInr: body.downPaymentInr === undefined || body.downPaymentInr === null ? undefined : Number(body.downPaymentInr),
    stampDutyRate: body.stampDutyRate === undefined || body.stampDutyRate === null ? undefined : Number(body.stampDutyRate),
    registrationRate: body.registrationRate === undefined || body.registrationRate === null ? undefined : Number(body.registrationRate),
  };
  const errors = validateOwnershipAssumptions(normalized);
  if (errors.length) return NextResponse.json({ ok: false, errors }, { status: 400, headers: { "Cache-Control": "no-store" } });

  const cost = calculateOwnershipCost(normalized);
  return NextResponse.json(
    {
      ok: true,
      cost,
      charges: cost.charges,
      disclaimer: "Illustrative educational estimate from your assumptions; not a lender quote or legal/tax advice. Confirm statutory charges with the applicable state/UT authority.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
