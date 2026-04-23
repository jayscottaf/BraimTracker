import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { prisma } from "../../_lib/prisma.js";
import { requireAuth, requireOwner, sendError, HttpError } from "../../_lib/auth.js";
import { assert, methodRouter, parseBody } from "../../_lib/http.js";

const addSchema = z.object({
  labels: z.array(z.string().min(1).max(120)).min(1),
});

const toggleSchema = z.object({
  taskId: z.string().min(1),
  done: z.boolean(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = String(req.query.id ?? "");
  try {
    await methodRouter(req, res, {
      GET: async () => {
        await requireAuth(req);
        const tasks = await prisma.jobTask.findMany({
          where: { jobId: id },
          orderBy: { order: "asc" },
        });
        return res.status(200).json({ tasks });
      },
      POST: async () => {
        await requireOwner(req);
        const { labels } = addSchema.parse(parseBody(req));
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
        const { taskId, done } = toggleSchema.parse(parseBody(req));
        const job = await prisma.job.findUnique({ where: { id } });
        assert(job, 404, "Job not found");
        if (user.role === "WORKER" && job.assignedWorkerId !== user.id) {
          throw new HttpError(403, "Not your job");
        }
        const task = await prisma.jobTask.update({
          where: { id: taskId },
          data: {
            done,
            doneAt: done ? new Date() : null,
            doneById: done ? user.id : null,
          },
        });
        return res.status(200).json({ task });
      },
      DELETE: async () => {
        await requireOwner(req);
        const { taskId } = z.object({ taskId: z.string().min(1) }).parse(parseBody(req));
        await prisma.jobTask.delete({ where: { id: taskId } });
        return res.status(204).end();
      },
    });
  } catch (err) {
    sendError(res, err);
  }
}
