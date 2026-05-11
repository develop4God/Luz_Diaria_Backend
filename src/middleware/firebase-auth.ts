import type { Context, Next } from "hono";
import { prisma } from "../prisma";
import { getAuth } from "../firebase";
import { IS_DEV } from "../env";

export type AuthUser = {
  firebaseUid: string;
  email: string;
  userId?: string;
};

/**
 * Firebase Auth middleware
 * Verifies Firebase ID token from Authorization header
 * Expects: Authorization: Bearer <idToken>
 * 
 * On production: verifies token with Firebase Admin SDK
 * On dev: accepts base64-encoded test tokens for easier testing
 */
export function firebaseAuth(c: Context, next: Next) {
  return async () => {
    const authHeader = c.req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.warn(`[Firebase Auth] Missing or malformed Authorization header on ${c.req.method} ${c.req.path}`);
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const idToken = authHeader.slice(7); // Remove "Bearer " prefix

    try {
      let firebaseUid: string;
      let email: string;

      if (IS_DEV) {
        // Dev mode: accept simple JWT-like format or base64 for testing
        try {
          const parts = idToken.split(".");
          if (parts.length === 3) {
            // Looks like a JWT
            const payload = JSON.parse(
              Buffer.from(parts[1], "base64").toString("utf-8")
            );
            firebaseUid = payload.sub || payload.uid;
            email = payload.email || "dev@example.com";
          } else {
            // Try base64 decode
            const decoded = JSON.parse(
              Buffer.from(idToken, "base64").toString("utf-8")
            );
            firebaseUid = decoded.uid || decoded.sub;
            email = decoded.email || "dev@example.com";
          }
        } catch (e) {
          console.warn(`[Firebase Auth] Dev mode: invalid token format`, e);
          return c.json({ success: false, error: "Invalid token" }, 401);
        }
      } else {
        // Production mode: verify with Firebase Admin SDK
        try {
          const auth = getAuth();
          const decodedToken = await auth.verifyIdToken(idToken);
          firebaseUid = decodedToken.uid;
          email = decodedToken.email || "unknown@example.com";
        } catch (err) {
          console.warn(`[Firebase Auth] Token verification failed:`, err);
          return c.json({ success: false, error: "Invalid token" }, 401);
        }
      }

      if (!firebaseUid) {
        console.warn(`[Firebase Auth] No UID extracted from token`);
        return c.json({ success: false, error: "Invalid token" }, 401);
      }

      // Look up Prisma user by Firebase UID
      let user = await prisma.user.findUnique({
        where: { id: firebaseUid },
        select: { id: true, role: true, nickname: true },
      });

      // Auto-create user on first login (optional)
      if (!user) {
        console.log(`[Firebase Auth] Creating new user for Firebase UID: ${firebaseUid}`);
        user = await prisma.user.create({
          data: {
            id: firebaseUid,
            nickname: `user_${firebaseUid.slice(0, 8)}`,
            nicknameLower: `user_${firebaseUid.slice(0, 8)}`,
            normalizedNickname: `user_${firebaseUid.slice(0, 8)}`,
            role: "USER",
          },
          select: { id: true, role: true, nickname: true },
        });
      }

      // Attach auth context for downstream handlers
      c.set("authUser", {
        firebaseUid,
        email,
        userId: user.id,
      });
      c.set("userRole", user.role);

      await next();
    } catch (err) {
      console.error("[Firebase Auth] Unexpected error:", err);
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }
  };
}

/**
 * Extract Firebase UID from Authorization header without full middleware
 * Useful for routes that work with or without auth
 */
export function getFirebaseUidFromRequest(c: Context): string | null {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  try {
    const idToken = authHeader.slice(7);
    const parts = idToken.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(
        Buffer.from(parts[1], "base64").toString("utf-8")
      );
      return payload.sub || payload.uid || null;
    }
    // Try plain base64
    const decoded = JSON.parse(
      Buffer.from(idToken, "base64").toString("utf-8")
    );
    return decoded.uid || decoded.sub || null;
  } catch {
    return null;
  }
}

