import { NextResponse } from "next/server";
import { getListingById } from "@/lib/repositories/listings";

export const runtime = "nodejs";

/** Resolve a small set of listings by id for client islands (compare tray, saved). */
export async function GET(request: Request) {
  const ids = (new URL(request.url).searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 24);
  const listings = ids
    .map((id) => getListingById(id))
    .filter((listing): listing is NonNullable<typeof listing> => Boolean(listing));
  return NextResponse.json({ listings }, { headers: { "Cache-Control": "private, max-age=60" } });
}
