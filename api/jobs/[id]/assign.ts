import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { prisma } from "../../_lib/prisma.js";
import { requireOwner, sendError } from "../../_lib/auth.js";
import { assert, methodRouter, parseBody } from "../../_lib/http.js";
import { logActivity } from "../../_lib/activity.js";

const schema = z.object({
  workerId: z.string().min(1).nullable(),
  hourlyRate: z.number().min(0).max(500).optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = String(req.query.id ?? "");
  try {
    await methodRouter(req, res, {
      POST: async () => {
        const owner = await requireOwner(req);
        const { workerId, hourlyRate } = schema.parse(parseBody(req));

        const job = await prisma.job.findUnique({ where: { id } });
        assert(job, 404, "Job not found");

        let newRate = job.hourlyRate;
        if (workerId) {
          const profile = await prisma.workerProfile.findUnique({ where: { userId: workerId } });
          assert(profile?.active, 400, "Worker not found or inactive");
          newRate = hourlyRate !== undefined ? (hourlyRate as unknown as typeof newRate) : profile.hourlyRate;
        }

        const updated = await prisma.job.update({
          where: { id },
          data: {
            assignedWorkerId: workerId,
            hourlyRate: newRate,
            status: workerId
              ? job.status === "DRAFT"
                ? "ASSIGNED"
                : job.status
              : "DRAFT",
          },
          include: { assignedWorker: { select: { id: true, name: true } } },
        });

        await logActivity(id, owner.id, workerId ? "ASSIGNED" : "UNASSIGNED", {
          workerId,
        });

        return res.status(200).json({ job: updated });
      },
    });
  } catch (err) {
    sendError(res, err);
  }
}
