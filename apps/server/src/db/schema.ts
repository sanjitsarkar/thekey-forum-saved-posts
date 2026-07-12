import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";


// ─── Enums ────────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", ["student", "moderator"]);

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull().default("student"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Courses ──────────────────────────────────────────────────────────────────

export const courses = pgTable("courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Posts ────────────────────────────────────────────────────────────────────

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    isRemoved: boolean("is_removed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("posts_course_id_idx").on(t.courseId),
    index("posts_author_id_idx").on(t.authorId),
    index("posts_created_at_idx").on(t.createdAt),
  ]
);

// ─── Saves ────────────────────────────────────────────────────────────────────
//
// Design: We keep a full history of save/un-save cycles.
//   - unsaved_at NULL   → the post is currently saved (active bookmark)
//   - unsaved_at NOT NULL → the bookmark was removed
//
// The partial unique index on (user_id, post_id) WHERE unsaved_at IS NULL
// guarantees at most one *active* save per (user, post) at the database level,
// even under concurrent requests — no application-level locking needed.
//
// Re-save flow: UPDATE existing row (set unsaved_at=NULL, saved_at=NOW())
//               rather than INSERT — preserving the single canonical row per cycle.
// Un-save flow: UPDATE existing row (set unsaved_at=NOW())

export const saves = pgTable(
  "saves",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
    unsavedAt: timestamp("unsaved_at", { withTimezone: true }),
  },
  (t) => [
    // Partial unique index — the heart of the idempotency guarantee.
    // Only ONE active (unsaved_at IS NULL) save per (user, post) is allowed.
    uniqueIndex("saves_active_unique_idx")
      .on(t.userId, t.postId)
      .where(sql`${t.unsavedAt} IS NULL`),
    index("saves_user_id_idx").on(t.userId),
    index("saves_post_id_idx").on(t.postId),
  ]
);

// ─── Enrollments ──────────────────────────────────────────────────────────────
//
// A student is "in" a course only if a row exists here.
// Moderators bypass this check entirely — they see all posts across all courses.

export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("enrollments_user_course_unique_idx").on(t.userId, t.courseId),
    index("enrollments_user_id_idx").on(t.userId),
    index("enrollments_course_id_idx").on(t.courseId),
  ]
);

// ─── Likes ────────────────────────────────────────────────────────────────────

export const likes = pgTable(
  "likes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("likes_user_post_unique_idx").on(t.userId, t.postId)]
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;

export type Save = typeof saves.$inferSelect;
export type NewSave = typeof saves.$inferInsert;

export type Like = typeof likes.$inferSelect;
export type NewLike = typeof likes.$inferInsert;

export type Enrollment = typeof enrollments.$inferSelect;
export type NewEnrollment = typeof enrollments.$inferInsert;
