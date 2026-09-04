/* Map Architech (LGD) state identity to ERPNext / India Compliance state identity.

   WHY THIS MODULE EXISTS

   We store states from the Government of India's LGD registry, which is the
   correct authority for addresses and locality data. ERPNext with the India
   Compliance app uses a DIFFERENT vocabulary, and it is strict about it.

   From india-compliance v16.9.0,
   india_compliance/gst_india/overrides/address.py:88:

       if doc.state not in STATE_NUMBERS:
           frappe.throw(_("Please select a valid State from available options"))

   That is a hard write failure, not a warning. Any Address we create with an
   LGD-spelled state is rejected outright.

   THE TWO MISMATCHES

   1. SPELLING. LGD writes "And" capitalised and uses different official names.
      Four of our 36 records fail an exact-match check:

        LGD                                            India Compliance
        "Andaman And Nicobar Islands"               -> "Andaman and Nicobar Islands"
        "Jammu And Kashmir"                         -> "Jammu and Kashmir"
        "Lakshadweep"                               -> "Lakshadweep Islands"
        "The Dadra And Nagar Haveli And Daman And Diu"
                                                    -> "Dadra and Nagar Haveli and Daman and Diu"

   2. NUMBERING -- the dangerous one. An LGD state code is NOT a GST state code.
      They agree for most states, which is exactly what makes it dangerous: it
      looks like it works until it silently does not. Twelve differ, including
      three where BOTH are valid two-digit codes pointing at different states:

        Andhra Pradesh    LGD 28   GST 37
        Ladakh            LGD 37   GST 38
        Dadra & Nagar...  LGD 38   GST 26

      Note the collision: LGD 37 is Ladakh, but GST 37 is Andhra Pradesh. Using
      an LGD code where a GST code is expected does not error -- it silently
      files against the wrong state. On a tax document that is a compliance
      incident, not a bug report.

      The remaining nine differ only by a leading zero (LGD "4" vs GST "04"),
      which string comparison also gets wrong.

   Nothing may derive a GST state code from an LGD code by arithmetic or
   zero-padding. The mapping below is explicit for every state, and the tests
   assert the three genuinely-conflicting cases by name. */

export type IndiaStateInterop = {
  /** LGD code as published by the Government of India. Our internal identity. */
  lgdCode: string;
  /** Our stored LGD name. */
  lgdName: string;
  /** Exact string India Compliance's STATE_NUMBERS dict requires. */
  erpnextState: string;
  /** GST state code: the first two digits of a GSTIN issued in this state. */
  gstStateCode: string;
};

/* Keyed by LGD name exactly as it appears in
   data/location/official/lgd-state-ut-2026-08-30.json. Verified against
   india-compliance v16.9.0 (071b544) STATE_NUMBERS. */
