# Community Forum — Saved Posts

A full-stack forum slice with a complete Saved Posts feature, built as a take-home assessment.

## Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (strict mode) |
| API Server | Elysia on Bun |
| Database | PostgreSQL + Drizzle ORM |
| Client State | React Query v5 (TanStack) |
| UI | React 19 + Next.js 15 (App Router) |
| Validation | Zod |
| Auth | HMAC-signed JWT (jose) |
| i18n | next-intl (en + es) |
| Tests | Vitest + API integration tests |

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.1.0
- [Docker](https://docker.com) (for PostgreSQL) — or use SQLite fallback (see Notes)
- Node.js ≥ 20 (for Next.js, if not using Bun for the web)

## Quick Start

```bash
# 1. Clone and install
cd forum
bun install

# 2. Start PostgreSQL (maps to host port 5433)
docker compose up -d

# Wait for postgres to be healthy (~5 seconds)
docker compose ps

# 3. Run migrations
bun run db:migrate

# 4. Seed the database
bun run db:seed

# 5. Start both servers (API + web)
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The API runs on port **3001**, the web app on port **3000**.

## Test Users & Enrollment

After seeding, three users are available. Click a user in the navbar to sign in:

| Name | Role | UUID | Enrolled in |
|------|------|------|-------------|
| Alice | Student | `00000000-0000-0000-0000-000000000001` | Web Development Fundamentals |
| Bob | Student | `00000000-0000-0000-0000-000000000002` | Data Science with Python |
| Carol | Moderator | `00000000-0000-0000-0000-000000000003` | All courses (moderator bypass) |

Students see only posts from their enrolled course. Trying to access or save a post from a different course returns **403**.

## Running Tests

Tests require a running PostgreSQL instance. The test suite uses a separate `forum_test` database
that is created and migrated automatically.

```bash
# Create the test database (Postgres is on host port 5433)
docker exec -it forum-postgres-1 psql -U forum -c "CREATE DATABASE forum_test;"

# Run tests
bun run test
```

## API Reference

All endpoints require `Authorization: Bearer <token>` header.
Get a token via `POST /dev/token` with `{ "userId": "<uuid>" }` (dev-only).

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | /posts | any | List posts (with hasSaved, savesCount) |
| GET | /posts/:id | any | Get single post |
| POST | /posts | any | Create a post |
| DELETE | /posts/:id | moderator | Soft-delete a post |
| POST | /posts/:id/saves | any | Save a post (toggle) |
| DELETE | /posts/:id/saves | any | Unsave a post (toggle) |
| GET | /users/me/saves | any | Get authenticated user's saved posts |
| POST | /dev/token | — | Issue a JWT for a user (dev only) |
| GET | /health | — | Health check |

## Project Structure

```
forum/
├── apps/
│   ├── server/              # Elysia API (Bun)
│   │   └── src/
│   │       ├── auth/        # JWT sign/verify + Elysia middleware
│   │       ├── db/          # Drizzle schema, migrations, seed
│   │       ├── routes/      # posts.router, saves.router, dev.router
│   │       ├── services/    # posts.service, saves.service (business logic)
│   │       └── tests/       # Integration tests (Vitest)
│   └── web/                 # Next.js 15 App Router
│       └── src/
│           ├── app/         # Pages: /, /saved, /posts/[id]
│           ├── components/  # PostCard, PostFeed, SaveButton, RemoveButton, Navbar
│           ├── hooks/       # useForum (React Query), useAuth
│           ├── i18n/        # next-intl config
│           ├── lib/         # API client
│           └── styles/      # globals.css
├── packages/
│   └── shared/              # Zod schemas + TypeScript types
├── messages/                # i18n strings (en.json, es.json)
├── docker-compose.yml
├── README.md
└── NOTES.md
```
