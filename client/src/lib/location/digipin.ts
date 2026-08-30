/* DIGIPIN encoder/decoder.

   Algorithm adapted from the Department of Posts (India Post) reference
   implementation: https://github.com/INDIAPOST-gov/digipin
   DIGIPIN represents a coordinate cell. It complements — and never replaces —
   a postal address, PIN, locality, or administrative identity. Exact DIGIPINs
   should follow the same access policy as exact listing coordinates. */

const GRID = [
  ["F", "C", "9", "8"],
  ["J", "3", "2", "7"],
  ["K", "4", "5", "6"],
  ["L", "M", "P", "T"],
] as const;

export const DIGIPIN_BOUNDS = Object.freeze({ minLatitude: 2.5, maxLatitude: 38.5, minLongitude: 63.5, maxLongitude: 99.5 });
export const DIGIPIN_PATTERN = /^[23456789CJKLMPFT]{10}$/;

export type Coordinate = { latitude: number; longitude: number };
export type CoordinateBounds = {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
};

function assertCoordinate(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || latitude < DIGIPIN_BOUNDS.minLatitude || latitude > DIGIPIN_BOUNDS.maxLatitude) {
    throw new RangeError(`Latitude must be between ${DIGIPIN_BOUNDS.minLatitude} and ${DIGIPIN_BOUNDS.maxLatitude}.`);
  }
  if (!Number.isFinite(longitude) || longitude < DIGIPIN_BOUNDS.minLongitude || longitude > DIGIPIN_BOUNDS.maxLongitude) {
    throw new RangeError(`Longitude must be between ${DIGIPIN_BOUNDS.minLongitude} and ${DIGIPIN_BOUNDS.maxLongitude}.`);
  }
}

export function isValidDigipin(value: string): boolean {
  return DIGIPIN_PATTERN.test(value.trim().toUpperCase());
}

/** Encode a coordinate as the current continuous ten-character format. */
export function encodeDigipin(latitude: number, longitude: number): string {
  assertCoordinate(latitude, longitude);
  let { minLatitude, maxLatitude, minLongitude, maxLongitude } = DIGIPIN_BOUNDS;
  let result = "";

  for (let level = 0; level < 10; level += 1) {
    const latitudeDivision = (maxLatitude - minLatitude) / 4;
    const longitudeDivision = (maxLongitude - minLongitude) / 4;
    const row = Math.max(0, Math.min(3, 3 - Math.floor((latitude - minLatitude) / latitudeDivision)));
    const column = Math.max(0, Math.min(3, Math.floor((longitude - minLongitude) / longitudeDivision)));
    result += GRID[row][column];

    maxLatitude = minLatitude + latitudeDivision * (4 - row);
    minLatitude += latitudeDivision * (3 - row);
    minLongitude += longitudeDivision * column;
    maxLongitude = minLongitude + longitudeDivision;
  }
  return result;
}

/** Decode to the full coordinate cell, preserving the code's real precision. */
export function decodeDigipinBounds(value: string): CoordinateBounds {
  const digipin = value.trim().toUpperCase();
  if (!DIGIPIN_PATTERN.test(digipin)) throw new TypeError("DIGIPIN must be a continuous ten-character code using the approved character set.");

  let minLatitude: number = DIGIPIN_BOUNDS.minLatitude;
  let maxLatitude: number = DIGIPIN_BOUNDS.maxLatitude;
  let minLongitude: number = DIGIPIN_BOUNDS.minLongitude;
  let maxLongitude: number = DIGIPIN_BOUNDS.maxLongitude;
  for (const character of digipin) {
    let row = -1;
    let column = -1;
    for (let candidateRow = 0; candidateRow < GRID.length; candidateRow += 1) {
      const rowValues: readonly string[] = GRID[candidateRow];
      const candidateColumn = rowValues.indexOf(character);
      if (candidateColumn >= 0) {
        row = candidateRow;
        column = candidateColumn;
        break;
      }
    }
    if (row < 0 || column < 0) throw new TypeError("DIGIPIN contains an invalid character.");

    const latitudeDivision = (maxLatitude - minLatitude) / 4;
    const longitudeDivision = (maxLongitude - minLongitude) / 4;
    const nextMinLatitude = maxLatitude - latitudeDivision * (row + 1);
    const nextMaxLatitude = maxLatitude - latitudeDivision * row;
    const nextMinLongitude = minLongitude + longitudeDivision * column;
    const nextMaxLongitude = minLongitude + longitudeDivision * (column + 1);
    minLatitude = nextMinLatitude;
    maxLatitude = nextMaxLatitude;
    minLongitude = nextMinLongitude;
    maxLongitude = nextMaxLongitude;
  }
  return { minLatitude, maxLatitude, minLongitude, maxLongitude };
}

/** Decode to the center of the DIGIPIN cell. */
export function decodeDigipin(value: string): Coordinate {
  const bounds = decodeDigipinBounds(value);
  return {
    latitude: (bounds.minLatitude + bounds.maxLatitude) / 2,
    longitude: (bounds.minLongitude + bounds.maxLongitude) / 2,
  };
}
