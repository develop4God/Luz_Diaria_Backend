import type { Context, Next } from "hono";
import { prisma } from "../prisma";

// Role hierarchy: USER < MODERATOR < OWNER
export type UserRole = "USER" | "MODERATOR" | "OWNER";

const ROLE_RANK: Record<UserRole, number> = {
  USER: 0,
  MODERATOR: 1,
  OWNER: 2,
};

/**
 * requireRole middleware factory.
 * Expects authUser to be set by firebaseAuth middleware.
 * Falls back to X-User-Id header for backward compatibility during transition.
 */
export function requireRole(minRole: UserRole) {
  return async (c: Context, next: Next) => {
    // First try to get auth from Firebase middleware
    const authUser = c.get("authUser");

    let userId: string | undefined;
    if (authUser?.userId) {
      userId = authUser.userId;
    } else {
      // Fallback to X-User-Id header (for backward compatibility)
      userId = c.req.header("X-User-Id");
    }

    if (!userId) {
      console.warn(`[RBAC] Missing auth on ${c.req.method} ${c.req.path}`);
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, nickname: true },
      });

      if (!user) {
        console.warn(`[RBAC] User not found: ${userId}`);
        return c.json({ success: false, error: "Forbidden" }, 403);
      }

      const userRole = (user.role as UserRole) ?? "USER";
      const userRank = ROLE_RANK[userRole] ?? 0;
      const requiredRank = ROLE_RANK[minRole];

      if (userRank < requiredRank) {
        console.warn(
          `[RBAC] Access denied for user ${user.nickname} (${userId}) role=${userRole} required=${minRole} on ${c.req.method} ${c.req.path}`
        );
        return c.json({ success: false, error: "Forbidden" }, 403);
      }

      // Attach user info to context for downstream handlers
      c.set("authUser", { id: user.id, role: userRole, nickname: user.nickname });
      await next();
    } catch (err) {
      console.error("[RBAC] Error checking role:", err);
      return c.json({ success: false, error: "Forbidden" }, 403);
    }
  };
}
