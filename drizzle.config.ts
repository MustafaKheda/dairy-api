import "dotenv/config";
import { defineConfig } from "drizzle-kit";

function envValue(name: string, fallback?: string) {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: envValue("TURSO_DATABASE_URL", "file:local.db")!,
    authToken: envValue("TURSO_AUTH_TOKEN"),
  },
  verbose: true,
  strict: true,
});
