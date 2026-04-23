import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "../../_lib/prisma.js";
import { requireAuth, sendError, HttpError } from "../../_lib/auth.js";
import { assert, methodRouter } from "../../_lib/http.js";
import { logActivity } from "../../_lib/activity.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = String(req.query.id ?? "");
  try {
    await methodRouter(req, res, {
      POST: async () => {
        const user = await requireAuth(req);
        const job = await prisma.job.findUnique({ where: { id } });
        assert(job, 404, "Job not found");

        const isOwner = user.role === "OWNER";
        const workerId = job.assignedWorkerId;
        if (!isOwner && workerId !== user.id) throw new HttpError(403, "Not your job");
        assert(workerId, 400, "Job is not assigned to a worker");

        const open = await prisma.timeEntry.findFirst({
          where: { workerId, endAt: null },
        });
        if (open) throw new HttpError(409, "You already have a timer running");

        const entry = await prisma.timeEntry.create({
          data: { jobId: id, workerId, startAt: new Date() },
        });

        const updated = await prisma.job.update({
          where: { id },
          data: { status: "IN_PROGRESS" },
        });

        await logActivity(id, user.id, "STARTED", { timeEntryId: entry.id });

        return res.status(200).json({ job: updated, timeEntry: entry });
      },
    });
  } catch (err) {
    sendError(res, err);
  }
}
