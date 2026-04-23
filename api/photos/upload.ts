import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { prisma } from "../_lib/prisma.js";
import { verifyToken, sendError, HttpError } from "../_lib/auth.js";
import { methodRouter, parseBody } from "../_lib/http.js";

/**
 * Vercel Blob client-upload flow:
 *   1. Frontend calls this endpoint to get a signed upload URL.
 *   2. Frontend uploads the file directly to Blob storage.
 *   3. Vercel calls this endpoint as a webhook confirming the upload.
 *
 * Auth token travels inside the clientPayload JSON (browsers can't forward
 * Authorization headers through the @vercel/blob/client upload helper).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await methodRouter(req, res, {
      POST: async () => {
        const body = parseBody<HandleUploadBody>(req);

        const jsonResponse = await handleUpload({
          body,
          request: req as unknown as Request,
          onBeforeGenerateToken: async (_pathname, clientPayload) => {
            const parsed = clientPayload ? JSON.parse(clientPayload) : {};
            const jobId = String(parsed.jobId ?? "");
            const photoType = String(parsed.type ?? "");
            const token = String(parsed.token ?? "");

            if (!token) throw new HttpError(401, "Missing auth token");
            let userId: string;
            let role: string;
            try {
              const payload = verifyToken(token);
              userId = payload.sub;
              role = payload.role;
            } catch {
              throw new HttpError(401, "Invalid auth token");
            }

            if (!jobId || !["INSTRUCTION", "BEFORE", "AFTER"].includes(photoType)) {
              throw new HttpError(400, "Invalid upload metadata");
            }

            const job = await prisma.job.findUnique({ where: { id: jobId } });
            if (!job) throw new HttpError(404, "Job not found");

            if (role === "WORKER") {
              if (job.assignedWorkerId !== userId) throw new HttpError(403, "Not your job");
              if (photoType === "INSTRUCTION") throw new HttpError(403, "Workers cannot upload instruction photos");
            }

            return {
              allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/heic"],
              maximumSizeInBytes: 15 * 1024 * 1024,
              tokenPayload: JSON.stringify({
                jobId,
                photoType,
                uploadedById: userId,
              }),
              addRandomSuffix: true,
            };
          },
          onUploadCompleted: async ({ blob, tokenPayload }) => {
            const { jobId, photoType, uploadedById } = JSON.parse(tokenPayload ?? "{}");
            await prisma.jobPhoto.create({
              data: {
                jobId,
                type: photoType,
                url: blob.url,
                pathname: blob.pathname,
                uploadedById,
              },
            });
            await prisma.activityLog.create({
              data: {
                jobId,
                actorId: uploadedById,
                action: "PHOTO_UPLOADED",
                meta: { type: photoType, url: blob.url },
              },
            });
          },
        });

        return res.status(200).json(jsonResponse);
      },
    });
  } catch (err) {
    sendError(res, err);
  }
}
