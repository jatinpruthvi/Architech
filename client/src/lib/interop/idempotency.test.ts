import { describe, expect, it } from "vitest";
import {
  FRAPPE_DATA_MAX,
  IDEMPOTENCY_KEY_MAX,
  IdempotencyKeyError,
  buildIdempotencyKey,
  payloadHash,
} from "./idempotency";

const key = (parts: string[], event = "channel.deal.closed", version = 1) =>
  buildIdempotencyKey({ event, version, parts });

describe("outbound idempotency keys", () => {
  it("stays below Frappe's varchar(140) Data limit", () => {
    expect(IDEMPOTENCY_KEY_MAX).toBeLessThan(FRAPPE_DATA_MAX);
  });

  it("builds a readable key from opaque identifiers", () => {
    expect(key(["deal_9y2k", "org_2"])).toBe("channel.deal.closed.v1.deal_9y2k-org_2");
  });

  it("is deterministic, so a retry produces the same key", () => {
    expect(key(["deal_9y2k", "org_2"])).toBe(key(["deal_9y2k", "org_2"]));
  });

  it("separates per-organization writes for the same deal", () => {
    // One deal closes into TWO sites; each needs its own delivery record.
    expect(key(["deal_9y2k", "org_1"])).not.toBe(key(["deal_9y2k", "org_2"]));
  });

  it("changes when the version is bumped", () => {
    expect(key(["deal_1"], "channel.deal.closed", 1)).not.toBe(key(["deal_1"], "channel.deal.closed", 2));
  });

  it("hashes rather than truncates when the key would overflow", () => {
    const long = key([("d").repeat(80), ("o").repeat(80)]);
    expect(long.length).toBeLessThanOrEqual(IDEMPOTENCY_KEY_MAX);
    expect(long).toContain("channel.deal.closed.v1.h");
  });

  it("keeps overflowing keys distinct instead of colliding them", () => {
    /* The whole point of hashing over truncating: two long inputs sharing a
       prefix must not become the same key, or two deals collide onto one
       ERPNext document. */
    const a = key([("d").repeat(120), "org_1"]);
    const b = key([("d").repeat(120), "org_2"]);
    expect(a).not.toBe(b);
    expect(a.length).toBeLessThanOrEqual(IDEMPOTENCY_KEY_MAX);
    expect(b.length).toBeLessThanOrEqual(IDEMPOTENCY_KEY_MAX);
  });

  it("rejects identifier parts containing unsafe characters", () => {
    expect(() => key(["deal 9y2k"])).toThrow(IdempotencyKeyError);
    expect(() => key(["deal/9y2k"])).toThrow(IdempotencyKeyError);
    expect(() => key(["deal+9y2k"])).toThrow(IdempotencyKeyError);
  });

  it("rejects empty or missing input", () => {
    expect(() => key([])).toThrow(/at least one identifier/);
    expect(() => key([""])).toThrow(/non-empty/);
    expect(() => buildIdempotencyKey({ event: "", version: 1, parts: ["a"] })).toThrow(/event is required/);
  });

  it("rejects a non-positive version", () => {
    expect(() => key(["a"], "e", 0)).toThrow(/positive integer/);
  });
});

describe("payload hashing", () => {
  it("is stable across key ordering", () => {
    // Otherwise a re-serialised payload looks changed and triggers a re-send.
    expect(payloadHash({ a: 1, b: 2 })).toBe(payloadHash({ b: 2, a: 1 }));
  });

  it("changes when a value changes", () => {
    expect(payloadHash({ total: 500000 })).not.toBe(payloadHash({ total: 500001 }));
  });

  it("handles nested objects and arrays deterministically", () => {
    expect(payloadHash({ x: [{ a: 1, b: 2 }] })).toBe(payloadHash({ x: [{ b: 2, a: 1 }] }));
  });

  it("serialises BigInt, which JSON.stringify cannot", () => {
    expect(() => payloadHash({ amount: BigInt(500000) })).not.toThrow();
  });

  it("ignores undefined values so optional fields do not churn the hash", () => {
    expect(payloadHash({ a: 1, b: undefined })).toBe(payloadHash({ a: 1 }));
  });
});
