import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_lib/prisma.js";
import { requireAuth, sendError } from "./_lib/auth.js";
import { methodRouter } from "./_lib/http.js";

function startOfWeek(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay(); // Sun=0
  const diff = (day + 6) % 7; // Mon=0
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - diff);
  return date;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await methodRouter(req, res, {
      GET: async () => {
        const user = await requireAuth(req);
        const workerFilter = user.role === "WORKER" ? { assignedWorkerId: user.id } : {};
        const weekStart = startOfWeek();

        const [active, awaiting, completed, weekEntries, unpaid, recent] = await Promise.all([
          prisma.job.count({
            where: { ...workerFilter, status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
          }),
          prisma.job.count({
            where: { ...workerFilter, status: "AWAITING_REVIEW" },
          }),
          prisma.job.count({
            where: { ...workerFilter, status: { in: ["APPROVED", "PAID"] } },
          }),
          prisma.timeEntry.findMany({
            where: {
              startAt: { gte: weekStart },
              endAt: { not: null },
              ...(user.role === "WORKER" ? { workerId: user.id } : {}),
            },
            select: { durationMinutes: true },
          }),
          prisma.payment.aggregate({
            where: { paid: false },
            _sum: { amount: true },
          }),
          prisma.job.findMany({
            where: workerFilter,
            orderBy: { updatedAt: "desc" },
            take: 5,
            include: {
              zone: { select: { name: true } },
              assignedWorker: { select: { id: true, name: true } },
              photos: { orderBy: { createdAt: "desc" }, take: 1 },
            },
          }),
        ]);

        const weekMinutes = weekEntries.reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
        const weekHours = Math.round((weekMinutes / 60) * 10) / 10;

        return res.status(200).json({
          counts: { active, awaiting, completed },
          weekHours,
          unpaidTotal: Number(unpaid._sum.amount ?? 0),
          recentJobs: recent,
        });
      },
    });
  } catch (err) {
    sendError(res, err);
  }
}
