import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { prisma } from "../_lib/prisma.js";
import { requireOwner, sendError } from "../_lib/auth.js";
import { assert, methodRouter, parseBody } from "../_lib/http.js";
import { logActivity } from "../_lib/activity.js";

const markPaidSchema = z.object({
  method: z.string().max(40).optional(),
  notes: z.string().max(500).optional(),
  paid: z.boolean().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = req.query.path;
  const segments = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
  try {
    if (segments.length === 0) {
      await methodRouter(req, res, {
        GET: async () => {
          await requireOwner(req);
          const payments = await prisma.payment.findMany({
            orderBy: [{ paid: "asc" }, { createdAt: "desc" }],
            include: {
              job: {
                select: {
                  id: true,
                  title: true,
                  zone: { select: { name: true } },
                  assignedWorker: { select: { id: true, name: true } },
                },
              },
            },
          });
          const unpaidTotal = payments
            .filter((p) => !p.paid)
            .reduce((sum, p) => sum + Number(p.amount), 0);
          return res.status(200).json({ payments, unpaidTotal });
        },
      });
    } else if (segments.length === 2 && segments[1] === "mark-paid") {
      const id = segments[0];
      await methodRouter(req, res, {
        POST: async () => {
          const owner = await requireOwner(req);
          const body = markPaidSchema.parse(parseBody(req));
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
    } else {
      res.status(404).json({ error: "Not found" });
    }
  } catch (err) {
    sendError(res, err);
  }
}
