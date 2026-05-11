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
 * Reads X-User-Id header, looks up the user's role, and enforces minimum required role.
 */
export function requireRole(minRole: UserRole) {
  return async (c: Context, next: Next) => {
    const userId = c.req.header("X-User-Id");

    if (!userId) {
      console.warn(`[RBAC] Missing X-User-Id header on ${c.req.method} ${c.req.path}`);
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
