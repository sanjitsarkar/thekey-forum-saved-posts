import { and, eq, isNull, sql, desc, count, exists, inArray } from "drizzle-orm";
import type { DB } from "../db/client.js";
import { posts, users, courses, saves, likes } from "../db/schema.js";
import type { Post } from "@forum/shared";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ListPostsOptions {
  page?: number;
  limit?: number;
  courseId?: string;
  /** If set, only return posts actively saved by this user (Saved Posts view). */
  savedByUserId?: string;
  /**
   * When set (students only), restrict results to posts in these courses.
   * Moderators pass undefined — they see all courses.
   */
  enrolledCourseIds?: string[];
}

export interface PostsListResult {
  posts: Post[];
  total: number;
  page: number;
  limit: number;
}

// ─── Shared select shape ──────────────────────────────────────────────────────

function postSelectFields(requestingUserId: string) {
  return {
    id: posts.id,
    courseId: posts.courseId,
    courseTitle: courses.title,
    authorId: posts.authorId,
    authorName: users.name,
    title: posts.title,
    body: posts.body,
    isRemoved: posts.isRemoved,
    createdAt: posts.createdAt,
    updatedAt: posts.updatedAt,
    savesCount: sql<number>`
      COUNT(DISTINCT CASE WHEN ${saves.unsavedAt} IS NULL THEN ${saves.id} END)
    `.mapWith(Number),
    likesCount: sql<number>`
      COUNT(DISTINCT ${likes.id})
    `.mapWith(Number),
    hasSaved: sql<boolean>`
      BOOL_OR(
        CASE
          WHEN ${saves.userId} = ${requestingUserId}
           AND ${saves.unsavedAt} IS NULL
          THEN true
          ELSE false
        END
      )
    `.mapWith(Boolean),
  };
}

function mapRowToPost(r: {
  id: string;
  courseId: string;
  courseTitle: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  isRemoved: boolean;
  createdAt: Date;
  updatedAt: Date;
  savesCount: number;
  likesCount: number;
  hasSaved: boolean | null;
}): Post {
  return {
    id: r.id,
    courseId: r.courseId,
    courseTitle: r.courseTitle,
    authorId: r.authorId,
    authorName: r.authorName,
    title: r.title,
    body: r.body,
    isRemoved: r.isRemoved,
    savesCount: r.savesCount,
    likesCount: r.likesCount,
    hasSaved: r.hasSaved ?? false,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

// ─── Core service ─────────────────────────────────────────────────────────────

/**
 * List posts with aggregated metadata in a single query.
 *
 * Returns hasSaved and savesCount for each post without N+1:
 * - savesCount: COUNT of active saves (unsaved_at IS NULL) via LEFT JOIN + GROUP BY
 * - likesCount: COUNT of likes via LEFT JOIN + GROUP BY
 * - hasSaved:   BOOL_OR over active saves belonging to the requesting user
 *
 * When `savedByUserId` is set, only posts with an active save for that user are
 * returned — filtered in SQL (INNER JOIN on active saves) so pagination is correct.
 *
 * Moderators see removed posts; students do not.
 */
export async function listPosts(
  db: DB,
  requestingUserId: string,
  opts: ListPostsOptions = {},
  requestingUserRole: "student" | "moderator" = "student"
): Promise<PostsListResult> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 20;
  const offset = (page - 1) * limit;

  const conditions = [];

  if (requestingUserRole === "student") {
    conditions.push(eq(posts.isRemoved, false));
  }

  if (opts.courseId) {
    conditions.push(eq(posts.courseId, opts.courseId));
  }

  // Restrict students to their enrolled courses (moderators pass no restriction)
  if (opts.enrolledCourseIds) {
    if (opts.enrolledCourseIds.length === 0) {
      // Enrolled in no courses → empty result without hitting the DB
      return { posts: [], total: 0, page, limit };
    }
    conditions.push(inArray(posts.courseId, opts.enrolledCourseIds));
  }

  // Filter to actively saved posts at the SQL level for correct pagination/total
  if (opts.savedByUserId) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(saves)
          .where(
            and(
              eq(saves.postId, posts.id),
              eq(saves.userId, opts.savedByUserId),
              isNull(saves.unsavedAt)
            )
          )
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select(postSelectFields(requestingUserId))
    .from(posts)
    .innerJoin(courses, eq(posts.courseId, courses.id))
    .innerJoin(users, eq(posts.authorId, users.id))
    .leftJoin(saves, eq(posts.id, saves.postId))
    .leftJoin(likes, eq(posts.id, likes.postId))
    .where(whereClause)
    .groupBy(posts.id, courses.title, users.name)
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .offset(offset);

  // Total count with the same filters (no aggregation joins — avoids inflation)
  const totalRows = await db
    .select({ total: count() })
    .from(posts)
    .innerJoin(courses, eq(posts.courseId, courses.id))
    .where(whereClause);

  const total = Number(totalRows[0]?.total ?? 0);

  return {
    posts: rows.map(mapRowToPost),
    total,
    page,
    limit,
  };
}

/**
 * Get a single post by ID.
 * Returns null if not found or removed (unless moderator).
 */
export async function getPost(
  db: DB,
  postId: string,
  requestingUserId: string,
  requestingUserRole: "student" | "moderator" = "student"
): Promise<Post | null> {
  const conditions = [eq(posts.id, postId)];
  if (requestingUserRole === "student") {
    conditions.push(eq(posts.isRemoved, false));
  }

  const rows = await db
    .select(postSelectFields(requestingUserId))
    .from(posts)
    .innerJoin(courses, eq(posts.courseId, courses.id))
    .innerJoin(users, eq(posts.authorId, users.id))
    .leftJoin(saves, eq(posts.id, saves.postId))
    .leftJoin(likes, eq(posts.id, likes.postId))
    .where(and(...conditions))
    .groupBy(posts.id, courses.title, users.name)
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return mapRowToPost(row);
}

/**
 * Soft-delete a post. Only moderators may do this.
 */
export async function removePost(
  db: DB,
  postId: string,
  _moderatorId: string
): Promise<{ success: boolean }> {
  const result = await db
    .update(posts)
    .set({ isRemoved: true, updatedAt: new Date() })
    .where(eq(posts.id, postId))
    .returning({ id: posts.id });

  return { success: result.length > 0 };
}

/**
 * Create a new post.
 */
export async function createPost(
  db: DB,
  authorId: string,
  courseId: string,
  title: string,
  body: string
): Promise<Post | null> {
  const [inserted] = await db
    .insert(posts)
    .values({ authorId, courseId, title, body })
    .returning({ id: posts.id });

  if (!inserted) return null;

  return getPost(db, inserted.id, authorId, "student");
}
