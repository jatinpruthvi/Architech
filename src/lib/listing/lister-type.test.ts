import { describe, expect, it } from "vitest";
import { DEFAULT_LISTER_TYPE, LISTER_TYPE_OPTIONS, attributionLabel, defaultListerTypeForAccount, isListerType, labelForListerType, normalizeListerType } from "./lister-type";

describe("lister type vocabulary", () => {
  it("accepts only the two reviewed codes", () => {
    expect(isListerType("OWNER")).toBe(true);
    expect(isListerType("BROKER")).toBe(true);
    for (const bad of ["owner", "ADMIN", "", null, undefined, 3, {}]) {
      expect(isListerType(bad), String(bad)).toBe(false);
    }
  });

  it("maps the loose spellings the requirement form already uses", () => {
    expect(normalizeListerType("owner")).toBe("OWNER");
    expect(normalizeListerType("  Owner ")).toBe("OWNER");
    expect(normalizeListerType("agent")).toBe("BROKER");
    expect(normalizeListerType("BROKER")).toBe("BROKER");
  });

  it("returns undefined for junk rather than defaulting it", () => {
    /* The caller must be able to tell "absent" from "explicitly owner":
       silently coercing junk to OWNER records a declaration nobody made, and
       this value is shown to buyers. */
    expect(normalizeListerType("banana")).toBeUndefined();
    expect(normalizeListerType(undefined)).toBeUndefined();
    expect(normalizeListerType(null)).toBeUndefined();
  });

  it("defaults an undeclared account to owner, the weaker claim", () => {
    expect(DEFAULT_LISTER_TYPE).toBe("OWNER");
    expect(defaultListerTypeForAccount(undefined)).toBe("OWNER");
    expect(defaultListerTypeForAccount(null)).toBe("OWNER");
    expect(defaultListerTypeForAccount("BROKER")).toBe("BROKER");
  });

  it("labels attribution as declared, never as verified", () => {
    for (const option of LISTER_TYPE_OPTIONS) {
      expect(attributionLabel(option.value)).toMatch(/declared/i);
      expect(attributionLabel(option.value)).not.toMatch(/verified|confirmed/i);
      expect(labelForListerType(option.value)).toBeTruthy();
    }
  });
});
