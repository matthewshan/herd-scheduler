import { defineConfig } from "vitest/config";

// Unit-test runner. Vitest uses the same describe/it/expect API as Jest, so
// these are "Jest-style" unit tests with one runner (no separate Jest config).
// Node environment — these cover server-side logic, not React components.
// DB-backed integration tests against a real Postgres land in Phase 9.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
  },
});
