import type { VercelRequest, VercelResponse } from "@vercel/node";
import { HttpError } from "./auth.js";

export function methodRouter(
  req: VercelRequest,
  res: VercelResponse,
  handlers: Partial<Record<"GET" | "POST" | "PATCH" | "PUT" | "DELETE", () => Promise<unknown>>>,
) {
  const method = (req.method ?? "GET").toUpperCase() as keyof typeof handlers;
  const handler = handlers[method];
  if (!handler) {
    res.setHeader("Allow", Object.keys(handlers).join(", "));
    res.status(405).json({ error: "Method not allowed" });
    return Promise.resolve();
  }
  return handler();
}

export function assert(cond: unknown, status: number, message: string): asserts cond {
  if (!cond) throw new HttpError(status, message);
}

export function parseBody<T = unknown>(req: VercelRequest): T {
  if (!req.body) return {} as T;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body) as T;
    } catch {
      return {} as T;
    }
  }
  return req.body as T;
}
