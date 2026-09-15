/* OTP store – supports memory (demo/fixture) and prisma persistence.
 * Matches existing lead storage pattern: ARCHITECH_DATA_SOURCE=prisma => prisma, else memory.
 *
 * Memory store is module singleton, not durable across restarts/workers – same limitation as
 * Better Auth memory adapter, acceptable for demo mode.
 */

import "server-only";
import { isPrismaPersistence } from "@/lib/persistence/source";
import { getPrismaClient, type PrismaClientLike, type PrismaModelDelegate } from "@/lib/repositories/server/prisma";
import { phoneToLast4 } from "./phone";

export type OtpRecord = {
  id: string;
  phoneE164: string;
  phoneLast4: string;
  otpHash: string;
  purpose: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  verifiedAt: Date | null;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type OtpClient = PrismaClientLike & {
  otpVerification: PrismaModelDelegate & {
    create(args: unknown): Promise<unknown>;
    findFirst(args: unknown): Promise<unknown | null>;
    findMany(args: unknown): Promise<unknown[]>;
    update(args: unknown): Promise<unknown>;
    deleteMany(args: unknown): Promise<{ count: number }>;
  };
};

// In-memory fallback
const memoryStore: Map<string, OtpRecord[]> = new Map(); // phoneE164 -> records

function isExpired(record: OtpRecord): boolean {
  return record.expiresAt.getTime() < Date.now();
}

function cleanupMemory(phoneE164: string) {
  const list = memoryStore.get(phoneE164) ?? [];
  const filtered = list.filter((r) => !isExpired(r) || r.verifiedAt !== null);
  // Keep only last 10 for history, but remove expired unverified older than 1h
  if (filtered.length !== list.length) memoryStore.set(phoneE164, filtered);
}

export async function createOtpRecord(input: {
  phoneE164: string;
  otpHash: string;
  purpose?: string;
  expiresAt: Date;
}): Promise<OtpRecord> {
  const purpose = input.purpose ?? "signup";
  const phoneLast4 = phoneToLast4(input.phoneE164);
  const now = new Date();

  if (isPrismaPersistence()) {
    const db = getPrismaClient() as unknown as OtpClient;
    const created = (await db.otpVerification.create({
      data: {
        phoneE164: input.phoneE164,
        phoneLast4,
        otpHash: input.otpHash,
        purpose,
        attempts: 0,
        maxAttempts: 5,
        expiresAt: input.expiresAt,
      },
    })) as unknown as OtpRecord;
    return created;
  }

  // Memory
  const record: OtpRecord = {
    id: `otp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    phoneE164: input.phoneE164,
    phoneLast4,
    otpHash: input.otpHash,
    purpose,
    attempts: 0,
    maxAttempts: 5,
    expiresAt: input.expiresAt,
    verifiedAt: null,
    userId: null,
    createdAt: now,
    updatedAt: now,
  };
  const list = memoryStore.get(input.phoneE164) ?? [];
  list.push(record);
  memoryStore.set(input.phoneE164, list);
  return record;
}

export async function getLatestValidOtp(phoneE164: string, purpose = "signup"): Promise<OtpRecord | null> {
  const now = new Date();
  if (isPrismaPersistence()) {
    const db = getPrismaClient() as unknown as OtpClient;
    const found = (await db.otpVerification.findFirst({
      where: {
        phoneE164,
        purpose,
        expiresAt: { gt: now },
        verifiedAt: null,
      },
      orderBy: [{ createdAt: "desc" }],
    })) as unknown as OtpRecord | null;
    return found;
  }

  // Memory
  cleanupMemory(phoneE164);
  const list = memoryStore.get(phoneE164) ?? [];
  const valid = list
    .filter((r) => r.purpose === purpose && r.verifiedAt === null && r.expiresAt.getTime() > now.getTime())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return valid[0] ?? null;
}

export async function countRecentOtps(phoneE164: string, since: Date, purpose = "signup"): Promise<number> {
  if (isPrismaPersistence()) {
    const db = getPrismaClient() as unknown as OtpClient;
    const count = await (db.otpVerification as any).count({
      where: {
        phoneE164,
        purpose,
        createdAt: { gte: since },
      },
    });
    return count as number;
  }
  const list = memoryStore.get(phoneE164) ?? [];
  return list.filter((r) => r.purpose === purpose && r.createdAt.getTime() >= since.getTime()).length;
}

export async function incrementAttempts(id: string): Promise<OtpRecord | null> {
  if (isPrismaPersistence()) {
    const db = getPrismaClient() as unknown as OtpClient;
    const updated = (await db.otpVerification.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    })) as unknown as OtpRecord;
    return updated;
  }
  // Memory: find and increment
  for (const [phone, list] of memoryStore.entries()) {
    const idx = list.findIndex((r) => r.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], attempts: list[idx].attempts + 1, updatedAt: new Date() };
      memoryStore.set(phone, list);
      return list[idx];
    }
  }
  return null;
}

export async function markVerified(id: string, userId?: string): Promise<void> {
  const now = new Date();
  if (isPrismaPersistence()) {
    const db = getPrismaClient() as unknown as OtpClient;
    await db.otpVerification.update({
      where: { id },
      data: { verifiedAt: now, ...(userId ? { userId } : {}) },
    });
    return;
  }
  for (const [phone, list] of memoryStore.entries()) {
    const idx = list.findIndex((r) => r.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], verifiedAt: now, userId: userId ?? null, updatedAt: now };
      memoryStore.set(phone, list);
      return;
    }
  }
}

export async function invalidateOtpsForPhone(phoneE164: string, purpose = "signup"): Promise<void> {
  if (isPrismaPersistence()) {
    const db = getPrismaClient() as unknown as OtpClient;
    // Mark all unverified as verified to invalidate (or delete)
    await db.otpVerification.updateMany({
      where: { phoneE164, purpose, verifiedAt: null },
      data: { verifiedAt: new Date() },
    });
    return;
  }
  const list = memoryStore.get(phoneE164) ?? [];
  const now = new Date();
  const updated = list.map((r) => (r.purpose === purpose && r.verifiedAt === null ? { ...r, verifiedAt: now, updatedAt: now } : r));
  memoryStore.set(phoneE164, updated);
}

// Test hook
export function clearMemoryStoreForTests() {
  memoryStore.clear();
}
