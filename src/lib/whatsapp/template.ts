import {
  ACKNOWLEDGEMENT_BODY_MAX,
  ACKNOWLEDGEMENT_RENDERED_MAX,
  ALLOWED_ACKNOWLEDGEMENT_PLACEHOLDERS,
  type AcknowledgementValues,
  type WhatsAppTemplatePlaceholder,
} from "./contracts";

export const DEFAULT_ACKNOWLEDGEMENT_BODY =
  "Hi {{firstName}}, this is {{brokerName}}. We received your enquiry for {{listingTitle}} in {{city}}. Our team will contact you shortly. Reply STOP to opt out.";

export const ACKNOWLEDGEMENT_PREVIEW_VALUES = {
  firstName: "Asha",
  brokerName: "Nivasa Partners",
  listingTitle: "Garden Court",
  city: "Ahmedabad",
} as const;

const TEMPLATE_VALUE_MAX = 240;
const PLACEHOLDER_PATTERN = /\{\{([^{}]*)\}\}/g;
const DISALLOWED_CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const ALLOWED_PLACEHOLDER_SET = new Set<string>(ALLOWED_ACKNOWLEDGEMENT_PLACEHOLDERS);

export class WhatsAppTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WhatsAppTemplateError";
  }
}

export type AcknowledgementTemplateValidation =
  | { ok: true; body: string; placeholders: string[] }
  | { ok: false; errors: string[] };

function normalizeBody(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

function extractPlaceholders(body: string): { placeholders: string[]; errors: string[] } {
  const placeholders = new Set<string>();
  const errors: string[] = [];
  for (const match of body.matchAll(PLACEHOLDER_PATTERN)) {
    const name = match[1] ?? "";
    if (!ALLOWED_PLACEHOLDER_SET.has(name)) {
      errors.push(`Unknown WhatsApp acknowledgement placeholder: ${name || "(empty)"}.`);
      continue;
    }
    placeholders.add(name);
  }
  /* Do not let a marker that the renderer would leave untouched become a
     disguised expression or an accidental provider instruction. */
  const withoutValidMarkers = body.replace(PLACEHOLDER_PATTERN, "");
  if (withoutValidMarkers.includes("{{") || withoutValidMarkers.includes("}}")) {
    errors.push("Template contains an unmatched placeholder marker.");
  }
  return { placeholders: [...placeholders].sort(), errors };
}

export function validateAcknowledgementTemplate(body: unknown): AcknowledgementTemplateValidation {
  if (typeof body !== "string") return { ok: false, errors: ["Acknowledgement template must be text."] };
  const normalized = normalizeBody(body);
  const errors: string[] = [];
  if (!normalized || !/\S/.test(normalized)) errors.push("Acknowledgement template cannot be empty.");
  if (normalized.length > ACKNOWLEDGEMENT_BODY_MAX) errors.push(`Acknowledgement template must be at most ${ACKNOWLEDGEMENT_BODY_MAX} characters.`);
  if (DISALLOWED_CONTROL_PATTERN.test(normalized)) errors.push("Acknowledgement template contains disallowed control characters.");
  errors.push(...extractPlaceholders(normalized).errors);
  if (errors.length) return { ok: false, errors: [...new Set(errors)] };
  const { placeholders } = extractPlaceholders(normalized);
  return { ok: true, body: normalized, placeholders };
}

function normalizeReplacement(name: WhatsAppTemplatePlaceholder, value: unknown): string {
  if (typeof value !== "string") throw new WhatsAppTemplateError(`Missing value for {{${name}}}.`);
  const normalized = value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length > TEMPLATE_VALUE_MAX) {
    throw new WhatsAppTemplateError(`Value for {{${name}}} is too long.`);
  }
  return normalized;
}

export function renderAcknowledgementTemplate(body: string, values: AcknowledgementValues): string {
  const validation = validateAcknowledgementTemplate(body);
  if (!validation.ok) throw new WhatsAppTemplateError(validation.errors.join(" "));
  let rendered = validation.body;
  for (const name of ALLOWED_ACKNOWLEDGEMENT_PLACEHOLDERS) {
    const value = normalizeReplacement(name, values[name]);
    rendered = rendered.split(`{{${name}}}`).join(value);
  }
  if (rendered.length > ACKNOWLEDGEMENT_RENDERED_MAX) {
    throw new WhatsAppTemplateError(`Rendered acknowledgement must be at most ${ACKNOWLEDGEMENT_RENDERED_MAX} characters.`);
  }
  return rendered;
}
