import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests cover the framework-free logic modules only (hashing,
// attestation decode, GitHub resolution, identity resolution). No DOM
// env is needed — those modules are plain TypeScript. UI is not tested
// here; the bundler shim's live read is a separate dev-server smoke
// check (scripts/smoke.mjs).
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
