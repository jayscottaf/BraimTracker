import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { prisma } from "../_lib/prisma.js";
import { requireOwner, sendError } from "../_lib/auth.js";
import { assert, methodRouter, parseBody } from "../_lib/http.js";

const patchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  loginCode: z.string().regex(/^\d{4,6}$/).optional(),
  hourlyRate: z.number().min(0).max(500).optional(),
  phone: z.string().max(30).nullable().optional(),
  active: z.boolean().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = String(req.query.id ?? "");
  try {
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
  } catch (err) {
    sendError(res, err);
  }
}
