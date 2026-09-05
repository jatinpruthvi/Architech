/* AWS Signature Version 4 signing for Cloudflare R2 (S3-compatible) uploads.
 *
 * Dependency-free on purpose: pulls in no SDK, so the media boundary stays
 * auditable and the bundle stays small. The algorithm follows the AWS IAM
 * User Guide "Create a signed AWS API request" (reference_sigv-create-
 * signed-request.html) step for step, and the module is pinned to that doc's
 * published worked example in sigv4.test.ts.
 *
 * Two surfaces:
 *  - `signRequest` produces an Authorization header (used as the unit-test
 *    oracle against the official AWS vector).
 *  - `presignPutUrl` produces the query-signed PUT URL the browser uploads
 *    straight to R2 with — the secret key never leaves the server, and the
 *    client never computes anything cryptographic.
 */
import { createHash, createHmac } from "node:crypto";

export type SigV4Input = {
  /** Required by `signRequest`; `presignPutUrl` hardcodes PUT, so callers of
      that path may omit it. */
  method?: string;
  /** Absolute URL; any existing query parameters are preserved and signed. */
  url: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Extra headers to sign, e.g. `{ "content-type": "image/jpeg" }`. */
  headers?: Record<string, string>;
  /** Hex SHA-256 of the payload, or the literal "UNSIGNED-PAYLOAD". */
  payloadHash?: string;
  /** Injectable clock so the golden vector in tests is deterministic. */
  now?: Date;
};

const EMPTY_SHA256 = createHash("sha256").update("").digest("hex");

function sha256Hex(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

/* AWS demands its own encoder: uppercase %XX, unreserved set exactly
   A-Z a-z 0-9 -._~, and (per the same doc) 'encodeURIComponent et al. might
   not work because of differences in interpretation'. bytes go through
   TextEncoder so multibyte characters percent-encode correctly. */
function uriEncode(value: string, encodeSlash: boolean): string {
  let out = "";
  for (const byte of new TextEncoder().encode(value)) {
    const ch = String.fromCharCode(byte);
    if ((byte >= 0x41 && byte <= 0x5a) || (byte >= 0x61 && byte <= 0x7a) || (byte >= 0x30 && byte <= 0x39) || ch === "-" || ch === "." || ch === "_" || ch === "~" || (ch === "/" && !encodeSlash)) {
      out += ch;
    } else {
      out += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
    }
  }
  return out;
}

/** "2026-09-05T03:40:00.000Z" → { amzDate: "20260905T034000Z", dateStamp: "20260905" }. */
export function amzDates(now: Date): { amzDate: string; dateStamp: string } {
  const iso = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

type CanonicalPieces = {
  host: string;
  canonicalUri: string;
  canonicalQuery: string;
  canonicalHeaders: string;
  signedHeaders: string;
  payloadHash: string;
  amzDate: string;
  credentialScope: string;
};

function canonicalize(input: SigV4Input, extraQuery: Array<[string, string]>, signedHeaderNames: string[]): CanonicalPieces {
  const url = new URL(input.url);
  const headers: Record<string, string> = { host: url.host };
  for (const [name, value] of Object.entries(input.headers ?? {})) {
    headers[name.toLowerCase()] = value.trim().replace(/\s+/g, " ");
  }
  const names = Object.keys(headers).filter((name) => signedHeaderNames.length === 0 || signedHeaderNames.includes(name));
  names.sort();
  const canonicalHeaders = names.map((name) => `${name}:${headers[name]}\n`).join("");

  const query = new Map<string, string>();
  url.searchParams.forEach((value, key) => query.set(key, value));
  for (const [key, value] of extraQuery) query.set(key, value);
  const canonicalQuery = [...query.entries()]
    .map(([key, value]) => `${uriEncode(key, true)}=${uriEncode(value, true)}`)
    .sort()
    .join("&");

  const { dateStamp, amzDate } = amzDates(input.now ?? new Date());
  return {
    host: url.host,
    /* UriEncode the path one segment at a time so object keys keep their
       '/' separators while reserved bytes still escape (S3 rule). */
    canonicalUri: url.pathname === "" ? "/" : url.pathname.split("/").map((segment) => uriEncode(segment, false)).join("/"),
    canonicalQuery,
    canonicalHeaders,
    signedHeaders: names.join(";"),
    payloadHash: input.payloadHash ?? EMPTY_SHA256,
    amzDate,
    credentialScope: `${dateStamp}/${input.region}/${input.service}/aws4_request`,
  };
}

function signatureFor(input: SigV4Input, pieces: CanonicalPieces, method: string): string {
  const canonicalRequest = [method, pieces.canonicalUri, pieces.canonicalQuery, pieces.canonicalHeaders, pieces.signedHeaders, pieces.payloadHash].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", pieces.amzDate, pieces.credentialScope, sha256Hex(canonicalRequest)].join("\n");
  const dateKey = hmac(`AWS4${input.secretAccessKey}`, pieces.credentialScope.slice(0, 8));
  const regionKey = hmac(dateKey, input.region);
  const serviceKey = hmac(regionKey, input.service);
  const signingKey = hmac(serviceKey, "aws4_request");
  return hmac(signingKey, stringToSign).toString("hex");
}

/** Header-authored signature covering ALL provided headers (the AWS doc's
    canonical-request rule set). Exists as the oracle against the official
    published test vector; the runtime code path is `presignPutUrl`. */
export function signRequest(input: SigV4Input & { method: string }): { authorization: string; amzDate: string; signedHeaders: string; signature: string } {
  const pieces = canonicalize(input, [], []);
  const signature = signatureFor(input, pieces, input.method);
  const authorization = `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${pieces.credentialScope}, SignedHeaders=${pieces.signedHeaders}, Signature=${signature}`;
  return { authorization, amzDate: pieces.amzDate, signedHeaders: pieces.signedHeaders, signature };
}

/** Query-authored (presigned) PUT URL for direct-to-R2 uploads.
    `host` is the only signed header: signing `content-type` would force the
    browser to echo a byte-exact value we cannot guarantee through devtools
    and mobile clients, while host-only signing still binds the URL to this
    bucket, this key, this method and this 15-minute window (R2 honours
    UNSIGNED-PAYLOAD for presigned PUTs). */
export function presignPutUrl(input: SigV4Input & { expiresInSeconds: number }): string {
  if (!Number.isFinite(input.expiresInSeconds) || input.expiresInSeconds < 1 || input.expiresInSeconds > 604800) {
    throw new Error("SigV4 presign expiry must be 1..604800 seconds.");
  }
  const { amzDate, dateStamp } = amzDates(input.now ?? new Date());
  const credentialScope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;
  const extraQuery: Array<[string, string]> = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${input.accessKeyId}/${credentialScope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(Math.floor(input.expiresInSeconds))],
    ["X-Amz-SignedHeaders", "host"],
  ];
  const unsignedPayload: SigV4Input = { ...input, payloadHash: "UNSIGNED-PAYLOAD", headers: {} };
  const pieces = canonicalize(unsignedPayload, extraQuery, ["host"]);
  const signature = signatureFor(unsignedPayload, pieces, "PUT");
  /* canonicalQuery already carries the URL's pre-existing parameters (sorted
     and encoded), so joining it back to the bare path reproduces the exact
     request that was signed — only the signature rides outside it. */
  const [base] = input.url.split("?");
  return `${base}?${pieces.canonicalQuery}&X-Amz-Signature=${signature}`;
}
