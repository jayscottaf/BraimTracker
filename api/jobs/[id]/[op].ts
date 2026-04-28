import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../_lib/prisma.js";
import {
  requireAuth,
  requireOwner,
  sendError,
  HttpError,
} from "../../_lib/auth.js";
import { assert, methodRouter, parseBody } from "../../_lib/http.js";
import { logActivity } from "../../_lib/activity.js";
import { computeTotal, sumActualHoursFromEntries } from "../../_lib/billing.js";

const approveSchema = z.object({
  actualHours: z.number().min(0).max(999).optional(),
  totalOwed: z.number().min(0).max(100000).optional(),
});

const assignSchema = z.object({
  workerId: z.string().min(1).nullable(),
  hourlyRate: z.number().min(0).max(500).optional(),
});

const rejectSchema = z.object({
  reason: z.string().min(1).max(1000),
});

const tasksAddSchema = z.object({
  labels: z.array(z.string().min(1).max(120)).min(1),
});

const tasksToggleSchema = z.object({
  taskId: z.string().min(1),
  done: z.boolean(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = String(req.query.id ?? "");
  const op = String(req.query.op ?? "");
  try {
    switch (op) {
      case "approve":
        await methodRouter(req, res, {
          POST: async () => {
            const owner = await requireOwner(req);
            const body = approveSchema.parse(parseBody(req));

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
        break;

      case "assign":
        await methodRouter(req, res, {
          POST: async () => {
            const owner = await requireOwner(req);
            const { workerId, hourlyRate } = assignSchema.parse(parseBody(req));

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
        break;

      case "reject":
        await methodRouter(req, res, {
          POST: async () => {
            const owner = await requireOwner(req);
            const { reason } = rejectSchema.parse(parseBody(req));

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
        break;

      case "start":
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
        break;

      case "stop":
        await methodRouter(req, res, {
          POST: async () => {
            const user = await requireAuth(req);
            const job = await prisma.job.findUnique({ where: { id } });
            assert(job, 404, "Job not found");

            const isOwner = user.role === "OWNER";
            if (!isOwner && job.assignedWorkerId !== user.id) {
              throw new HttpError(403, "Not your job");
            }

            const open = await prisma.timeEntry.findFirst({
              where: { jobId: id, endAt: null },
              orderBy: { startAt: "desc" },
            });
            assert(open, 400, "No running timer on this job");

            const endAt = new Date();
            const durationMinutes = Math.max(
              1,
              Math.round((endAt.getTime() - open.startAt.getTime()) / 60000),
            );
            await prisma.timeEntry.update({
              where: { id: open.id },
              data: { endAt, durationMinutes },
            });

            const entries = await prisma.timeEntry.findMany({
              where: { jobId: id, endAt: { not: null } },
              select: { durationMinutes: true },
            });
            const actualHours = sumActualHoursFromEntries(entries);
            const totalOwed = computeTotal({
              priceMode: job.priceMode,
              hourlyRate: job.hourlyRate,
              flatRate: job.flatRate,
              actualHours,
            });

            const updated = await prisma.job.update({
              where: { id },
              data: {
                actualHours,
                totalOwed,
              },
            });

            await logActivity(id, user.id, "STOPPED", {
              timeEntryId: open.id,
              durationMinutes,
            });

            return res.status(200).json({ job: updated });
          },
        });
        break;

      case "submit":
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

            const entries = await prisma.timeEntry.findMany({
              where: { jobId: id, endAt: { not: null } },
              select: { durationMinutes: true },
            });
            const actualHours = sumActualHoursFromEntries(entries);
            const totalOwed = computeTotal({
              priceMode: job.priceMode,
              hourlyRate: job.hourlyRate,
              flatRate: job.flatRate,
              actualHours,
            });

            const updated = await prisma.job.update({
              where: { id },
              data: {
                status: "AWAITING_REVIEW",
                actualHours,
                totalOwed: totalOwed ?? undefined,
              },
            });

            await logActivity(id, user.id, "SUBMITTED");

            return res.status(200).json({ job: updated });
          },
        });
        break;

      case "tasks":
        await methodRouter(req, res, {
          GET: async () => {
            const user = await requireAuth(req);
            const job = await prisma.job.findUnique({
              where: { id },
              select: { assignedWorkerId: true },
            });
            assert(job, 404, "Job not found");
            if (user.role === "WORKER" && job.assignedWorkerId !== user.id) {
              throw new HttpError(403, "Not your job");
            }
            const tasks = await prisma.jobTask.findMany({
              where: { jobId: id },
              orderBy: { order: "asc" },
            });
            return res.status(200).json({ tasks });
          },
          POST: async () => {
            await requireOwner(req);
            const { labels } = tasksAddSchema.parse(parseBody(req));
            const job = await prisma.job.findUnique({
              where: { id },
              select: { id: true },
            });
            assert(job, 404, "Job not found");
            const existing = await prisma.jobTask.count({ where: { jobId: id } });
            await prisma.jobTask.createMany({
              data: labels.map((label, i) => ({
                jobId: id,
                label,
                order: existing + i,
              })),
            });
            const tasks = await prisma.jobTask.findMany({
              where: { jobId: id },
              orderBy: { order: "asc" },
            });
            return res.status(201).json({ tasks });
          },
          PATCH: async () => {
            const user = await requireAuth(req);
            const { taskId, done } = tasksToggleSchema.parse(parseBody(req));
            const job = await prisma.job.findUnique({ where: { id } });
            assert(job, 404, "Job not found");
            if (user.role === "WORKER" && job.assignedWorkerId !== user.id) {
              throw new HttpError(403, "Not your job");
            }
            const updated = await prisma.jobTask.updateMany({
              where: { id: taskId, jobId: id },
              data: {
                done,
                doneAt: done ? new Date() : null,
                doneById: done ? user.id : null,
              },
            });
            assert(updated.count === 1, 404, "Task not found");
            const task = await prisma.jobTask.findFirst({
              where: { id: taskId, jobId: id },
            });
            assert(task, 404, "Task not found");
            return res.status(200).json({ task });
          },
          DELETE: async () => {
            await requireOwner(req);
            const { taskId } = z.object({ taskId: z.string().min(1) }).parse(parseBody(req));
            const deleted = await prisma.jobTask.deleteMany({ where: { id: taskId, jobId: id } });
            assert(deleted.count === 1, 404, "Task not found");
            return res.status(204).end();
          },
        });
        break;

      default:
        res.status(404).json({ error: "Not found" });
    }
  } catch (err) {
    sendError(res, err);
  }
}
