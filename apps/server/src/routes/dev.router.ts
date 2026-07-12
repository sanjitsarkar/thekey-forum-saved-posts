import Elysia, { t } from "elysia";
import { signToken } from "../auth/jwt.js";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

/**
 * Dev-only route to issue auth tokens for testing.
 * This route is ONLY registered when NODE_ENV !== 'production'.
 */
export const devRouter = new Elysia({ prefix: "/dev" }).post(
  "/token",
  async ({ body, set }) => {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, body.userId))
      .limit(1);

    if (!user) {
      set.status = 404;
      return { error: "User not found" };
    }

    const token = await signToken({
      sub: user.id,
      role: user.role,
      name: user.name,
    });

    return { token, user: { id: user.id, name: user.name, role: user.role } };
  },
  {
    body: t.Object({ userId: t.String() }),
  }
);
