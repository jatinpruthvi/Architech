/* Ownership cost estimator (P1-COST-001).

   EMI is nationally reusable. Stamp duty and registration are not: they depend
   on the state/UT, instrument, consideration/market value, buyer attributes,
   concessions, caps, and effective date. Unknown jurisdictions therefore
   produce unavailable statutory fields — never another state's fallback. */

export type OwnershipAssumptions = {
  /** Property price in INR. */
  priceInr: number;
  /** Loan amount in INR (defaults to 80% LTV). */
  loanInr?: number;
  /** Loan tenure in years. */
  tenorYears?: number;
  /** Annual interest rate (%). */
  annualRatePct?: number;
  /** Down payment in INR (defaults to the price less loan). */
  downPaymentInr?: number;
  /** State/UT containing the property. Required to select a configured rule. */
  state?: string;
  /** Reader-supplied stamp rate as a fraction. Must be supplied together with
      `registrationRate`; these values are labelled as user assumptions. */
  stampDutyRate?: number;
  /** Reader-supplied registration rate as a fraction. */
  registrationRate?: number;
};

export type TransferCharges = {
  state: string;
  stampDutyRate: number;
  registrationRate: number;
  basis: "configured-state-baseline" | "user-assumption";
  /** Human-readable limitations that must be shown beside the figures. */
  note: string;
  sourceUrl: string | null;
  reviewedAt: string | null;
};

export type OwnershipCost = {
  priceInr: number;
  loanInr: number;
  downPaymentInr: number;
  tenorYears: number;
  annualRatePct: number;
  monthlyEmiInr: number;
  totalInterestInr: number;
  totalRepaymentInr: number;
  /** Null means Architech has no applicable reviewed/configured state rule. */
  stampDutyInr: number | null;
  registrationInr: number | null;
  oneTimeCostsInr: number | null;
  /** Null when mandatory transfer charges are unavailable; down payment alone
      must not be presented as total cash required. */
  cashRequiredInr: number | null;
  charges: TransferCharges | null;
  statutoryStatus: "available" | "unavailable";
};

export const DEFAULT_LOAN_RATIO = 0.8;

/* This registry is intentionally sparse. Adding a state requires product/legal
   review of the official source and its conditions; copying a headline rate
   from an article is not sufficient. Gujarat remains an explicitly scoped,
   illustrative configured baseline for the existing demo and is never used for
   another state. The linked GARVI service is the final transaction-time source. */
export const TRANSFER_CHARGES: readonly TransferCharges[] = [
  {
    state: "Gujarat",
    stampDutyRate: 0.05,
    registrationRate: 0.01,
    basis: "configured-state-baseline",
    note: "Gujarat illustrative baseline only (5% stamp duty + 1% registration). Deed type, official market value, buyer eligibility, concessions and caps can change the amount; verify in GARVI before relying on it.",
    sourceUrl: "https://garvi.gujarat.gov.in/",
    reviewedAt: "2026-08-30",
  },
];

/** Configured transfer charges for one explicit state/UT, or null. */
export function transferChargesFor(state?: string | null): TransferCharges | null {
  if (!state) return null;
  const needle = state.trim().toLocaleLowerCase("en-IN");
  return TRANSFER_CHARGES.find((charges) => charges.state.toLocaleLowerCase("en-IN") === needle) ?? null;
}

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

