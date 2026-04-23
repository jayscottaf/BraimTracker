import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { del, get, patch, post } from "../lib/api";
import {
  Button,
  Card,
  Field,
  inputClass,
  StatusBadge,
  PriorityBadge,
  Spinner,
} from "../components/ui";
import PhotoUploader from "../components/PhotoUploader";
import PhotoGrid from "../components/PhotoGrid";
import TimerButton from "../components/TimerButton";
import { currency, formatDuration, hours, priceLine, relativeTime } from "../lib/format";
import { useAuth } from "../context/AuthContext";
import type { Job, Worker } from "../types";

export default function JobDetail() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await get<{ job: Job }>(`/api/jobs/${id}`);
      setJob(d.job);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [id]);

  useEffect(() => {
    void load();
    if (user?.role === "OWNER") {
      void get<{ workers: Worker[] }>("/api/workers").then((d) => setWorkers(d.workers));
    }
  }, [load, user?.role]);

  if (error) {
    return <div className="p-4 text-rose-700">{error}</div>;
  }
  if (!job) return <div className="py-8 text-center text-slate-400">Loading…</div>;

  const isOwner = user?.role === "OWNER";
  const isAssignedWorker = user?.id === job.assignedWorkerId;
  const openTimer = job.timeEntries?.find((t) => !t.endAt);

  const hasAfter = !!job.photos?.some((p) => p.type === "AFTER");
  const canStart =
    isAssignedWorker &&
    ["ASSIGNED", "IN_PROGRESS"].includes(job.status) &&
    !openTimer;
  const canStop = !!openTimer && (isAssignedWorker || isOwner);
  const canSubmit =
    isAssignedWorker && hasAfter && ["IN_PROGRESS", "ASSIGNED"].includes(job.status);

  async function assign(workerId: string) {
    const { job: updated } = await post<{ job: Job }>(`/api/jobs/${id}/assign`, {
      workerId: workerId || null,
    });
    setJob((prev) => (prev ? { ...prev, ...updated } : updated));
  }

  async function submitJob() {
    await post(`/api/jobs/${id}/submit`);
    await load();
  }

  async function approve(actualHoursOverride?: number, totalOwedOverride?: number) {
    await post(`/api/jobs/${id}/approve`, {
      actualHours: actualHoursOverride,
      totalOwed: totalOwedOverride,
    });
    await load();
  }

  async function reject() {
    const reason = prompt("What needs to change?");
    if (!reason) return;
    await post(`/api/jobs/${id}/reject`, { reason });
    await load();
  }

  async function markPaid() {
    const method = prompt("Payment method? (cash, venmo, check…)") ?? undefined;
    const paymentId = job?.payment?.id;
    if (!paymentId) return;
    await post(`/api/payments/${paymentId}/mark-paid`, { method });
    await load();
  }

  async function toggleTask(taskId: string, done: boolean) {
    await patch(`/api/jobs/${id}/tasks`, { taskId, done });
    await load();
  }

  async function deleteJob() {
    if (!confirm("Delete this job permanently?")) return;
    await del(`/api/jobs/${id}`);
    nav("/jobs", { replace: true });
  }

  async function addManualTime() {
    const raw = prompt("Minutes to add?");
    if (!raw) return;
    const minutes = Number(raw);
    if (!minutes || minutes < 1) return;
    await post(`/api/time/manual`, { jobId: id, minutes });
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">{job.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <Link to={`/jobs?status=${job.status}`}>
              <StatusBadge status={job.status} />
            </Link>
            <PriorityBadge priority={job.priority} />
            <span>· {job.zone?.name}</span>
            {job.assignedWorker && <span>· {job.assignedWorker.name}</span>}
          </div>
        </div>
      </div>

      {job.ownerNotes && job.status === "ASSIGNED" && (
        <Card className="border-amber-300 bg-amber-50">
          <div className="text-xs font-semibold text-amber-700">Changes requested</div>
          <div className="mt-1 text-sm text-amber-900">{job.ownerNotes}</div>
        </Card>
      )}

      <Card>
        <div className="text-sm font-semibold text-slate-700">Pay</div>
        <div className="mt-1 text-sm">{priceLine(job)}</div>
        {job.estimatedHours && (
          <div className="text-xs text-slate-500">Estimated {hours(job.estimatedHours)}</div>
        )}
      </Card>

      {job.instructions && (
        <Card>
          <div className="text-sm font-semibold text-slate-700">Instructions</div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{job.instructions}</p>
        </Card>
      )}

      <Section
        title="Instruction photos"
        action={
          isOwner && (
            <PhotoUploader jobId={id} type="INSTRUCTION" label="Add" onUploaded={load} />
          )
        }
      >
        <PhotoGrid
          photos={job.photos ?? []}
          type="INSTRUCTION"
          canDelete={isOwner}
          onDeleted={load}
        />
      </Section>

      {job.tasks && job.tasks.length > 0 && (
        <Card>
          <div className="mb-2 text-sm font-semibold text-slate-700">Checklist</div>
          <ul className="space-y-2">
            {job.tasks.map((t) => (
              <li key={t.id}>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={(e) => toggleTask(t.id, e.target.checked)}
                    className="h-5 w-5 rounded"
                    disabled={!isOwner && !isAssignedWorker}
                  />
                  <span className={t.done ? "text-slate-400 line-through" : "text-sm"}>
                    {t.label}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {isOwner && (
        <Card>
          <div className="mb-2 text-sm font-semibold text-slate-700">Assign worker</div>
          <select
            className={inputClass}
            value={job.assignedWorkerId ?? ""}
            onChange={(e) => void assign(e.target.value)}
          >
            <option value="">— unassigned —</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </Card>
      )}

      <Section
        title="Before"
        action={
          isAssignedWorker && (
            <PhotoUploader jobId={id} type="BEFORE" label="Before" onUploaded={load} />
          )
        }
      >
        <PhotoGrid photos={job.photos ?? []} type="BEFORE" canDelete={isOwner} onDeleted={load} />
      </Section>

      <Section
        title="After"
        action={
          isAssignedWorker && (
            <PhotoUploader jobId={id} type="AFTER" label="After" onUploaded={load} />
          )
        }
      >
        <PhotoGrid photos={job.photos ?? []} type="AFTER" canDelete={isOwner} onDeleted={load} />
      </Section>

      {(isAssignedWorker || isOwner) && (
        <Card>
          <div className="mb-3 text-sm font-semibold text-slate-700">Time</div>
          <div className="mb-3 text-xs text-slate-500">
            Logged: {hours(job.actualHours ?? 0)}
          </div>
          {isAssignedWorker && (canStart || canStop) && (
            <TimerButton jobId={id} openSince={openTimer?.startAt ?? null} onChanged={load} />
          )}
          <div className="mt-3">
            <Button size="sm" variant="ghost" onClick={addManualTime}>
              + Add time manually
            </Button>
          </div>
          {job.timeEntries && job.timeEntries.length > 0 && (
            <ul className="mt-3 divide-y divide-slate-100 text-xs text-slate-600">
              {job.timeEntries.map((t) => (
                <li key={t.id} className="flex justify-between py-1.5">
                  <span>{new Date(t.startAt).toLocaleString()}</span>
                  <span>
                    {t.endAt
                      ? formatDuration(t.durationMinutes ?? 0)
                      : "running…"}
                    {t.manualEntry && " (manual)"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {isAssignedWorker && canSubmit && (
        <Button size="lg" block onClick={submitJob}>
          ✓ Submit for review
        </Button>
      )}
      {isAssignedWorker && !hasAfter && job.status === "IN_PROGRESS" && (
        <div className="text-center text-xs text-slate-500">
          Upload an AFTER photo to submit.
        </div>
      )}

      {isOwner && job.status === "AWAITING_REVIEW" && (
        <ApproveBar job={job} onApprove={approve} onReject={reject} />
      )}

      {isOwner && job.status === "APPROVED" && job.payment && !job.payment.paid && (
        <Button size="lg" block onClick={markPaid}>
          💵 Mark paid · {currency(job.payment.amount)}
        </Button>
      )}

      {job.activity && job.activity.length > 0 && (
        <Card>
          <div className="mb-2 text-sm font-semibold text-slate-700">Activity</div>
          <ul className="space-y-1.5 text-xs text-slate-600">
            {job.activity.map((a) => (
              <li key={a.id} className="flex justify-between gap-2">
                <span>
                  <span className="font-medium text-slate-800">{a.actor?.name ?? "—"}</span>{" "}
                  {a.action.toLowerCase().replace(/_/g, " ")}
                </span>
                <span className="text-slate-400">{relativeTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {isOwner && (
        <div className="pt-4 text-right">
          <Button size="sm" variant="ghost" onClick={deleteJob}>
            Delete job
          </Button>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        {action && <div className="w-40 shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}

function ApproveBar({
  job,
  onApprove,
  onReject,
}: {
  job: Job;
  onApprove: (actualHours?: number, totalOwed?: number) => Promise<void>;
  onReject: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [actualHours, setActualHours] = useState(
    job.actualHours ? String(job.actualHours) : "",
  );
  const [totalOverride, setTotalOverride] = useState(
    job.totalOwed ? String(job.totalOwed) : "",
  );

  async function approve() {
    setBusy(true);
    try {
      await onApprove(
        actualHours ? Number(actualHours) : undefined,
        totalOverride ? Number(totalOverride) : undefined,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-brand-200 bg-brand-50/40">
      <div className="mb-3 text-sm font-semibold text-slate-700">Review & approve</div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Hours">
          <input
            className={inputClass}
            type="number"
            step="0.25"
            value={actualHours}
            onChange={(e) => setActualHours(e.target.value)}
          />
        </Field>
        <Field label="Total owed ($)">
          <input
            className={inputClass}
            type="number"
            step="1"
            value={totalOverride}
            onChange={(e) => setTotalOverride(e.target.value)}
          />
        </Field>
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" onClick={onReject} block>
          Request changes
        </Button>
        <Button onClick={approve} block disabled={busy}>
          {busy ? <Spinner /> : "Approve"}
        </Button>
      </div>
    </Card>
  );
}
