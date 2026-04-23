import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get } from "../lib/api";
import { Button, Card, EmptyState } from "../components/ui";
import { currency, hours } from "../lib/format";
import JobCard from "../components/JobCard";
import { useAuth } from "../context/AuthContext";
import type { DashboardSummary } from "../types";

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    void get<DashboardSummary>("/api/dashboard").then(setData);
  }, []);

  if (!data) {
    return <div className="py-8 text-center text-slate-400">Loading…</div>;
  }

  const isOwner = user?.role === "OWNER";

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Active" value={data.counts.active} tone="blue" />
        <Stat label="Awaiting review" value={data.counts.awaiting} tone="purple" />
        <Stat label="This week" value={hours(data.weekHours)} tone="slate" />
        <Stat
          label={isOwner ? "Owed" : "Completed"}
          value={isOwner ? currency(data.unpaidTotal) : data.counts.completed}
          tone="emerald"
        />
      </section>

      {isOwner && (
        <Card>
          <div className="mb-2 text-sm font-semibold">Quick actions</div>
          <div className="flex flex-wrap gap-2">
            <Link to="/jobs/new">
              <Button>+ New job</Button>
            </Link>
            <Link to="/zones">
              <Button variant="secondary">Manage zones</Button>
            </Link>
            <Link to="/workers">
              <Button variant="secondary">Workers</Button>
            </Link>
            {data.counts.awaiting > 0 && (
              <Link to="/jobs?status=AWAITING_REVIEW">
                <Button variant="secondary">Review {data.counts.awaiting} job{data.counts.awaiting === 1 ? "" : "s"}</Button>
              </Link>
            )}
          </div>
        </Card>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-600">Recent jobs</h2>
          <Link to="/jobs" className="text-sm text-brand-700">
            See all →
          </Link>
        </div>
        <div className="space-y-2">
          {data.recentJobs.length === 0 ? (
            <EmptyState
              title="No jobs yet"
              description={isOwner ? "Create your first job to get started." : "You don't have any assigned jobs."}
              action={isOwner ? <Link to="/jobs/new"><Button>+ Create job</Button></Link> : undefined}
            />
          ) : (
            data.recentJobs.map((j) => <JobCard key={j.id} job={j} />)
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "blue" | "purple" | "slate" | "emerald";
}) {
  const bg = {
    blue: "bg-blue-50 text-blue-900",
    purple: "bg-purple-50 text-purple-900",
    slate: "bg-slate-100 text-slate-900",
    emerald: "bg-emerald-50 text-emerald-900",
  }[tone];
  return (
    <div className={`rounded-2xl p-3 ${bg}`}>
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
