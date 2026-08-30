import { NextResponse } from "next/server";
import { calculateOwnershipCost, DEFAULT_TRANSFER_CHARGES, transferChargesFor, type OwnershipAssumptions } from "@/lib/cost/ownership";

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

  const priceInr = Number(body.priceInr);
  if (!Number.isFinite(priceInr) || priceInr <= 0) {
    return NextResponse.json({ ok: false, errors: ["Price must be a positive INR value."] }, { status: 400 });
  }

  const charges = transferChargesFor(body.state) ?? DEFAULT_TRANSFER_CHARGES;
  const cost = calculateOwnershipCost({
    state: body.state,
    priceInr,
    loanInr: body.loanInr === undefined ? undefined : Number(body.loanInr),
    tenorYears: body.tenorYears === undefined ? undefined : Number(body.tenorYears),
    annualRatePct: body.annualRatePct === undefined ? undefined : Number(body.annualRatePct),
    downPaymentInr: body.downPaymentInr === undefined ? undefined : Number(body.downPaymentInr),
  });

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
