import type { Job } from "@prisma/client";
import { Prisma } from "@prisma/client";

type JobForBilling = Pick<Job, "priceMode" | "hourlyRate" | "flatRate" | "actualHours">;

/**
 * Total owed in dollars based on pricing mode:
 *  HOURLY => hourlyRate × actualHours
 *  FLAT   => flatRate
 * Returns null if the required inputs are missing (e.g. hourly job with no hours yet).
 */
export function computeTotal(job: JobForBilling): Prisma.Decimal | null {
  if (job.priceMode === "FLAT") {
    return job.flatRate ? new Prisma.Decimal(job.flatRate) : null;
  }
  if (!job.actualHours) return null;
  return new Prisma.Decimal(job.actualHours).mul(new Prisma.Decimal(job.hourlyRate));
}

export function sumActualHoursFromEntries(
  entries: Array<{ durationMinutes: number | null }>,
): Prisma.Decimal {
  const totalMinutes = entries.reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
  return new Prisma.Decimal(totalMinutes).div(60).toDecimalPlaces(2);
}
