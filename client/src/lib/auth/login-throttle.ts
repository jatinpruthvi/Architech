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

export type ThrottleDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

function take(store: Map<string, Bucket>, key: string, max: number, now: number): ThrottleDecision {
  const current = store.get(key);
  if (!current || now - current.startedAt >= LOGIN_WINDOW_MS) {
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
