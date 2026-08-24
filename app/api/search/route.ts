import { NextResponse } from "next/server";
import { searchListingsFromSearchParams } from "@/lib/search/search";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const response = searchListingsFromSearchParams(url.searchParams);
  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "no-store",
      "X-Architech-Search-Source": response.source,
    },
  });
}
