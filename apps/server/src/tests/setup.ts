import { beforeAll, afterAll } from "vitest";
import { setupTestDb, teardownTestDb } from "./helpers.js";

// Run migrations once before the entire test suite
beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});
