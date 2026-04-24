import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { del } from "@vercel/blob";
import { prisma } from "../_lib/prisma.js";
import {
  verifyToken,
  requireAuth,
  sendError,
  HttpError,
} from "../_lib/auth.js";
import { assert, methodRouter, parseBody } from "../_lib/http.js";

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
  // Parse segments from req.url directly — see workers/[[...id]].ts for why.
  const urlPath = (req.url || "").split("?")[0];
  const tail = urlPath.replace(/^\/api\/photos\/?/, "").replace(/\/$/, "");
  const segments = tail ? tail.split("/") : [];
  try {
    if (segments.length === 1 && segments[0] === "upload") {
      await methodRouter(req, res, {
        POST: async () => {
          // Fail fast and loud if the Blob integration isn't wired up.
          // Without this, @vercel/blob's handleUpload throws a generic
          // "No token found" deep in its stack which sendError reduces to
          // "Internal server error", which the client library then reports
          // as the opaque "Failed to retrieve the client token".
          const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
          if (!blobToken) {
            console.error("[photos/upload] BLOB_READ_WRITE_TOKEN env var is not set in this deployment");
            throw new HttpError(
              500,
              "Vercel Blob storage is not configured. Add a Blob store under the Vercel project's Storage tab and redeploy.",
            );
          }

          const body = parseBody<HandleUploadBody>(req);

          let jsonResponse;
          try {
            jsonResponse = await handleUpload({
              token: blobToken,
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
          } catch (uploadErr) {
            // Surface the real upload error in Vercel logs — without this,
            // sendError just returns the generic "Internal server error" and
            // we have no idea why handleUpload failed.
            console.error("[photos/upload] handleUpload threw:", uploadErr);
            throw uploadErr;
          }

          return res.status(200).json(jsonResponse);
        },
      });
    } else if (segments.length === 1) {
      const id = segments[0];
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
    } else {
      res.status(404).json({ error: "Not found" });
    }
  } catch (err) {
    sendError(res, err);
  }
}
