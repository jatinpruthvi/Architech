import { describe, expect, it } from "vitest";
import { isPublicIndexingEnabled, publicRobots } from "./runtime";

describe("public indexability runtime gate", () => {
  it("allows preview and test environments to render crawlable fixtures", () => {
    expect(isPublicIndexingEnabled({ NODE_ENV: "test" })).toBe(true);
  });

  it("blocks production indexing until explicitly enabled", () => {
    expect(isPublicIndexingEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(publicRobots(true, { NODE_ENV: "production" })).toEqual({ index: false, follow: false });
  });

  it("allows production indexing only with the explicit flag", () => {
    const env = { NODE_ENV: "production", PUBLIC_INDEXING_ENABLED: "true" };
    expect(isPublicIndexingEnabled(env)).toBe(true);
    expect(publicRobots(true, env)).toEqual({ index: true, follow: true });
  });
});
