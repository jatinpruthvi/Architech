import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { include: ["client/src/**/*.test.ts"] },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
      // Vitest runs in a plain Node runtime, not a React Server Component one.
      // Stub `server-only` so server-mode modules can be unit-tested directly;
      // the real guard remains in the production build.
      "server-only": path.resolve(__dirname, "client/src/test/server-only-stub.ts"),
    },
  },
});
