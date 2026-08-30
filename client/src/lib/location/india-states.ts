import snapshot from "../../../../data/location/official/lgd-state-ut-2026-08-30.json";

export type IndiaStateOrUt = {
  lgdCode: string;
  name: string;
  nativeName: string;
  kind: "STATE" | "UT";
  census2001Code: string | null;
  census2011Code: string | null;
  slug: string;
};

export const INDIA_STATE_REGISTRY_SOURCE = {
  schemaVersion: snapshot.schemaVersion,
  publisher: snapshot.publisher,
  datasetName: snapshot.datasetName,
  sourceUrl: snapshot.sourceUrl,
  catalogUrl: snapshot.catalogUrl,
  licenseName: snapshot.licenseName,
  licenseUrl: snapshot.licenseUrl,
  retrievedAt: snapshot.retrievedAt,
  attribution: snapshot.attribution,
} as const;

export function locationSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const INDIA_STATES_AND_UTS: IndiaStateOrUt[] = snapshot.records
  .map((record) => ({ ...record, kind: record.kind as "STATE" | "UT", slug: locationSlug(record.name) }))
  .sort((left, right) => left.name.localeCompare(right.name, "en-IN"));

const byCode = new Map(INDIA_STATES_AND_UTS.map((entry) => [entry.lgdCode, entry]));
const byName = new Map<string, IndiaStateOrUt>();

function normalizedStateName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/\bTHE\b/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

for (const entry of INDIA_STATES_AND_UTS) {
  for (const label of [entry.name, entry.nativeName]) {
    const normalized = normalizedStateName(label);
    if (normalized) byName.set(normalized, entry);
  }
}

const historicAliases: Record<string, string> = {
  ORISSA: "21",
  CHATTISGARH: "22",
  UTTARANCHAL: "5",
  PONDICHERRY: "34",
  "NCT OF DELHI": "7",
  "JAMMU KASHMIR": "1",
  "ANDAMAN NICOBAR ISLANDS": "35",
  "DADRA NAGAR HAVELI DAMAN DIU": "38",
  "DADRA AND NAGAR HAVELI": "38",
  "DAMAN AND DIU": "38",
};
for (const [alias, code] of Object.entries(historicAliases)) {
  const entry = byCode.get(code);
  if (entry) byName.set(normalizedStateName(alias), entry);
}

export function indiaStateByLgdCode(code: string | number) {
  return byCode.get(String(Number(code)));
}

/** Resolve only an explicit state/UT label. This never guesses from a PIN prefix. */
export function resolveIndiaStateName(value: string) {
  return byName.get(normalizedStateName(value));
}
