import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireRole } from "../middleware/rbac";

export const testimoniesRouter = new Hono();

// ─── GET /api/testimonies/approved  ──────────────────────────────────────────
// Public: returns approved testimonies for community display (paginated)
testimoniesRouter.get("/approved", async (c) => {
  const page   = Math.max(1, parseInt(c.req.query("page") ?? "1", 10));
  const limit  = Math.min(50, parseInt(c.req.query("limit") ?? "20", 10));
  const offset = (page - 1) * limit;
  const userId = c.req.header("x-user-id");

  const [items, total] = await Promise.all([
    prisma.testimony.findMany({
      where: { status: "APPROVED" },
      orderBy: { reviewedAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        text: true,
        createdAt: true,
        reviewedAt: true,
        likeCount: true,
        user: {
          select: {
            id: true,
            nickname: true,
            avatarId: true,
            frameId: true,
            titleId: true,
          },
        },
        ...(userId ? {
          likes: {
            where: { userId },
            select: { userId: true },
          },
        } : {}),
      },
    }),
    prisma.testimony.count({ where: { status: "APPROVED" } }),
  ]);

  // Normalize: add `likedByMe` field, remove raw `likes` array
  const testimonies = items.map((item: any) => ({
    id: item.id,
    text: item.text,
    createdAt: item.createdAt,
    reviewedAt: item.reviewedAt,
    likeCount: item.likeCount,
    likedByMe: userId ? (item.likes?.length > 0) : false,
    user: item.user,
  }));

  return c.json({ testimonies, total, page, limit });
});

// ─── GET /api/testimonies/mine  ───────────────────────────────────────────────
// Returns the current user's most recent testimony + approved count
testimoniesRouter.get("/mine", async (c) => {
  const userId = c.req.header("x-user-id");
  if (!userId) return c.json({ error: "Missing userId" }, 400);

  const [testimony, approvedCount] = await Promise.all([
    prisma.testimony.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, text: true, status: true, createdAt: true },
    }),
    prisma.testimony.count({ where: { userId, status: "APPROVED" } }),
  ]);

  return c.json({ testimony, approvedCount });
});

// ─── POST /api/testimonies  ───────────────────────────────────────────────────
// Submit a new testimony (replaces previous if still PENDING)
const submitSchema = z.object({
  text: z.string().min(20, "Mínimo 20 caracteres").max(500, "Máximo 500 caracteres").trim(),
});

testimoniesRouter.post(
  "/",
  zValidator("json", submitSchema),
  async (c) => {
    const userId = c.req.header("x-user-id");
    if (!userId) return c.json({ error: "Missing userId" }, 400);

    const { text } = c.req.valid("json");

    // Remove existing PENDING testimony if any (user can re-submit)
    await prisma.testimony.deleteMany({
      where: { userId, status: "PENDING" },
    });

    // Don't allow more than 3 approved testimonies
    const approvedCount = await prisma.testimony.count({
      where: { userId, status: "APPROVED" },
    });
    if (approvedCount >= 3) {
      return c.json({ error: "Has alcanzado el límite de 3 testimonios publicados." }, 409);
    }

    const testimony = await prisma.testimony.create({
      data: { userId, text, status: "PENDING" },
      select: { id: true, text: true, status: true, createdAt: true },
    });

    return c.json({ testimony }, 201);
  }
);

// ─── DELETE /api/testimonies/mine  ────────────────────────────────────────────
// User can delete their own pending testimony
testimoniesRouter.delete("/mine", async (c) => {
  const userId = c.req.header("x-user-id");
  if (!userId) return c.json({ error: "Missing userId" }, 400);

  await prisma.testimony.deleteMany({
    where: { userId, status: "PENDING" },
  });

  return c.json({ success: true });
});

// ─── ADMIN: GET /api/testimonies/admin/counts  ────────────────────────────────
testimoniesRouter.get(
  "/admin/counts",
  requireRole("MODERATOR"),
  async (c) => {
    const count = await prisma.testimony.count({ where: { status: "PENDING" } });
    return c.json({ pendingTestimonies: count });
  }
);

