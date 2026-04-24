import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { prisma } from "../_lib/prisma.js";
import { requireAuth, requireOwner, sendError } from "../_lib/auth.js";
import { assert, methodRouter, parseBody } from "../_lib/http.js";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(1000).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  referencePhoto: z.string().url().optional(),
  notes: z.string().max(2000).optional(),
});

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(1000).nullable().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  referencePhoto: z.string().url().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Parse segments from req.url directly — see workers/[[...id]].ts
  const urlPath = (req.url || "").split("?")[0];
  const tail = urlPath.replace(/^\/api\/zones\/?/, "").replace(/\/$/, "");
  const rawSegments = tail ? tail.split("/") : [];
  const segments = rawSegments[0] === "_root" ? rawSegments.slice(1) : rawSegments;
  try {
    if (segments.length === 0) {
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
    } else if (segments.length === 1) {
      const id = segments[0];
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
    } else {
      res.status(404).json({ error: "Not found" });
    }
  } catch (err) {
    sendError(res, err);
  }
}
