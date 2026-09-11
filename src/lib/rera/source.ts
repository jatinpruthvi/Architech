export type ReraSourceMode = "demo" | "gujarat";

type GujaratReraEnv = Partial<Record<"GUJARAT_RERA_BASE_URL" | "GUJARAT_RERA_API_KEY", string | undefined>>;

export function getReraSourceMode(value = process.env.ARCHITECH_RERA_SOURCE): ReraSourceMode {
  return value === "gujarat" ? "gujarat" : "demo";
}

export function validateGujaratReraEnvironment(env?: GujaratReraEnv) {
  const source = (env ?? process.env) as GujaratReraEnv;
  const missing = ["GUJARAT_RERA_BASE_URL", "GUJARAT_RERA_API_KEY"].filter((key) => !source[key as keyof GujaratReraEnv]);
  return { ok: missing.length === 0, missing };
}
