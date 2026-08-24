export type MediaStorageMode = "memory" | "r2";

export function getMediaStorageMode(value = process.env.ARCHITECH_MEDIA_STORAGE): MediaStorageMode {
  return value === "r2" ? "r2" : "memory";
}

export function validateR2Environment(env: NodeJS.ProcessEnv = process.env) {
  const required = ["R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_PUBLIC_BASE_URL"];
  const missing = required.filter((key) => !env[key]);
  return { ok: missing.length === 0, missing };
}
