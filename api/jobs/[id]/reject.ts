import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { prisma } from "../../_lib/prisma.js";
import { requireOwner, sendError } from "../../_lib/auth.js";
import { assert, methodRouter, parseBody } from "../../_lib/http.js";
import { logActivity } from "../../_lib/activity.js";

const schema = z.object({
  reason: z.string().min(1).max(1000),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = String(req.query.id ?? "");
  try {
    await methodRouter(req, res, {
      POST: async () => {
        const owner = await requireOwner(req);
        const { reason } = schema.parse(parseBody(req));

        const job = await prisma.job.findUnique({ where: { id } });
        assert(job, 404, "Job not found");

        const updated = await prisma.job.update({
          where: { id },
          data: {
            status: job.assignedWorkerId ? "ASSIGNED" : "DRAFT",
            ownerNotes: reason,
          },
        });

        await logActivity(id, owner.id, "REJECTED", { reason });

        return res.status(200).json({ job: updated });
      },
    });
  } catch (err) {
    sendError(res, err);
  }
}
