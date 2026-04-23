import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { prisma } from "../_lib/prisma.js";
import { requireAuth, requireOwner, sendError, HttpError } from "../_lib/auth.js";
import { assert, methodRouter, parseBody } from "../_lib/http.js";
import { logActivity } from "../_lib/activity.js";

const patchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  zoneId: z.string().optional(),
  taskType: z.enum(["MULCH", "EDGING", "CLEANUP", "TRIMMING", "PRUNING", "OTHER"]).optional(),
  instructions: z.string().max(4000).nullable().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  targetDate: z.string().datetime().nullable().optional(),
  estimatedHours: z.number().min(0).max(999).nullable().optional(),
  priceMode: z.enum(["HOURLY", "FLAT"]).optional(),
  hourlyRate: z.number().min(0).max(500).optional(),
  flatRate: z.number().min(0).max(100000).nullable().optional(),
  ownerNotes: z.string().max(2000).nullable().optional(),
  workerNotes: z.string().max(2000).nullable().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = String(req.query.id ?? "");
  try {
    await methodRouter(req, res, {
      GET: async () => {
        const user = await requireAuth(req);
        const job = await prisma.job.findUnique({
          where: { id },
          include: {
            zone: true,
            assignedWorker: {
              select: {
                id: true,
                name: true,
                workerProfile: { select: { hourlyRate: true } },
              },
            },
            photos: { orderBy: { createdAt: "desc" } },
            tasks: { orderBy: { order: "asc" } },
            timeEntries: { orderBy: { startAt: "desc" } },
            payment: true,
            activity: {
              orderBy: { createdAt: "desc" },
              take: 50,
              include: { actor: { select: { id: true, name: true, role: true } } },
            },
          },
        });
        assert(job, 404, "Job not found");
        if (user.role === "WORKER" && job.assignedWorkerId !== user.id) {
          throw new HttpError(403, "Not your job");
        }
        return res.status(200).json({ job });
      },

      PATCH: async () => {
        const user = await requireAuth(req);
        const job = await prisma.job.findUnique({ where: { id } });
        assert(job, 404, "Job not found");

        const body = patchSchema.parse(parseBody(req));

        if (user.role === "WORKER") {
          if (job.assignedWorkerId !== user.id) throw new HttpError(403, "Not your job");
          const allowed = { workerNotes: body.workerNotes };
          const updated = await prisma.job.update({ where: { id }, data: allowed });
          return res.status(200).json({ job: updated });
        }

        const data: Record<string, unknown> = { ...body };
        if (body.targetDate !== undefined) {
          data.targetDate = body.targetDate ? new Date(body.targetDate) : null;
        }
        const updated = await prisma.job.update({ where: { id }, data });
        return res.status(200).json({ job: updated });
      },

      DELETE: async () => {
        const owner = await requireOwner(req);
        await prisma.job.delete({ where: { id } });
        await logActivity(null, owner.id, "JOB_DELETED", { jobId: id });
        return res.status(204).end();
      },
    });
  } catch (err) {
    sendError(res, err);
  }
}
