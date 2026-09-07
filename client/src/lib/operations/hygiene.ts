/* Security & operational hygiene (P1-PLAT-001).
   Enforces the "no secrets in source, no token in remote" rule at the module
   level so it can be checked in CI and replicated in scripts. Deterministic and
   server-safe; reads only the explicitly passed inputs (no ambient secrets). */

export type HygieneResult = {
  ok: boolean;
  issues: string[];
  allowedEnvKeys: string[];
};

/** The allow-list of env keys the app is permitted to read at runtime. */
export const ALLOWED_ENV_KEYS = [
  "NEXT_PUBLIC_SITE_URL",
  "DATABASE_URL",
  "ARCHITECH_DATA_SOURCE",
  "ARCHITECH_CONTACT_ENCRYPTION_KEY",
  "ARCHITECH_REQUIREMENT_RETENTION_DAYS",
  "ARCHITECH_SEARCH_SOURCE",
  "ARCHITECH_LEAD_STORAGE",
  "ARCHITECH_SAVED_SEARCH_STORAGE",
  "ARCHITECH_MEDIA_STORAGE",
  "ARCHITECH_RERA_SOURCE",
  "ARCHITECH_AUTH_SOURCE",
  "ARCHITECH_AI_PROVIDER",
  "ARCHITECH_GSC_SOURCE",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_DSN",
  "SENTRY_TRACES_SAMPLE_RATE",
  "NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE",
  "R2_ACCOUNT_ID",
  "R2_BUCKET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_PUBLIC_BASE_URL",
  "RESEND_API_KEY",
  "SAVED_SEARCH_ALERTS",
  "SAVED_SEARCH_ALERT_FROM",
  "SAVED_SEARCH_ALERT_MODE",
  "SAVED_SEARCH_ALERT_DAILY_LIMIT",
  "SAVED_SEARCH_ALERT_DIGEST_MAX_LISTINGS",
  /* Shared bearer token for /api/internal/scheduled/* cron drivers. */
  "CRON_SECRET",
  "GSC_CREDENTIALS",
  "GUJARAT_RERA_BASE_URL",
  "GUJARAT_RERA_API_KEY",
  "LOG_LEVEL",
  "APP_ENV",
  "NEXT_PUBLIC_APP_ENV",
  "NODE_ENV",
  "PORT",
  "NEXT_RUNTIME",
  "PUBLIC_INDEXING_ENABLED",
  "INDEXNOW_KEY",
  "INDEXNOW_HOST",
  "NEXT_PUBLIC_SITE_HOST",
  "LEGAL_GATES_ENFORCE_APPROVAL",
  "ARCHITECH_AUTHORITY_STORAGE",
  "TRUST_PROXY_HEADERS",
  "ALLOW_ORIGINLESS_MUTATIONS",
  /* Reconciled 2026-09-07 (bug-hunt round 4, W5): these 18 keys are read from
     process.env somewhere in app/, client/src/, shared/ or scripts/ but were
     missing from the catalog, so validateEnvCatalog would have flagged the
     project's own configuration as unknown. env-catalog-parity.test.ts now
     drives this list from a source scan on every CI run. */
  "ARCHITECH_ALLOW_DEMO_AUTH_IN_PRODUCTION",
  "ARCHITECH_BENCH_DATABASE_URL",
  "ARCHITECH_DEMO_START_SIGNED_OUT",
  "ARCHITECH_MEDIA_KINDS",
  "ARCHITECH_PARITY_DATABASE_URL",
  "ARCHITECH_SANDBOX_DB_NAME",
  "ARCHITECH_SANDBOX_PG_PORT",
  "ARCHITECH_SEARCH_SQL_PAGE",
  "BROKER_CHANNEL_ERPNEXT_TOKEN",
  "BROKER_CHANNEL_ERPNEXT_URL",
  "CRAWL_BASE_URL",
  "DATA_GOV_IN_API_KEY",
  "MEDIA_MAX_IMAGES_PER_LISTING",
  "NEXT_PUBLIC_ARCHITECH_MEDIA_KINDS",
  "NEXT_PUBLIC_MAPLIBRE_VENDOR_PATH",
  "NEXT_PUBLIC_R2_PUBLIC_BASE_URL",
  "NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE",
  "SEO_REGISTRY_TTL_MS",
] as const;

/** Risk keywords that reveal a stray secret in source or a rendered URL. */
const SECRET_KEYWORDS = [
  "ghp_", "github_pat_", "sk-", "AKIA", "aws_secret", "BEGIN RSA", "BEGIN PRIVATE KEY",
  "Bearer ", "x-access-token", "access_token=", "client_secret",
] as const;

export function detectSecretInString(value: string, label: string): string[] {
  const issues: string[] = [];
  for (const keyword of SECRET_KEYWORDS) {
    if (value.toLowerCase().includes(keyword.toLowerCase())) issues.push(`${label} contains a potential secret (${keyword.trim()}).`);
  }
  return issues;
}

/** Validate a git remote URL contains no embedded credentials. */
export function validateRemoteUrl(remoteUrl?: string): HygieneResult {
  const issues: string[] = [];
  if (!remoteUrl) {
    issues.push("Git remote is not set.");
    return { ok: false, issues, allowedEnvKeys: [...ALLOWED_ENV_KEYS] };
  }
  issues.push(...detectSecretInString(remoteUrl, "git remote"));
  const hasCredentials = /^https:\/\/[^@\s]+@/.test(remoteUrl);
  if (hasCredentials) issues.push("Git remote embeds credentials; it must be a clean URL.");
  return { ok: issues.length === 0, issues, allowedEnvKeys: [...ALLOWED_ENV_KEYS] };
}

/** Validate an env catalog against the allow-list and flag unknown/secret-looking keys. */
export function validateEnvCatalog(env: Record<string, string | undefined>): HygieneResult {
  const issues: string[] = [];
  for (const key of Object.keys(env)) {
    if (!ALLOWED_ENV_KEYS.includes(key as (typeof ALLOWED_ENV_KEYS)[number])) {
      issues.push(`Unknown env key not in allow-list: ${key}`);
    }
  }
  return { ok: issues.length === 0, issues, allowedEnvKeys: [...ALLOWED_ENV_KEYS] };
}

export type ReleaseRollbackCheck = {
  ok: boolean;
  reasons: string[];
};

/** Rollback readiness: the release must be gated and reversibility documented. */
export function rollbackReadiness(input: { gated: boolean; backupCrisp: boolean; healthEndpoint: string; lastGoodCommit: string }): ReleaseRollbackCheck {
  const reasons: string[] = [];
  if (!input.gated) reasons.push("Release must be behind an environment gate before rollback is authorized.");
  if (!input.backupCrisp) reasons.push("Backup/runtime snapshot must be crisply restorable before release.");
  if (!input.healthEndpoint) reasons.push("Health endpoint must be defined for post-deploy validation.");
  if (!input.lastGoodCommit) reasons.push("A last-known-good commit must be tagged for one-step rollback.");
  return { ok: reasons.length === 0, reasons };
}
