import { db, schema } from "./client.js";

// ─── Known IDs ────────────────────────────────────────────────────────────────
// Using fixed UUIDs so tokens in .env.example remain valid across reseeds.

export const SEED = {
  users: {
    alice: "00000000-0000-0000-0000-000000000001", // student → Web Dev only
    bob:   "00000000-0000-0000-0000-000000000002", // student → Data Science only
    carol: "00000000-0000-0000-0000-000000000003", // moderator (sees all courses)
  },
  courses: {
    webDev:  "10000000-0000-0000-0000-000000000001",
    dataSci: "10000000-0000-0000-0000-000000000002",
  },
} as const;

async function seed() {
  console.log("Seeding database…");

  // ── Users ────────────────────────────────────────────────────────────────────
  await db
    .insert(schema.users)
    .values([
      { id: SEED.users.alice, name: "Alice (Student)", role: "student" },
      { id: SEED.users.bob,   name: "Bob (Student)",   role: "student" },
      { id: SEED.users.carol, name: "Carol (Moderator)", role: "moderator" },
    ])
    .onConflictDoNothing();

  // ── Courses ──────────────────────────────────────────────────────────────────
  await db
    .insert(schema.courses)
    .values([
      { id: SEED.courses.webDev,  title: "Web Development Fundamentals" },
      { id: SEED.courses.dataSci, title: "Data Science with Python" },
    ])
    .onConflictDoNothing();

  // ── Enrollments ───────────────────────────────────────────────────────────────
  // Alice is enrolled ONLY in Web Dev.
  // Bob   is enrolled ONLY in Data Science.
  // Carol is a moderator and bypasses enrollment checks entirely.
  await db
    .insert(schema.enrollments)
    .values([
      { userId: SEED.users.alice, courseId: SEED.courses.webDev },
      { userId: SEED.users.bob,   courseId: SEED.courses.dataSci },
    ])
    .onConflictDoNothing();

  // ── Posts ────────────────────────────────────────────────────────────────────
  await db
    .insert(schema.posts)
    .values([
      {
        id: "20000000-0000-0000-0000-000000000001",
        courseId: SEED.courses.webDev,
        authorId: SEED.users.alice,
        title: "What's the best way to center a div in 2025?",
        body: "I know this is a classic question, but with modern CSS I'm wondering if flexbox or grid is now the preferred approach. Any opinions?\n\nI've been using `display: flex; justify-content: center; align-items: center;` but someone told me CSS Grid with `place-items: center` is cleaner. Thoughts?",
      },
      {
        id: "20000000-0000-0000-0000-000000000002",
        courseId: SEED.courses.webDev,
        authorId: SEED.users.alice,
        title: "Understanding React's useEffect dependency array",
        body: "I keep running into stale closure issues with useEffect. When exactly do I need to include a variable in the dependency array?\n\nSpecifically: if I use a ref inside an effect, do I need to include it? What about setState functions?",
      },
      {
        id: "20000000-0000-0000-0000-000000000003",
        courseId: SEED.courses.webDev,
        authorId: SEED.users.alice,
        title: "TypeScript strict mode — worth the pain?",
        body: "Just enabled `strict: true` in my tsconfig and now I have 200 errors. Is it worth fixing all of these? What are the biggest wins from strict mode?\n\nSo far I've found `strictNullChecks` is catching real bugs, but `noImplicitAny` feels like a lot of noise.",
      },
      {
        id: "20000000-0000-0000-0000-000000000004",
        courseId: SEED.courses.dataSci,
        authorId: SEED.users.bob,
        title: "Pandas vs Polars — which should I learn?",
        body: "I'm starting my data science journey. Should I invest time in Pandas or go straight to Polars? I've heard Polars is much faster but the ecosystem is smaller.\n\nFor context: I'm working with datasets up to 10GB on a laptop.",
      },
      {
        id: "20000000-0000-0000-0000-000000000005",
        courseId: SEED.courses.dataSci,
        authorId: SEED.users.bob,
        title: "Explaining p-values to non-technical stakeholders",
        body: "I always struggle to explain statistical significance in a way that resonates with business people. What analogies or framings have worked for you?\n\nThe classic 'probability of observing this result if null hypothesis is true' never lands well.",
      },
    ])
    .onConflictDoNothing();

  // ── Sample saves ───────────────────────────────────────────────────────────────
  // Alice saves 2 Web Dev posts (she's enrolled there).
  // Bob saves 1 Data Science post (he's enrolled there).
  await db
    .insert(schema.saves)
    .values([
      { userId: SEED.users.alice, postId: "20000000-0000-0000-0000-000000000001" },
      { userId: SEED.users.alice, postId: "20000000-0000-0000-0000-000000000002" },
      { userId: SEED.users.bob,   postId: "20000000-0000-0000-0000-000000000004" },
    ])
    .onConflictDoNothing();

  // ── Sample likes ──────────────────────────────────────────────────────────────
  await db
    .insert(schema.likes)
    .values([
      { userId: SEED.users.bob,   postId: "20000000-0000-0000-0000-000000000001" },
      { userId: SEED.users.carol, postId: "20000000-0000-0000-0000-000000000001" },
      { userId: SEED.users.alice, postId: "20000000-0000-0000-0000-000000000002" },
      { userId: SEED.users.carol, postId: "20000000-0000-0000-0000-000000000003" },
    ])
    .onConflictDoNothing();

  console.log("Seed complete ✓");
  console.log("");
  console.log("Enrollment summary:");
  console.log("  Alice (student) → Web Development Fundamentals only");
  console.log("  Bob   (student) → Data Science with Python only");
  console.log("  Carol (mod)     → all courses (moderator bypass)");
  console.log("");
  console.log("Get auth tokens via POST /dev/token with these userIds:");
  console.log("  Alice : 00000000-0000-0000-0000-000000000001");
  console.log("  Bob   : 00000000-0000-0000-0000-000000000002");
  console.log("  Carol : 00000000-0000-0000-0000-000000000003");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
