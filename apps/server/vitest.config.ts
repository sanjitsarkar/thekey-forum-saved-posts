import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./src/tests/setup.ts"],
    // Load .env.test for test environment
    env: {
      // Prefer TEST_DATABASE_URL so Bun's auto-loaded .env cannot wipe the dev DB
      TEST_DATABASE_URL: "postgres://forum:forum@localhost:5433/forum_test",
      DATABASE_URL: "postgres://forum:forum@localhost:5433/forum_test",
      JWT_SECRET: "test-secret-key",
      NODE_ENV: "test",
    },
    // Run tests sequentially to avoid DB conflicts
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
