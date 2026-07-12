# Community Forum — Saved Posts: Implementation Plan

## Overview

A full-stack forum slice with a complete Saved Posts feature, built to evaluate clean layering,
correct data modeling, and production-quality engineering judgment. Built as a single Next.js 15
(App Router) monolith with an Elysia API server running separately, sharing a TypeScript-first codebase.

---

## Architecture Decision: Monorepo with Two Apps

```
forum/
├── packages/
│   └── shared/          # Zod schemas, types, i18n strings
├── apps/
│   ├── server/          # Elysia API (Bun runtime)
│   └── web/             # Next.js 15 App Router (React 19)
├── docker-compose.yml   # PostgreSQL
├── NOTES.md
└── README.md
```

**Why separate server + web?** The spec calls for Elysia (not Next.js route handlers), so we use a
proper API server. The web app is a pure client consuming the API — this gives a cleaner separation
and lets us test the API independently.

---

## Database Schema

### `users` (stubbed — pre-seeded)
```sql
id UUID PK, name TEXT, role ENUM('student','moderator')
```

### `courses` (context — pre-seeded)
```sql
id UUID PK, title TEXT
```

### `posts`
```sql
id UUID PK
course_id UUID FK → courses
author_id UUID FK → users
title TEXT NOT NULL
body TEXT NOT NULL
is_removed BOOLEAN DEFAULT false  -- soft delete by moderator
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### `saves` — **key design**
```sql
id UUID PK
user_id UUID FK → users
post_id UUID FK → posts
saved_at TIMESTAMPTZ NOT NULL DEFAULT now()
unsaved_at TIMESTAMPTZ NULL           -- NULL = currently saved
UNIQUE (user_id, post_id) WHERE unsaved_at IS NULL  -- partial unique index
```

**Why this shape?**
- The partial unique index guarantees no duplicate *active* saves at the DB level.
- `unsaved_at` preserves history — we can audit when a user saved/unsaved and re-saved.
- Re-saving = UPDATE saves SET unsaved_at=NULL, saved_at=now() WHERE user_id=X AND post_id=Y AND unsaved_at IS NOT NULL — idempotent UPSERT in application code.
- `saves_count` is a derived aggregate — no denormalized counter to keep in sync.

### `likes`
```sql
id UUID PK, user_id UUID FK, post_id UUID FK
UNIQUE(user_id, post_id)
created_at TIMESTAMPTZ
```

---

## Business Logic Layer (`server/src/services/`)

All business rules live in plain functions, injectable with a DB client — testable without a real DB.

### `saves.service.ts`
- `toggleSave(userId, postId)` → upsert logic, returns `{saved: boolean, savesCount: number}`
- `getSavedPosts(userId, page, limit)` → paginated list
- Idempotency: calling save when already saved is a no-op (returns current state, 200 not 201)

### `posts.service.ts`
- `listPosts(userId, courseId?)` → posts + `hasSaved`, `savesCount`, `likesCount` in **one query** (window functions / LEFT JOINs — no N+1)
- `removePost(moderatorId, postId)` → soft-delete, checks role

---

## API Layer (`server/src/routes/`)

Auth: read `x-user-id` + `x-user-role` headers (or a signed JWT — we'll use a simple HMAC-signed token for correctness without a full auth system).

| Method | Path | Role | Status codes |
|--------|------|------|-------------|
| GET | /posts | student/mod | 200 |
| GET | /posts/:id | student/mod | 200, 404 |
| POST | /posts | student/mod | 201, 400, 401 |
| DELETE | /posts/:id | moderator | 204, 403, 404 |
| POST | /posts/:id/saves | student/mod | 200 (idempotent toggle) |
| DELETE | /posts/:id/saves | student/mod | 200 (idempotent toggle) |
| GET | /users/me/saves | student/mod | 200 |

**Elysia features used**: typed context, middleware for auth, Zod validation via `@elysiajs/zod`.

---

## Client State (`web/src/`)

React Query v5 patterns:
- `usePostsQuery(courseId?)` — list with `hasSaved`, `savesCount`
- `useSaveToggleMutation(postId)` — **optimistic update**: immediately flip `hasSaved` + `savesCount` in cache, rollback on error
- `useSavedPostsQuery()` — the saved list page
- Cache invalidation: after toggle, invalidate `/users/me/saves` + update the specific post entry in `/posts` list cache

**Bookmark toggle is optimistic** — the UI feels instant even on slow connections.

---

## UI Structure (`web/src/app/`)

```
app/
├── layout.tsx           # providers: QueryClient, i18n
├── page.tsx             # forum feed (list of posts)
├── posts/[id]/page.tsx  # single post detail
├── saved/page.tsx       # saved posts list
└── components/
    ├── PostCard.tsx      # pure presentational
    ├── SaveButton.tsx    # uses useSaveToggleMutation
    ├── PostFeed.tsx      # data fetching wrapper
    └── EmptyState.tsx    # loading / empty handling
```

Presentation components receive props only — no data fetching inside them.

---

## Internationalization

Using `next-intl` (the standard for Next.js App Router i18n):
- `messages/en.json` + `messages/es.json` (two locales to demonstrate)
- All UI strings externalized: post titles, button labels, empty states
- Pluralization: `"{count, plural, one {# post saved} other {# posts saved}}"`

---

## Tests

### API Integration Tests (`server/src/tests/`)
Using Vitest + Elysia's built-in test client:
- `saves.test.ts`: save → 200, double-save idempotent → 200, unsave → 200, re-save → 200
- `auth.test.ts`: missing header → 401, wrong role for DELETE post → 403
- `posts.test.ts`: list returns hasSaved correctly per user

### Unit Tests
- `saves.service.test.ts`: toggle logic without DB (mock)

---

## Verification Plan

1. `docker compose up -d` → Postgres running
2. `bun run db:migrate` → schema applied
3. `bun run db:seed` → two users (student, moderator), two courses, five posts
4. `bun run dev` (server + web concurrently)
5. `bun run test` → all tests green

---

## Open Questions / Trade-offs Noted in NOTES.md

- **Auth stub**: using HMAC-signed token in header; no cookie/session
- **No pagination UI**: API is paginated, UI shows first page (noted as next step)
- **No real-time**: saves count updates on next fetch, not websocket
- **SQLite option**: will use PostgreSQL + Docker; SQLite fallback noted
