export type InventoryView = "cards" | "table";

export function preferredInventoryView(stored: string | null, isMobile: boolean): InventoryView {
  if (stored === "cards" || stored === "table") return stored;
  return isMobile ? "cards" : "table";
}
