import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { prisma } from "../_lib/prisma.js";
import { requireAuth, requireOwner, sendError } from "../_lib/auth.js";
import { methodRouter, parseBody } from "../_lib/http.js";
import { logActivity } from "../_lib/activity.js";

const createSchema = z
  .object({
    title: z.string().min(1).max(120),
    description: z.string().max(2000).optional(),
    zoneId: z.string().min(1),
    taskType: z.enum(["MULCH", "EDGING", "CLEANUP", "TRIMMING", "PRUNING", "OTHER"]).optional(),
    instructions: z.string().max(4000).optional(),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
    assignedWorkerId: z.string().optional().nullable(),
    targetDate: z.string().datetime().optional().nullable(),
    estimatedHours: z.number().min(0).max(999).optional(),
    priceMode: z.enum(["HOURLY", "FLAT"]).default("HOURLY"),
    hourlyRate: z.number().min(0).max(500).optional(),
    flatRate: z.number().min(0).max(100000).optional(),
    tasks: z.array(z.string().min(1).max(120)).optional(),
  })
  .refine((d) => d.priceMode !== "FLAT" || typeof d.flatRate === "number", {
    message: "flatRate is required when priceMode is FLAT",
    path: ["flatRate"],
  });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await methodRouter(req, res, {
      GET: async () => {
        const user = await requireAuth(req);
        const statusFilter = req.query.status ? String(req.query.status).split(",") : undefined;

        const where: Record<string, unknown> = {};
        if (user.role === "WORKER") where.assignedWorkerId = user.id;
        if (statusFilter) where.status = { in: statusFilter };

        const jobs = await prisma.job.findMany({
          where,
          orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
          include: {
            zone: { select: { id: true, name: true, priority: true } },
            assignedWorker: { select: { id: true, name: true } },
            photos: { orderBy: { createdAt: "desc" }, take: 4 },
            payment: true,
            _count: { select: { tasks: true, photos: true, timeEntries: true } },
          },
        });
        return res.status(200).json({ jobs });
      },

      POST: async () => {
        const owner = await requireOwner(req);
        const data = createSchema.parse(parseBody(req));

        let hourlyRate = data.hourlyRate ?? 20;
        if (data.assignedWorkerId) {
          const profile = await prisma.workerProfile.findUnique({
            where: { userId: data.assignedWorkerId },
          });
          if (profile && data.hourlyRate === undefined) {
            hourlyRate = Number(profile.hourlyRate);
          }
        }

        const job = await prisma.job.create({
          data: {
            title: data.title,
            description: data.description,
            zoneId: data.zoneId,
            taskType: data.taskType ?? "OTHER",
            instructions: data.instructions,
            priority: data.priority ?? "NORMAL",
            assignedWorkerId: data.assignedWorkerId ?? null,
            status: data.assignedWorkerId ? "ASSIGNED" : "DRAFT",
            targetDate: data.targetDate ? new Date(data.targetDate) : null,
            estimatedHours: data.estimatedHours,
            priceMode: data.priceMode,
            hourlyRate,
            flatRate: data.flatRate,
            tasks: data.tasks
              ? { create: data.tasks.map((label, order) => ({ label, order })) }
              : undefined,
          },
          include: { zone: true, tasks: true, assignedWorker: true },
        });

        await logActivity(job.id, owner.id, "CREATED");
        if (data.assignedWorkerId) {
          await logActivity(job.id, owner.id, "ASSIGNED", {
            workerId: data.assignedWorkerId,
          });
        }

        return res.status(201).json({ job });
      },
    });
  } catch (err) {
    sendError(res, err);
  }
}
