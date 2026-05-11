import { Hono } from "hono";
import { prisma } from "../prisma";

export const commentsRouter = new Hono();

// Shape returned for each comment
interface CommentOut {
  id: string;
  text: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  user: {
    id: string;
    nickname: string;
    avatarId: string;
    frameId: string | null;
  };
}

// ─── GET /api/comments/:date ──────────────────────────────────────────────────
// Returns all non-deleted comments for a devotional date, oldest first.
// Optionally marks likedByMe when x-user-id header is present.
commentsRouter.get("/:date", async (c) => {
  const { date } = c.req.param();
  const requesterId = c.req.header("x-user-id") ?? null;

  const comments = await prisma.devotionalComment.findMany({
    where: {
      devotionalDate: date,
      deletedAt: null,
    },
    orderBy: { createdAt: "asc" },
    include: {
      user: {
        select: { id: true, nickname: true, avatarId: true, frameId: true },
      },
      likes: requesterId
        ? { where: { userId: requesterId }, select: { id: true } }
        : false,
    },
  });

  const out: CommentOut[] = comments.map((c) => ({
    id: c.id,
    text: c.text,
    createdAt: c.createdAt.toISOString(),
    likeCount: c.likeCount,
    likedByMe: requesterId ? (c.likes as { id: string }[]).length > 0 : false,
    user: {
      id: c.user.id,
      nickname: c.user.nickname,
      avatarId: c.user.avatarId,
      frameId: c.user.frameId,
    },
  }));

  return c.json({ comments: out });
});

// ─── POST /api/comments/:date ─────────────────────────────────────────────────
// Create a new comment on a devotional date.
commentsRouter.post("/:date", async (c) => {
  const userId = c.req.header("x-user-id");
  if (!userId) return c.json({ error: "Missing userId" }, 400);

  const { date } = c.req.param();

  let body: { text?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const text = (body.text ?? "").trim();
  if (!text) return c.json({ error: "Comment text is required" }, 400);
  if (text.length > 500) return c.json({ error: "Comment too long (max 500 chars)" }, 400);

  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, nickname: true, avatarId: true, frameId: true },
  });
  if (!user) return c.json({ error: "User not found" }, 404);

  const comment = await prisma.devotionalComment.create({
    data: {
      devotionalDate: date,
      userId,
      text,
    },
  });

  const out: CommentOut = {
    id: comment.id,
    text: comment.text,
    createdAt: comment.createdAt.toISOString(),
    likeCount: 0,
    likedByMe: false,
    user: {
      id: user.id,
      nickname: user.nickname,
      avatarId: user.avatarId,
      frameId: user.frameId,
    },
  };

  return c.json({ comment: out }, 201);
});

// ─── POST /api/comments/:commentId/like ──────────────────────────────────────
// Toggle like on a comment. One like per user.
commentsRouter.post("/:commentId/like", async (c) => {
  const userId = c.req.header("x-user-id");
  if (!userId) return c.json({ error: "Missing userId" }, 400);

  const { commentId } = c.req.param();

  const comment = await prisma.devotionalComment.findUnique({
    where: { id: commentId },
  });
  if (!comment || comment.deletedAt) {
    return c.json({ error: "Comment not found" }, 404);
  }

  const existing = await prisma.devotionalCommentLike.findUnique({
    where: { commentId_userId: { commentId, userId } },
  });

  if (existing) {
    // Unlike
    await prisma.$transaction([
      prisma.devotionalCommentLike.delete({
        where: { commentId_userId: { commentId, userId } },
      }),
      prisma.devotionalComment.update({
        where: { id: commentId },
        data: { likeCount: { decrement: 1 } },
      }),
    ]);
    const updated = await prisma.devotionalComment.findUnique({
      where: { id: commentId },
      select: { likeCount: true },
    });
    return c.json({ liked: false, likeCount: Math.max(0, updated?.likeCount ?? 0) });
  } else {
    // Like
    await prisma.$transaction([
      prisma.devotionalCommentLike.create({ data: { commentId, userId } }),
      prisma.devotionalComment.update({
        where: { id: commentId },
        data: { likeCount: { increment: 1 } },
      }),
    ]);
    const updated = await prisma.devotionalComment.findUnique({
      where: { id: commentId },
      select: { likeCount: true },
    });
    return c.json({ liked: true, likeCount: updated?.likeCount ?? 1 });
  }
});

// ─── DELETE /api/comments/:commentId ─────────────────────────────────────────
// Moderator/Owner soft-deletes a comment.
commentsRouter.delete("/:commentId", async (c) => {
  const userId = c.req.header("x-user-id");
  if (!userId) return c.json({ error: "Missing userId" }, 400);

  // Check moderator role
  const requester = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!requester || !["MODERATOR", "OWNER"].includes(requester.role)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const { commentId } = c.req.param();
  const comment = await prisma.devotionalComment.findUnique({
    where: { id: commentId },
  });
  if (!comment) return c.json({ error: "Comment not found" }, 404);

  await prisma.devotionalComment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });

  return c.json({ success: true });
});
