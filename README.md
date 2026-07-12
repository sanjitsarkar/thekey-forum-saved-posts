# Community Forum — Saved Posts

A full-stack take-home slice for THEKEY: a discussion feed with an end-to-end bookmarks (Saved Posts) feature, course enrollment enforcement, optimistic UI, i18n, and a full test suite.

## Live Deployment

| | URL |
|--|--|
| Web App | https://forum-one-sage.vercel.app |
| API | https://thekey-forum-api-production.up.railway.app |

Health check: [`/health`](https://thekey-forum-api-production.up.railway.app/health)

## Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (strict mode) |
| API Server | Elysia on Bun |
| Database | PostgreSQL + Drizzle ORM |
| Client State | TanStack React Query v5 |
| UI | React 19 + Next.js 15 (App Router) |
| Validation | Zod |
| Auth | HMAC-signed JWT (jose) |
| i18n | next-intl (en + es) |
| Tests | Vitest — 35 unit + integration tests |

---

## Local Development

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.1
- [Docker](https://docker.com) (for PostgreSQL)

### Setup

```bash
# 1. Install dependencies
bun install

# 2. Start PostgreSQL on port 5433
#    (5433 to avoid clashing with a local Postgres on 5432)
docker compose up -d

# 3. Run migrations
bun run db:migrate

# 4. Seed the database
bun run db:seed

# 5. Start both servers (API :3001, web :3000)
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Running Tests

```bash
# Create the test database (one-time)
docker exec -it forum-postgres-1 psql -U forum -c "CREATE DATABASE forum_test;"

# Run all tests
bun run test
```

Tests run against a separate `forum_test` database and are fully isolated.

---

## Test Users & Enrollment

| Name | Role | Enrolled in |
|------|------|-------------|
| Alice | Student | Web Development Fundamentals |
| Bob | Student | Data Science with Python |
| Carol | Moderator | All courses (bypasses enrollment checks) |

Click any user in the navbar to sign in. Students see only posts from their enrolled course; accessing or saving a post from another course returns **403**.

---

## API Reference

All endpoints require `Authorization: Bearer <token>`.  
Get a token via `POST /dev/token` with `{ "userId": "<uuid>" }` (dev/staging only).

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | /posts | any | Paginated feed (enrolled courses only for students) |
| GET | /posts/:id | any | Single post (403 if not enrolled) |
| POST | /posts | any | Create a post (403 if not enrolled in that course) |
| DELETE | /posts/:id | moderator | Soft-delete |
| POST | /posts/:id/saves | any | Save a post — idempotent (403 if not enrolled) |
| DELETE | /posts/:id/saves | any | Unsave — idempotent (403 if not enrolled) |
| GET | /users/me/saves | any | Authenticated user's saved posts |
| POST | /dev/token | — | Issue a JWT (dev only, disabled in production) |
| GET | /health | — | Health check |

---

## Deployment

### API → Railway

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → select `thekey-forum-saved-posts`.
2. Add a **Postgres** plugin — Railway auto-injects `DATABASE_URL`.
3. Add these environment variables in the Railway service settings:
   ```
   JWT_SECRET=<long-random-string>
   NODE_ENV=production
   PORT=3001
   ```
4. Railway auto-detects the `Dockerfile` in `apps/server/` and deploys.  
   The container runs `db:migrate` then starts the API on every deploy.
5. Copy the generated **Railway URL** (e.g. `https://thekey-forum-saved-posts.railway.app`).

### Web → Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project** → import `thekey-forum-saved-posts`.
2. Set **Root Directory** to `apps/web`.
3. Add environment variable:
   ```
   NEXT_PUBLIC_API_URL=https://<your-railway-url>.railway.app
   ```
4. Deploy. Vercel auto-detects Next.js.

---

## Project Structure

```
forum/
├── apps/
│   ├── server/              # Elysia API (Bun)
│   │   └── src/
│   │       ├── auth/        # JWT sign/verify + Elysia middleware
│   │       ├── db/          # Drizzle schema, migrations, seed
│   │       ├── routes/      # posts.router, saves.router, dev.router
│   │       ├── services/    # posts.service, saves.service, enrollment.service
│   │       └── tests/       # 35 Vitest integration + unit tests
│   └── web/                 # Next.js 15 App Router
│       └── src/
│           ├── app/         # Pages: /, /saved, /posts/[id]
│           ├── components/  # PostCard, PostFeed, SaveButton, RemoveButton, EmptyState, Navbar
│           ├── hooks/       # useForum (React Query), useAuth
│           ├── i18n/        # next-intl config
│           ├── lib/         # Typed API client
│           └── styles/      # globals.css
├── packages/
│   └── shared/              # Zod schemas + TypeScript types (shared between server and web)
├── docker-compose.yml
├── railway.json
├── README.md
└── NOTES.md
```
