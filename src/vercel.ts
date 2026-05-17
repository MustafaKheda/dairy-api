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

function requestBody(req: IncomingMessage) {
  if (req.method === "GET" || req.method === "HEAD") {
    return undefined;
  }

  return Readable.toWeb(req) as unknown as BodyInit;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const response = await app.fetch(
      new Request(requestUrl(req), {
        method: req.method,
        headers: req.headers as HeadersInit,
        body: requestBody(req),
        duplex: "half",
      } as RequestInit),
    );

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
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ success: false, error: "Internal server error" }));
  }
}
