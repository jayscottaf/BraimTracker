import type { VercelRequest, VercelResponse } from "@vercel/node";
import { del } from "@vercel/blob";
import { prisma } from "../_lib/prisma.js";
import { requireAuth, sendError, HttpError } from "../_lib/auth.js";
import { assert, methodRouter } from "../_lib/http.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = String(req.query.id ?? "");
  try {
    await methodRouter(req, res, {
      DELETE: async () => {
        const user = await requireAuth(req);
        const photo = await prisma.jobPhoto.findUnique({
          where: { id },
          include: { job: true },
        });
        assert(photo, 404, "Photo not found");

        const isOwner = user.role === "OWNER";
        const isUploader = photo.uploadedById === user.id;
        const jobOpen = ["DRAFT", "ASSIGNED", "IN_PROGRESS"].includes(photo.job.status);
        if (!isOwner && !(isUploader && jobOpen)) {
          throw new HttpError(403, "Cannot delete this photo");
        }

        try {
          await del(photo.url);
        } catch {
          // swallow; DB row removal still matters
        }
        await prisma.jobPhoto.delete({ where: { id } });

        return res.status(204).end();
      },
    });
  } catch (err) {
    sendError(res, err);
  }
}
