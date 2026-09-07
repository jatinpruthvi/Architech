/* Sign-in attempt throttle.
 *
 * `request-safety.ts` already rate-limits mutations, but its budget (60/min) is
 * sized for ordinary form posts and is far too generous for a credential
 * endpoint: 60 guesses a minute per IP is a workable online brute force.
 *
 * This limiter is deliberately keyed on BOTH the client identity and the email
 * being attempted:
 *
 * - the IP bucket stops one host spraying many accounts;
 * - the email bucket stops a distributed attempt against one account, which the
 *   IP bucket cannot see at all.
 *
 * A successful sign-in clears the email bucket so a user who mistyped twice and
 * then succeeded is not left throttled. This is in-process state — correct for
 * a single instance and a real (documented) limitation behind a multi-instance
 * deployment, where it must move to shared storage. It fails CLOSED on the
 * budget and open on identity: no identity means no bucket, exactly as the
 * existing mutation limiter behaves.
 */

import { BoundedWindowMap } from "@/lib/utils/bounded-window-map";

export const LOGIN_WINDOW_MS = 15 * 60_000;
export const MAX_ATTEMPTS_PER_IP = 20;
export const MAX_ATTEMPTS_PER_EMAIL = 8;

/* BUG-R4-003: hard ceiling on live windows in EACH map.

   Neither map was ever pruned: `clearLoginAttempts` only fires on a successful
   sign-in, so every address an attacker sprayed at POST /api/auth/login left a
   permanent entry (the route forwards the body's `email` here after nothing
   more than a shape check — see credential-flow.ts:133). With a 15-minute
   window these entries also outlive the mutation limiter's 60-second ones by
   15x. Same defect class as BUG-R4-001 (metrics series) and BUG-R4-002
   (mutation buckets): unbounded in-process state keyed by client input.

   20k live windows per map is far above any realistic sign-in volume; above
   that we drop the longest-resident windows rather than the process. */
export const MAX_LOGIN_THROTTLE_BUCKETS = 20_000;

type Bucket = { startedAt: number; count: number };

/* Round-4 §6 item 1: both maps are BoundedWindowMaps, so the ceiling and the
   eviction pass live in one shared, separately unit-tested place instead of
   being re-implemented here. Behaviour is unchanged — same 20k ceiling, same
   insertion-order eviction, same "prune only when a brand-new key arrives". */
const ipBuckets = new BoundedWindowMap<Bucket>(MAX_LOGIN_THROTTLE_BUCKETS, LOGIN_WINDOW_MS);
const emailBuckets = new BoundedWindowMap<Bucket>(MAX_LOGIN_THROTTLE_BUCKETS, LOGIN_WINDOW_MS);

/** Live window count per map. Exposed for the bound's regression test. */
export function loginThrottleBucketCount(): { ip: number; email: number } {
  return { ip: ipBuckets.size, email: emailBuckets.size };
}

export type ThrottleDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

function take(store: BoundedWindowMap<Bucket>, key: string, max: number, now: number): ThrottleDecision {
  const current = store.peek(key, now);
  if (!current) {
    /* BUG-R4-003: only a brand-new key can grow the map — an expired hit
       overwrites its slot in place. set() prunes lazily, and only at the
       ceiling, so the steady-state cost stays O(1). */
    store.set(key, { startedAt: now, count: 1 }, now);
    return { allowed: true };
  }
  if (current.count >= max) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.startedAt + LOGIN_WINDOW_MS - now) / 1000)) };
  }
  current.count += 1;
  return { allowed: true };
}

/** Record and evaluate one sign-in attempt. Call BEFORE verifying the password. */
export function registerLoginAttempt(identity: { ip?: string | null; email: string }, now = Date.now()): ThrottleDecision {
  const email = identity.email.trim().toLowerCase();
  const byEmail = email ? take(emailBuckets, `email:${email}`, MAX_ATTEMPTS_PER_EMAIL, now) : { allowed: true as const };
  const byIp = identity.ip ? take(ipBuckets, `ip:${identity.ip}`, MAX_ATTEMPTS_PER_IP, now) : { allowed: true as const };
  if (!byEmail.allowed) return byEmail;
  if (!byIp.allowed) return byIp;
  return { allowed: true };
}

/** Clear the per-email budget after a successful sign-in. */
export function clearLoginAttempts(email: string): void {
  emailBuckets.delete(`email:${email.trim().toLowerCase()}`);
}

export function clearLoginThrottleForTests(): void {
  ipBuckets.clear();
  emailBuckets.clear();
}
