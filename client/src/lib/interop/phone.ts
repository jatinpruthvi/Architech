/* E.164 phone normalisation for cross-system identity resolution.

   WHY THIS IS LOAD-BEARING, not cosmetic:

   ERPNext resolves whether a contact already exists by EXACT STRING MATCH on
   the phone column. From erpnext/crm/frappe_crm_api.py:115 at v16.34.1:

       def contact_exists(email, mobile_no):
           mobile_exist = frappe.db.exists("Contact Phone", {"phone": mobile_no})

   There is no normalisation on the receiving side. `Contact Phone.phone` is a
   plain `Data` column. So "+91 98765 43210", "9876543210" and "+919876543210"
   are three different contacts to ERPNext, and the same human being will be
   duplicated across Customer/Contact/Prospect records — silently, and in a
   system that then issues invoices against those records.

   Frappe CRM has the same property: `CRM Lead.mobile_no` is `Data` with an
   options hint of "Phone", which affects UI rendering only, not storage.

   Therefore the canonical format must be decided HERE, on our side, before any
   value crosses the boundary. We store E.164 (+919876543210: no spaces, no
   punctuation, leading +, country code) because it is unambiguous, it is what
   `wa.me` links require, and it is stable under round-tripping.

   This module deliberately does NOT depend on libphonenumber. India is the only
   market in scope, the rules below are the published NTP numbering plan, and a
   500 KB metadata dependency for one country code is not a good trade. If the
   product expands beyond India, replace the internals here and leave callers
   untouched -- that is the point of routing everything through one function. */

/** India country calling code. */
export const INDIA_COUNTRY_CODE = "91";

/* Indian mobile numbers are 10 digits and, per the National Numbering Plan,
   begin with 6, 7, 8 or 9. Landlines and service codes do not, and are not
   valid WhatsApp/SMS destinations, so we reject them rather than storing a
   number no channel can reach. */
const INDIA_MOBILE_PATTERN = /^[6-9]\d{9}$/;

export type PhoneNormalizationResult =
  | { ok: true; e164: string; national: string; last4: string }
  | { ok: false; reason: string };

/* Normalise a user-entered Indian phone number to E.164.

   Accepts the shapes real users and real spreadsheets actually produce:
   "9876543210", "+91 98765 43210", "091-9876543210", "0 98765 43210",
   "+919876543210". Rejects anything that is not a reachable Indian mobile. */
export function normalizeIndianPhone(raw: string | null | undefined): PhoneNormalizationResult {
  if (raw === null || raw === undefined) return { ok: false, reason: "Phone number is required." };

  // Strip everything except digits and a leading +. Users paste numbers with
  // spaces, hyphens, parentheses and non-breaking spaces from PDFs.
  const trimmed = String(raw).trim();
  if (trimmed === "") return { ok: false, reason: "Phone number is required." };

  let digits = trimmed.replace(/[^\d]/g, "");

  /* Strip the country code and trunk prefixes, in a deliberate order:

     "919876543210"  -> country code prefix (12 digits)
     "09876543210"   -> domestic trunk '0' (11 digits)
     "0919876543210" -> trunk then country code (13 digits)

     Order matters: check the longest form first, otherwise "0919..." loses its
     leading 0 and then fails the country-code test. */
  if (digits.length === 13 && digits.startsWith(`0${INDIA_COUNTRY_CODE}`)) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith(INDIA_COUNTRY_CODE)) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);

  if (digits.length !== 10) {
    return { ok: false, reason: `Expected a 10-digit Indian mobile number, received ${digits.length} digits.` };
  }
  if (!INDIA_MOBILE_PATTERN.test(digits)) {
    return { ok: false, reason: "Indian mobile numbers start with 6, 7, 8 or 9." };
  }

  return {
    ok: true,
    e164: `+${INDIA_COUNTRY_CODE}${digits}`,
    national: digits,
    last4: digits.slice(-4),
  };
}

/** Throwing variant for write paths that have already validated input. */
export function toE164OrThrow(raw: string, field = "phone"): string {
  const result = normalizeIndianPhone(raw);
  if (!result.ok) throw new Error(`${field}: ${result.reason}`);
  return result.e164;
}

/* Build a wa.me link.

   wa.me requires digits only -- no '+', no spaces. Passing an E.164 string with
   the plus produces a broken link that silently fails to open a chat, which is
   the kind of defect that only shows up in front of a customer. */
export function waMeLink(e164: string): string {
  const digits = e164.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}`;
}

/** Build a tel: link for the native dialer. */
export function telLink(e164: string): string {
  return `tel:${e164}`;
}

/** Display mask. Never send this across a system boundary as an identifier. */
export function maskE164(e164: string): string {
  const digits = e164.replace(/[^\d]/g, "");
  if (digits.length < 4) return "••••";
  return `+${INDIA_COUNTRY_CODE} ••••• ${digits.slice(-5)}`;
}
