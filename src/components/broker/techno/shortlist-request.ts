type FetchShortlist = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type ShortlistResult =
  | { ok: true }
  | { ok: false; error: string };

export async function persistShortlist(
  propertyId: string,
  shortlisted: boolean,
  fetchShortlist: FetchShortlist = fetch,
): Promise<ShortlistResult> {
  try {
    const response = await fetchShortlist("/api/broker/technoproperty/shortlist/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ propertyId, shortlisted }),
    });
    const data = await response.json().catch(() => null) as { ok?: boolean } | null;
    if (!response.ok || !data?.ok) {
      return { ok: false, error: "Could not update shortlist. Please try again." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not update shortlist. Check your connection." };
  }
}
