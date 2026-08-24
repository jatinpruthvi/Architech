import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { include: ["client/src/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "client/src"), "@shared": path.resolve(__dirname, "shared") } },
});
