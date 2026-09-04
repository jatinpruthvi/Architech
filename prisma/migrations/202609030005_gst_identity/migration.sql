-- GST identity for brokerages that invoice through ERPNext.
--
-- Verified against india-compliance v16.9.0 (071b544).
--
-- WHY: a brokerage receiving a commission invoice needs a GSTIN, and India
-- Compliance validates it hard. Two of its checks bite us:
--
--   1. gst_india/overrides/address.py:88
--        if doc.state not in STATE_NUMBERS: frappe.throw(...)
--      An unrecognised state name is a hard write failure. Our LGD spellings
--      differ for four states ("Jammu And Kashmir" vs "Jammu and Kashmir",
--      "Lakshadweep" vs "Lakshadweep Islands", and two more).
--
--   2. gst_india/overrides/address.py:97
--        if doc.gstin and doc.gst_state_number != doc.gstin[:2]: frappe.throw(...)
--      The GSTIN prefix must equal the GST state code.
--
-- CRITICALLY: the GST state code is NOT the LGD state code. Twelve differ, and
-- three collide in a way that fails silently rather than loudly:
--
--        Andhra Pradesh   LGD 28   GST 37
--        Ladakh           LGD 37   GST 38
--        Dadra & Nagar..  LGD 38   GST 26
--
-- LGD 37 is Ladakh but GST 37 is Andhra Pradesh, so passing an LGD code where
-- a GST code is expected files against the wrong state without any error. On a
-- tax document that is a compliance incident. Translation is explicit, in
-- lib/interop/india-state-mapping.ts, and never derived by arithmetic or
-- zero-padding.

ALTER TABLE "BrokerOrganization"
    -- 15 chars exactly: [0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}
    ADD COLUMN "gstin" VARCHAR(15),
    -- LGD state name; the key into the interop mapping. Not the ERPNext name.
    ADD COLUMN "registeredStateLgd" TEXT;

-- A GSTIN is unique per registered entity nationally. Partial index so the many
-- brokerages without one do not collide on NULL.
CREATE UNIQUE INDEX "BrokerOrganization_gstin_key"
    ON "BrokerOrganization" ("gstin")
    WHERE "gstin" IS NOT NULL;
