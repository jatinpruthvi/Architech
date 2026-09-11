import "server-only";
import { getPrismaClient } from "@/lib/repositories/server/prisma";
import { isPrismaPersistence } from "@/lib/persistence/source";
import type { AuthSession } from "@/lib/auth/roles";

const prisma = () => getPrismaClient() as unknown as {
  listing: { findFirst(args: unknown): Promise<Record<string, unknown> | null> };
  addressDisclosureRequest: { create(args: unknown): Promise<Record<string, unknown>>; findFirst(args: unknown): Promise<Record<string, unknown> | null>; update(args: unknown): Promise<Record<string, unknown>> };
};

export async function requestExactAddress(session: AuthSession, listingId: string, purpose: string) {
  const safePurpose = purpose.trim().slice(0, 200);
  if (safePurpose.length < 8) return { ok: false as const, status: 400, errors: ["Explain why you need the exact address."] };
  if (!isPrismaPersistence()) return { ok: true as const, request: { id: `address_request_${listingId}`, status: "REQUESTED", purpose: safePurpose } };
  const listing = await prisma().listing.findFirst({ where: { OR: [{ id: listingId }, { stableId: listingId }], lifecycle: "ACTIVE" }, select: { id: true, addressVisibility: true, brokerOrgId: true } });
  if (!listing) return { ok: false as const, status: 404, errors: ["Listing not found."] };
  if (listing.addressVisibility === "LOCALITY_ONLY") return { ok: false as const, status: 403, errors: ["This listing does not permit exact-address requests."] };
  const created = await prisma().addressDisclosureRequest.create({ data: { listingId: String(listing.id), requesterId: session.user.id, organizationId: session.organization?.id ?? null, purpose: safePurpose, status: "REQUESTED" } });
  return { ok: true as const, request: created };
}

export async function decideExactAddress(session: AuthSession, requestId: string, decision: "APPROVED" | "REJECTED", sharedMode?: "FULL_ADDRESS" | "APPOINTMENT_ONLY" | "APPROXIMATE_PIN") {
  if (!isPrismaPersistence()) return { ok: true as const, request: { id: requestId, status: decision, sharedMode: sharedMode ?? null } };
  const request = await prisma().addressDisclosureRequest.findFirst({ where: { id: requestId }, include: { listing: { select: { brokerOrgId: true } } } });
  if (!request) return { ok: false as const, status: 404, errors: ["Address request not found."] };
  const listing = (request.listing ?? {}) as { brokerOrgId?: string | null };
  if (!listing.brokerOrgId || listing.brokerOrgId !== session.organization?.id) return { ok: false as const, status: 403, errors: ["Only the listing owner or authorised organization can decide this request."] };
  if (decision === "APPROVED" && !sharedMode) return { ok: false as const, status: 400, errors: ["Choose what location information to share."] };
  const updated = await prisma().addressDisclosureRequest.update({ where: { id: requestId }, data: { status: decision, sharedMode: decision === "APPROVED" ? sharedMode : null, approvedById: session.user.id, decidedAt: new Date(), expiresAt: decision === "APPROVED" ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null } });
  return { ok: true as const, request: updated };
}
