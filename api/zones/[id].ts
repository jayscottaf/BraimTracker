import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { prisma } from "../_lib/prisma.js";
import { requireAuth, requireOwner, sendError } from "../_lib/auth.js";
import { assert, methodRouter, parseBody } from "../_lib/http.js";

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(1000).nullable().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  referencePhoto: z.string().url().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = String(req.query.id ?? "");
  try {
    await methodRouter(req, res, {
      GET: async () => {
        await requireAuth(req);
        const zone = await prisma.zone.findUnique({
          where: { id },
          include: {
            jobs: {
              orderBy: { createdAt: "desc" },
              include: { assignedWorker: { select: { id: true, name: true } } },
            },
          },
        });
        assert(zone, 404, "Zone not found");
        return res.status(200).json({ zone });
      },
      PATCH: async () => {
        await requireOwner(req);
        const data = patchSchema.parse(parseBody(req));
        const zone = await prisma.zone.update({ where: { id }, data });
        return res.status(200).json({ zone });
      },
      DELETE: async () => {
        await requireOwner(req);
        const jobCount = await prisma.job.count({ where: { zoneId: id } });
        assert(jobCount === 0, 400, "Zone has jobs; delete or reassign them first");
        await prisma.zone.delete({ where: { id } });
        return res.status(204).end();
      },
    });
  } catch (err) {
    sendError(res, err);
  }
}
