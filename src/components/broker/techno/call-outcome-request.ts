type FetchOutcome = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type CallOutcomeResult =
  | { ok: true }
  | { ok: false; error: string };

export async function persistCallOutcome(
  propertyId: string,
  outcome: string,
  fetchOutcome: FetchOutcome = fetch,
): Promise<CallOutcomeResult> {
  try {
    const response = await fetchOutcome("/api/broker/technoproperty/call-outcome/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ propertyId, outcome }),
    });
    const data = await response.json().catch(() => null) as { ok?: boolean } | null;
    if (!response.ok || !data?.ok) {
      return { ok: false, error: "Could not save outcome. Please try again." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not save outcome. Check your connection." };
  }
}
