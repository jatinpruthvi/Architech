import { describe, expect, it } from "vitest";
import { INDIA_STATES_AND_UTS, indiaStateByLgdCode, resolveIndiaStateName } from "./india-states";

describe("official LGD state/UT registry", () => {
  it("contains the current 28 states and 8 Union Territories exactly once", () => {
    expect(INDIA_STATES_AND_UTS).toHaveLength(36);
    expect(new Set(INDIA_STATES_AND_UTS.map((entry) => entry.lgdCode)).size).toBe(36);
    expect(INDIA_STATES_AND_UTS.filter((entry) => entry.kind === "STATE")).toHaveLength(28);
    expect(INDIA_STATES_AND_UTS.filter((entry) => entry.kind === "UT")).toHaveLength(8);
  });

  it("uses LGD codes as administrative identities", () => {
    expect(indiaStateByLgdCode(24)?.name).toBe("Gujarat");
    expect(indiaStateByLgdCode("29")?.name).toBe("Karnataka");
    expect(indiaStateByLgdCode("999")).toBeUndefined();
  });

  it("normalizes known postal and historic state labels without PIN-prefix guessing", () => {
    expect(resolveIndiaStateName("JAMMU & KASHMIR")?.lgdCode).toBe("1");
    expect(resolveIndiaStateName("Orissa")?.lgdCode).toBe("21");
    expect(resolveIndiaStateName("Chattisgarh")?.name).toBe("Chhattisgarh");
    expect(resolveIndiaStateName("The Dadra And Nagar Haveli And Daman And Diu")?.lgdCode).toBe("38");
    expect(resolveIndiaStateName("unknown")).toBeUndefined();
  });
});
