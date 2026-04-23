import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { prisma } from "../_lib/prisma.js";
import { requireOwner, sendError, HttpError } from "../_lib/auth.js";
import { methodRouter, parseBody } from "../_lib/http.js";

const createSchema = z.object({
  name: z.string().min(1).max(60),
  loginCode: z.string().regex(/^\d{4,6}$/, "Login code must be 4-6 digits"),
  hourlyRate: z.number().min(0).max(500).optional(),
  phone: z.string().max(30).optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await methodRouter(req, res, {
      GET: async () => {
        await requireOwner(req);
        const workers = await prisma.user.findMany({
          where: { role: "WORKER" },
          include: {
            workerProfile: true,
            _count: { select: { assignedJobs: true } },
          },
          orderBy: { name: "asc" },
        });
        return res.status(200).json({ workers });
      },
      POST: async () => {
        await requireOwner(req);
        const data = createSchema.parse(parseBody(req));

        const existing = await prisma.user.findUnique({ where: { loginCode: data.loginCode } });
        if (existing) throw new HttpError(409, "Login code already in use");

        const worker = await prisma.user.create({
          data: {
            role: "WORKER",
            name: data.name,
            loginCode: data.loginCode,
            workerProfile: {
              create: {
                hourlyRate: data.hourlyRate ?? 20,
                phone: data.phone,
                active: true,
              },
            },
          },
          include: { workerProfile: true },
        });
        return res.status(201).json({ worker });
      },
    });
  } catch (err) {
    sendError(res, err);
  }
}
