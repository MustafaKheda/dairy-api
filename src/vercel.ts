import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { app } from "./app.js";

export const runtime = "nodejs";

function requestUrl(req: IncomingMessage) {
  const protocol = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost";
  return `${protocol}://${host}${req.url ?? "/"}`;
}

function requestHeaders(req: IncomingMessage) {
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
      continue;
    }

    if (value !== undefined) {
      headers.set(key, String(value));
    }
  }

  return headers;
}

function requestBody(req: IncomingMessage) {
  if (req.method === "GET" || req.method === "HEAD") {
    return undefined;
  }

  return Readable.toWeb(req) as unknown as BodyInit;
}

function isFetchRequest(req: unknown): req is Request {
  return typeof Request !== "undefined" && req instanceof Request;
}

export default async function handler(req: IncomingMessage | Request, res?: ServerResponse) {
  if (isFetchRequest(req)) {
    return app.fetch(req);
  }

  try {
    const response = await app.fetch(
      new Request(requestUrl(req), {
        method: req.method,
        headers: requestHeaders(req),
        body: requestBody(req),
        duplex: "half",
      } as RequestInit),
    );

    if (!res) {
      return response;
    }

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (!response.body) {
      res.end();
      return;
    }

    Readable.fromWeb(response.body as unknown as NodeReadableStream).pipe(res);
  } catch (error) {
    console.error(error);
    if (!res) {
      return Response.json({ success: false, error: "Internal server error" }, { status: 500 });
    }

    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ success: false, error: "Internal server error" }));
  }
}
