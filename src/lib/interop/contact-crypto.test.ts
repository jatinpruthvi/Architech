import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { decryptContact, encryptContact } from "./contact-crypto";

describe("contact encryption envelope", () => {
  const key = randomBytes(32);

  it("round-trips an E.164 phone number", () => {
    const encrypted = encryptContact("+919876543210", key);
    expect(decryptContact(encrypted, key)).toBe("+919876543210");
    expect(encrypted.toString("utf8")).not.toContain("9876543210");
  });

  it("rejects the wrong key and malformed payloads", () => {
    const encrypted = encryptContact("+919876543210", key);
    expect(() => decryptContact(encrypted, randomBytes(32))).toThrow();
    expect(() => decryptContact(Buffer.from("not-a-contact"), key)).toThrow("Malformed contact ciphertext");
  });
});
