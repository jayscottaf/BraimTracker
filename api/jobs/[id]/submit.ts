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
        const job = await prisma.job.findUnique({
          where: { id },
          include: { photos: true, timeEntries: true },
        });
        assert(job, 404, "Job not found");

        if (user.role === "WORKER" && job.assignedWorkerId !== user.id) {
          throw new HttpError(403, "Not your job");
        }

        const hasAfter = job.photos.some((p) => p.type === "AFTER");
        assert(hasAfter, 400, "An AFTER photo is required before submitting");

        // Auto-close any open timer
        const open = job.timeEntries.find((t) => t.endAt === null);
        if (open) {
          const endAt = new Date();
          const durationMinutes = Math.max(
            1,
            Math.round((endAt.getTime() - open.startAt.getTime()) / 60000),
          );
          await prisma.timeEntry.update({
            where: { id: open.id },
            data: { endAt, durationMinutes },
          });
        }

        const updated = await prisma.job.update({
          where: { id },
          data: { status: "AWAITING_REVIEW" },
        });

        await logActivity(id, user.id, "SUBMITTED");

        return res.status(200).json({ job: updated });
      },
    });
  } catch (err) {
    sendError(res, err);
  }
}
