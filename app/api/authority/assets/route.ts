import { NextResponse } from "next/server";
import { listRegistryAssetsForServer, registerAuthorityAssetForServer } from "@/lib/governance/server";
import type { AuthorityAsset } from "@/lib/governance/authority";

export const runtime = "nodejs";

export async function GET() {
  const assets = await listRegistryAssetsForServer();
  return NextResponse.json({ ok: true, assets, count: assets.length }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Omit<AuthorityAsset, "id"> | null;
  if (!body) return NextResponse.json({ ok: false, errors: ["Request body must be JSON."] }, { status: 400 });
  const result = await registerAuthorityAssetForServer(body);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { status: result.duplicate ? 200 : 201, headers: { "Cache-Control": "no-store" } });
}
