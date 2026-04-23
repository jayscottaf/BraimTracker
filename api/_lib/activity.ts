import { prisma } from "./prisma.js";

export async function logActivity(
  jobId: string | null,
  actorId: string,
  action: string,
  meta?: Record<string, unknown>,
) {
  await prisma.activityLog.create({
    data: { jobId, actorId, action, meta: meta as any },
  });
}
