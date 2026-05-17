import { app } from "./app.js";
import { ensureDatabaseSchema } from "./db/ensure-schema.js";
import { env } from "./lib/env.js";

await ensureDatabaseSchema();

console.log(`Dairy API listening on http://localhost:${env.port}`);

Bun.serve({
  port: env.port,
  fetch: app.fetch,
});
