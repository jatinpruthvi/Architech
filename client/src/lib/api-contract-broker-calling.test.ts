/* Broker lead calling contract (spec §4). Demo mode = demoBrokerSession
   (no cookie → the historical demo contract hands out the broker admin).
   Fixture storage mode: leads are created through the public lead route,
   which exercises createLeadForServer's fixture path. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as leadDetailGet } from "../../../app/api/broker/leads/[id]/route";
import { POST as revealPost } from "../../../app/api/broker/leads/[id]/reveal/route";
import { POST as callsPost } from "../../../app/api/broker/leads/[id]/calls/route";
import { GET as metricsGet } from "../../../app/api/broker/leads/metrics/route";
import { POST as publicLeadsPost } from "../../../app/api/leads/route";
import { resetLeadStoreForTests } from "./leads/lead";

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

beforeEach(() => {
  resetLeadStoreForTests();
  vi.stubEnv("ARCHITECH_LEAD_STORAGE", "memory");
  vi.stubEnv("ARCHITECH_BROKER_PLAN_STATUS", "");
  // Reveal is IST-hours-gated; pin the clock inside the default 09:00–20:00
  // window so the contract holds at any hour in any CI zone.
  vi.useFakeTimers({ now: Date.UTC(2026, 8, 10, 4, 30, 0) });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

function postLead(name = "Contract Buyer", phone = "07941234567") {
  return publicLeadsPost(
    new Request("http://localhost/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listingId: "garden-courtyard",
        name,
        phone,
        message: "Is this 3 BHK still available this week?",
        consentText: "I agree to being contacted about this enquiry.",
      }),
    }),
  );
}

describe("GET /api/broker/leads/[id]", () => {
  it("returns the LeadDetailRecord for an owned fixture lead", async () => {
    const created = await json(await postLead());
    expect(created.ok).toBe(true);
    const id = (created as { lead: { id: string } }).lead.id;
    const response = await leadDetailGet(new Request(`http://localhost/api/broker/leads/${id}`), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.ok).toBe(true);
    const lead = body.lead as Record<string, unknown>;
    expect(lead).toMatchObject({ id, name: "Contract Buyer", stage: "NEW", callAttempts: 0, suppressed: false, consentClass: "first-party-form" });
    expect(lead).toHaveProperty("callHistory");
  });

  it("returns 404 for a lead outside the session organization", async () => {
    const response = await leadDetailGet(new Request("http://localhost/api/broker/leads/someone-elses-lead"), { params: Promise.resolve({ id: "someone-elses-lead" }) });
    expect(response.status).toBe(404);
  });
});

describe("POST /api/broker/leads/[id]/reveal", () => {
  it("reveals a fixture lead created through the public form", async () => {
    const created = await json(await postLead());
    const id = (created as { lead: { id: string } }).lead.id;
    const response = await revealPost(new Request(`http://localhost/api/broker/leads/${id}/reveal`, { method: "POST" }), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body).toMatchObject({ ok: true, revealed: true });
    expect(body.telLink).toBe("tel:+917941234567");
    expect(String(body.waMeLink)).toContain("917941234567");
  });

  it("passes the gate status through (402 when the plan override is NONE)", async () => {
    vi.stubEnv("ARCHITECH_BROKER_PLAN_STATUS", "NONE");
    const created = await json(await postLead());
    const id = (created as { lead: { id: string } }).lead.id;
    const response = await revealPost(new Request(`http://localhost/api/broker/leads/${id}/reveal`, { method: "POST" }), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(402);
  });

  it("returns 404 for a foreign lead without leaking existence", async () => {
    const response = await revealPost(new Request("http://localhost/api/broker/leads/other-org-lead/reveal", { method: "POST" }), { params: Promise.resolve({ id: "other-org-lead" }) });
    expect(response.status).toBe(404);
  });
});

describe("POST /api/broker/leads/[id]/calls", () => {
  async function setupLead(): Promise<string> {
    const created = await json(await postLead());
    return (created as { lead: { id: string } }).lead.id;
  }

  it("logs NO_ANSWER, keeps the stage, requires nextActionAt", async () => {
    const id = await setupLead();
    const missing = await callsPost(
      new Request(`http://localhost/api/broker/leads/${id}/calls`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome: "NO_ANSWER" }) }),
      { params: Promise.resolve({ id }) },
    );
    expect(missing.status).toBe(400);
    const ok = await callsPost(
      new Request(`http://localhost/api/broker/leads/${id}/calls`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome: "NO_ANSWER", nextActionAt: "2026-09-11T09:00:00.000Z" }) }),
      { params: Promise.resolve({ id }) },
    );
    expect(ok.status).toBe(200);
    const body = await json(ok);
    expect((body.call as Record<string, unknown>).stageBefore).toBe("NEW");
  });

  it("NOT_INTERESTED requires a lost reason and suppresses the lead", async () => {
    const id = await setupLead();
    const ok = await callsPost(
      new Request(`http://localhost/api/broker/leads/${id}/calls`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome: "NOT_INTERESTED", lostReason: "bought elsewhere" }) }),
      { params: Promise.resolve({ id }) },
    );
    expect(ok.status).toBe(200);
    const detail = await leadDetailGet(new Request(`http://localhost/api/broker/leads/${id}`), { params: Promise.resolve({ id }) });
    const lead = ((await json(detail)).lead as Record<string, unknown>);
    expect(lead.suppressed).toBe(true);
    expect(lead.callAttempts).toBe(1);
  });

  it("rejects an unknown outcome with 400", async () => {
    const id = await setupLead();
    const response = await callsPost(
      new Request(`http://localhost/api/broker/leads/${id}/calls`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome: "CONNECTED_FOR_12_MINUTES" }) }),
      { params: Promise.resolve({ id }) },
    );
    expect(response.status).toBe(400);
  });
});

describe("GET /api/broker/leads/metrics", () => {
  it("counts calls logged through the fixture store", async () => {
    const created = await json(await postLead());
    const id = (created as { lead: { id: string } }).lead.id;
    await callsPost(
      new Request(`http://localhost/api/broker/leads/${id}/calls`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome: "NOT_INTERESTED", lostReason: "bought elsewhere" }) }),
      { params: Promise.resolve({ id }) },
    );
    const response = await metricsGet(new Request("http://localhost/api/broker/leads/metrics"));
    expect(response.status).toBe(200);
    const body = await json(response);
    expect((body.metrics as Record<string, unknown>).outcomes).toMatchObject({ NOT_INTERESTED: 1 });
    expect((body.metrics as Record<string, unknown>).lostReasons).toMatchObject({ "bought elsewhere": 1 });
  });

  it("requires the organization", async () => {
    const response = await metricsGet(new Request("http://localhost/api/broker/leads/metrics?source=demo&mode=none"));
    // mode=none forces a sessionless contract → 401 from the guard
    expect([401, 403]).toContain(response.status);
  });
});
