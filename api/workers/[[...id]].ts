import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { prisma } from "../_lib/prisma.js";
import { requireOwner, sendError, HttpError } from "../_lib/auth.js";
import { assert, methodRouter, parseBody } from "../_lib/http.js";

const createSchema = z.object({
  name: z.string().min(1).max(60),
  loginCode: z.string().regex(/^\d{4,6}$/, "Login code must be 4-6 digits"),
  hourlyRate: z.number().min(0).max(500).optional(),
  phone: z.string().max(30).optional(),
});

const patchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  loginCode: z.string().regex(/^\d{4,6}$/).optional(),
  hourlyRate: z.number().min(0).max(500).optional(),
  phone: z.string().max(30).nullable().optional(),
  active: z.boolean().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = req.query.id;
  const rawSegments = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
  // vercel.json rewrites /api/workers -> /api/workers/_root so the
  // catch-all function matches; strip the sentinel back out here.
  const segments = rawSegments[0] === "_root" ? rawSegments.slice(1) : rawSegments;
  try {
    if (segments.length === 0) {
      await methodRouter(req, res, {
        GET: async () => {
          await requireOwner(req);
          const workers = await prisma.user.findMany({
            where: { role: "WORKER" },
            include: {
              workerProfile: true,
              _count: { select: { assignedJobs: true } },
            },
            orderBy: { name: "asc" },
          });
          return res.status(200).json({ workers });
        },
        POST: async () => {
          await requireOwner(req);
          const data = createSchema.parse(parseBody(req));

          const existing = await prisma.user.findUnique({ where: { loginCode: data.loginCode } });
          if (existing) throw new HttpError(409, "Login code already in use");

          const worker = await prisma.user.create({
            data: {
              role: "WORKER",
              name: data.name,
              loginCode: data.loginCode,
              workerProfile: {
                create: {
                  hourlyRate: data.hourlyRate ?? 20,
                  phone: data.phone,
                  active: true,
                },
              },
            },
            include: { workerProfile: true },
          });
          return res.status(201).json({ worker });
        },
      });
    } else if (segments.length === 1) {
      const id = segments[0];
      await methodRouter(req, res, {
        PATCH: async () => {
          await requireOwner(req);
          const data = patchSchema.parse(parseBody(req));

          const userUpdate: { name?: string; loginCode?: string } = {};
          if (data.name !== undefined) userUpdate.name = data.name;
          if (data.loginCode !== undefined) userUpdate.loginCode = data.loginCode;

          const profileUpdate: { hourlyRate?: number; phone?: string | null; active?: boolean } = {};
          if (data.hourlyRate !== undefined) profileUpdate.hourlyRate = data.hourlyRate;
          if (data.phone !== undefined) profileUpdate.phone = data.phone;
          if (data.active !== undefined) profileUpdate.active = data.active;

          const worker = await prisma.user.update({
            where: { id },
            data: {
              ...userUpdate,
              ...(Object.keys(profileUpdate).length
                ? { workerProfile: { update: profileUpdate } }
                : {}),
            },
            include: { workerProfile: true },
          });
          return res.status(200).json({ worker });
        },
        DELETE: async () => {
          await requireOwner(req);
          const assigned = await prisma.job.count({ where: { assignedWorkerId: id } });
          assert(assigned === 0, 400, "Worker has assigned jobs; reassign them first");
          await prisma.user.delete({ where: { id } });
          return res.status(204).end();
        },
      });
    } else {
      res.status(404).json({ error: "Not found" });
    }
  } catch (err) {
    sendError(res, err);
  }
}
