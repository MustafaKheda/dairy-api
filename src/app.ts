import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { swaggerUI } from "@hono/swagger-ui";
import { env } from "./lib/env";
import { openApiDocument } from "./lib/openapi";
import { authRoutes } from "./routes/auth";
import { customerRoutes } from "./routes/customers";
import { entryRoutes } from "./routes/entries";
import { invoiceRoutes } from "./routes/invoices";
import { paymentRoutes } from "./routes/payments";
import { productRoutes } from "./routes/products";
import { reportRoutes } from "./routes/reports";
import type { AppEnv } from "./types";
import { fail, ok } from "./utils/http";

export const app = new Hono<AppEnv>();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: env.corsOrigin === "*" ? "*" : env.corsOrigin.split(",").map((origin) => origin.trim()),
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.get("/", (c) =>
  ok(c, {
    name: "Dairy API",
    status: "ok",
    routes: {
      docs: "/docs",
      openapi: "/openapi.json",
      auth: "/auth",
      customers: "/customers",
      products: "/products",
      entries: "/entries",
      invoices: "/invoices",
      payments: "/payments",
      reports: "/reports",
    },
  }),
);

app.get("/health", (c) => ok(c, { status: "ok" }));
app.get("/openapi.json", (c) => c.json(openApiDocument));
app.get("/docs", swaggerUI({ url: "/openapi.json" }));

app.route("/auth", authRoutes);
app.route("/products", productRoutes);
app.route("/customers", customerRoutes);
app.route("/entries", entryRoutes);
app.route("/invoices", invoiceRoutes);
app.route("/payments", paymentRoutes);
app.route("/reports", reportRoutes);

app.notFound((c) => fail(c, "Route not found", 404));

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return fail(c, error.message, error.status);
  }

  console.error(error);
  return fail(c, "Internal server error", 500);
});

export type AppType = typeof app;
