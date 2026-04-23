import { Link } from "react-router-dom";
import { StatusBadge, PriorityBadge } from "./ui";
import { priceLine } from "../lib/format";
import type { Job } from "../types";

export default function JobCard({ job }: { job: Job }) {
  const photo =
    job.photos?.find((p) => p.type === "AFTER") ||
    job.photos?.find((p) => p.type === "BEFORE") ||
    job.photos?.find((p) => p.type === "INSTRUCTION") ||
    job.photos?.[0];

  return (
    <Link
      to={`/jobs/${job.id}`}
      className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow"
    >
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
        {photo ? (
          <img src={photo.url} className="h-full w-full object-cover" alt="" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xl text-slate-300">📷</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{job.title}</div>
            <div className="truncate text-xs text-slate-500">
              {job.zone?.name}
              {job.assignedWorker && ` · ${job.assignedWorker.name}`}
            </div>
          </div>
          <PriorityBadge priority={job.priority} />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <StatusBadge status={job.status} />
          <span className="truncate text-xs text-slate-600">{priceLine(job)}</span>
        </div>
      </div>
    </Link>
  );
}
