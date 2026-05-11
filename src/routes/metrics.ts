import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";

const metricsRouter = new Hono();

// POST /api/metrics/event
// Fire-and-forget analytics events: TTS activations and tab screen time.
// Best-effort — always returns 200 to avoid impacting the user experience.
metricsRouter.post(
  "/event",
  zValidator(
    "json",
    z.object({
      userId: z.string(),
      type: z.enum(["tts_used", "tab_time", "translator_used"]),
      screen: z.string().max(50),
      seconds: z.number().int().min(0).max(86400).default(0),
      dateId: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
  ),
  async (c) => {
    const { userId, type, screen, seconds, dateId } = c.req.valid("json");
    try {
      await prisma.appEvent.create({
        data: { userId, type, screen, seconds, dateId },
      });
    } catch {
      // Non-fatal — analytics are best-effort
    }
    return c.json({ ok: true });
  }
);

export { metricsRouter };
