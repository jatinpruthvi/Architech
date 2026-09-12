import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "BrokerWhatsAppPanel.tsx"), "utf8");

describe("BrokerWhatsAppPanel UI contract", () => {
  it("uses only Architech routes and exposes the focused connection/template/status experience", () => {
    expect(source).toContain("export function BrokerWhatsAppPanel");
    expect(source).toContain('fetch("/api/broker/whatsapp"');
    expect(source).toContain('fetch("/api/broker/whatsapp/connect"');
    expect(source).toContain('fetch("/api/broker/whatsapp/qr"');
    expect(source).toContain('fetch("/api/broker/whatsapp/status"');
    expect(source).toContain('fetch("/api/broker/whatsapp/template"');
  });

  it("keeps company ownership and Linked devices instructions explicit", () => {
    expect(source).toContain("owned and controlled by the broker company");
    expect(source).toContain("WhatsApp Linked devices");
    expect(source).toContain("Settings → Linked devices → Link a device");
    expect(source).toContain("Server-shared preview");
  });

  it("labels every connection and safety state without exposing provider internals", () => {
    for (const label of ["PROVISIONING", "QR_READY", "CONNECTING", "CONNECTED", "DISCONNECTED", "ERROR", "PROVIDER_DISABLED", "NO_ACTIVE_PLAN", "QR_EXPIRED", "EMPTY_TEMPLATE"]) {
      expect(source).toContain(label);
    }
    for (const forbidden of ["localhost", "127.0.0.1", "apikey", "jwt", "hash", "instanceName", "logout", "pause", "delete"]) {
      expect(source.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});
