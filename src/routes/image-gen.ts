import { Hono } from "hono";
import { env } from "../env";

const imageGenRouter = new Hono();

// POST /api/image-gen/generate
// Body: { prompt: string, size?: string, quality?: string }
// Returns: { b64_json: string }
imageGenRouter.post("/generate", async (c) => {
  try {
    const body = await c.req.json<{ prompt: string; size?: string; quality?: string }>();
    if (!body.prompt) return c.json({ error: "prompt is required" }, 400);

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1.5",
        prompt: body.prompt,
        size: body.size || "1024x1536",
        quality: body.quality || "medium",
        n: 1,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[ImageGen] API error:", err);
      return c.json({ error: err }, response.status as 400 | 500);
    }

    const data = await response.json() as { data: Array<{ b64_json: string }> };
    return c.json({ b64_json: data.data[0]?.b64_json ?? null });
  } catch (e) {
    console.error("[ImageGen] Unexpected error:", e);
    return c.json({ error: String(e) }, 500);
  }
});

export { imageGenRouter };
