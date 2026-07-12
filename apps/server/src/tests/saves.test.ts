import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testDb, cleanTestDb, insertFixtures, TEST_USERS, TEST_POSTS } from "./helpers.js";
import { toggleSave, savePost, unsavePost, getSavedPosts } from "../services/saves.service.js";
import { eq, and, isNull } from "drizzle-orm";
import { saves } from "../db/schema.js";

describe("saves.service", () => {
  beforeEach(async () => {
    await insertFixtures();
  });

  afterEach(async () => {
    await cleanTestDb();
  });

  describe("savePost / unsavePost (idempotent)", () => {
    it("savePost is a no-op when already saved", async () => {
      const first = await savePost(testDb, TEST_USERS.alice.id, TEST_POSTS.post1.id);
      const second = await savePost(testDb, TEST_USERS.alice.id, TEST_POSTS.post1.id);

      expect(first.saved).toBe(true);
      expect(second.saved).toBe(true);
      expect(second.savesCount).toBe(1);

      const activeRows = await testDb
        .select()
        .from(saves)
        .where(
          and(
            eq(saves.userId, TEST_USERS.alice.id),
            eq(saves.postId, TEST_POSTS.post1.id),
            isNull(saves.unsavedAt)
          )
        );
      expect(activeRows.length).toBe(1);
    });

    it("unsavePost is a no-op when not saved", async () => {
      const result = await unsavePost(testDb, TEST_USERS.alice.id, TEST_POSTS.post1.id);

      expect(result.saved).toBe(false);
      expect(result.savesCount).toBe(0);
    });

    it("save → unsave → save reactivates the same row", async () => {
      await savePost(testDb, TEST_USERS.alice.id, TEST_POSTS.post1.id);
      await unsavePost(testDb, TEST_USERS.alice.id, TEST_POSTS.post1.id);
      const result = await savePost(testDb, TEST_USERS.alice.id, TEST_POSTS.post1.id);

      expect(result.saved).toBe(true);
      expect(result.savesCount).toBe(1);
    });
  });

  describe("toggleSave", () => {
    it("saves a post for the first time", async () => {
      const result = await toggleSave(testDb, TEST_USERS.alice.id, TEST_POSTS.post1.id);

      expect(result.saved).toBe(true);
      expect(result.savesCount).toBe(1);

      // Verify DB state
      const [row] = await testDb
        .select()
        .from(saves)
        .where(
          and(
            eq(saves.userId, TEST_USERS.alice.id),
            eq(saves.postId, TEST_POSTS.post1.id),
            isNull(saves.unsavedAt)
          )
        );
      expect(row).toBeDefined();
      expect(row!.unsavedAt).toBeNull();
    });

    it("un-saves a post that was already saved", async () => {
      // First save
      await toggleSave(testDb, TEST_USERS.alice.id, TEST_POSTS.post1.id);

      // Un-save
      const result = await toggleSave(testDb, TEST_USERS.alice.id, TEST_POSTS.post1.id);

      expect(result.saved).toBe(false);
      expect(result.savesCount).toBe(0);

      // Verify DB state: row should now have unsaved_at set
      const [row] = await testDb
        .select()
        .from(saves)
        .where(
          and(
            eq(saves.userId, TEST_USERS.alice.id),
            eq(saves.postId, TEST_POSTS.post1.id)
          )
        );
      expect(row).toBeDefined();
      expect(row!.unsavedAt).not.toBeNull();
    });

    it("re-saves a post after un-saving (reactivation)", async () => {
      // Save → unsave → save again
      await toggleSave(testDb, TEST_USERS.alice.id, TEST_POSTS.post1.id);
      await toggleSave(testDb, TEST_USERS.alice.id, TEST_POSTS.post1.id);
      const result = await toggleSave(testDb, TEST_USERS.alice.id, TEST_POSTS.post1.id);

      expect(result.saved).toBe(true);
      expect(result.savesCount).toBe(1);

      // Verify there's only ONE active save row (partial unique index working)
      const activeRows = await testDb
        .select()
        .from(saves)
        .where(
          and(
            eq(saves.userId, TEST_USERS.alice.id),
            eq(saves.postId, TEST_POSTS.post1.id),
            isNull(saves.unsavedAt)
          )
        );
      expect(activeRows.length).toBe(1);
    });

    it("counts saves from multiple users correctly", async () => {
      await toggleSave(testDb, TEST_USERS.alice.id, TEST_POSTS.post1.id);
      await toggleSave(testDb, TEST_USERS.bob.id, TEST_POSTS.post1.id);

      // Carol saves
      const result = await toggleSave(testDb, TEST_USERS.carol.id, TEST_POSTS.post1.id);

      expect(result.savesCount).toBe(3);
    });

    it("does not count saves from other posts in savesCount", async () => {
      await toggleSave(testDb, TEST_USERS.alice.id, TEST_POSTS.post2.id);
      await toggleSave(testDb, TEST_USERS.bob.id, TEST_POSTS.post2.id);

      const result = await toggleSave(testDb, TEST_USERS.alice.id, TEST_POSTS.post1.id);

      // post1 has only 1 save (alice); post2's saves don't count
      expect(result.savesCount).toBe(1);
    });

    it("un-saving reduces the count", async () => {
      await toggleSave(testDb, TEST_USERS.alice.id, TEST_POSTS.post1.id);
      await toggleSave(testDb, TEST_USERS.bob.id, TEST_POSTS.post1.id);

      // Alice un-saves
      const result = await toggleSave(testDb, TEST_USERS.alice.id, TEST_POSTS.post1.id);

      expect(result.saved).toBe(false);
      expect(result.savesCount).toBe(1); // Bob still has it saved
    });

    it("preserves history across save/unsave cycles", async () => {
      await toggleSave(testDb, TEST_USERS.alice.id, TEST_POSTS.post1.id); // save
      await toggleSave(testDb, TEST_USERS.alice.id, TEST_POSTS.post1.id); // unsave
      await toggleSave(testDb, TEST_USERS.alice.id, TEST_POSTS.post1.id); // save again

      // Total rows in saves for this (user, post) should be 1 (we reuse the row)
      // But there should be a history: savedAt is updated, unsavedAt cleared
      const rows = await testDb
        .select()
        .from(saves)
        .where(
          and(
            eq(saves.userId, TEST_USERS.alice.id),
            eq(saves.postId, TEST_POSTS.post1.id)
          )
        );

      // In our implementation we reuse the same row for re-saves
      // so there should be exactly 1 row with unsaved_at = null
      const activeRows = rows.filter((r) => r.unsavedAt === null);
      expect(activeRows.length).toBe(1);
    });
  });

  describe("getSavedPosts", () => {
    it("returns only posts the user has saved", async () => {
      await toggleSave(testDb, TEST_USERS.alice.id, TEST_POSTS.post1.id);
      await toggleSave(testDb, TEST_USERS.alice.id, TEST_POSTS.post2.id);

      const result = await getSavedPosts(testDb, TEST_USERS.alice.id, 1, 20);

      expect(result.posts).toHaveLength(2);
      expect(result.posts.every((p) => p.hasSaved === true)).toBe(true);
    });

    it("excludes posts the user un-saved", async () => {
      await toggleSave(testDb, TEST_USERS.alice.id, TEST_POSTS.post1.id); // save
      await toggleSave(testDb, TEST_USERS.alice.id, TEST_POSTS.post1.id); // unsave
      await toggleSave(testDb, TEST_USERS.alice.id, TEST_POSTS.post2.id); // save

      const result = await getSavedPosts(testDb, TEST_USERS.alice.id, 1, 20);

      expect(result.posts).toHaveLength(1);
      expect(result.posts[0]!.id).toBe(TEST_POSTS.post2.id);
    });

    it("does not include saves from other users", async () => {
      await toggleSave(testDb, TEST_USERS.bob.id, TEST_POSTS.post1.id);
      await toggleSave(testDb, TEST_USERS.bob.id, TEST_POSTS.post2.id);

      const result = await getSavedPosts(testDb, TEST_USERS.alice.id, 1, 20);

      expect(result.posts).toHaveLength(0);
    });

    it("returns empty list when no saves exist", async () => {
      const result = await getSavedPosts(testDb, TEST_USERS.alice.id, 1, 20);

      expect(result.posts).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});
