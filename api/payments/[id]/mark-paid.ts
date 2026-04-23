import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { prisma } from "../../_lib/prisma.js";
import { requireOwner, sendError } from "../../_lib/auth.js";
import { assert, methodRouter, parseBody } from "../../_lib/http.js";
import { logActivity } from "../../_lib/activity.js";

const schema = z.object({
  method: z.string().max(40).optional(),
  notes: z.string().max(500).optional(),
  paid: z.boolean().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = String(req.query.id ?? "");
  try {
    await methodRouter(req, res, {
      POST: async () => {
        const owner = await requireOwner(req);
        const body = schema.parse(parseBody(req));
        const markPaid = body.paid !== false;

        const payment = await prisma.payment.findUnique({ where: { id } });
        assert(payment, 404, "Payment not found");

        const updated = await prisma.payment.update({
          where: { id },
          data: {
            paid: markPaid,
            paidAt: markPaid ? new Date() : null,
            method: body.method,
            notes: body.notes,
          },
        });

        await prisma.job.update({
          where: { id: payment.jobId },
          data: { status: markPaid ? "PAID" : "APPROVED" },
        });

        await logActivity(payment.jobId, owner.id, markPaid ? "PAID" : "UNPAID", {
          amount: Number(payment.amount),
          method: body.method,
        });

        return res.status(200).json({ payment: updated });
      },
    });
  } catch (err) {
    sendError(res, err);
  }
}
