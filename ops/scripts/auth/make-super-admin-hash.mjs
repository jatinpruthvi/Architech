#!/usr/bin/env node
/**
 * Generates the ARCHITECH_SUPER_ADMIN_PASSWORD_HASH value for .env / deployment
 * secrets. Prompts twice on a TTY, prints the scrypt$<salt>$<hash> string,
 * exits. The plaintext password is never written to disk or a log.
 *
 * Non-interactive (piped stdin) is supported for smoke tests: the password is
 * read twice, one per line:
 *   printf 'pw\npw\n' | node ops/scripts/auth/make-super-admin-hash.mjs
 */
import { createInterface } from "node:readline";
import { randomBytes, scryptSync } from "node:crypto";

const MIN = 12;

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  process.stdout.write(`\nAdd this to your deployment environment:\n\nARCHITECH_SUPER_ADMIN_PASSWORD_HASH=scrypt$${salt.toString("hex")}$${hash.toString("hex")}\n`);
}

async function main() {
  let first;
  let second;
  if (process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      const ask = (question) => new Promise((resolve) => rl.question(question, resolve));
      first = await ask("Super-admin password (min 12 characters): ");
      process.stdout.write("\n");
      second = await ask("Repeat the password: ");
    } finally {
      rl.close();
    }
  } else {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const lines = Buffer.concat(chunks).toString("utf8").split("\n");
    first = lines[0] ?? "";
    second = lines[1] ?? "";
  }
  if (first.length < MIN) throw new Error(`Password must be at least ${MIN} characters (got ${first.length}).`);
  if (first !== second) throw new Error("Passwords do not match.");
  hashPassword(first);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
