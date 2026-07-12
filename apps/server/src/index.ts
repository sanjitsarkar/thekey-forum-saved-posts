import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { postsRouter } from "./routes/posts.router.js";
import { savesRouter } from "./routes/saves.router.js";
import { devRouter } from "./routes/dev.router.js";

const PORT = Number(process.env["PORT"] ?? 3001);
const isDev = process.env["NODE_ENV"] !== "production";

const app = new Elysia()
  .use(
    cors({
      origin: (request) => {
        const origin = request.headers.get("Origin");
        if (!origin) return true; // server-to-server
        const extra = (process.env["ALLOWED_ORIGINS"] ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const defaults = ["http://localhost:3000", "http://localhost:3001"];
        return [...defaults, ...extra].includes(origin);
      },
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
    })
  )

  // Health check
  .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))

  // API routes
  .use(postsRouter)
  .use(savesRouter)

  // Dev-only token issuer (not in production)
  .use(isDev ? devRouter : new Elysia())

  // Global error handler
  .onError(({ error, set, code }) => {
    const message = error instanceof Error ? error.message : "Internal server error";

    if (code === "VALIDATION") {
      set.status = 400;
      return { error: "VALIDATION_ERROR", message, statusCode: 400 };
    }

    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "NOT_FOUND", message: "Route not found", statusCode: 404 };
    }

    // Auth errors thrown by requireAuth / requireRole
    if (message === "Authentication required") {
      set.status = 401;
      return { error: "UNAUTHORIZED", message, statusCode: 401 };
    }

    if (message.startsWith("Requires role:")) {
      set.status = 403;
      return { error: "FORBIDDEN", message, statusCode: 403 };
    }

    console.error("[Error]", error);
    set.status = 500;
    return { error: "INTERNAL_ERROR", message: "Internal server error", statusCode: 500 };
  })

  .listen(PORT);

console.log(`🚀 Forum API running at http://localhost:${PORT}`);

export type App = typeof app;
