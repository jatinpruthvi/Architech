import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getEvolutionProvider } from "./evolution";
import { WhatsAppProviderError } from "./provider";

const env = () => {
  vi.stubEnv("ARCHITECH_WHATSAPP_ENABLED", "true");
  vi.stubEnv("ARCHITECH_EVOLUTION_API_URL", "http://evolution.test/");
  vi.stubEnv("ARCHITECH_EVOLUTION_API_KEY", "global-secret");
};

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("server-only Evolution provider", () => {
  it("uses only the pinned operation paths and allowlists returned data", async () => {
    env();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ instance: { instanceId: "provider-1", status: "connecting" }, hash: "DO_NOT_RETURN", token: "DO_NOT_RETURN" }))
      .mockResolvedValueOnce(jsonResponse({ state: "connecting", base64: "data:image/png;base64,QR_PAYLOAD", apikey: "DO_NOT_RETURN" }))
      .mockResolvedValueOnce(jsonResponse({ instance: "wa_org_1", state: "open", apikey: "DO_NOT_RETURN" }))
      .mockResolvedValueOnce(jsonResponse({ key: { id: "message-1" }, hash: "DO_NOT_RETURN", apikey: "DO_NOT_RETURN" }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = getEvolutionProvider();

    const created = await provider.createInstance({ instanceName: "wa_org_1", webhookUrl: "https://architech.test/webhook", webhookJwtKey: "jwt-secret", events: ["QRCODE_UPDATED", "CONNECTION_UPDATE", "SEND_MESSAGE", "SEND_MESSAGE_UPDATE"] });
    expect(created).toEqual({ providerInstanceId: "provider-1", state: "connecting" });
    expect(created).not.toHaveProperty("hash");

    const qr = await provider.getQr({ instanceName: "wa_org_1" });
    expect(qr).toEqual({ state: "connecting", qrDataUrl: "data:image/png;base64,QR_PAYLOAD" });
    const state = await provider.getConnectionState({ instanceName: "wa_org_1" });
    expect(state).toEqual({ state: "open" });
    const sent = await provider.sendText({ instanceName: "wa_org_1", number: "919876543210", text: "Hi Asha" });
    expect(sent).toEqual({ providerMessageId: "message-1" });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://evolution.test/instance/create", expect.objectContaining({ method: "POST", headers: expect.objectContaining({ apikey: "global-secret", "Content-Type": "application/json" }) }));
    const createInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(createInit.body))).toEqual(expect.objectContaining({
      instanceName: "wa_org_1",
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      webhook: expect.objectContaining({ url: "https://architech.test/webhook", byEvents: false, base64: false, headers: { jwt_key: "jwt-secret" } }),
    }));
    expect(JSON.parse(String((fetchMock.mock.calls[3]?.[1] as RequestInit).body)).text).toBe("Hi Asha");
    expect(JSON.parse(String((fetchMock.mock.calls[3]?.[1] as RequestInit).body)).number).toBe("919876543210");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "http://evolution.test/instance/create",
      "http://evolution.test/instance/connect/wa_org_1",
      "http://evolution.test/instance/connectionState/wa_org_1",
      "http://evolution.test/message/sendText/wa_org_1",
    ]);
  });

  it("classifies provider auth/not-found errors as definitive and transport errors as ambiguous", async () => {
    env();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("secret body", { status: 401 }))
      .mockResolvedValueOnce(new Response("secret body", { status: 404 }))
      .mockRejectedValueOnce(Object.assign(new Error("socket details with api key"), { name: "AbortError" }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = getEvolutionProvider();

    await expect(provider.createInstance({ instanceName: "wa_org_1", webhookUrl: "https://architech.test/webhook", webhookJwtKey: "jwt-secret", events: [] })).rejects.toMatchObject({ kind: "DEFINITIVE", code: "PROVIDER_AUTH" });
    await expect(provider.getConnectionState({ instanceName: "wa_org_1" })).rejects.toMatchObject({ kind: "DEFINITIVE", code: "INSTANCE_NOT_FOUND" });
    await expect(provider.sendText({ instanceName: "wa_org_1", number: "919876543210", text: "Hi" })).rejects.toMatchObject({ kind: "AMBIGUOUS", code: "PROVIDER_TIMEOUT" });
    await expect(provider.sendText({ instanceName: "wa_org_1", number: "919876543210", text: "Hi" })).rejects.toBeInstanceOf(WhatsAppProviderError);
  });

  it("never accepts an HTTP success without a provider message id", async () => {
    env();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: "success", hash: "DO_NOT_RETURN" })));
    await expect(getEvolutionProvider().sendText({ instanceName: "wa_org_1", number: "919876543210", text: "Hi" })).rejects.toMatchObject({ kind: "AMBIGUOUS", code: "PROVIDER_NO_MESSAGE_ID" });
  });
});