/** Errors that make the estimate meaningless rather than merely unusual. */
export function validateOwnershipAssumptions(input: Partial<OwnershipAssumptions>): string[] {
  const errors: string[] = [];
  const price = input.priceInr;
  if (price === undefined || !Number.isFinite(price) || price <= 0) errors.push("Price must be a positive INR value.");
  if (input.loanInr !== undefined) {
    if (!Number.isFinite(input.loanInr) || input.loanInr < 0) errors.push("Loan must be zero or a positive INR value.");
    else if (price !== undefined && Number.isFinite(price) && input.loanInr > price) errors.push("Loan cannot exceed the property price.");
  }
  if (input.downPaymentInr !== undefined && (!Number.isFinite(input.downPaymentInr) || input.downPaymentInr < 0)) errors.push("Down payment must be zero or a positive INR value.");
  if (input.tenorYears !== undefined && (!Number.isFinite(input.tenorYears) || input.tenorYears <= 0)) errors.push("Loan tenure must be a positive number of years.");
  if (input.annualRatePct !== undefined && (!Number.isFinite(input.annualRatePct) || input.annualRatePct < 0 || input.annualRatePct >= 100)) errors.push("Annual interest rate must be between 0 and 100.");
  if (input.stampDutyRate !== undefined && (!Number.isFinite(input.stampDutyRate) || input.stampDutyRate < 0 || input.stampDutyRate > 1)) errors.push("Stamp duty rate must be a fraction between 0 and 1.");
  if (input.registrationRate !== undefined && (!Number.isFinite(input.registrationRate) || input.registrationRate < 0 || input.registrationRate > 1)) errors.push("Registration rate must be a fraction between 0 and 1.");
  if ((input.stampDutyRate === undefined) !== (input.registrationRate === undefined)) errors.push("Supply both stamp duty and registration rates together.");
  return errors;
}

function resolveCharges(input: OwnershipAssumptions): TransferCharges | null {
  if (input.stampDutyRate !== undefined && input.registrationRate !== undefined) {
    return {
      state: input.state?.trim() || "User-supplied jurisdiction",
      stampDutyRate: input.stampDutyRate,
      registrationRate: input.registrationRate,
      basis: "user-assumption",
      note: "Rates supplied by the reader. Architech has not verified these statutory assumptions; confirm them with the applicable registration authority.",
      sourceUrl: null,
      reviewedAt: null,
    };
  }
  return transferChargesFor(input.state);
}

export function calculateOwnershipCost(input: OwnershipAssumptions): OwnershipCost {
  const priceInr = Number.isFinite(input.priceInr) ? Math.max(0, input.priceInr) : 0;
  const hasExplicitLoan = input.loanInr !== undefined && Number.isFinite(input.loanInr) && input.loanInr >= 0;
  const hasExplicitDownPayment = input.downPaymentInr !== undefined && Number.isFinite(input.downPaymentInr) && input.downPaymentInr >= 0;
  const loanInr = hasExplicitLoan ? input.loanInr! : Math.round(priceInr * DEFAULT_LOAN_RATIO);
  const downPaymentInr = hasExplicitDownPayment ? input.downPaymentInr! : Math.max(0, priceInr - loanInr);
  const tenorYears = Number.isFinite(input.tenorYears) && input.tenorYears! > 0 ? input.tenorYears! : 20;
  const annualRatePct = Number.isFinite(input.annualRatePct) && input.annualRatePct! >= 0 && input.annualRatePct! < 100 ? input.annualRatePct! : 8.5;
  const charges = resolveCharges(input);

  const emi = monthlyEmi(loanInr, tenorYears, annualRatePct);
  const totalRepaymentInr = emi > 0 ? emi * tenorYears * 12 : 0;
  const totalInterestInr = Math.max(0, totalRepaymentInr - loanInr);
  const stampDutyInr = charges ? round(priceInr * charges.stampDutyRate) : null;
  const registrationInr = charges ? round(priceInr * charges.registrationRate) : null;
  const oneTimeCostsInr = stampDutyInr === null || registrationInr === null ? null : stampDutyInr + registrationInr;
  const cashRequiredInr = oneTimeCostsInr === null ? null : downPaymentInr + oneTimeCostsInr;

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
    statutoryStatus: charges ? "available" : "unavailable",
  };
}

/** Compact INR label, matching the existing real-estate formatter style. */
export function compactInr(value: number): string {
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)} Cr`;
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(1)} L`;
  return `₹${value.toLocaleString("en-IN")}`;
}
