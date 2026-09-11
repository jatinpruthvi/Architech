import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import type { MediaUploadInput } from "@/lib/media/upload";
import { createSignedMediaUploadForServer } from "@/lib/media/server/upload";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const access = await authorizeRequest(request, { permission: "media.upload.write" });
  if (!isAuthorized(access)) return access.response;
  const body = await request.json().catch(() => null) as MediaUploadInput | null;
  if (!body) return NextResponse.json({ ok: false, errors: ["Request body must be JSON."] }, { status: 400 });
  const result = await createSignedMediaUploadForServer(body);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { status: result.duplicate ? 200 : 201, headers: { "Cache-Control": "no-store" } });
}
