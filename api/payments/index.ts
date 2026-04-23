import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "../_lib/prisma.js";
import { requireOwner, sendError } from "../_lib/auth.js";
import { methodRouter } from "../_lib/http.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
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
  } catch (err) {
    sendError(res, err);
  }
}
