import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import * as schema from "../db/schema.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { sql } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_DB_URL =
  process.env["TEST_DATABASE_URL"] ??
  "postgres://forum:forum@localhost:5433/forum_test";

let testDbConnection: ReturnType<typeof postgres> | null = null;

export let testDb: ReturnType<typeof drizzle<typeof schema>>;

/**
 * Create a fresh test database connection and run migrations.
 * Called once before all tests via globalSetup or beforeAll.
 */
export async function setupTestDb() {
  testDbConnection = postgres(TEST_DB_URL, { max: 5 });
  testDb = drizzle(testDbConnection, { schema });

  // Run migrations to ensure schema is up to date
  await migrate(testDb, {
    migrationsFolder: join(__dirname, "../db/migrations"),
  });
}

/**
 * Tear down all test data between tests for isolation.
 * Truncates in reverse FK order.
 */
export async function cleanTestDb() {
  if (!testDb) return;

  await testDb.execute(
    sql`TRUNCATE TABLE likes, saves, enrollments, posts, courses, users RESTART IDENTITY CASCADE`
  );
}

/**
 * Close the test DB connection.
 */
export async function teardownTestDb() {
  if (testDbConnection) {
    await testDbConnection.end();
  }
}

// ─── Test fixtures ────────────────────────────────────────────────────────────

export const TEST_USERS = {
  alice: {
    id: "00000000-0000-0000-0001-000000000001",
    name: "Alice Test",
    role: "student" as const,
  },
  bob: {
    id: "00000000-0000-0000-0001-000000000002",
    name: "Bob Test",
    role: "student" as const,
  },
  carol: {
    id: "00000000-0000-0000-0001-000000000003",
    name: "Carol Test",
    role: "moderator" as const,
  },
};

export const TEST_COURSES = {
  webDev: {
    id: "10000000-0000-0000-0001-000000000001",
    title: "Test Web Dev",
  },
  dataSci: {
    id: "10000000-0000-0000-0001-000000000002",
    title: "Test Data Science",
  },
};

export const TEST_POSTS = {
  // In webDev course — Alice is enrolled
  post1: {
    id: "20000000-0000-0000-0001-000000000001",
    title: "Test Post 1 (Web Dev)",
    body: "Test body 1",
  },
  post2: {
    id: "20000000-0000-0000-0001-000000000002",
    title: "Test Post 2 (Web Dev)",
    body: "Test body 2",
  },
  // In dataSci course — Bob is enrolled, Alice is NOT
  post3: {
    id: "20000000-0000-0000-0001-000000000003",
    title: "Test Post 3 (Data Sci)",
    body: "Test body 3",
  },
};

/**
 * Insert base fixtures into the test DB.
 *
 * Enrollment setup:
 *   Alice → webDev only
 *   Bob   → dataSci only
 *   Carol → moderator (no enrollment rows needed)
 */
export async function insertFixtures() {
  await testDb.insert(schema.users).values([
    TEST_USERS.alice,
    TEST_USERS.bob,
    TEST_USERS.carol,
  ]);

  await testDb.insert(schema.courses).values([
    TEST_COURSES.webDev,
    TEST_COURSES.dataSci,
  ]);

  // Enrollments
  await testDb.insert(schema.enrollments).values([
    { userId: TEST_USERS.alice.id, courseId: TEST_COURSES.webDev.id },
    { userId: TEST_USERS.bob.id,   courseId: TEST_COURSES.dataSci.id },
  ]);

  await testDb.insert(schema.posts).values([
    {
      id: TEST_POSTS.post1.id,
      courseId: TEST_COURSES.webDev.id,
      authorId: TEST_USERS.alice.id,
      title: TEST_POSTS.post1.title,
      body: TEST_POSTS.post1.body,
    },
    {
      id: TEST_POSTS.post2.id,
      courseId: TEST_COURSES.webDev.id,
      authorId: TEST_USERS.alice.id,
      title: TEST_POSTS.post2.title,
      body: TEST_POSTS.post2.body,
    },
    {
      id: TEST_POSTS.post3.id,
      courseId: TEST_COURSES.dataSci.id,
      authorId: TEST_USERS.bob.id,
      title: TEST_POSTS.post3.title,
      body: TEST_POSTS.post3.body,
    },
  ]);
}
