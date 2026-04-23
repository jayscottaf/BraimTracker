import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { prisma } from "../_lib/prisma.js";
import { signToken, constantTimeEqual, sendError, HttpError } from "../_lib/auth.js";
import { methodRouter, parseBody } from "../_lib/http.js";

const bodySchema = z.discriminatedUnion("role", [
  z.object({ role: z.literal("OWNER"), password: z.string().min(1) }),
  z.object({ role: z.literal("WORKER"), code: z.string().min(3).max(10) }),
]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await methodRouter(req, res, {
      POST: async () => {
        const body = bodySchema.parse(parseBody(req));

        if (body.role === "OWNER") {
          const expected = process.env.OWNER_PASSWORD;
          if (!expected) throw new HttpError(500, "OWNER_PASSWORD not configured");
          if (!constantTimeEqual(body.password, expected)) {
            throw new HttpError(401, "Incorrect password");
          }
          const owner = await prisma.user.findFirst({ where: { role: "OWNER" } });
          if (!owner) throw new HttpError(500, "No owner user seeded");
          const token = signToken(owner);
          return res.status(200).json({ token, user: publicUser(owner) });
        }

        const worker = await prisma.user.findUnique({
          where: { loginCode: body.code },
          include: { workerProfile: true },
        });
        if (!worker || worker.role !== "WORKER" || !worker.workerProfile?.active) {
          throw new HttpError(401, "Invalid code");
        }
        const token = signToken(worker);
        return res.status(200).json({ token, user: publicUser(worker) });
      },
    });
  } catch (err) {
    sendError(res, err);
  }
}

function publicUser(user: { id: string; name: string; role: string; email: string | null }) {
  return { id: user.id, name: user.name, role: user.role, email: user.email };
}
