import jwt from "jsonwebtoken";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./prisma.js";
import type { Role, User } from "@prisma/client";

const TOKEN_TTL = "30d";

export interface TokenPayload {
  sub: string;
  role: Role;
}

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET env var is not set");
  return s;
}

export function signToken(user: Pick<User, "id" | "role">): string {
  return jwt.sign({ sub: user.id, role: user.role }, secret(), {
    expiresIn: TOKEN_TTL,
  });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, secret()) as TokenPayload;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function extractToken(req: VercelRequest): string | null {
  const hdr = req.headers.authorization ?? req.headers.Authorization;
  if (typeof hdr !== "string") return null;
  const [scheme, token] = hdr.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

export async function getUser(req: VercelRequest) {
  const token = extractToken(req);
  if (!token) return null;
  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { workerProfile: true },
    });
    return user;
  } catch {
    return null;
  }
}

export async function requireAuth(req: VercelRequest) {
  const user = await getUser(req);
  if (!user) throw new HttpError(401, "Unauthorized");
  return user;
}

export async function requireOwner(req: VercelRequest) {
  const user = await requireAuth(req);
  if (user.role !== "OWNER") throw new HttpError(403, "Owner only");
  return user;
}

export async function requireWorker(req: VercelRequest) {
  const user = await requireAuth(req);
  if (user.role !== "WORKER") throw new HttpError(403, "Worker only");
  return user;
}

export function sendError(res: VercelResponse, err: unknown) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  // Zod validation errors: surface the first issue as a clear string.
  if (err && typeof err === "object" && "issues" in err && Array.isArray((err as { issues: unknown[] }).issues)) {
    const issues = (err as { issues: Array<{ path: (string | number)[]; message: string }> }).issues;
    const first = issues[0];
    const path = first?.path?.join(".") ?? "";
    const message = first ? (path ? `${path}: ${first.message}` : first.message) : "Validation failed";
    res.status(400).json({ error: message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
