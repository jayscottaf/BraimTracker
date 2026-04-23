import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { get } from "../lib/api";
import { Button, EmptyState } from "../components/ui";
import JobCard from "../components/JobCard";
import { useAuth } from "../context/AuthContext";
import type { Job, JobStatus } from "../types";

const FILTERS: { value: string; label: string; statuses: JobStatus[] }[] = [
  { value: "active", label: "Active", statuses: ["ASSIGNED", "IN_PROGRESS", "AWAITING_REVIEW"] },
  { value: "draft", label: "Draft", statuses: ["DRAFT"] },
  { value: "done", label: "Done", statuses: ["APPROVED", "PAID"] },
  { value: "all", label: "All", statuses: [] },
];

export default function JobsList() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const statusParam = params.get("status");
  const activeFilter = useMemo(() => {
    if (statusParam) return { value: "custom", label: statusParam.replace(/_/g, " "), statuses: statusParam.split(",") as JobStatus[] };
    return FILTERS.find((f) => f.value === (params.get("filter") ?? "active")) ?? FILTERS[0];
  }, [params, statusParam]);

  useEffect(() => {
    setLoading(true);
    const qs = activeFilter.statuses.length ? `?status=${activeFilter.statuses.join(",")}` : "";
    void get<{ jobs: Job[] }>(`/api/jobs${qs}`)
      .then((d) => setJobs(d.jobs))
      .finally(() => setLoading(false));
  }, [activeFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">{user?.role === "OWNER" ? "Jobs" : "My jobs"}</h1>
        {user?.role === "OWNER" && (
          <Link to="/jobs/new">
            <Button>+ New</Button>
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setParams(f.value === "active" ? {} : { filter: f.value });
            }}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium ${
              activeFilter.value === f.value ? "bg-white shadow-sm" : "text-slate-500"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-8 text-center text-slate-400">Loading…</div>
      ) : jobs.length === 0 ? (
        <EmptyState
          title="No jobs"
          description="Nothing matches this filter yet."
          action={
            user?.role === "OWNER" ? (
              <Link to="/jobs/new">
                <Button>+ Create job</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {jobs.map((j) => (
            <JobCard key={j.id} job={j} />
          ))}
        </div>
      )}
    </div>
  );
}
