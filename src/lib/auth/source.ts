export type AuthSourceMode = "demo" | "better-auth";

type BetterAuthEnv = Partial<Record<"BETTER_AUTH_SECRET" | "BETTER_AUTH_URL" | "DATABASE_URL", string | undefined>>;

export function getAuthSourceMode(value = process.env.ARCHITECH_AUTH_SOURCE): AuthSourceMode {
  return value === "better-auth" ? "better-auth" : "demo";
}

export function isBetterAuthEnabled(value = process.env.ARCHITECH_AUTH_SOURCE) {
  return getAuthSourceMode(value) === "better-auth";
}

export function validateBetterAuthEnvironment(env?: BetterAuthEnv) {
  const source = (env ?? process.env) as BetterAuthEnv;
  const missing = ["BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "DATABASE_URL"].filter((key) => !source[key as keyof BetterAuthEnv]);
  return {
    ok: missing.length === 0,
    missing,
  };
}
