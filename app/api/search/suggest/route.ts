import { NextResponse } from "next/server";
import { suggestSearchIncludingRaw } from "@/lib/search/suggest";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 12) : undefined;
  const suggestions = suggestSearchIncludingRaw(q, normalizedLimit);
  return NextResponse.json(
    { suggestions, count: suggestions.length },
    { headers: { "Cache-Control": "max-age=300, stale-while-revalidate=86400" } },
  );
}
