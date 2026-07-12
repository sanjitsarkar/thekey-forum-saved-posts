import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Elysia } from "elysia";
import { testDb, cleanTestDb, insertFixtures, TEST_USERS, TEST_POSTS, TEST_COURSES } from "./helpers.js";
import { signToken } from "../auth/jwt.js";
import { postsRouter } from "../routes/posts.router.js";
import { savesRouter } from "../routes/saves.router.js";

// ─── Test App ─────────────────────────────────────────────────────────────────
// We mount routes on a fresh Elysia instance for each test file.
// The routes use the shared `db` instance; in tests that db client
// points at the test database because DATABASE_URL env var is set.

const app = new Elysia()
  .use(postsRouter)
  .use(savesRouter)
  .onError(({ error, set, code }) => {
    const message = error instanceof Error ? error.message : "Error";
    if (message === "Authentication required") {
      set.status = 401;
      return { error: "UNAUTHORIZED", message, statusCode: 401 };
    }
    if (message.startsWith("Requires role:")) {
      set.status = 403;
      return { error: "FORBIDDEN", message, statusCode: 403 };
    }
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "NOT_FOUND", message: "Route not found", statusCode: 404 };
    }
    set.status = 500;
    return { error: "INTERNAL", message, statusCode: 500 };
  });

// ─── Token helpers ────────────────────────────────────────────────────────────

async function tokenFor(userId: string, role: string, name: string) {
  return signToken({ sub: userId, role: role as "student" | "moderator", name });
}

async function aliceToken() {
  return tokenFor(TEST_USERS.alice.id, "student", TEST_USERS.alice.name);
}

async function carolToken() {
  return tokenFor(TEST_USERS.carol.id, "moderator", TEST_USERS.carol.name);
}

// ─── Auth Tests ───────────────────────────────────────────────────────────────

