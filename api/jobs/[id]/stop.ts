import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "../../_lib/prisma.js";
import { requireAuth, sendError, HttpError } from "../../_lib/auth.js";
import { assert, methodRouter } from "../../_lib/http.js";
import { logActivity } from "../../_lib/activity.js";
import { computeTotal, sumActualHoursFromEntries } from "../../_lib/billing.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = String(req.query.id ?? "");
  try {
    await methodRouter(req, res, {
      POST: async () => {
        const user = await requireAuth(req);
        const job = await prisma.job.findUnique({ where: { id } });
        assert(job, 404, "Job not found");

        const isOwner = user.role === "OWNER";
        if (!isOwner && job.assignedWorkerId !== user.id) {
          throw new HttpError(403, "Not your job");
        }

        const open = await prisma.timeEntry.findFirst({
          where: { jobId: id, endAt: null },
          orderBy: { startAt: "desc" },
        });
        assert(open, 400, "No running timer on this job");

        const endAt = new Date();
        const durationMinutes = Math.max(
          1,
          Math.round((endAt.getTime() - open.startAt.getTime()) / 60000),
        );
        await prisma.timeEntry.update({
          where: { id: open.id },
          data: { endAt, durationMinutes },
        });

        const entries = await prisma.timeEntry.findMany({
          where: { jobId: id, endAt: { not: null } },
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
          where: { id },
          data: {
            actualHours,
            totalOwed,
          },
        });

        await logActivity(id, user.id, "STOPPED", {
          timeEntryId: open.id,
          durationMinutes,
        });

        return res.status(200).json({ job: updated });
      },
    });
  } catch (err) {
    sendError(res, err);
  }
}
