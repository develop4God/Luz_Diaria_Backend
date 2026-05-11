import { Hono } from "hono";
import { prisma } from "../prisma";
import { z } from "zod";
import { requireRole } from "../middleware/rbac";

export const brandingRouter = new Hono();

const DEFAULT_BRANDING = {
  id: "app",
  appName: "Luz Diaria",
  taglineEs: "Tu devocional diario",
  taglineEn: "Your daily devotional",
  shareWatermarkEnabled: true,
  shareWatermarkPosition: "bottom-left" as const,
};

// GET /api/branding - Returns current app branding
brandingRouter.get("/", async (c) => {
  try {
    let branding = await prisma.appBranding.findUnique({ where: { id: "app" } });
    if (!branding) {
      // Seed default branding on first access
      branding = await prisma.appBranding.create({ data: DEFAULT_BRANDING });
    }
    return c.json({ success: true, branding });
  } catch (err) {
    console.error("[Branding] GET error:", err);
    return c.json({ success: true, branding: { ...DEFAULT_BRANDING, updatedAt: new Date() } });
  }
});

const UpdateBrandingSchema = z.object({
  appName: z.string().min(1).max(100).optional(),
  taglineEs: z.string().max(200).optional(),
  taglineEn: z.string().max(200).optional(),
  shareWatermarkEnabled: z.boolean().optional(),
  shareWatermarkPosition: z.enum(["bottom-left", "bottom-right", "top-left", "top-right"]).optional(),
});

// PUT /api/branding - Update branding (OWNER only)
brandingRouter.put("/", requireRole("OWNER"), async (c) => {
  try {
    const body = await c.req.json();
    const parsed = UpdateBrandingSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: parsed.error.message }, 400);
    }

    const branding = await prisma.appBranding.upsert({
      where: { id: "app" },
      create: { ...DEFAULT_BRANDING, ...parsed.data },
      update: parsed.data,
    });

    console.log("[Branding] Updated:", JSON.stringify(parsed.data));
    return c.json({ success: true, branding });
  } catch (err) {
    console.error("[Branding] PUT error:", err);
    return c.json({ success: false, error: "Failed to update branding" }, 500);
  }
});
