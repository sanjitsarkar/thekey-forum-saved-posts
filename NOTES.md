# NOTES.md — Design Decisions & Trade-offs

## Key Design Decisions

### 0. Course Enrollment — Access Control Model

A student is "in" a course if an `enrollments` row exists for `(user_id, course_id)`.

The `enrollments` table is a simple join table with a `UNIQUE(user_id, course_id)` index. No soft-delete is needed here — removing a row fully un-enrolls the student.

Enforcement happens at the **API layer**:

- `GET /posts` (feed) — students see only posts from their enrolled courses (done with an `inArray(posts.courseId, enrolledCourseIds)` clause, not post-filter, so pagination counts are correct).
- `GET /posts/:id` — 403 if the post's course is not in the student's enrollment set.
- `POST /posts/:id/saves` / `DELETE /posts/:id/saves` — 403 if not enrolled.
- `POST /posts` — 403 if trying to post into an unenrolled course.
- Moderators bypass all enrollment checks — they see and act on any post across all courses.

The check is a single indexed lookup (`isEnrolled`) or a batch query (`getEnrolledCourseIds`) — one extra DB round-trip per request, which is acceptable for this API shape.



### 1. Schema Shape: `saves` with Partial Unique Index

The `saves` table stores the full history of save/unsave cycles. The critical constraint is:

```sql
UNIQUE (user_id, post_id) WHERE unsaved_at IS NULL
```

This is a **partial unique index** — it only enforces uniqueness among *active* saves (where `unsaved_at IS NULL`). 
This means:

- At most one active save per (user, post) — enforced at the DB level, not application-level
- History is preserved: you can audit when a post was saved, unsaved, and re-saved
- Re-saving reactivates the existing row (`UPDATE ... SET unsaved_at=NULL`) rather than inserting a new one
- Un-saving sets `unsaved_at = NOW()` on the existing row
- Under concurrent `POST /saves` requests, the DB index prevents duplicate inserts — one wins, one gets a conflict error that the application handles gracefully

The alternative was a simple `UNIQUE(user_id, post_id)` with an `is_active` boolean. I chose the timestamp approach because it gives you real audit data (when was the last save? how many save/unsave cycles?) essentially for free.

### 2. Where Auth Lives

Auth validation lives **in a single Elysia plugin** (`auth/middleware.ts`) that is registered globally. Every handler that needs auth calls `requireAuth(ctx)` or `requireRole(ctx, "moderator")`. These are type-safe assertion functions — TypeScript narrows `ctx.user` from `AuthTokenPayload | null` to `AuthTokenPayload` after the assertion.

This means:
- The auth check is explicit at each handler (auditable, not "magic middleware")
- TypeScript enforces that you can't access `ctx.user.sub` without calling `requireAuth` first
- It's testable: you can call handlers in tests with any auth context

I chose JWT (HMAC HS256, via `jose`) over plain header stubs because it demonstrates a realistic auth pattern while still being "stubbed" (no login flow, no refresh tokens). The dev-only `POST /dev/token` endpoint lets you get tokens without a login UI.

### 3. Fetching `hasSaved` + `savesCount` Efficiently

Both values are fetched in a **single SQL query** using `LEFT JOIN` and aggregation:

```sql
SELECT
  posts.*,
  COUNT(DISTINCT CASE WHEN saves.unsaved_at IS NULL THEN saves.id END) AS saves_count,
  BOOL_OR(
    CASE WHEN saves.user_id = $userId AND saves.unsaved_at IS NULL THEN true ELSE false END
  ) AS has_saved
FROM posts
LEFT JOIN saves ON posts.id = saves.post_id
GROUP BY posts.id, ...
```

No N+1. No separate "check if saved" query per post. The `BOOL_OR` aggregate scans all save rows per post group and returns true if any of them belong to the requesting user with an active save. This scales correctly even with many saves per post.

### 4. Optimistic UI for the Bookmark Toggle

When a user clicks the bookmark button:
1. React Query immediately updates the `PostListResponse` cache (flipping `hasSaved`, adjusting `savesCount` by ±1)
2. The mutation fires against the API
3. On success, the cache is invalidated to sync with the server
4. On error, the previous cache value is restored (rollback)

The optimistic delta is ±1 which is correct for a single user. The server-authoritative count syncs back on `onSettled`.

### 5. Why Elysia as a Separate Server (not Next.js Route Handlers)

The spec preferred Elysia. Elysia runs on Bun and is significantly faster than Node.js-based routers for an API server. The separation also gives a cleaner architecture: the web app is a pure client, and the API is independently testable and deployable.

---

## Trade-offs and Deliberate Descoping

### Pagination UI
The API is fully paginated (page + limit query params, total in response). The UI shows the first page only. Building a pagination UI would have consumed ~45 minutes with no architectural insight — the interesting part is the API design, which is complete.

### No Real-Time / WebSockets
Save counts update when the user next fetches (or when the cache is invalidated after their own mutation). Real-time would require Server-Sent Events or WebSockets — out of scope for this box.

### Auth via localStorage
The JWT is stored in `localStorage` for simplicity. In production, this should be an `HttpOnly` cookie to prevent XSS attacks. The assessment stub trades security for simplicity, explicitly noted here.

### Postgres port
Docker Compose maps Postgres to host port **5433** (not 5432) so it does not clash with a local Postgres install. Connection strings in `.env` use `localhost:5433`.

### Course Filtering UI
The API accepts a `courseId` filter. The UI doesn't yet surface a course filter dropdown — just a clean decision about what was worth the time.

### No Optimistic Remove
The "remove post" mutation invalidates the cache after success rather than doing an optimistic update, because a failed remove (network error) that optimistically disappeared from the list would be confusing UX.

### i18n Locale Switch
Locale is read from a cookie. There's no locale-switcher UI (would have needed a server action to set the cookie). You can test Spanish by setting `document.cookie = "locale=es"` in the browser console and refreshing.

---

## What I'd Do Next (with Another Day)

1. **Database transactions**: Wrap the `toggleSave` in a single DB transaction to handle the read-then-write race condition more explicitly. The partial unique index already prevents duplicate active saves, but a transaction with `FOR UPDATE` on the save row would be cleaner.

2. **Cursor pagination**: Replace offset-based pagination with cursor-based for the saves list — more efficient at scale and avoids duplicates when new posts are saved during pagination.

3. **Rate limiting**: Add per-user rate limiting on the toggle endpoint (e.g., prevent toggling >10 times/second per user).

4. **HttpOnly cookie auth**: Move JWT from `Authorization: Bearer` header (localStorage) to `HttpOnly` cookie for XSS safety.

5. **Proper i18n routing**: Use Next.js `i18n` routing (URL-based locale: `/en/forum`, `/es/forum`) instead of cookie-based locale.

6. **Like toggle**: The `likes` table is seeded but the like button is not yet implemented in the UI — the API would follow the same pattern as saves.

7. **E2E tests**: Add Playwright tests for the full save flow: click bookmark → see it in Saved Posts → unsave → disappears.

8. **Metrics**: Add a simple `p99_save_toggle_ms` histogram so we can catch regressions in the hot path.
