export type ModerationInput = {
  title: string;
  description: string;
  priceInr?: number;
  reraNumber?: string;
  mediaRightsConfirmed?: boolean;
};

export type ModerationFlag = {
  severity: "info" | "warning" | "critical";
  code: string;
  message: string;
};

export function reviewListingDraft(input: ModerationInput): { flags: ModerationFlag[]; autoApprovalAllowed: false } {
  const flags: ModerationFlag[] = [];
  // `?? ""` keeps a partially-populated draft a flaggable review, not a crash.
  const text = `${input.title ?? ""} ${input.description ?? ""}`.toLowerCase();
  if (!input.reraNumber) flags.push({ severity: "warning", code: "missing_rera", message: "RERA number is missing; verify whether the listing requires one before publication." });
  if (!input.mediaRightsConfirmed) flags.push({ severity: "critical", code: "media_rights_missing", message: "Media rights must be confirmed before review approval." });
  if (!input.priceInr || input.priceInr <= 0) flags.push({ severity: "critical", code: "price_missing", message: "A positive INR price is required." });
  for (const phrase of ["guaranteed return", "government endorsed", "100% appreciation", "risk free"] as const) {
    if (text.includes(phrase)) flags.push({ severity: "critical", code: "unsupported_claim", message: `Unsupported claim detected: ${phrase}` });
  }
  if ((input.description ?? "").length < 80) flags.push({ severity: "info", code: "thin_description", message: "Description is short; ask broker for more source context." });
  return { flags, autoApprovalAllowed: false };
}
