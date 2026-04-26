import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { del, get, patch } from "../lib/api";
import { Button, Card, EmptyState, Field, inputClass, Spinner } from "../components/ui";
import JobCard from "../components/JobCard";
import { currency, hours, relativeTime } from "../lib/format";
import type { Job, Worker } from "../types";

interface Detail {
  worker: Worker & { assignedJobs: Job[] };
  activity: Array<{
    id: string;
    action: string;
    createdAt: string;
    meta?: Record<string, unknown> | null;
    job?: { id: string; title: string } | null;
  }>;
  summary: {
    weekHours: number;
    unpaidOwed: number;
    lifetimeEarned: number;
    activeJobs: number;
  };
}

export default function WorkerDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [rateDraft, setRateDraft] = useState("");
  const [rateBusy, setRateBusy] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [phoneBusy, setPhoneBusy] = useState(false);

  const refresh = async () => {
    if (!id) return;
    try {
      const d = await get<Detail>(`/api/workers/${id}`);
      if (!d || !d.worker) {
        console.error("Worker detail response missing `worker` field:", d);
        setErr("Worker data didn't load. Try pulling down to refresh.");
        return;
      }
      setData(d);
      setRateDraft(String(d.worker.workerProfile?.hourlyRate ?? ""));
      setPhoneDraft(d.worker.workerProfile?.phone ?? "");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load worker");
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (err) return <div className="text-sm text-rose-700">{err}</div>;
  if (!data || !data.worker) return <div className="py-8 text-center text-slate-400">Loading…</div>;

  const { worker, activity, summary } = data;
  const active = worker.workerProfile?.active !== false;
  const activeJobs = (worker.assignedJobs ?? []).filter((j) => j.status !== "PAID");

  async function saveRate() {
    const rate = Number(rateDraft);
    if (!Number.isFinite(rate) || rate < 0) return;
    setRateBusy(true);
    try {
      await patch(`/api/workers/${id}`, { hourlyRate: rate });
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to update rate");
    } finally {
      setRateBusy(false);
    }
  }

  async function savePhone() {
    const trimmed = phoneDraft.trim();
    setPhoneBusy(true);
    try {
      await patch(`/api/workers/${id}`, { phone: trimmed === "" ? null : trimmed });
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to update phone");
    } finally {
      setPhoneBusy(false);
    }
  }

  async function toggleActive() {
    await patch(`/api/workers/${id}`, { active: !active });
    await refresh();
  }

  async function remove() {
    if (!confirm(`Delete ${worker.name}? This cannot be undone.`)) return;
    try {
      await del(`/api/workers/${id}`);
      nav("/workers", { replace: true });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  return (
    <div className="space-y-4">
      <Link to="/workers" className="text-sm text-brand-700">
        ← Workers
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{worker.name}</h1>
        <div className="text-sm text-slate-500">
          Code <span className="font-mono">{worker.loginCode}</span>
          {!active && (
            <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-700">
              Paused
            </span>
          )}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="This week" value={hours(summary.weekHours)} tone="slate" />
        <Stat label="Owed now" value={currency(summary.unpaidOwed)} tone="emerald" />
        <Stat label="Lifetime paid" value={currency(summary.lifetimeEarned)} tone="blue" />
        <Stat label="Active jobs" value={summary.activeJobs} tone="purple" />
      </section>

      {/* Body — single column on mobile, 2/3 + 1/3 on lg+. Mobile DOM
          order is preserved (Rate, Active jobs, Activity, Status). */}
      <div className="space-y-4 lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0 lg:items-start">
        {/* LEFT COLUMN: contact + rate + active jobs */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <Field label="Phone">
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  type="tel"
                  inputMode="tel"
                  placeholder="(555) 123-4567"
                  value={phoneDraft}
                  onChange={(e) => setPhoneDraft(e.target.value)}
                />
                <Button
                  size="md"
                  onClick={savePhone}
                  disabled={phoneBusy || phoneDraft.trim() === (worker.workerProfile?.phone ?? "")}
                >
                  {phoneBusy ? <Spinner /> : "Save"}
                </Button>
              </div>
            </Field>
            {worker.workerProfile?.phone && (
              <div className="mt-2 flex gap-3 text-sm">
                <a
                  href={`tel:${worker.workerProfile.phone}`}
                  className="text-brand-700 underline-offset-2 hover:underline"
                >
                  📞 Call
                </a>
                <a
                  href={`sms:${worker.workerProfile.phone}`}
                  className="text-brand-700 underline-offset-2 hover:underline"
                >
                  💬 Text
                </a>
              </div>
            )}
          </Card>

          <Card>
            <Field label="Hourly rate ($)">
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  type="number"
                  step="0.5"
                  value={rateDraft}
                  onChange={(e) => setRateDraft(e.target.value)}
                />
                <Button
                  size="md"
                  onClick={saveRate}
                  disabled={rateBusy || rateDraft === String(worker.workerProfile?.hourlyRate ?? "")}
                >
                  {rateBusy ? <Spinner /> : "Save"}
                </Button>
              </div>
            </Field>
            <p className="mt-1 text-xs text-slate-400">
              Snapshot rate is used when the worker is assigned to a new hourly job.
            </p>
          </Card>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-600">Active jobs</h2>
            {activeJobs.length === 0 ? (
              <EmptyState title="No active jobs" description="Jobs assigned to this worker will show up here." />
            ) : (
              <div className="space-y-2">
                {activeJobs.map((j) => (
                  <JobCard key={j.id} job={j} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN: activity + status rail */}
        <div className="space-y-4 lg:col-span-1">
          {activity.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-slate-600">Recent activity</h2>
              <Card className="divide-y divide-slate-100 p-0">
                {activity.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <span className="font-medium text-slate-700">{actionLabel(a.action)}</span>
                      {a.job && (
                        <>
                          {" "}
                          <Link to={`/jobs/${a.job.id}`} className="text-brand-700">
                            {a.job.title}
                          </Link>
                        </>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">{relativeTime(a.createdAt)}</span>
                  </div>
                ))}
              </Card>
            </section>
          )}

          <section className="space-y-2 border-t border-slate-200 pt-4 lg:border-0 lg:pt-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status
            </div>
            <Button variant="secondary" block onClick={toggleActive}>
              {active ? "Pause worker" : "Reactivate worker"}
            </Button>
            <p className="text-xs text-slate-400">
              {active
                ? "Paused workers can still log in but won't appear in the worker picker on new jobs."
                : "Reactivate to include this worker in the picker when creating new jobs."}
            </p>
            <Button variant="ghost" block onClick={remove}>
              <span className="text-rose-600">Delete worker</span>
            </Button>
          </section>
        </div>
      </div>
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

function actionLabel(action: string): string {
  switch (action) {
    case "CREATED":
      return "Job created";
    case "ASSIGNED":
      return "Assigned to";
    case "STARTED":
      return "Started";
    case "STOPPED":
      return "Stopped timer on";
    case "PHOTO_UPLOADED":
      return "Uploaded photo to";
    case "SUBMITTED":
      return "Submitted";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "PAID":
      return "Paid";
    case "UNPAID":
      return "Unmarked paid";
    default:
      return action;
  }
}
