/* Panel data loading, and what to do when it fails.
 *
 * Every dashboard panel loads from an API that performs its own server-side
 * authorisation. That means a panel can legitimately receive a 401, 403, a
 * network error, or malformed JSON, and the dashboard must degrade in a way
 * that does not LIE.
 *
 * The distinction that matters, and that this module exists to make explicit:
 *
 *   "empty"       -- the request succeeded and there is genuinely nothing.
 *   "unavailable" -- we could not look.
 *
 * Rendering the second as the first is the bug that shipped in the owner
 * dashboard: a 403 was swallowed, `[]` was returned, and the panel announced
 * "No properties listed yet" to someone who might have had ten. `loadPanel`
 * therefore returns an outcome, never a bare array, so a caller cannot
 * accidentally collapse the two.
 */
export type PanelOutcome<T> =
  | { state: "ok"; items: T[] }
  /** The session may not read this. Render locked, not empty. */
  | { state: "forbidden" }
  /** Network, server, or malformed response. Say so; do not claim emptiness. */
  | { state: "unavailable" };

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Pull the array out of a payload, tolerating a missing or wrong-typed key. */
export function pickArray<T>(payload: unknown, key: string): T[] {
  if (!payload || typeof payload !== "object") return [];
  const value = (payload as Record<string, unknown>)[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

export async function loadPanel<T>(
  url: string,
  key: string,
  fetchImpl: FetchLike = fetch,
): Promise<PanelOutcome<T>> {
  let response: Response;
  try {
    response = await fetchImpl(url, { cache: "no-store", credentials: "same-origin" });
  } catch {
    /* Offline, DNS failure, aborted request. We could not look. */
    return { state: "unavailable" };
  }

  if (response.status === 401 || response.status === 403) return { state: "forbidden" };
  if (!response.ok) return { state: "unavailable" };

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { state: "unavailable" };
  }

  /* A 200 carrying `ok: false` is an application-level failure. Treating it as
     success would render a real error as an empty list. */
  if (payload && typeof payload === "object" && (payload as Record<string, unknown>).ok === false) {
    return { state: "unavailable" };
  }

  return { state: "ok", items: pickArray<T>(payload, key) };
}

/** Items when the load succeeded, otherwise none — for counts and prompts. */
export function itemsOf<T>(outcome: PanelOutcome<T>): T[] {
  return outcome.state === "ok" ? outcome.items : [];
}

/* Whether a panel may show "you have nothing".
 *
 * Only ever true for a successful, genuinely empty response. This is the
 * single guard that stops "we could not look" being rendered as "you have
 * none". */
export function mayClaimEmpty<T>(outcome: PanelOutcome<T>): boolean {
  return outcome.state === "ok" && outcome.items.length === 0;
}
