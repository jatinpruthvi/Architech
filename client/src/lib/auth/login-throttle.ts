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

export const LOGIN_WINDOW_MS = 15 * 60_000;
export const MAX_ATTEMPTS_PER_IP = 20;
export const MAX_ATTEMPTS_PER_EMAIL = 8;

type Bucket = { startedAt: number; count: number };

const ipBuckets = new Map<string, Bucket>();
const emailBuckets = new Map<string, Bucket>();

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

/** Live window count per map. Exposed for the bound's regression test. */
export function loginThrottleBucketCount(): { ip: number; email: number } {
  return { ip: ipBuckets.size, email: emailBuckets.size };
}

/* Reclaim window slots. Expired windows are dead weight — the key is re-created
   on that client's next attempt anyway — so they go first; only if the map is
   still over the ceiling do we drop the longest-resident entries.

   Eviction walks the Map's own insertion order rather than sorting by
   `startedAt`: insertion order is a good proxy, and it keeps this O(excess)
   instead of O(n log n) PER INSERT. A sort here would run on every request
   once the ceiling is reached, turning the memory guard into its own
   denial-of-service amplifier — precisely the condition it exists to survive.
   Re-setting an existing key keeps its position, so a continuously-active
   client may sit near the front; that costs it at most one unthrottled window
   in a situation where 20k windows are already live. */
function prune(store: Map<string, Bucket>, now: number) {
  for (const [key, bucket] of store) {
    if (now - bucket.startedAt >= LOGIN_WINDOW_MS) store.delete(key);
  }
  const limit = MAX_LOGIN_THROTTLE_BUCKETS - 1;
  for (const key of store.keys()) {
    if (store.size <= limit) break;
    store.delete(key);
  }
}

export type ThrottleDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

function take(store: Map<string, Bucket>, key: string, max: number, now: number): ThrottleDecision {
  const current = store.get(key);
  if (!current || now - current.startedAt >= LOGIN_WINDOW_MS) {
    /* BUG-R4-003: only a brand-new key can grow the map — an expired hit
       overwrites its slot in place. Prune lazily, and only at the ceiling, so
       the steady-state cost stays O(1). */
    if (!current && store.size >= MAX_LOGIN_THROTTLE_BUCKETS - 1) prune(store, now);
    store.set(key, { startedAt: now, count: 1 });
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
