import { describe, expect, it } from "vitest";
import { amzDates, presignPutUrl, signRequest } from "./sigv4";

/* The golden vector: the worked example published in the AWS IAM User Guide's
   SigV4 documentation (GET ListUsers against iam.amazonaws.com, signed
   2015-08-30T12:36:00Z with the doc's fictional credentials). The expected
   signature below is the one AWS prints in that document; if our math drifts
   by a single byte of canonicalization it stops matching. */
const AWS_DOC_VECTOR = {
  method: "GET",
  url: "https://iam.amazonaws.com/?Action=ListUsers&Version=2010-05-08",
  region: "us-east-1",
  service: "iam",
  accessKeyId: "AKIDEXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
  now: new Date("2015-08-30T12:36:00.000Z"),
  headers: { "content-type": "application/x-www-form-urlencoded; charset=utf-8" },
};

describe("SigV4 canonical signing", () => {
  it("reproduces the official AWS worked-example signature exactly", () => {
    const signed = signRequest({ ...AWS_DOC_VECTOR, headers: { ...AWS_DOC_VECTOR.headers, "x-amz-date": "20150830T123600Z" } });
    expect(signed.signedHeaders).toBe("content-type;host;x-amz-date");
    expect(signed.signature).toBe("5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7");
    expect(signed.authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/iam/aws4_request, " +
        "SignedHeaders=content-type;host;x-amz-date, Signature=5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7",
    );
  });

  it("formats amz dates in the AWS layout", () => {
    expect(amzDates(new Date("2026-09-05T03:04:05.678Z"))).toEqual({ amzDate: "20260905T030405Z", dateStamp: "20260905" });
  });
});

describe("presigned R2 PUT URLs", () => {
  const r2 = {
    url: "https://ab12cd34.r2.cloudflarestorage.com/architech-media/listing-drafts/draft_1/media_9/hero-shot.jpg",
    region: "auto",
    service: "s3",
    accessKeyId: "R2KEYID",
    secretAccessKey: "r2secret",
    now: new Date("2026-09-05T00:00:00.000Z"),
  };

  it("is deterministic for identical input and clock", () => {
    expect(presignPutUrl({ ...r2, expiresInSeconds: 900 })).toBe(presignPutUrl({ ...r2, expiresInSeconds: 900 }));
  });

  it("carries host-only signed headers, a 64-hex signature, and the expiry window", () => {
    const url = new URL(presignPutUrl({ ...r2, expiresInSeconds: 900 }));
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(url.searchParams.get("X-Amz-Credential")).toBe("R2KEYID/20260905/auto/s3/aws4_request");
    expect(url.searchParams.get("X-Amz-Date")).toBe("20260905T000000Z");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(url.toString()).not.toContain("placeholder");
    expect(url.pathname).toBe("/architech-media/listing-drafts/draft_1/media_9/hero-shot.jpg");
  });

  it("binds the signature to the credential, the key, and the expiry", () => {
    const a = presignPutUrl({ ...r2, expiresInSeconds: 900 });
    expect(presignPutUrl({ ...r2, secretAccessKey: "other", expiresInSeconds: 900 })).not.toBe(a);
    expect(presignPutUrl({ ...r2, url: r2.url.replace("media_9", "media_10"), expiresInSeconds: 900 })).not.toBe(a);
    expect(presignPutUrl({ ...r2, expiresInSeconds: 901 })).not.toBe(a);
  });

  it("rejects nonsense expiry windows instead of minting a weird URL", () => {
    expect(() => presignPutUrl({ ...r2, expiresInSeconds: 0 })).toThrow();
    expect(() => presignPutUrl({ ...r2, expiresInSeconds: 700000 })).toThrow();
    expect(() => presignPutUrl({ ...r2, expiresInSeconds: Number.NaN })).toThrow();
  });

  it("preserves and re-signs pre-existing query parameters", () => {
    const url = new URL(presignPutUrl({ ...r2, url: `${r2.url}?partNumber=2`, expiresInSeconds: 900 }));
    expect(url.searchParams.get("partNumber")).toBe("2");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  });
});
