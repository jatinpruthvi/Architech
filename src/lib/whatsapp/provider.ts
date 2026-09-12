export type WhatsAppProvider = {
  createInstance(input: {
    instanceName: string;
    webhookUrl: string;
    webhookJwtKey: string;
    events: string[];
  }): Promise<{ providerInstanceId: string | null; state: string }>;
  getQr(input: { instanceName: string }): Promise<{ state: string; qrDataUrl?: string }>;
  getConnectionState(input: { instanceName: string }): Promise<{ state: string }>;
  sendText(input: { instanceName: string; number: string; text: string }): Promise<{ providerMessageId: string | null }>;
};

export type WhatsAppProviderErrorKind = "DEFINITIVE" | "AMBIGUOUS" | "DISABLED";

export class WhatsAppProviderError extends Error {
  constructor(readonly kind: WhatsAppProviderErrorKind, readonly code: string) {
    super(code);
    this.name = "WhatsAppProviderError";
  }
}
