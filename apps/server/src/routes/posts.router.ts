import Elysia, { t } from "elysia";
import { authPlugin, requireAuth, requireRole } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { listPosts, getPost, createPost, removePost } from "../services/posts.service.js";
import { isEnrolled, getEnrolledCourseIds } from "../services/enrollment.service.js";

export const postsRouter = new Elysia({ prefix: "/posts" })
  .use(authPlugin)

  // ── GET /posts ──────────────────────────────────────────────────────────────
  // Students: only posts from their enrolled courses.
  // Moderators: all posts (no enrollment restriction).
  .get(
    "/",
    async ({ user, query, set }) => {
      requireAuth({ user, set });

      const page = Number(query.page ?? 1);
      const limit = Math.min(Number(query.limit ?? 20), 100);
      const courseId = query.courseId;

      // Moderators bypass enrollment — they see everything
      const enrolledCourseIds =
        user.role === "moderator"
          ? undefined
          : await getEnrolledCourseIds(db, user.sub);

      // If a specific course is requested, verify the student is enrolled in it
      if (user.role === "student" && courseId) {
        const enrolled = await isEnrolled(db, user.sub, courseId);
        if (!enrolled) {
          set.status = 403;
          return { error: "FORBIDDEN", message: "Not enrolled in this course", statusCode: 403 };
        }
      }

      const result = await listPosts(
        db,
        user.sub,
        { page, limit, courseId, enrolledCourseIds },
        user.role
      );

      return result;
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        courseId: t.Optional(t.String()),
      }),
    }
  )

  // ── GET /posts/:id ──────────────────────────────────────────────────────────
  .get(
    "/:id",
    async ({ user, params, set }) => {
      requireAuth({ user, set });

      const post = await getPost(db, params.id, user.sub, user.role);

      if (!post) {
        set.status = 404;
        return { error: "NOT_FOUND", message: "Post not found", statusCode: 404 };
      }

      // Students must be enrolled in the post's course
      if (user.role === "student") {
        const enrolled = await isEnrolled(db, user.sub, post.courseId);
        if (!enrolled) {
          set.status = 403;
          return { error: "FORBIDDEN", message: "Not enrolled in this course", statusCode: 403 };
        }
      }

      return post;
    },
    {
      params: t.Object({ id: t.String() }),
    }
  )

  // ── POST /posts ─────────────────────────────────────────────────────────────
  .post(
    "/",
    async ({ user, body, set }) => {
      requireAuth({ user, set });

      if (!body.courseId || !body.title || !body.body) {
        set.status = 400;
        return {
          error: "VALIDATION_ERROR",
          message: "courseId, title, and body are required",
          statusCode: 400,
        };
      }

      // Students can only post in courses they're enrolled in
      if (user.role === "student") {
        const enrolled = await isEnrolled(db, user.sub, body.courseId);
        if (!enrolled) {
          set.status = 403;
          return { error: "FORBIDDEN", message: "Not enrolled in this course", statusCode: 403 };
        }
      }

      const post = await createPost(db, user.sub, body.courseId, body.title, body.body);

      if (!post) {
        set.status = 500;
        return { error: "SERVER_ERROR", message: "Failed to create post", statusCode: 500 };
      }

      set.status = 201;
      return post;
    },
    {
      body: t.Object({
        courseId: t.String(),
        title: t.String(),
        body: t.String(),
      }),
    }
  )

  // ── DELETE /posts/:id ────────────────────────────────────────────────────────
  // Moderator only — soft-deletes the post
  .delete(
    "/:id",
    async ({ user, params, set }) => {
      requireRole({ user, set }, "moderator");

      const existing = await getPost(db, params.id, user.sub, "moderator");
      if (!existing) {
        set.status = 404;
        return { error: "NOT_FOUND", message: "Post not found", statusCode: 404 };
      }

      await removePost(db, params.id, user.sub);

      // Bun rejects Response bodies on 204 — return an empty Response explicitly
      return new Response(null, { status: 204 });
    },
    {
      params: t.Object({ id: t.String() }),
    }
  );