const BY_LGD_NAME: Record<string, IndiaStateInterop> = {
  "Andaman And Nicobar Islands": { lgdCode: "35", lgdName: "Andaman And Nicobar Islands", erpnextState: "Andaman and Nicobar Islands", gstStateCode: "35" },
  "Andhra Pradesh": { lgdCode: "28", lgdName: "Andhra Pradesh", erpnextState: "Andhra Pradesh", gstStateCode: "37" },
  "Arunachal Pradesh": { lgdCode: "12", lgdName: "Arunachal Pradesh", erpnextState: "Arunachal Pradesh", gstStateCode: "12" },
  Assam: { lgdCode: "18", lgdName: "Assam", erpnextState: "Assam", gstStateCode: "18" },
  Bihar: { lgdCode: "10", lgdName: "Bihar", erpnextState: "Bihar", gstStateCode: "10" },
  Chandigarh: { lgdCode: "4", lgdName: "Chandigarh", erpnextState: "Chandigarh", gstStateCode: "04" },
  Chhattisgarh: { lgdCode: "22", lgdName: "Chhattisgarh", erpnextState: "Chhattisgarh", gstStateCode: "22" },
  Delhi: { lgdCode: "7", lgdName: "Delhi", erpnextState: "Delhi", gstStateCode: "07" },
  Goa: { lgdCode: "30", lgdName: "Goa", erpnextState: "Goa", gstStateCode: "30" },
  Gujarat: { lgdCode: "24", lgdName: "Gujarat", erpnextState: "Gujarat", gstStateCode: "24" },
  Haryana: { lgdCode: "6", lgdName: "Haryana", erpnextState: "Haryana", gstStateCode: "06" },
  "Himachal Pradesh": { lgdCode: "2", lgdName: "Himachal Pradesh", erpnextState: "Himachal Pradesh", gstStateCode: "02" },
  "Jammu And Kashmir": { lgdCode: "1", lgdName: "Jammu And Kashmir", erpnextState: "Jammu and Kashmir", gstStateCode: "01" },
  Jharkhand: { lgdCode: "20", lgdName: "Jharkhand", erpnextState: "Jharkhand", gstStateCode: "20" },
  Karnataka: { lgdCode: "29", lgdName: "Karnataka", erpnextState: "Karnataka", gstStateCode: "29" },
  Kerala: { lgdCode: "32", lgdName: "Kerala", erpnextState: "Kerala", gstStateCode: "32" },
  Ladakh: { lgdCode: "37", lgdName: "Ladakh", erpnextState: "Ladakh", gstStateCode: "38" },
  Lakshadweep: { lgdCode: "31", lgdName: "Lakshadweep", erpnextState: "Lakshadweep Islands", gstStateCode: "31" },
  "Madhya Pradesh": { lgdCode: "23", lgdName: "Madhya Pradesh", erpnextState: "Madhya Pradesh", gstStateCode: "23" },
  Maharashtra: { lgdCode: "27", lgdName: "Maharashtra", erpnextState: "Maharashtra", gstStateCode: "27" },
  Manipur: { lgdCode: "14", lgdName: "Manipur", erpnextState: "Manipur", gstStateCode: "14" },
  Meghalaya: { lgdCode: "17", lgdName: "Meghalaya", erpnextState: "Meghalaya", gstStateCode: "17" },
  Mizoram: { lgdCode: "15", lgdName: "Mizoram", erpnextState: "Mizoram", gstStateCode: "15" },
  Nagaland: { lgdCode: "13", lgdName: "Nagaland", erpnextState: "Nagaland", gstStateCode: "13" },
  Odisha: { lgdCode: "21", lgdName: "Odisha", erpnextState: "Odisha", gstStateCode: "21" },
  Puducherry: { lgdCode: "34", lgdName: "Puducherry", erpnextState: "Puducherry", gstStateCode: "34" },
  Punjab: { lgdCode: "3", lgdName: "Punjab", erpnextState: "Punjab", gstStateCode: "03" },
  Rajasthan: { lgdCode: "8", lgdName: "Rajasthan", erpnextState: "Rajasthan", gstStateCode: "08" },
  Sikkim: { lgdCode: "11", lgdName: "Sikkim", erpnextState: "Sikkim", gstStateCode: "11" },
  "Tamil Nadu": { lgdCode: "33", lgdName: "Tamil Nadu", erpnextState: "Tamil Nadu", gstStateCode: "33" },
  Telangana: { lgdCode: "36", lgdName: "Telangana", erpnextState: "Telangana", gstStateCode: "36" },
  "The Dadra And Nagar Haveli And Daman And Diu": { lgdCode: "38", lgdName: "The Dadra And Nagar Haveli And Daman And Diu", erpnextState: "Dadra and Nagar Haveli and Daman and Diu", gstStateCode: "26" },
  Tripura: { lgdCode: "16", lgdName: "Tripura", erpnextState: "Tripura", gstStateCode: "16" },
  "Uttar Pradesh": { lgdCode: "9", lgdName: "Uttar Pradesh", erpnextState: "Uttar Pradesh", gstStateCode: "09" },
  Uttarakhand: { lgdCode: "5", lgdName: "Uttarakhand", erpnextState: "Uttarakhand", gstStateCode: "05" },
  "West Bengal": { lgdCode: "19", lgdName: "West Bengal", erpnextState: "West Bengal", gstStateCode: "19" },
};

export class StateMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StateMappingError";
  }
}

/** Every mapped state. */
export function allIndiaStateInterop(): IndiaStateInterop[] {
  return Object.values(BY_LGD_NAME);
}

/* Resolve an LGD state name to its ERPNext identity.

   Returns undefined rather than throwing so callers can decide: a read path may
   degrade, but a write path crossing into ERPNext must use the throwing form. */
export function lookupIndiaState(lgdName: string): IndiaStateInterop | undefined {
  return BY_LGD_NAME[lgdName];
}

/* Resolve for a write that will cross into ERPNext.

   Throws on an unmapped state, because the alternative is India Compliance
   throwing on its side with a message that does not say which of our records
   caused it. Failing here names the value. */
export function toErpnextState(lgdName: string): IndiaStateInterop {
  const mapped = BY_LGD_NAME[lgdName];
  if (!mapped) {
    throw new StateMappingError(
      `No ERPNext state mapping for LGD state ${JSON.stringify(lgdName)}. ` +
        `India Compliance rejects unrecognised state names, so this address cannot be synced.`,
    );
  }
  return mapped;
}

/* Check that a GSTIN's embedded state code agrees with the address state.

   India Compliance performs this exact check on save
   (gst_india/overrides/address.py:97) and throws when they disagree. Running it
   before we send avoids a round trip that can only fail. */
export function gstinMatchesState(gstin: string, lgdName: string): boolean {
  const mapped = BY_LGD_NAME[lgdName];
  if (!mapped || gstin.length < 2) return false;
  return gstin.slice(0, 2) === mapped.gstStateCode;
}

/** GSTIN format required by India Compliance (constants/__init__.py:1461). */
export const GSTIN_FORMAT = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/** Indian PIN code format required by India Compliance (PINCODE_FORMAT). */
export const PINCODE_FORMAT = /^[1-9][0-9]{5}$/;

export function isValidGstin(value: string): boolean {
  return GSTIN_FORMAT.test(value);
}
