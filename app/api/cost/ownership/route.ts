import { NextResponse } from "next/server";
import { calculateOwnershipCost, type OwnershipAssumptions } from "@/lib/cost/ownership";

export const runtime = "nodejs";

const RATES = { stampDutyRate: 0.05, registrationRate: 0.01 } as const;

/** Compute buyer ownership costs (EMI + stamp duty + registration) from
    caller-supplied assumptions. Educational calculator — not a lender quote or
    legal/tax advice. Validates inputs and applies Gujarat defaults. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<OwnershipAssumptions> | null;
  if (!body) return NextResponse.json({ ok: false, errors: ["Request body must be JSON."] }, { status: 400 });

  const priceInr = Number(body.priceInr);
  if (!Number.isFinite(priceInr) || priceInr <= 0) {
    return NextResponse.json({ ok: false, errors: ["Price must be a positive INR value."] }, { status: 400 });
  }

  const cost = calculateOwnershipCost({
    ...RATES,
    priceInr,
    loanInr: body.loanInr === undefined ? undefined : Number(body.loanInr),
    tenorYears: body.tenorYears === undefined ? undefined : Number(body.tenorYears),
    annualRatePct: body.annualRatePct === undefined ? undefined : Number(body.annualRatePct),
    downPaymentInr: body.downPaymentInr === undefined ? undefined : Number(body.downPaymentInr),
  });

  return NextResponse.json(
    { ok: true, cost, disclaimer: "Illustrative educational estimate from your assumptions; not a lender quote or legal/tax advice." },
    { headers: { "Cache-Control": "no-store" } },
  );
}
