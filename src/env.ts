import { z } from "zod";

/**
 * Environment variable schema using Zod
 * This ensures all required environment variables are present and valid
 */
const envSchema = z.object({
  // Server Configuration
  PORT: z.string().optional().default("3000"),
  NODE_ENV: z.string().optional(),
  BACKEND_URL: z.url("BACKEND_URL must be a valid URL").default("http://localhost:3000"), // Set via the Vibecode enviroment at run-time

  // Database
  DATABASE_URL: z.string().default("file:./dev.db"),

  // OpenAI
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),

  // Environment: "dev" | "prod"
  // CRITICAL: This must be set to "prod" for production deployments.
  // If missing, defaults to "dev" for safety (never accidentally treat unknown as prod).
  APP_ENV: z.enum(["dev", "prod"]).default("dev"),
});

/**
 * Validate and parse environment variables
 */
function validateEnv() {
  try {
    const parsed = envSchema.parse(process.env);

    if (!process.env.APP_ENV) {
      console.warn("⚠️  [ENV] APP_ENV is not set — defaulting to 'dev'. Set APP_ENV=prod for production.");
    }

    console.log(`✅ Environment variables validated successfully [APP_ENV=${parsed.APP_ENV}]`);

    if (parsed.APP_ENV === "prod") {
      console.log("🚀 [ENV] Running in PRODUCTION mode — destructive operations are BLOCKED.");
    } else {
      console.log("🛠️  [ENV] Running in DEV mode — destructive operations are allowed.");
    }

    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Environment variable validation failed:");
      error.issues.forEach((err: any) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
      console.error("\nPlease check your .env file and ensure all required variables are set.");
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Validated and typed environment variables
 */
export const env = validateEnv();

export const IS_PROD = env.APP_ENV === "prod";
export const IS_DEV = env.APP_ENV === "dev";

/**
 * Type of the validated environment variables
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Extend process.env with our environment variables
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    // eslint-disable-next-line import/namespace
    interface ProcessEnv extends z.infer<typeof envSchema> {}
  }
}
