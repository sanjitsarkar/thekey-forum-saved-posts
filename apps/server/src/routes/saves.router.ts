import Elysia, { t } from "elysia";
import { authPlugin, requireAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { savePost, unsavePost, getSavedPosts } from "../services/saves.service.js";
import { getPost } from "../services/posts.service.js";
import { isEnrolled } from "../services/enrollment.service.js";

export const savesRouter = new Elysia()
  .use(authPlugin)

  // ── POST /posts/:id/saves — ensure saved (idempotent) ───────────────────────
  .post(
    "/posts/:id/saves",
    async ({ user, params, set }) => {
      requireAuth({ user, set });

      const post = await getPost(db, params.id, user.sub, user.role);
      if (!post) {
        set.status = 404;
        return { error: "NOT_FOUND", message: "Post not found", statusCode: 404 };
      }

      // Students may only save posts from courses they're enrolled in
      if (user.role === "student") {
        const enrolled = await isEnrolled(db, user.sub, post.courseId);
        if (!enrolled) {
          set.status = 403;
          return { error: "FORBIDDEN", message: "Not enrolled in this course", statusCode: 403 };
        }
      }

      // Idempotent: already-saved → 200 with current state (no-op)
      const result = await savePost(db, user.sub, params.id);

      set.status = 200;
      return result;
    },
    {
      params: t.Object({ id: t.String() }),
    }
  )

  // ── DELETE /posts/:id/saves — ensure unsaved (idempotent) ───────────────────
  .delete(
    "/posts/:id/saves",
    async ({ user, params, set }) => {
      requireAuth({ user, set });

      const post = await getPost(db, params.id, user.sub, user.role);
      if (!post) {
        set.status = 404;
        return { error: "NOT_FOUND", message: "Post not found", statusCode: 404 };
      }

      // Students may only interact with posts from enrolled courses
      if (user.role === "student") {
        const enrolled = await isEnrolled(db, user.sub, post.courseId);
        if (!enrolled) {
          set.status = 403;
          return { error: "FORBIDDEN", message: "Not enrolled in this course", statusCode: 403 };
        }
      }

      // Idempotent: already-unsaved → 200 with saved=false (no-op)
      const result = await unsavePost(db, user.sub, params.id);

      set.status = 200;
      return result;
    },
    {
      params: t.Object({ id: t.String() }),
    }
  )

  // ── GET /users/me/saves ─────────────────────────────────────────────────────
  .get(
    "/users/me/saves",
    async ({ user, query, set }) => {
      requireAuth({ user, set });

      const page = Number(query.page ?? 1);
      const limit = Math.min(Number(query.limit ?? 20), 100);

      const result = await getSavedPosts(db, user.sub, page, limit);

      return result;
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    }
  );
