import { TechnoCategory } from "@prisma/client";

export type CatKey =
  | "ResidentialRent"
  | "ResidentialSell"
  | "CommercialRent"
  | "CommercialSell"
  | "Premium"
  | "Important";

export const TECHNOCATEGORIES: {
  key: CatKey;
  enum: TechnoCategory;
  label: string;
  chip: "blue" | "amber" | "rose" | "violet" | "slate" | "green";
}[] = [
  {
    key: "ResidentialRent",
    enum: TechnoCategory.RESIDENTIAL_RENT,
    label: "Residential Rent",
    chip: "blue",
  },
  {
    key: "ResidentialSell",
    enum: TechnoCategory.RESIDENTIAL_SELL,
    label: "Residential Sell",
    chip: "amber",
  },
  {
    key: "CommercialRent",
    enum: TechnoCategory.COMMERCIAL_RENT,
    label: "Commercial Rent",
    chip: "rose",
  },
  {
    key: "CommercialSell",
    enum: TechnoCategory.COMMERCIAL_SELL,
    label: "Commercial Sell",
    chip: "violet",
  },
  { key: "Premium", enum: TechnoCategory.PREMIUM, label: "Premium", chip: "slate" },
  { key: "Important", enum: TechnoCategory.IMPORTANT, label: "Shortlisted", chip: "green" },
];

export function categoryKeyToEnum(key: string): TechnoCategory {
  const found = TECHNOCATEGORIES.find(
    (c) => c.key.toLowerCase() === String(key).toLowerCase(),
  );
  if (!found) throw new Error(`Unknown technoproperty category: ${key}`);
  return found.enum;
}

export function categoryLabel(key: string): string {
  const found = TECHNOCATEGORIES.find(
    (c) => c.key.toLowerCase() === String(key).toLowerCase(),
  );
  return found?.label ?? key;
}

export function chipFor(key: string): "blue" | "amber" | "rose" | "violet" | "slate" | "green" {
  const found = TECHNOCATEGORIES.find(
    (c) => c.key.toLowerCase() === String(key).toLowerCase(),
  );
  return found?.chip ?? "blue";
}
