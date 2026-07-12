import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { AuthTokenPayload } from "@forum/shared";

const secret = new TextEncoder().encode(
  process.env["JWT_SECRET"] ?? "dev-secret-change-in-production"
);

const ALGORITHM = "HS256";
const ISSUER = "forum-api";
const AUDIENCE = "forum-web";

/**
 * Sign a short-lived JWT containing userId and role.
 * In production you'd set a short expiry and use refresh tokens.
 * For this assessment we use 7d for developer convenience.
 */
export async function signToken(payload: Omit<AuthTokenPayload, "iat">): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime("7d")
    .sign(secret);
}

/**
 * Verify and decode a JWT. Returns null if invalid/expired.
 */
export async function verifyToken(token: string): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    const parsed = parsePayload(payload);
    return parsed;
  } catch {
    return null;
  }
}

function parsePayload(payload: JWTPayload): AuthTokenPayload | null {
  if (
    typeof payload["sub"] !== "string" ||
    typeof payload["role"] !== "string" ||
    typeof payload["name"] !== "string" ||
    typeof payload["iat"] !== "number"
  ) {
    return null;
  }

  if (payload["role"] !== "student" && payload["role"] !== "moderator") {
    return null;
  }

  return {
    sub: payload["sub"],
    role: payload["role"],
    name: payload["name"],
    iat: payload["iat"],
  };
}
