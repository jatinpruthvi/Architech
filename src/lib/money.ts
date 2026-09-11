/* INR money at the database boundary.

   Money is stored as BigInt in PostgreSQL (see prisma/schema.prisma) because a
   32-bit integer caps at ₹2,147,483,647 (~₹214 crore), which is reachable for
   commercial property and land. The domain layer above this file works in
   `number`, which is exact for integers up to 2^53 (~₹90,07,19,92,54,740 — nine
   thousand crore) and is what every pricing, yield, and stamp-duty calculation
   already expects.

   So the widening is deliberately confined: BigInt in the DB, number in the
   domain, and exactly one explicit conversion here. That keeps the ceiling
   removed without turning every arithmetic site into BigInt arithmetic, which
   would be a large and bug-prone change for no gain — BigInt cannot express the
   fractional intermediates that yield and rate calculations produce anyway.

   The conversion is checked rather than silent. A value above 2^53 is not
   representable and would corrupt quietly, so we surface it. */

/** Largest INR amount that survives the BigInt -> number narrowing exactly. */
export const MAX_SAFE_INR = BigInt(Number.MAX_SAFE_INTEGER);

export class MoneyPrecisionError extends Error {
  constructor(value: bigint, field: string) {
    super(`${field}=${value} exceeds the exact-integer range for a JS number (${Number.MAX_SAFE_INTEGER}).`);
    this.name = "MoneyPrecisionError";
  }
}

/* Narrow a database BigInt to a domain number.

   Throws above 2^53 instead of returning a silently-wrong value. That range is
   ~₹9,007 crore for a single listing: far beyond any real Indian residential or
   commercial price, so in practice this only fires on corrupt or adversarial
   data, which is exactly when silence would be worst. */
export function inrToNumber(value: bigint | number | null | undefined, field = "amount"): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value > MAX_SAFE_INR || value < -MAX_SAFE_INR) throw new MoneyPrecisionError(value, field);
  return Number(value);
}

/* Widen a domain number to a database BigInt.

   Non-finite and fractional input is rejected rather than truncated: INR columns
   hold whole rupees, and a caller passing 1500.75 has a bug we should not paper
   over by rounding on their behalf. */
export function inrToBigInt(value: number, field = "amount"): bigint {
  if (!Number.isFinite(value)) throw new MoneyPrecisionError(BigInt(0), field);
  if (!Number.isInteger(value)) throw new Error(`${field}=${value} must be a whole rupee amount.`);
  return BigInt(value);
}

/* Serialise money for a JSON payload crossing into Frappe/ERPNext.

   ERPNext stores Currency as decimal(21,9) (verified in
   frappe/database/mariadb/database.py:176 at v16.33.0). BigInt does not survive
   JSON.stringify at all, and a JS number invites float drift on the receiving
   side, so the wire format is a decimal string. See
   docs/broker-suite/erpnext-consumability-schema-constraints.md §1.2. */
export function inrToDecimalString(value: bigint | number): string {
  const whole = typeof value === "bigint" ? value : inrToBigInt(value);
  return `${whole}.000000000`;
}
