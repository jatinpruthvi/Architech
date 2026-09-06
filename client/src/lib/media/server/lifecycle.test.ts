import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteMediaObjectBestEffort } from "./lifecycle";

/* Best-effort object deletion: a storage outage must never wedge the
   retention sweep or a takedown — failures are returned, not thrown. */

const r2Vars = ["ARCHITECH_MEDIA_STORAGE", "R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_PUBLIC_BASE_URL"];
const saved: Record<string, string | undefined> = {};

function clearEnv() {
  for (const key of r2Vars) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
}

function restoreEnv() {
  for (const key of r2Vars) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
}

describe("deleteMediaObjectBestEffort", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    restoreEnv();
  });

  it("skips when there is no object key", async () => {
    clearEnv();
    await expect(deleteMediaObjectBestEffort(null)).resolves.toEqual({ ok: true, skipped: true });
    await expect(deleteMediaObjectBestEffort(undefined)).resolves.toEqual({ ok: true, skipped: true });
  });

  it("skips in memory storage mode (no object exists there)", async () => {
    clearEnv();
    process.env.ARCHITECH_MEDIA_STORAGE = "memory";
    await expect(deleteMediaObjectBestEffort("listing-drafts/x.jpg")).resolves.toEqual({ ok: true, skipped: true });
  });

  it("deletes through the R2 provider in r2 mode", async () => {
    clearEnv();
    Object.assign(process.env, {
      ARCHITECH_MEDIA_STORAGE: "r2",
      R2_ACCOUNT_ID: "account",
      R2_BUCKET: "bucket",
      R2_ACCESS_KEY_ID: "key",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_PUBLIC_BASE_URL: "https://media.example.com",
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response);
    vi.stubGlobal("fetch", fetchMock);
    const result = await deleteMediaObjectBestEffort("listing-drafts/draft_1/media_1/a.jpg");
    expect(result).toEqual({ ok: true, skipped: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns (never throws) a failure when R2 is unreachable", async () => {
    clearEnv();
    Object.assign(process.env, {
      ARCHITECH_MEDIA_STORAGE: "r2",
      R2_ACCOUNT_ID: "account",
      R2_BUCKET: "bucket",
      R2_ACCESS_KEY_ID: "key",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_PUBLIC_BASE_URL: "https://media.example.com",
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    const result = await deleteMediaObjectBestEffort("listing-drafts/x.jpg");
    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/boom/);
  });
});
