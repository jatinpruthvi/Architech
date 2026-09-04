import { describe, expect, it } from "vitest";
import lgdSnapshot from "../../../../data/location/official/lgd-state-ut-2026-08-30.json";
import {
  GSTIN_FORMAT,
  PINCODE_FORMAT,
  StateMappingError,
  allIndiaStateInterop,
  gstinMatchesState,
  isValidGstin,
  lookupIndiaState,
  toErpnextState,
} from "./india-state-mapping";

type LgdRecord = { lgdCode: string; name: string };
const lgdRecords = (lgdSnapshot as { records: LgdRecord[] }).records;

describe("LGD to ERPNext state mapping", () => {
  it("covers every state in our LGD registry, with no gaps", () => {
    /* A missing entry is a runtime frappe.throw on the ERPNext side, so this
       must be exhaustive rather than best-effort. */
    const unmapped = lgdRecords.filter((record) => !lookupIndiaState(record.name));
    expect(unmapped.map((r) => r.name)).toEqual([]);
  });

  it("agrees with the LGD snapshot on every code", () => {
    // Guards against the mapping drifting from the registry it describes.
    for (const record of lgdRecords) {
      expect(lookupIndiaState(record.name)?.lgdCode).toBe(record.lgdCode);
    }
  });

  it("has no duplicate GST state codes", () => {
    const codes = allIndiaStateInterop().map((s) => s.gstStateCode);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("renames the four states India Compliance spells differently", () => {
    expect(toErpnextState("Andaman And Nicobar Islands").erpnextState).toBe("Andaman and Nicobar Islands");
    expect(toErpnextState("Jammu And Kashmir").erpnextState).toBe("Jammu and Kashmir");
    expect(toErpnextState("Lakshadweep").erpnextState).toBe("Lakshadweep Islands");
    expect(toErpnextState("The Dadra And Nagar Haveli And Daman And Diu").erpnextState).toBe(
      "Dadra and Nagar Haveli and Daman and Diu",
    );
  });

  /* The three cases where an LGD code is a VALID but WRONG GST code. Using the
     LGD number would not error -- it would file against another state. */
  it("does not confuse LGD codes with GST state codes", () => {
    const ap = toErpnextState("Andhra Pradesh");
    expect(ap.lgdCode).toBe("28");
    expect(ap.gstStateCode).toBe("37");

    const ladakh = toErpnextState("Ladakh");
    expect(ladakh.lgdCode).toBe("37"); // LGD 37 is Ladakh...
    expect(ladakh.gstStateCode).toBe("38");

    // ...but GST 37 is Andhra Pradesh. The collision, asserted explicitly.
    expect(ap.gstStateCode).toBe(ladakh.lgdCode);

    const dnh = toErpnextState("The Dadra And Nagar Haveli And Daman And Diu");
    expect(dnh.lgdCode).toBe("38");
    expect(dnh.gstStateCode).toBe("26");
  });

  it("keeps the leading zero that LGD codes drop", () => {
    // "4" and "04" are different strings; GSTIN comparison is a string compare.
    expect(toErpnextState("Chandigarh").lgdCode).toBe("4");
    expect(toErpnextState("Chandigarh").gstStateCode).toBe("04");
    for (const name of ["Delhi", "Haryana", "Punjab", "Rajasthan", "Uttarakhand", "Uttar Pradesh"]) {
      expect(toErpnextState(name).gstStateCode).toHaveLength(2);
    }
  });

  it("maps Gujarat, the launch market, correctly end to end", () => {
    const gujarat = toErpnextState("Gujarat");
    expect(gujarat).toEqual({
      lgdCode: "24",
      lgdName: "Gujarat",
      erpnextState: "Gujarat",
      gstStateCode: "24",
    });
  });

  it("throws a naming error for an unmapped state rather than sending it", () => {
    expect(() => toErpnextState("Bombay")).toThrow(StateMappingError);
    expect(() => toErpnextState("Bombay")).toThrow(/Bombay/);
  });
});

describe("GSTIN validation against state", () => {
  it("accepts a GSTIN whose prefix matches the state", () => {
    expect(gstinMatchesState("24AAACC1206D1ZM", "Gujarat")).toBe(true);
  });

  it("rejects a GSTIN issued in a different state", () => {
    // India Compliance throws on this exact condition; catch it before sending.
    expect(gstinMatchesState("27AAACC1206D1ZM", "Gujarat")).toBe(false);
  });

  it("uses the GST code, not the LGD code, when they differ", () => {
    // Andhra Pradesh: GST 37, LGD 28. A GSTIN starts with 37.
    expect(gstinMatchesState("37AAACC1206D1ZM", "Andhra Pradesh")).toBe(true);
    expect(gstinMatchesState("28AAACC1206D1ZM", "Andhra Pradesh")).toBe(false);
  });

  it("rejects an unknown state and a truncated GSTIN", () => {
    expect(gstinMatchesState("24AAACC1206D1ZM", "Bombay")).toBe(false);
    expect(gstinMatchesState("2", "Gujarat")).toBe(false);
  });

  it("matches the upstream GSTIN and PIN formats", () => {
    expect(isValidGstin("24AAACC1206D1ZM")).toBe(true);
    expect(isValidGstin("24aaacc1206d1zm")).toBe(false);
    expect(GSTIN_FORMAT.test("24AAACC1206D10M")).toBe(false); // 'Z' is fixed
    expect(PINCODE_FORMAT.test("380015")).toBe(true);
    expect(PINCODE_FORMAT.test("080015")).toBe(false); // cannot start with 0
  });
});
