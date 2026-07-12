import { and, eq, isNull, desc, count } from "drizzle-orm";
import type { DB } from "../db/client.js";
import { saves } from "../db/schema.js";
import type { Post } from "@forum/shared";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SaveToggleResult {
  saved: boolean;
  savesCount: number;
}

export interface SavedPostsResult {
  posts: Post[];
  total: number;
  page: number;
  limit: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getActiveSavesCount(db: DB, postId: string): Promise<number> {
  const [{ value }] = await db
    .select({ value: count() })
    .from(saves)
    .where(and(eq(saves.postId, postId), isNull(saves.unsavedAt)));
  return Number(value);
}

async function findLatestSave(db: DB, userId: string, postId: string) {
  const [existing] = await db
    .select()
    .from(saves)
    .where(and(eq(saves.userId, userId), eq(saves.postId, postId)))
    .orderBy(desc(saves.savedAt))
    .limit(1);
  return existing ?? null;
}

// ─── Core service ─────────────────────────────────────────────────────────────

/**
 * Ensure a post is saved for a user (idempotent).
 *
 * - No row            → INSERT (saved = true)
 * - Active save       → no-op   (saved = true)
 * - Inactive save     → reactivate (unsaved_at=NULL, saved_at=now())
 *
 * The partial unique index on (user_id, post_id) WHERE unsaved_at IS NULL
 * prevents duplicate active saves under concurrent requests.
 */
export async function savePost(
  db: DB,
  userId: string,
  postId: string
): Promise<SaveToggleResult> {
  const existing = await findLatestSave(db, userId, postId);

  if (!existing) {
    await db.insert(saves).values({ userId, postId });
  } else if (existing.unsavedAt !== null) {
    await db
      .update(saves)
      .set({ unsavedAt: null, savedAt: new Date() })
      .where(eq(saves.id, existing.id));
  }
  // else: already actively saved → idempotent no-op

  return {
    saved: true,
    savesCount: await getActiveSavesCount(db, postId),
  };
}

/**
 * Ensure a post is unsaved for a user (idempotent).
 *
 * - No row / inactive → no-op (saved = false)
 * - Active save       → set unsaved_at = now()
 */
export async function unsavePost(
  db: DB,
  userId: string,
  postId: string
): Promise<SaveToggleResult> {
  const existing = await findLatestSave(db, userId, postId);

  if (existing && existing.unsavedAt === null) {
    await db
      .update(saves)
      .set({ unsavedAt: new Date() })
      .where(
        and(
          eq(saves.userId, userId),
          eq(saves.postId, postId),
          isNull(saves.unsavedAt)
        )
      );
  }

  return {
    saved: false,
    savesCount: await getActiveSavesCount(db, postId),
  };
}

/**
 * Toggle a bookmark for a user on a post.
 *
 * Used by unit tests and any client that prefers a single toggle endpoint.
 * Prefer savePost / unsavePost for REST POST/DELETE semantics.
 */
export async function toggleSave(
  db: DB,
  userId: string,
  postId: string
): Promise<SaveToggleResult> {
  const existing = await findLatestSave(db, userId, postId);

  if (!existing || existing.unsavedAt !== null) {
    return savePost(db, userId, postId);
  }
  return unsavePost(db, userId, postId);
}

/**
 * Get the paginated list of posts a user has actively saved.
 *
 * Efficient: single JOIN query filtered by active saves — no N+1, correct pagination.
 */
export async function getSavedPosts(
  db: DB,
  userId: string,
  page: number,
  limit: number
): Promise<SavedPostsResult> {
  const { listPosts } = await import("./posts.service.js");
  return listPosts(db, userId, { page, limit, savedByUserId: userId });
}

/**
 * Check if a specific user has actively saved a specific post.
 */
export async function hasSavedPost(
  db: DB,
  userId: string,
  postId: string
): Promise<boolean> {
  const [result] = await db
    .select({ id: saves.id })
    .from(saves)
    .where(
      and(eq(saves.userId, userId), eq(saves.postId, postId), isNull(saves.unsavedAt))
    )
    .limit(1);
  return !!result;
}

/**
 * Get the current active saves count for a post.
 */
export async function getPostSavesCount(db: DB, postId: string): Promise<number> {
  return getActiveSavesCount(db, postId);
}
