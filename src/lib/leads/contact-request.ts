import "server-only";
import { getPrismaClient } from "@/lib/repositories/server/prisma";
import { isPrismaPersistence } from "@/lib/persistence/source";
import type { AuthSession } from "@/lib/auth/roles";
import { recordContactAccess } from "./server";

export async function requestListingContact(session: AuthSession, listingId: string, purpose: string, request: Request) {
  const safePurpose = purpose.trim().slice(0, 200);
  if (safePurpose.length < 8) return { ok: false as const, status: 400, errors: ["Explain why you want to contact this advertiser."] };
  if (!isPrismaPersistence()) return { ok: true as const, request: { listingId, status: "REQUESTED", purpose: safePurpose } };
  const db = getPrismaClient() as unknown as { listing: { findFirst(args: unknown): Promise<Record<string, unknown> | null> } };
  const listing = await db.listing.findFirst({ where: { OR: [{ id: listingId }, { stableId: listingId }], lifecycle: "ACTIVE" }, select: { id: true, contactVisibility: true } });
  if (!listing) return { ok: false as const, status: 404, errors: ["Listing not found."] };
  if (listing.contactVisibility === "PUBLIC_BUSINESS") return { ok: true as const, request: { listingId: String(listing.id), status: "BUSINESS_CONTACT_AVAILABLE", purpose: safePurpose } };
  await recordContactAccess(session, { listingId: String(listing.id), method: "contact-request", result: "REQUESTED", purpose: safePurpose, request });
  return { ok: true as const, request: { listingId: String(listing.id), status: "REQUESTED", purpose: safePurpose } };
}
