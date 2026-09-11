import "server-only";
import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import type { AuthSession } from "./roles";

/** Cookie carrying the owner's super-admin session (spec §6). */
export const SUPER_ADMIN_COOKIE = "architech.super_admin";
/** 8 hours — the same TTL the demo session cookie uses. */
export const SUPER_ADMIN_TTL_SECONDS = 28_800;

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;
const KEY_LEN = 32;

/** `scrypt$<salt-hex>$<hash-hex>` as printed by scripts/auth/make-super-admin-hash.mjs. */
export function parseSuperAdminHash(stored: string | undefined): { salt: Buffer; hash: Buffer } | null {
  if (!stored) return null;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return null;
  const salt = Buffer.from(parts[1], "hex");
  const hash = Buffer.from(parts[2], "hex");
  /* Canonical round-trip: rejects truncated, non-hex and padded encodings. */
  if (salt.length < 8 || hash.length !== KEY_LEN || salt.toString("hex") !== parts[1] || hash.toString("hex") !== parts[2]) return null;
  return { salt, hash };
}

export function verifySuperAdminPassword(password: string, storedHash: string | undefined): boolean {
  const parsed = parseSuperAdminHash(storedHash);
  if (!parsed || !password) return false;
  const candidate = scryptSync(password, parsed.salt, KEY_LEN, SCRYPT_PARAMS);
  return timingSafeEqual(candidate, parsed.hash);
}

function hmacOf(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** `<expiryEpochSeconds>.<hmac-sha256-hex>` over `<expiryEpoch>:architech-super-admin`. */
export function mintSuperAdminCookieValue(expiresAt: Date, secret: string): string {
  const epoch = Math.floor(expiresAt.getTime() / 1000);
  return `${epoch}.${hmacOf(`${epoch}:architech-super-admin`, secret)}`;
}

/** The owner's master session: exactly two permissions, no organization. */
export function superAdminSession(): AuthSession {
  return {
    user: { id: "super-admin", name: "Owner", email: "owner@architech.local", role: "SUPER_ADMIN" },
    permissions: ["admin.plans.read", "admin.plans.write"],
    source: "super-admin",
  };
}

export function superAdminSessionFromCookie(cookieHeader: string, secret: string | undefined): AuthSession | null {
  if (!secret) return null;
  let value: string | undefined;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const index = trimmed.indexOf("=");
    if (index < 0 || trimmed.slice(0, index) !== SUPER_ADMIN_COOKIE) continue;
    value = decodeURIComponent(trimmed.slice(index + 1));
  }
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot < 1) return null;
  const epoch = Number(value.slice(0, dot));
  const signature = value.slice(dot + 1);
  if (!Number.isSafeInteger(epoch) || epoch * 1000 <= Date.now()) return null;
  const expected = hmacOf(`${epoch}:architech-super-admin`, secret);
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return superAdminSession();
}
