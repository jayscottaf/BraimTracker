import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { prisma } from "../_lib/prisma.js";
import { requireAuth, requireOwner, sendError } from "../_lib/auth.js";
import { methodRouter, parseBody } from "../_lib/http.js";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(1000).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  referencePhoto: z.string().url().optional(),
  notes: z.string().max(2000).optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await methodRouter(req, res, {
      GET: async () => {
        await requireAuth(req);
        const zones = await prisma.zone.findMany({
          orderBy: [{ priority: "desc" }, { name: "asc" }],
          include: { _count: { select: { jobs: true } } },
        });
        return res.status(200).json({ zones });
      },
      POST: async () => {
        await requireOwner(req);
        const data = createSchema.parse(parseBody(req));
        const zone = await prisma.zone.create({ data });
        return res.status(201).json({ zone });
      },
    });
  } catch (err) {
    sendError(res, err);
  }
}
