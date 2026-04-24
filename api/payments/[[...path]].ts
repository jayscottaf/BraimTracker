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
  const rawSegments = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
  // vercel.json rewrites /api/payments -> /api/payments/_root so the
  // catch-all function matches; strip the sentinel back out here.
  const segments = rawSegments[0] === "_root" ? rawSegments.slice(1) : rawSegments;
  try {
    if (segments.length === 0) {
      await methodRouter(req, res, {
        GET: async () => {
          await requireOwner(req);

          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

          const [payments, inProgressJobs] = await Promise.all([
            prisma.payment.findMany({
              orderBy: [{ paid: "asc" }, { createdAt: "desc" }],
              include: {
                job: {
                  select: {
                    id: true,
                    title: true,
                    priceMode: true,
                    hourlyRate: true,
                    flatRate: true,
                    actualHours: true,
                    zone: { select: { name: true } },
                    assignedWorker: { select: { id: true, name: true } },
                  },
                },
              },
            }),
            prisma.job.findMany({
              where: { status: { in: ["IN_PROGRESS", "AWAITING_REVIEW"] } },
              select: {
                id: true,
                title: true,
                status: true,
                priceMode: true,
                hourlyRate: true,
                flatRate: true,
                actualHours: true,
                estimatedHours: true,
                zone: { select: { name: true } },
                assignedWorker: { select: { id: true, name: true } },
                timeEntries: {
                  where: { endAt: null },
                  select: { startAt: true },
                  take: 1,
                },
              },
              orderBy: { updatedAt: "desc" },
            }),
          ]);

          const unpaidTotal = payments
            .filter((p) => !p.paid)
            .reduce((sum, p) => sum + Number(p.amount), 0);

          const weekPaid = payments
            .filter((p) => p.paid && p.paidAt && p.paidAt > weekAgo)
            .reduce((sum, p) => sum + Number(p.amount), 0);

          // Estimate accruing cost for in-progress jobs.
          const inProgress = inProgressJobs.map((j) => {
            const openTimer = j.timeEntries[0]?.startAt ?? null;
            const rate = Number(j.hourlyRate);
            const hrs = j.actualHours ? Number(j.actualHours) : 0;
            const accrued =
              j.priceMode === "FLAT"
                ? Number(j.flatRate ?? 0)
                : Math.round(rate * hrs * 100) / 100;
            return {
              id: j.id,
              title: j.title,
              status: j.status,
              priceMode: j.priceMode,
              hourlyRate: j.hourlyRate,
              flatRate: j.flatRate,
              actualHours: j.actualHours,
              estimatedHours: j.estimatedHours,
              zone: j.zone,
              assignedWorker: j.assignedWorker,
              openTimerStartedAt: openTimer,
              accrued,
            };
          });

          const inProgressTotal = inProgress.reduce((sum, j) => sum + j.accrued, 0);

          return res.status(200).json({
            payments,
            inProgress,
            rollup: {
              weekPaid,
              unpaidTotal,
              inProgressTotal,
            },
            unpaidTotal, // kept for backward compatibility
          });
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
