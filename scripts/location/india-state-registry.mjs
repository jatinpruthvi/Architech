import { readFileSync } from "node:fs";

export const officialStateSnapshot = JSON.parse(
  readFileSync(new URL("../../data/location/official/lgd-state-ut-2026-08-30.json", import.meta.url), "utf8"),
);

export const officialStatesByCode = new Map(
  officialStateSnapshot.records.map((record) => [record.lgdCode, record]),
);

export function comparableStateName(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/\bTHE\b/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const statesByName = new Map();
for (const state of officialStateSnapshot.records) {
  for (const name of [state.name, state.nativeName]) {
    const normalized = comparableStateName(name);
    if (normalized) statesByName.set(normalized, state);
  }
}

const aliases = {
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
for (const [alias, code] of Object.entries(aliases)) statesByName.set(comparableStateName(alias), officialStatesByCode.get(code));

export function officialStateForName(value) {
  return statesByName.get(comparableStateName(value));
}
