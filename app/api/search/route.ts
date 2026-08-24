import { NextResponse } from "next/server";
import { searchListingsFromSearchParamsForServer } from "@/lib/search/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const response = await searchListingsFromSearchParamsForServer(url.searchParams);
  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "no-store",
      "X-Architech-Search-Source": response.source,
    },
  });
}
