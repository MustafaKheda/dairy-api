import { networkInterfaces } from "node:os";
import { app } from "./app.js";
import { ensureDatabaseSchema } from "./db/ensure-schema.js";
import { env } from "./lib/env.js";

function getNetworkIpAddresses() {
  return Object.values(networkInterfaces())
    .flatMap((networkInterface) => networkInterface ?? [])
    .filter((address) => address.family === "IPv4" && !address.internal)
    .map((address) => address.address);
}

await ensureDatabaseSchema();

const server = Bun.serve({
  hostname: "0.0.0.0",
  port: env.port,
  fetch: app.fetch,
});

const networkUrls = getNetworkIpAddresses().map((ipAddress) => `http://${ipAddress}:${server.port}`);

console.log("Dairy API listening:");
console.log(`- Local: http://localhost:${server.port}`);

for (const url of networkUrls) {
  console.log(`- Network: ${url}`);
}