describe("auth", () => {
  beforeEach(async () => {
    await insertFixtures();
  });

  afterEach(async () => {
    await cleanTestDb();
  });

  it("returns 401 when no token is provided", async () => {
    const res = await app.handle(new Request("http://localhost/posts"));
    expect(res.status).toBe(401);
  });

  it("returns 401 when token is invalid", async () => {
    const res = await app.handle(
      new Request("http://localhost/posts", {
        headers: { Authorization: "Bearer invalid.token.here" },
      })
    );
    expect(res.status).toBe(401);
  });

  it("allows student to GET /posts with valid token", async () => {
    const token = await aliceToken();
    const res = await app.handle(
      new Request("http://localhost/posts", {
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.posts).toBeDefined();
    expect(Array.isArray(data.posts)).toBe(true);
  });

  it("returns 403 when student tries to DELETE a post (moderator-only)", async () => {
    const token = await aliceToken();
    const res = await app.handle(
      new Request(`http://localhost/posts/${TEST_POSTS.post1.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 when student reads a post from a course they are not enrolled in", async () => {
    // Alice is enrolled in webDev only; post3 is in dataSci
    const token = await aliceToken();
    const res = await app.handle(
      new Request(`http://localhost/posts/${TEST_POSTS.post3.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 when moderator reads a post from any course", async () => {
    // Carol (moderator) bypasses enrollment — can see dataSci posts
    const token = await carolToken();
    const res = await app.handle(
      new Request(`http://localhost/posts/${TEST_POSTS.post3.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    expect(res.status).toBe(200);
  });

  it("allows moderator to DELETE a post", async () => {
    const token = await carolToken();
    const res = await app.handle(
      new Request(`http://localhost/posts/${TEST_POSTS.post1.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    expect(res.status).toBe(204);
  });
});

// ─── Posts API Tests ──────────────────────────────────────────────────────────

describe("GET /posts", () => {
  beforeEach(async () => {
    await insertFixtures();
  });

  afterEach(async () => {
    await cleanTestDb();
  });

  it("returns posts with hasSaved=false when user has not saved any", async () => {
    const token = await aliceToken();
    const res = await app.handle(
      new Request("http://localhost/posts", {
        headers: { Authorization: `Bearer ${token}` },
      })
    );

    const data = await res.json();
    expect(data.posts.every((p: any) => p.hasSaved === false)).toBe(true);
  });

  it("feed only shows enrolled-course posts for students", async () => {
    // Alice is enrolled in webDev only — should see post1, post2 but NOT post3
    const token = await aliceToken();
    const res = await app.handle(
      new Request("http://localhost/posts", {
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    const data = await res.json();
    const ids = data.posts.map((p: any) => p.id);
    expect(ids).toContain(TEST_POSTS.post1.id);
    expect(ids).toContain(TEST_POSTS.post2.id);
    expect(ids).not.toContain(TEST_POSTS.post3.id);
  });

  it("returns 403 when student saves a post from a non-enrolled course", async () => {
    // Alice tries to save post3 (dataSci) — she's not enrolled
    const token = await aliceToken();
    const res = await app.handle(
      new Request(`http://localhost/posts/${TEST_POSTS.post3.id}/saves`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    expect(res.status).toBe(403);
  });

  it("returns hasSaved=true for posts the user has saved", async () => {
    // Save post1 for Alice via the saves route
    const token = await aliceToken();
    await app.handle(
      new Request(`http://localhost/posts/${TEST_POSTS.post1.id}/saves`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
    );

    const res = await app.handle(
      new Request("http://localhost/posts", {
        headers: { Authorization: `Bearer ${token}` },
      })
    );

    const data = await res.json();
    const post1 = data.posts.find((p: any) => p.id === TEST_POSTS.post1.id);
    expect(post1?.hasSaved).toBe(true);

    const post2 = data.posts.find((p: any) => p.id === TEST_POSTS.post2.id);
    expect(post2?.hasSaved).toBe(false);
  });

  it("does not show removed posts to students", async () => {
    const carolTok = await carolToken();
    // Moderator removes post1
    await app.handle(
      new Request(`http://localhost/posts/${TEST_POSTS.post1.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${carolTok}` },
      })
    );

    const aliceTok = await aliceToken();
    const res = await app.handle(
      new Request("http://localhost/posts", {
        headers: { Authorization: `Bearer ${aliceTok}` },
      })
    );

    const data = await res.json();
    const postIds = data.posts.map((p: any) => p.id);
    expect(postIds).not.toContain(TEST_POSTS.post1.id);
  });

  it("returns 404 for a non-existent post", async () => {
    const token = await aliceToken();
    const res = await app.handle(
      new Request("http://localhost/posts/00000000-0000-0000-0000-000000000099", {
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    expect(res.status).toBe(404);
  });
});

// ─── Saves API Tests ──────────────────────────────────────────────────────────

describe("saves API", () => {
  beforeEach(async () => {
    await insertFixtures();
  });

  afterEach(async () => {
    await cleanTestDb();
  });

  it("POST /posts/:id/saves saves a post and returns saved=true", async () => {
    const token = await aliceToken();
    const res = await app.handle(
      new Request(`http://localhost/posts/${TEST_POSTS.post1.id}/saves`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.saved).toBe(true);
    expect(data.savesCount).toBe(1);
  });

  it("POST /posts/:id/saves is idempotent (double-save stays saved)", async () => {
    const token = await aliceToken();

    await app.handle(
      new Request(`http://localhost/posts/${TEST_POSTS.post1.id}/saves`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
    );

    const res = await app.handle(
      new Request(`http://localhost/posts/${TEST_POSTS.post1.id}/saves`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.saved).toBe(true);
    expect(data.savesCount).toBe(1);
  });

  it("DELETE /posts/:id/saves is idempotent (double-unsave stays unsaved)", async () => {
    const token = await aliceToken();

    const res = await app.handle(
      new Request(`http://localhost/posts/${TEST_POSTS.post1.id}/saves`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.saved).toBe(false);
    expect(data.savesCount).toBe(0);
  });

  it("DELETE /posts/:id/saves un-saves a post", async () => {
    const token = await aliceToken();

    // First save
    await app.handle(
      new Request(`http://localhost/posts/${TEST_POSTS.post1.id}/saves`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
    );

    // Un-save
    const res = await app.handle(
      new Request(`http://localhost/posts/${TEST_POSTS.post1.id}/saves`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.saved).toBe(false);
    expect(data.savesCount).toBe(0);
  });

  it("GET /users/me/saves returns the authenticated user's saved posts", async () => {
    const token = await aliceToken();

    // Alice saves post1
    await app.handle(
      new Request(`http://localhost/posts/${TEST_POSTS.post1.id}/saves`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
    );

    const res = await app.handle(
      new Request("http://localhost/users/me/saves", {
        headers: { Authorization: `Bearer ${token}` },
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.posts).toHaveLength(1);
    expect(data.posts[0].id).toBe(TEST_POSTS.post1.id);
  });

  it("GET /users/me/saves returns 401 without auth", async () => {
    const res = await app.handle(new Request("http://localhost/users/me/saves"));
    expect(res.status).toBe(401);
  });

  it("saves are private — Bob's saves are not visible in Alice's list", async () => {
    const aliceTok = await aliceToken();
    const bobTok = await tokenFor(TEST_USERS.bob.id, "student", TEST_USERS.bob.name);

    // Bob saves post1
    await app.handle(
      new Request(`http://localhost/posts/${TEST_POSTS.post1.id}/saves`, {
        method: "POST",
        headers: { Authorization: `Bearer ${bobTok}` },
      })
    );

    // Alice's save list should be empty
    const res = await app.handle(
      new Request("http://localhost/users/me/saves", {
        headers: { Authorization: `Bearer ${aliceTok}` },
      })
    );

    const data = await res.json();
    expect(data.posts).toHaveLength(0);
  });

  it("returns 404 when saving a non-existent post", async () => {
    const token = await aliceToken();
    const res = await app.handle(
      new Request("http://localhost/posts/00000000-0000-0000-0000-000000000099/saves", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    expect(res.status).toBe(404);
  });
});
