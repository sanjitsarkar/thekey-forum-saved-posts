# Implementation Plan & Codebase Guide for Cursor

This document provides a comprehensive overview of the **Community Forum — Saved Posts** full-stack slice. Use this file as context/prompts for **Cursor Composer** or **Cursor Chat** to verify, modify, or extend the codebase.

---

## 🏗️ Architecture & Layering

The application is structured as a TypeScript monorepo using Bun/Node workspaces:
- `packages/shared/`: Single source of truth for Zod schemas, TypeScript types, and validation logic.
- `apps/server/`: High-performance API server using Elysia and Drizzle ORM.
- `apps/web/`: React 19 / Next.js 15 (App Router) client application utilizing TanStack React Query v5.

```
forum/
├── packages/
│   └── shared/          # Shared validators and types
├── apps/
│   ├── server/          # Elysia API + Drizzle Postgres
│   └── web/             # Next.js 15 Client
├── README.md
└── NOTES.md
```

---

## 🗄️ Database Schema & Idempotency Design

The core of the "Saved Posts" feature is the `saves` schema in [schema.ts](file:///Users/sanjitsarkar/JUCE/Demo/NewProject/forum/apps/server/src/db/schema.ts):

```typescript
export const saves = pgTable(
  "saves",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
    unsavedAt: timestamp("unsaved_at", { withTimezone: true }),
  },
  (t) => [
    // Partial unique index enforcing at most one active save per (user, post)
    uniqueIndex("saves_active_unique_idx")
      .on(t.userId, t.postId)
      .where(sql`${t.unsavedAt} IS NULL`),
    index("saves_user_id_idx").on(t.userId),
    index("saves_post_id_idx").on(t.postId),
  ]
);
```

### Idempotency Flow
- **Save**: Checks for an existing row. If none exists, inserts a new row. If an inactive row exists (`unsaved_at IS NOT NULL`), reactivates it by setting `unsaved_at = null` and updating `saved_at`.
- **Unsave**: Updates the active row, setting `unsaved_at = NOW()`.
- **Concurrency**: The partial unique index `saves_active_unique_idx` guarantees database-level safety against concurrent save requests.

---

## 🔌 API Endpoints & Auth

Authentication is stubbed using a signed JWT payload containing `{ sub: userId, role: "student" | "moderator", name: string }`. A developer-only route `/dev/token` is available to issue tokens for the pre-seeded users.

- **GET /posts**: Returns paginated posts, including aggregated fields `savesCount`, `likesCount`, and `hasSaved` (boolean status for the requesting user). All aggregations are done in a single database query to avoid N+1 query overhead. See [posts.service.ts](file:///Users/sanjitsarkar/JUCE/Demo/NewProject/forum/apps/server/src/services/posts.service.ts).
- **GET /posts/:id**: Gets a single post's details.
- **POST /posts**: Creates a new post.
- **DELETE /posts/:id**: Soft-deletes a post (Moderator role only).
- **POST /posts/:id/saves**: Saves a post.
- **DELETE /posts/:id/saves**: Unsaves a post.
- **GET /users/me/saves**: Gets all active saved posts for the current user.

---

## 🎨 Client State & Optimistic UI

The client uses TanStack React Query v5 to manage server cache in [useForum.ts](file:///Users/sanjitsarkar/JUCE/Demo/NewProject/forum/apps/web/src/hooks/useForum.ts):

- **Optimistic Updates**: Toggling a bookmark immediately flips `hasSaved` and adjusts `savesCount` (±1) in the cache. On mutation failure, it rolls back to the previous snapshot.
- **Cache Consistency**: Invalidates both the feed query and the `/users/me/saves` query when a toggle settles, ensuring all lists stay in sync.

---

## 🌐 i18n & Pluralization

Internationalization is handled by `next-intl` (en/es). Key pluralization rules are defined using the ICU format in [en.json](file:///Users/sanjitsarkar/JUCE/Demo/NewProject/forum/apps/web/messages/en.json):

```json
"saves": "{count, plural, =0 {No saves} one {# save} other {# saves}}"
```

Locale selection is read from the `locale` cookie, falling back to English.

---

## 🤖 Prompts to Feed to Cursor

Here are specific prompts you can type directly into Cursor Composer or Chat:

### Prompt 1: Verify the DB Connection and Run Migrations
> "Drizzle-kit generated migrations are placed in `apps/server/src/db/migrations`. Check if `apps/server/src/db/migrate.ts` runs correctly, and check the PostgreSQL connection in `apps/server/src/db/client.ts`. If Postgres is not running, help me add an SQLite fallback configuration so I can run it locally without Docker."

### Prompt 2: Run and Analyze Vitest Tests
> "Run the Vitest integration tests located in `apps/server/src/tests/` using `bun run test`. Explain if any assertions in `saves.test.ts` or `api.test.ts` are failing, and help me resolve them."

### Prompt 3: Implement the Likes Feature End-to-End
> "I want to implement the Likes toggle feature end-to-end. Drizzle already has a `likes` table in `schema.ts`. Let's build the endpoint `POST /posts/:id/likes` and `DELETE /posts/:id/likes` in `posts.router.ts`, add service functions in `posts.service.ts`, implement optimistic updates in the React Query hook `useForum.ts`, and wire it up to a Like button in `PostCard.tsx`."

### Prompt 4: Add Course Filtering in the UI
> "The API already supports fetching posts filtered by `courseId`. Modify `apps/web/src/app/page.tsx` and build a dropdown filter component in Next.js that lets students filter the post feed by course. Ensure it updates the React Query key appropriately so caching works correctly."
