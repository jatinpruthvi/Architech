/* ARCHITECH — Controlled property-detail vocabulary. Keep public facts explicit, reviewable, and reusable across cards, quick view, dossiers, and broker drafts. */

export type FurnishingCode = "UNFURNISHED" | "SEMI_FURNISHED" | "FURNISHED";
export type FacingCode = "EAST" | "WEST" | "NORTH" | "SOUTH" | "NORTH_EAST" | "SOUTH_WEST" | "NOT_SPECIFIED";

export type PropertyDetails = {
  bathrooms?: number;
  parkingSpaces?: number;
  furnishing?: FurnishingCode;
  floorNumber?: number;
  totalFloors?: number;
  facing?: FacingCode;
  possessionLabel?: string;
  amenities?: string[];
};

export const FURNISHING_OPTIONS: Array<{ value: FurnishingCode; label: string }> = [
  { value: "UNFURNISHED", label: "Unfurnished" },
  { value: "SEMI_FURNISHED", label: "Semi-furnished" },
  { value: "FURNISHED", label: "Furnished" },
];

export const FACING_OPTIONS: Array<{ value: FacingCode; label: string }> = [
  { value: "EAST", label: "East" },
  { value: "WEST", label: "West" },
  { value: "NORTH", label: "North" },
  { value: "SOUTH", label: "South" },
  { value: "NORTH_EAST", label: "North-east" },
  { value: "SOUTH_WEST", label: "South-west" },
  { value: "NOT_SPECIFIED", label: "Not specified" },
];

export const AMENITY_OPTIONS = [
  "Lift",
  "Reserved parking",
  "Power backup",
  "24×7 water",
  "Security",
  "Gym",
  "Garden or courtyard",
  "Balcony",
  "Clubhouse",
  "Rainwater harvesting",
] as const;

export const BATHROOM_OPTIONS = [1, 2, 3, 4, 5, 6] as const;
export const PARKING_OPTIONS = [0, 1, 2, 3, 4] as const;

export function labelForFurnishing(value?: FurnishingCode) {
  return FURNISHING_OPTIONS.find((option) => option.value === value)?.label ?? "Not specified";
}

export function labelForFacing(value?: FacingCode) {
  return FACING_OPTIONS.find((option) => option.value === value)?.label ?? "Not specified";
}

export function propertyFactRows(details?: PropertyDetails) {
  return [
    ["Bathrooms", details?.bathrooms ? `${details.bathrooms}` : "Not specified"],
    ["Parking", details?.parkingSpaces === undefined ? "Not specified" : details.parkingSpaces === 0 ? "No parking" : `${details.parkingSpaces} ${details.parkingSpaces === 1 ? "space" : "spaces"}`],
    ["Furnishing", labelForFurnishing(details?.furnishing)],
    ["Floor", details?.floorNumber === undefined ? "Not specified" : `${details.floorNumber}${details.totalFloors ? ` / ${details.totalFloors}` : ""}`],
    ["Facing", labelForFacing(details?.facing)],
    ["Possession", details?.possessionLabel ?? "Not specified"],
  ] as const;
}
