/**
 * P1.4 (cost-reduction-audit): the `--states` selector for the location
 * importers.
 *
 * The national OGD snapshots are complete by design — the completeness
 * checks refuse a truncated snapshot. But the OLTP database does not need
 * every state: Architech operates from Gujarat, and importing 150k+ rows for
 * 36 states/UTs into the listings database buys nothing but backup size.
 * The raw snapshot stays whole (in R2, see r2-upload.mjs); only the
 * requested states' rows are imported.
 *
 * The selector accepts official LGD state names (case/diacritic-insensitive,
 * alias-aware — "Orissa" resolves like "Odisha") or LGD codes ("24"),
 * comma-separated. Anything unknown is an error: a silent no-op filter would
 * import nothing and look like success.
 */
import { officialStateForName, officialStatesByCode } from "./india-state-registry.mjs";

/**
 * Resolve a `--states` value into a Set of official LGD state codes.
 * Returns `null` for an empty/absent selector (no filtering).
 */
export function resolveStateFilter(spec) {
  if (spec === undefined || spec === null) return null;
  const text = String(spec).trim();
  if (text === "") return null;
  const codes = new Set();
  const unknown = [];
  for (const part of text.split(",").map((value) => value.trim()).filter(Boolean)) {
    if (/^\d+$/.test(part)) {
      const record = officialStatesByCode.get(part);
      if (!record) unknown.push(part);
      else codes.add(record.lgdCode);
    } else {
      const record = officialStateForName(part);
      if (!record) unknown.push(part);
      else codes.add(record.lgdCode);
    }
  }
  if (unknown.length) throw new Error(`Unknown state(s) in --states: ${unknown.join(", ")}. Use official LGD names or codes (e.g. "gujarat,27").`);
  if (codes.size === 0) throw new Error("--states resolved to no states.");
  return codes;
}

/**
 * Keep only the rows whose state is in `stateCodes`. `stateCodeOf` adapts the
 * two importers' row shapes (india-post uses `stateLgdCode`, LGD uses
 * `stateCode`). A row with a null state is dropped when filtering — it has
 * no way to prove it belongs to a requested state.
 */
export function filterRowsByStates(rows, stateCodes, stateCodeOf) {
  const kept = rows.filter((row) => {
    const code = stateCodeOf(row);
    return code !== null && code !== undefined && stateCodes.has(code);
  });
  return { kept, dropped: rows.length - kept.length };
}
