/* Idempotency keys for outbound projections into Frappe/ERPNext.

   TWO CONSTRAINTS SHAPE THIS, both verified in upstream source:

   1. WIDTH. Frappe stores Data/Link columns as varchar(140)
      (frappe/database/database.py:91, VARCHAR_LEN = 140). A longer key is
      truncated by the receiving database, and two different deals whose keys
      share a 140-char prefix would then collide onto one document -- a
      commission silently attributed to the wrong deal. We bound keys to 128 and
      throw here, so the failure happens in our code with a stack trace instead
      of in their database with no signal at all.

   2. NO RAW CONTACT DATA. The v8 decision requires that no contact-derived
      material appear in idempotency keys or logs. Keys are built from opaque
      internal identifiers only. A key derived from a phone number leaks that
      number into every log line, retry record and error report that mentions
      it, in a system whose entire premise is that customer contact data does
      not cross the boundary. */

import { createHash } from "node:crypto";

/** Frappe's varchar limit; our own bound sits below it deliberately. */
export const FRAPPE_DATA_MAX = 140;
export const IDEMPOTENCY_KEY_MAX = 128;

/* Characters that are safe in a URL path, a JSON string, and a SQL literal
   without escaping. Deliberately excludes '+' and '/' so base64 is never
   passed through unencoded. */
const SAFE_KEY = /^[A-Za-z0-9._:-]+$/;

export class IdempotencyKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdempotencyKeyError";
  }
}

export type IdempotencyKeyParts = {
  /** Dotted event name, e.g. "channel.deal.closed". */
  event: string;
  /** Schema version. Bump to force a re-send with different payload shape. */
  version: number;
  /** Opaque internal ids only -- never a phone, email, or name. */
  parts: string[];
};

/* Build a bounded, collision-resistant idempotency key.

   Shape: "<event>.v<version>.<part>-<part>". If that exceeds the bound, the
   variable tail is replaced by a SHA-256 prefix, keeping the human-readable
   event name while guaranteeing width. Hashing the tail rather than truncating
   it is what preserves distinctness: truncation makes two long keys equal,
   which is exactly the collision we are trying to prevent. */
export function buildIdempotencyKey({ event, version, parts }: IdempotencyKeyParts): string {
  if (!event) throw new IdempotencyKeyError("event is required.");
  if (!Number.isInteger(version) || version < 1) {
    throw new IdempotencyKeyError(`version must be a positive integer, received ${version}.`);
  }
  if (parts.length === 0) throw new IdempotencyKeyError("at least one identifier part is required.");
  for (const part of parts) {
    if (!part) throw new IdempotencyKeyError("identifier parts must be non-empty.");
    if (!SAFE_KEY.test(part)) {
      throw new IdempotencyKeyError(`identifier part "${part}" contains characters that are unsafe in a key.`);
    }
  }

  const prefix = `${event}.v${version}`;
  const direct = `${prefix}.${parts.join("-")}`;
  if (direct.length <= IDEMPOTENCY_KEY_MAX) return direct;

  /* Full input is hashed -- not the truncated form -- so distinct inputs stay
     distinct. 32 hex chars is 128 bits, far beyond collision risk at any
     plausible deal volume. */
  const digest = createHash("sha256").update(direct).digest("hex").slice(0, 32);
  const hashed = `${prefix}.h${digest}`;
  if (hashed.length > IDEMPOTENCY_KEY_MAX) {
    throw new IdempotencyKeyError(
      `event name "${event}" is too long to build a bounded key (${hashed.length} > ${IDEMPOTENCY_KEY_MAX}).`,
    );
  }
  return hashed;
}

/** Stable hash of an outbound payload, for change detection on retry. */
export function payloadHash(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

/* Key-sorted JSON.

   JSON.stringify preserves insertion order, so two objects with identical
   content but different key order would hash differently and look like a
   changed payload, causing a needless re-send. */
function stableStringify(value: unknown): string {
  /* BigInt is checked FIRST: it is not an object, so a `typeof !== "object"`
     branch would hand it to JSON.stringify, which throws on BigInt outright.
     Money crosses this boundary as BigInt, so that path is reached in normal
     operation, not just in tests. */
  if (typeof value === "bigint") return `"${value.toString()}"`;
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(",")}}`;
}
