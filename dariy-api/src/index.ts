import { app } from "./app";
import { ensureDatabaseSchema } from "./db/ensure-schema";
import { env } from "./lib/env";

await ensureDatabaseSchema();

console.log(`Dairy API listening on http://localhost:${env.port}`);

Bun.serve({
  port: env.port,
  fetch: app.fetch,
});
