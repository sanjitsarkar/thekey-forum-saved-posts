import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

/**
 * Resolve the database URL.
 *
 * During Vitest, always use the dedicated test database — Bun auto-loads
 * `.env` which would otherwise point tests at the development DB and wipe it.
 */
function resolveDatabaseUrl(): string {
  const isTest =
    process.env["VITEST"] === "true" || process.env["NODE_ENV"] === "test";

  if (isTest) {
    return (
      process.env["TEST_DATABASE_URL"] ??
      "postgres://forum:forum@localhost:5433/forum_test"
    );
  }

  return (
    process.env["DATABASE_URL"] ??
    "postgres://forum:forum@localhost:5433/forum"
  );
}

const connectionString = resolveDatabaseUrl();

// postgres-js handles pooling internally.
// max: 10 connections is fine for a small API server.
const sql = postgres(connectionString, { max: 10 });

export const db = drizzle(sql, { schema });

export type DB = typeof db;

// Re-export schema for convenience
export { schema };
