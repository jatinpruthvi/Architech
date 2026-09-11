import { NextResponse } from "next/server";
import { suggestSearchIncludingRaw } from "@/lib/search/suggest";
import { getCityBySlug } from "@/lib/repositories";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  // Suggestions respect the caller's city scope so a Pune search does not lead
  // with Mumbai localities.
  const city = getCityBySlug(url.searchParams.get("city") ?? undefined)?.slug;
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 12) : undefined;
  const suggestions = suggestSearchIncludingRaw(q, normalizedLimit, { citySlug: city });
  return NextResponse.json(
    { suggestions, count: suggestions.length },
    { headers: { "Cache-Control": "max-age=300, stale-while-revalidate=86400" } },
  );
}
