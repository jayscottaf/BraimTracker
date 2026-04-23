import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../_lib/prisma.js";
import { requireOwner, sendError } from "../../_lib/auth.js";
import { assert, methodRouter, parseBody } from "../../_lib/http.js";
import { logActivity } from "../../_lib/activity.js";
import { computeTotal, sumActualHoursFromEntries } from "../../_lib/billing.js";

const schema = z.object({
  actualHours: z.number().min(0).max(999).optional(),
  totalOwed: z.number().min(0).max(100000).optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = String(req.query.id ?? "");
  try {
    await methodRouter(req, res, {
      POST: async () => {
        const owner = await requireOwner(req);
        const body = schema.parse(parseBody(req));

        const job = await prisma.job.findUnique({
          where: { id },
          include: { timeEntries: true },
        });
        assert(job, 404, "Job not found");

        const actualHours =
          body.actualHours !== undefined
            ? new Prisma.Decimal(body.actualHours)
            : sumActualHoursFromEntries(job.timeEntries);

        const computed = computeTotal({
          priceMode: job.priceMode,
          hourlyRate: job.hourlyRate,
          flatRate: job.flatRate,
          actualHours,
        });
        const totalOwed =
          body.totalOwed !== undefined ? new Prisma.Decimal(body.totalOwed) : computed;
        assert(totalOwed, 400, "Cannot compute total (missing hours or flat rate)");

        const updated = await prisma.$transaction(async (tx) => {
          const j = await tx.job.update({
            where: { id },
            data: {
              status: "APPROVED",
              actualHours,
              totalOwed,
            },
          });
          await tx.payment.upsert({
            where: { jobId: id },
            create: {
              jobId: id,
              amount: totalOwed,
              paid: false,
            },
            update: {
              amount: totalOwed,
            },
          });
          return j;
        });

        await logActivity(id, owner.id, "APPROVED", {
          actualHours: actualHours.toString(),
          totalOwed: totalOwed.toString(),
        });

        return res.status(200).json({ job: updated });
      },
    });
  } catch (err) {
    sendError(res, err);
  }
}
