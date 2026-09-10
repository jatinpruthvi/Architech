import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const MAGIC = Buffer.from("ARQ1");
const IV_BYTES = 12;
const TAG_BYTES = 16;

function keyFromEnv(value = process.env.ARCHITECH_CONTACT_ENCRYPTION_KEY): Buffer {
  if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value)) {
    throw new Error("ARCHITECH_CONTACT_ENCRYPTION_KEY must be canonical base64 for exactly 32 random bytes.");
  }
  const key = Buffer.from(value, "base64");
  if (key.length !== 32 || key.toString("base64") !== value) {
    throw new Error("ARCHITECH_CONTACT_ENCRYPTION_KEY must be canonical base64 for exactly 32 random bytes.");
  }
  return key;
}

/** Versioned AES-256-GCM envelope: magic + IV + auth tag + ciphertext. */
export function encryptContact(value: string, key = keyFromEnv()): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptContact(payload: Uint8Array, key = keyFromEnv()): string {
  const data = Buffer.from(payload);
  if (data.length < MAGIC.length + IV_BYTES + TAG_BYTES || !data.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("Malformed contact ciphertext.");
  }
  const ivStart = MAGIC.length;
  const tagStart = ivStart + IV_BYTES;
  const cipherStart = tagStart + TAG_BYTES;
  const decipher = createDecipheriv("aes-256-gcm", key, data.subarray(ivStart, tagStart));
  decipher.setAuthTag(data.subarray(tagStart, cipherStart));
  return Buffer.concat([decipher.update(data.subarray(cipherStart)), decipher.final()]).toString("utf8");
}

export function contactEncryptionKey(): Buffer {
  return keyFromEnv();
}
