import { NextResponse } from "next/server";
import { assistSearchQuery } from "@/lib/ai/search-assist";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return NextResponse.json(assistSearchQuery(url.searchParams.get("q") ?? ""), { headers: { "Cache-Control": "no-store" } });
}
