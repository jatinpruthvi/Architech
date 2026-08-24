import { NextResponse } from "next/server";
import { compareListings } from "@/lib/ai/explain";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return NextResponse.json(compareListings(url.searchParams.get("left") ?? "", url.searchParams.get("right") ?? ""), { headers: { "Cache-Control": "no-store" } });
}
