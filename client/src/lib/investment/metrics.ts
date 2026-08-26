/* Investment analysis metrics (P1-INVEST-001).
   Deterministic, server-safe calculators for the three common Indian rental
   yield / investment lenses: gross rental yield (GRM), cap rate, and cash-on-
   cash return. These are *calculators*, not valuation models or advice — outputs
   depend purely on the assumptions the caller supplies and are always labelled
   illustrative. Never invents a price or a yield. */

export type InvestmentAssumptions = {
  /** Purchase/entry price in INR. */
  priceInr: number;
  /** Annual rental income in INR. */
  annualRentInr: number;
  /** Annual operating expenses (maintenance, taxes, society, etc.) in INR. */
  annualExpensesInr: number;
  /** Down payment / equity contributed in INR (used for cash-on-cash). */
  downPaymentInr: number;
};

export type InvestmentMetrics = {
  /** Gross rental yield: annualRent / price. */
  grossYieldPct: number | null;
  /** Gross Rent Multiplier: price / annualRent (years to recoup via gross rent). */
  grm: number | null;
  /** Net operating income: annualRent - annualExpenses. */
  noiInr: number;
  /** Cap rate: NOI / price. */
  capRatePct: number | null;
  /** Cash-on-cash return: (NOI - debt service) / invested equity; here debt service is
      assumed 0 when not provided, so it reduces to NOI / downPayment. */
  cashOnCashPct: number | null;
  /** Is the cash-on-cash a rough NOI/equity estimate (no debt service modelled)? */
  cashOnCashApproximation: boolean;
};

export function calculateInvestmentMetrics(input: InvestmentAssumptions): InvestmentMetrics {
  const { priceInr, annualRentInr, annualExpensesInr, downPaymentInr } = input;
  const noiInr = annualRentInr - annualExpensesInr;

  const grossYieldPct = priceInr > 0 && annualRentInr > 0 ? round2((annualRentInr / priceInr) * 100) : null;
  const grm = annualRentInr > 0 ? round2(priceInr / annualRentInr) : null;
  const capRatePct = priceInr > 0 ? round2((noiInr / priceInr) * 100) : null;
  const cashOnCashPct = downPaymentInr > 0 ? round2((noiInr / downPaymentInr) * 100) : null;

  return {
    grossYieldPct,
    grm,
    noiInr,
    capRatePct,
    cashOnCashPct,
    cashOnCashApproximation: true,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Extend assumptions with a helper to derive annual rent from monthly rent. */
export function annualRentFromMonthly(monthlyRentInr: number, months = 12): number {
  return monthlyRentInr * months;
}
