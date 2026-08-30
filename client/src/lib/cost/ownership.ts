/* Ownership cost estimator (P1-COST-001).
   Pure, server-safe calculator that turns a property price into the real monthly
   and one-time costs of buying in India: monthly EMI (reducing balance),
   stamp duty, and registration. Like the investment/metrics module it is an
   *educational calculator*, never a lender quote or legal advice, and every
   output depends on the assumptions the caller supplies. */

export type OwnershipAssumptions = {
  /** Property price in INR. */
  priceInr: number;
  /** Loan amount in INR (defaults to 80% LTV). */
  loanInr?: number;
  /** Loan tenure in years. */
  tenorYears?: number;
  /** Annual interest rate (%). */
  annualRatePct?: number;
  /** Down payment in INR (defaults to 20% LTV). */
  downPaymentInr?: number;
  /** State the property is in, used to resolve stamp duty and registration
      from `TRANSFER_CHARGES`. Falls back to `DEFAULT_TRANSFER_CHARGES` with
      its scope note attached when the state has no recorded rate. */
  state?: string;
  /** Stamp duty rate as a fraction (e.g. 0.05 = 5%). Overrides the registry —
      for a calculator that lets the reader adjust the assumption. */
  stampDutyRate?: number;
  /** Registration fee fraction (default 0.01). Overrides the registry. */
  registrationRate?: number;
};

export type OwnershipCost = {
  priceInr: number;
  loanInr: number;
  downPaymentInr: number;
  tenorYears: number;
  annualRatePct: number;
  /** Reducing-balance monthly EMI. */
  monthlyEmiInr: number;
  /** Total interest paid over the loan term. */
  totalInterestInr: number;
  /** Total repaid (principal + interest). */
  totalRepaymentInr: number;
  /** One-time stamp duty. */
  stampDutyInr: number;
  /** One-time registration fee. */
  registrationInr: number;
  /** One-time purchase costs (stamp + registration). */
  oneTimeCostsInr: number;
  /** Total one-time cash required (down payment + stamp + registration). */
  cashRequiredInr: number;
  /** Which state's transfer charges produced the stamp duty and registration
      figures, and the scope note that must travel with them. Carried on the
      result so a caller cannot show the number without its caveat. */
  charges: TransferCharges;
};

export const DEFAULT_LOAN_RATIO = 0.8;

/* One documented home for the statutory transfer rates.

   These were written twice: as `DEFAULT_STAMP_DUTY` / `DEFAULT_REGISTRATION`
   here, and as a `RATES` literal in `app/api/cost/ownership/route.ts`. Two
   copies of a state rate is a drift waiting to happen — the API could quote a
   buyer a different stamp duty than the page shows for the same house. Neither
   copy said which state it described, though the route's comment claimed
   Gujarat.

   The registry holds only a region Architech has actually recorded. It is
   deliberately not filled in for the other eleven cities: stamp duty is set by
   each state, and a plausible-looking guess is a statutory number quoted to
   someone about to spend a crore of rupees. An unrecorded rate falls back to
   this one with the `note` attached, so the page says which state the figure
   belongs to instead of implying it is universal.

   Contestant B §3 wants content built around "how to calculate stamp duty in
   [neighbourhood]". That content is only safe to write once this registry is
   the single source of truth — otherwise each article invents its own rate. */
export type TransferCharges = {
  /** State whose rates these are. */
  state: string;
  /** Stamp duty as a fraction of the transaction value (0.05 = 5%). */
  stampDutyRate: number;
  /** Registration fee as a fraction of the transaction value. */
  registrationRate: number;
  /** Plain-English scope note, surfaced wherever the number is shown. */
  note: string;
};

export const TRANSFER_CHARGES: readonly TransferCharges[] = [
  {
    state: "Gujarat",
    stampDutyRate: 0.05,
    registrationRate: 0.01,
    note: "Gujarat rates applied. Stamp duty and registration are set by each state — confirm the current rate for your state before relying on this figure.",
  },
];

/** The rates used when a city's state has no entry of its own. */
export const DEFAULT_TRANSFER_CHARGES: TransferCharges = TRANSFER_CHARGES[0];

/** Recorded transfer charges for a state, or null when none is recorded.

    Null rather than a guess: the caller decides whether to fall back to
    `DEFAULT_TRANSFER_CHARGES` and disclose it, or to withhold the figure. */
export function transferChargesFor(state?: string | null): TransferCharges | null {
  if (!state) return null;
  const needle = state.trim().toLowerCase();
  return TRANSFER_CHARGES.find((charges) => charges.state.toLowerCase() === needle) ?? null;
}

export const DEFAULT_STAMP_DUTY = DEFAULT_TRANSFER_CHARGES.stampDutyRate;
export const DEFAULT_REGISTRATION = DEFAULT_TRANSFER_CHARGES.registrationRate;

function round(value: number): number {
  return Math.round(value);
}

/** Monthly EMI for a reducing-balance loan. */
export function monthlyEmi(principalInr: number, tenorYears: number, annualRatePct: number): number {
  if (principalInr <= 0 || tenorYears <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  const n = tenorYears * 12;
  if (r === 0) return principalInr / n;
  const factor = Math.pow(1 + r, n);
  return (principalInr * r * factor) / (factor - 1);
}

export function calculateOwnershipCost(input: OwnershipAssumptions): OwnershipCost {
  const priceInr = Math.max(0, input.priceInr);
  const loanRatio = input.loanInr ? input.loanInr / priceInr : DEFAULT_LOAN_RATIO;
  const loanInr = input.loanInr ?? Math.round(priceInr * loanRatio);
  const downPaymentInr = input.downPaymentInr ?? Math.max(0, priceInr - loanInr);
  const tenorYears = input.tenorYears ?? 20;
  const annualRatePct = input.annualRatePct ?? 8.5;
  const charges = transferChargesFor(input.state) ?? DEFAULT_TRANSFER_CHARGES;
  const stampDutyRate = input.stampDutyRate ?? charges.stampDutyRate;
  const registrationRate = input.registrationRate ?? charges.registrationRate;

  const emi = monthlyEmi(loanInr, tenorYears, annualRatePct);
  const totalRepaymentInr = emi > 0 ? emi * tenorYears * 12 : 0;
  const totalInterestInr = Math.max(0, totalRepaymentInr - loanInr);
  const stampDutyInr = round(priceInr * stampDutyRate);
  const registrationInr = round(priceInr * registrationRate);
  const oneTimeCostsInr = stampDutyInr + registrationInr;
  const cashRequiredInr = downPaymentInr + oneTimeCostsInr;

  return {
    priceInr,
    loanInr: round(loanInr),
    downPaymentInr: round(downPaymentInr),
    tenorYears,
    annualRatePct,
    monthlyEmiInr: round(emi),
    totalInterestInr: round(totalInterestInr),
    totalRepaymentInr: round(totalRepaymentInr),
    stampDutyInr,
    registrationInr,
    oneTimeCostsInr,
    cashRequiredInr,
    charges,
  };
}

/** Compact INR label, matching the existing real-estate formatter style. */
export function compactInr(value: number): string {
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)} Cr`;
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(1)} L`;
  return `₹${value.toLocaleString("en-IN")}`;
}
