import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "BrokerChannelPanel.tsx"), "utf8");

describe("BrokerChannelPanel UI contracts", () => {
  it("keeps broker channel workflow componentized away from AgentWorkspace", () => {
    expect(source).toContain("export function BrokerChannelPanel");
    expect(source).toContain('type BrokerChannelTab = "publish" | "matches" | "deals" | "notifications" | "maintenance"');
  });

  it("uses explicit request type fields so each publish card submits the right channel request", () => {
    expect(source).toContain('name="requestType" value="SUPPLY"');
    expect(source).toContain('name="requestType" value="DEMAND"');
    expect(source).toContain('const selectedType = String(form.get("requestType") || draftType) === "DEMAND" ? "DEMAND" : "SUPPLY"');
  });

  it("guards the UI against common invalid broker-channel submissions", () => {
    expect(source).toContain("Create a listing first, then choose it to generate a broker-channel supply request.");
    expect(source).toContain("Enter a valid area range before saving requirement-backed demand.");
    expect(source).toContain("Enter a valid budget range before saving requirement-backed demand.");
    expect(source).toContain("Demand + supply shares must equal total commission");
  });

  it("keeps match, notification, and maintenance operations discoverable", () => {
    expect(source).toContain("Top 10 deterministic matches");
    expect(source).toContain("Broker business contact");
    expect(source).toContain("Mark all read");
    expect(source).toContain("Expire stale requests");
    expect(source).toContain("Sync ERPNext closes");
  });
});
