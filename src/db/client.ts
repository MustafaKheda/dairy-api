import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { env } from "../lib/env.js";
import * as schema from "../schema/index.js";

export const client = createClient({
  url: env.databaseUrl,
  authToken: env.tursoAuthToken,
});

export const db = drizzle(client, { schema });
