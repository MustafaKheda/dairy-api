function envValue(name: string, fallback?: string) {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

export const env = {
  databaseUrl: envValue("TURSO_DATABASE_URL", "file:local.db")!,
  tursoAuthToken: envValue("TURSO_AUTH_TOKEN"),
  jwtSecret: envValue("JWT_SECRET", "dev-secret-change-me")!,
  port: Number(envValue("PORT", "3000")),
  corsOrigin: envValue("CORS_ORIGIN", "*")!,
  appUrl: envValue("APP_URL", "http://localhost:3000")!,
};
