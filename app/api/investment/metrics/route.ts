import { NextResponse } from "next/server";
import { calculateInvestmentMetrics, type InvestmentAssumptions } from "@/lib/investment/metrics";

export const runtime = "nodejs";

/** Compute investment analysis metrics (cap rate, GRM, cash-on-cash) from
    caller-supplied assumptions. Pure calculator — never a valuation or advice. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<InvestmentAssumptions> | null;
  if (!body) return NextResponse.json({ ok: false, errors: ["Request body must be JSON."] }, { status: 400 });
  const priceInr = Number(body.priceInr);
  const annualRentInr = Number(body.annualRentInr);
  const annualExpensesInr = Number(body.annualExpensesInr ?? 0);
  const downPaymentInr = Number(body.downPaymentInr ?? 0);

  if (!Number.isFinite(priceInr) || priceInr <= 0) return NextResponse.json({ ok: false, errors: ["Price must be a positive INR value."] }, { status: 400 });
  if (!Number.isFinite(annualRentInr) || annualRentInr < 0) return NextResponse.json({ ok: false, errors: ["Annual rent must be non-negative."] }, { status: 400 });
  if (!Number.isFinite(annualExpensesInr) || annualExpensesInr < 0) return NextResponse.json({ ok: false, errors: ["Annual expenses must be non-negative."] }, { status: 400 });
  if (!Number.isFinite(downPaymentInr) || downPaymentInr < 0) return NextResponse.json({ ok: false, errors: ["Down payment must be non-negative."] }, { status: 400 });

  const metrics = calculateInvestmentMetrics({ priceInr, annualRentInr, annualExpensesInr, downPaymentInr });
  return NextResponse.json({ ok: true, metrics, disclaimer: "Illustrative calculation from your assumptions; not investment, tax, or legal advice." }, { headers: { "Cache-Control": "no-store" } });
}
