import Elysia from "elysia";
import { verifyToken } from "./jwt.js";
import type { AuthTokenPayload } from "@forum/shared";

/**
 * Elysia plugin that extracts and verifies the Bearer token from
 * the Authorization header and attaches the decoded payload to ctx.user.
 *
 * Usage: app.use(authPlugin)
 *
 * To protect a route, call `requireAuth(ctx)` or `requireRole(ctx, "moderator")`.
 */
export const authPlugin = new Elysia({ name: "auth" }).derive(
  { as: "global" },
  async ({ headers, set }) => {
    const authHeader = headers["authorization"];

    if (!authHeader?.startsWith("Bearer ")) {
      return { user: null as AuthTokenPayload | null };
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token);

    return { user: payload as AuthTokenPayload | null };
  }
);

/**
 * Asserts the request is authenticated. Throws 401 if not.
 */
export function requireAuth(
  ctx: { user: AuthTokenPayload | null; set: { status: number } },
  message = "Authentication required"
): asserts ctx is { user: AuthTokenPayload; set: { status: number } } {
  if (!ctx.user) {
    ctx.set.status = 401;
    throw new Error(message);
  }
}

/**
 * Asserts the authenticated user has the required role. Throws 403 if not.
 */
export function requireRole(
  ctx: { user: AuthTokenPayload | null; set: { status: number } },
  role: "moderator"
): asserts ctx is { user: AuthTokenPayload; set: { status: number } } {
  requireAuth(ctx);
  if (ctx.user.role !== role) {
    ctx.set.status = 403;
    throw new Error(`Requires role: ${role}`);
  }
}
