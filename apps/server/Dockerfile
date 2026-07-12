FROM oven/bun:1.3 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/

# Copy shared package source (needed at install time for workspace resolution)
COPY packages/shared/ ./packages/shared/

RUN bun install --frozen-lockfile

# Copy server source
COPY apps/server/ ./apps/server/

# Run migrations then start the API
# DATABASE_URL is injected at runtime via environment variables
CMD ["sh", "-c", "bun run apps/server/src/db/migrate.ts && bun run apps/server/src/index.ts"]
