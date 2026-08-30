import { NextResponse } from "next/server";
import { calculateOwnershipCost, DEFAULT_TRANSFER_CHARGES, transferChargesFor, validateOwnershipAssumptions, type OwnershipAssumptions } from "@/lib/cost/ownership";

export const runtime = "nodejs";

/** Compute buyer ownership costs (EMI + stamp duty + registration) from
    caller-supplied assumptions. Educational calculator — not a lender quote or
    legal/tax advice.

    Stamp duty and registration come from the shared `TRANSFER_CHARGES`
    registry rather than a local copy of the numbers, so the API and the page
    can never quote a buyer different statutory rates for the same house. A
    state with no recorded rate falls back to the registry default and the
    response carries that default's scope note. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<OwnershipAssumptions> | null;
  if (!body) return NextResponse.json({ ok: false, errors: ["Request body must be JSON."] }, { status: 400 });

  const normalized: OwnershipAssumptions = {
    state: body.state,
    priceInr: Number(body.priceInr),
    loanInr: body.loanInr === undefined || body.loanInr === null ? undefined : Number(body.loanInr),
    tenorYears: body.tenorYears === undefined || body.tenorYears === null ? undefined : Number(body.tenorYears),
    annualRatePct: body.annualRatePct === undefined || body.annualRatePct === null ? undefined : Number(body.annualRatePct),
    downPaymentInr: body.downPaymentInr === undefined || body.downPaymentInr === null ? undefined : Number(body.downPaymentInr),
    stampDutyRate: body.stampDutyRate === undefined || body.stampDutyRate === null ? undefined : Number(body.stampDutyRate),
    registrationRate: body.registrationRate === undefined || body.registrationRate === null ? undefined : Number(body.registrationRate),
  };
  /* B-12: non-numeric strings used to become NaN in the response, and a loan
     above the price produced impossible outputs. Reject before computing. */
  const errors = validateOwnershipAssumptions(normalized);
  if (errors.length) return NextResponse.json({ ok: false, errors }, { status: 400, headers: { "Cache-Control": "no-store" } });

  const charges = transferChargesFor(body.state) ?? DEFAULT_TRANSFER_CHARGES;
  const cost = calculateOwnershipCost(normalized);

  return NextResponse.json(
    {
      ok: true,
      cost,
      // The state the rates belong to travels with the numbers: a caller
      // showing the stamp duty should be able to show its scope too.
      charges,
      disclaimer: "Illustrative educational estimate from your assumptions; not a lender quote or legal/tax advice.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
