import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../_lib/prisma.js";
import { requireAuth, sendError, HttpError } from "../_lib/auth.js";
import { assert, methodRouter, parseBody } from "../_lib/http.js";
import { logActivity } from "../_lib/activity.js";
import { computeTotal, sumActualHoursFromEntries } from "../_lib/billing.js";

const schema = z.object({
  jobId: z.string().min(1),
  minutes: z.number().int().min(1).max(60 * 24),
  notes: z.string().max(500).optional(),
  startAt: z.string().datetime().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await methodRouter(req, res, {
      POST: async () => {
        const user = await requireAuth(req);
        const body = schema.parse(parseBody(req));

        const job = await prisma.job.findUnique({ where: { id: body.jobId } });
        assert(job, 404, "Job not found");

        const workerId =
          user.role === "WORKER" ? user.id : job.assignedWorkerId ?? null;
        assert(workerId, 400, "Job has no assigned worker");

        if (user.role === "WORKER" && job.assignedWorkerId !== user.id) {
          throw new HttpError(403, "Not your job");
        }

        const startAt = body.startAt ? new Date(body.startAt) : new Date();
        const endAt = new Date(startAt.getTime() + body.minutes * 60000);

        await prisma.timeEntry.create({
          data: {
            jobId: body.jobId,
            workerId,
            startAt,
            endAt,
            durationMinutes: body.minutes,
            manualEntry: true,
            notes: body.notes,
          },
        });

        const entries = await prisma.timeEntry.findMany({
          where: { jobId: body.jobId, endAt: { not: null } },
          select: { durationMinutes: true },
        });
        const actualHours = sumActualHoursFromEntries(entries);
        const totalOwed = computeTotal({
          priceMode: job.priceMode,
          hourlyRate: job.hourlyRate,
          flatRate: job.flatRate,
          actualHours,
        });

        const updated = await prisma.job.update({
          where: { id: body.jobId },
          data: { actualHours, totalOwed: totalOwed ?? undefined },
        });

        await logActivity(body.jobId, user.id, "TIME_MANUAL", {
          minutes: body.minutes,
        });

        return res.status(201).json({ job: updated });
      },
    });
  } catch (err) {
    sendError(res, err);
  }
}