// ─── ADMIN: GET /api/testimonies/admin/pending  ───────────────────────────────
testimoniesRouter.get(
  "/admin/pending",
  requireRole("MODERATOR"),
  async (c) => {
    const items = await prisma.testimony.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        text: true,
        createdAt: true,
        user: {
          select: { id: true, nickname: true, avatarId: true },
        },
      },
    });
    return c.json({ testimonies: items });
  }
);

// ─── ADMIN: GET /api/testimonies/admin/all  ───────────────────────────────────
testimoniesRouter.get(
  "/admin/all",
  requireRole("MODERATOR"),
  async (c) => {
    const status = c.req.query("status"); // optional filter
    const where = status ? { status } : {};

    const items = await prisma.testimony.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        text: true,
        status: true,
        createdAt: true,
        reviewedAt: true,
        user: {
          select: { id: true, nickname: true, avatarId: true },
        },
      },
    });
    return c.json({ testimonies: items });
  }
);

// ─── ADMIN: PATCH /api/testimonies/admin/:id/review  ─────────────────────────
const reviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

testimoniesRouter.patch(
  "/admin/:id/review",
  requireRole("MODERATOR"),
  zValidator("json", reviewSchema),
  async (c) => {
    const reviewerId = c.req.header("x-user-id");
    if (!reviewerId) return c.json({ error: "Missing userId" }, 400);

    const { id } = c.req.param();
    const { status } = c.req.valid("json");

    const testimony = await prisma.testimony.findUnique({ where: { id } });
    if (!testimony) return c.json({ error: "Not found" }, 404);

    const updated = await prisma.testimony.update({
      where: { id },
      data: {
        status,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      },
      select: { id: true, text: true, status: true, reviewedAt: true },
    });

    return c.json({ testimony: updated });
  }
);

// ─── ADMIN: DELETE /api/testimonies/admin/:id  ────────────────────────────────
testimoniesRouter.delete(
  "/admin/:id",
  requireRole("MODERATOR"),
  async (c) => {
    const { id } = c.req.param();

    await prisma.testimony.delete({ where: { id } }).catch(() => null);
    return c.json({ success: true });
  }
);

// ─── POST /api/testimonies/:id/like  ─────────────────────────────────────────
// Toggle like on an approved testimony (one per user)
testimoniesRouter.post("/:id/like", async (c) => {
  const userId = c.req.header("x-user-id");
  if (!userId) return c.json({ error: "Missing userId" }, 400);

  const { id } = c.req.param();

  const testimony = await prisma.testimony.findUnique({ where: { id } });
  if (!testimony || testimony.status !== "APPROVED") {
    return c.json({ error: "Testimony not found" }, 404);
  }

  // Check if already liked
  const existing = await prisma.testimonyLike.findUnique({
    where: { testimonyId_userId: { testimonyId: id, userId } },
  });

  if (existing) {
    // Unlike: remove the like and decrement
    await prisma.$transaction([
      prisma.testimonyLike.delete({
        where: { testimonyId_userId: { testimonyId: id, userId } },
      }),
      prisma.testimony.update({
        where: { id },
        data: { likeCount: { decrement: 1 } },
      }),
    ]);
    const updated = await prisma.testimony.findUnique({ where: { id }, select: { likeCount: true } });
    return c.json({ liked: false, likeCount: updated?.likeCount ?? 0 });
  } else {
    // Like: add the like and increment
    await prisma.$transaction([
      prisma.testimonyLike.create({ data: { testimonyId: id, userId } }),
      prisma.testimony.update({
        where: { id },
        data: { likeCount: { increment: 1 } },
      }),
    ]);
    const updated = await prisma.testimony.findUnique({ where: { id }, select: { likeCount: true } });
    return c.json({ liked: true, likeCount: updated?.likeCount ?? 0 });
  }
});
