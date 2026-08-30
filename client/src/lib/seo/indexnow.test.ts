/* IndexNow submission.

   The behaviour that matters most here is the failure mode, not the happy
   path. A ping is best-effort by definition: if it fails, the URL is still in
   the sitemap and still linked from its hub. So the tests are weighted towards
   "this must never break the caller" — unconfigured, network down, engine
   returns 429, empty input.

   The happy-path test exists to pin the payload shape, because the most likely
   real-world failure is a silently malformed submission: IndexNow returns 202
   for a body it cannot parse, so a wrong shape looks like success. */
import { describe, expect, it, vi } from "vitest";
import { INDEXNOW_MAX_URLS, indexNowConfig, indexNowKeyLocation, submitToIndexNow } from "./indexnow";

const env = { INDEXNOW_KEY: "key-abc", INDEXNOW_HOST: "architech.example" };

function okFetch() {
  return vi.fn(async () => new Response(null, { status: 200 })) as unknown as typeof fetch;
}

describe("indexNowConfig", () => {
  it("is absent without a key", () => {
    expect(indexNowConfig({ INDEXNOW_HOST: "architech.example" })).toBeNull();
  });

  it("is absent without a host", () => {
    expect(indexNowConfig({ INDEXNOW_KEY: "key-abc" })).toBeNull();
  });

  it("falls back to the public site host", () => {
    expect(indexNowConfig({ INDEXNOW_KEY: "k", NEXT_PUBLIC_SITE_HOST: "architech.example" })).toEqual({
      key: "k",
      host: "architech.example",
    });
  });
});

describe("indexNowKeyLocation", () => {
  it("points at a key file on the host, which IndexNow fetches to verify", () => {
    expect(indexNowKeyLocation({ key: "key-abc", host: "architech.example" })).toBe(
      "https://architech.example/key-abc.txt",
    );
  });
});

describe("submitToIndexNow", () => {
  it("does nothing when unconfigured, without calling out", async () => {
    const fetchImpl = okFetch();
    await expect(submitToIndexNow(["/buy/ahmedabad/paldi/"], {}, fetchImpl)).resolves.toEqual({
      submitted: false,
      reason: "not-configured",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does nothing for an empty list", async () => {
    const fetchImpl = okFetch();
    await expect(submitToIndexNow([], env, fetchImpl)).resolves.toEqual({ submitted: false, reason: "empty" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends the payload shape IndexNow expects", async () => {
    const fetchImpl = okFetch();
    await submitToIndexNow(["/buy/ahmedabad/paldi/", "/buy/ahmedabad/"], env, fetchImpl);

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://api.indexnow.org/indexnow");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      host: "architech.example",
      key: "key-abc",
      keyLocation: "https://architech.example/key-abc.txt",
      urlList: ["https://architech.example/buy/ahmedabad/paldi/", "https://architech.example/buy/ahmedabad/"],
    });
  });

  it("makes relative paths absolute and de-duplicates them", async () => {
    const fetchImpl = okFetch();
    await submitToIndexNow(["/a/", "/a/", "https://other.example/b/"], env, fetchImpl);
    const body = JSON.parse((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.urlList).toEqual(["https://architech.example/a/", "https://other.example/b/"]);
  });

  it("reports the engine's status, including a rate limit", async () => {
    const limited = vi.fn(async () => new Response(null, { status: 429 })) as unknown as typeof fetch;
    await expect(submitToIndexNow(["/a/"], env, limited)).resolves.toEqual({
      submitted: true,
      status: 429,
      urlCount: 1,
    });
  });

  it("never throws when the network is down", async () => {
    const broken = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    await expect(submitToIndexNow(["/a/"], env, broken)).resolves.toMatchObject({ submitted: false });
  });

  it("caps the submission at the protocol limit", async () => {
    const fetchImpl = okFetch();
    const many = Array.from({ length: INDEXNOW_MAX_URLS + 50 }, (_, index) => `/p/${index}/`);
    const result = await submitToIndexNow(many, env, fetchImpl);
    expect(result).toMatchObject({ submitted: true, urlCount: INDEXNOW_MAX_URLS });
  });
});
