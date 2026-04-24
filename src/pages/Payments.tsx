import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get, post } from "../lib/api";
import { Button, Card, EmptyState } from "../components/ui";
import { currency, hours as hoursFmt, relativeTime } from "../lib/format";

type PaymentJob = {
  id: string;
  title: string;
  priceMode: "HOURLY" | "FLAT";
  hourlyRate: string | number;
  flatRate: string | number | null;
  actualHours: string | number | null;
  zone: { name: string };
  assignedWorker: { id: string; name: string } | null;
};

type PaymentRow = {
  id: string;
  jobId: string;
  amount: string | number;
  paid: boolean;
  paidAt: string | null;
  method: string | null;
  createdAt: string;
  job?: PaymentJob;
};

type InProgressJob = {
  id: string;
  title: string;
  status: "IN_PROGRESS" | "AWAITING_REVIEW";
  priceMode: "HOURLY" | "FLAT";
  hourlyRate: string | number;
  flatRate: string | number | null;
  actualHours: string | number | null;
  estimatedHours: string | number | null;
  zone: { name: string };
  assignedWorker: { id: string; name: string } | null;
  openTimerStartedAt: string | null;
  accrued: number;
};

type Resp = {
  payments: PaymentRow[];
  inProgress: InProgressJob[];
  rollup: {
    weekPaid: number;
    unpaidTotal: number;
    inProgressTotal: number;
  };
};

export default function Payments() {
  const [data, setData] = useState<Resp | null>(null);

  const refresh = () => get<Resp>("/api/payments").then(setData);

  useEffect(() => {
    void refresh();
  }, []);

  async function mark(p: PaymentRow) {
    if (p.paid) return;
    const method = prompt("Payment method? (cash, venmo, check…)") ?? undefined;
    await post(`/api/payments/${p.id}/mark-paid`, { method });
    await refresh();
  }

  if (!data) return <div className="py-8 text-center text-slate-400">Loading…</div>;

  const unpaid = data.payments.filter((p) => !p.paid);
  const paid = data.payments.filter((p) => p.paid);
  const nothing = unpaid.length === 0 && paid.length === 0 && data.inProgress.length === 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold">Payments</h1>
        <p className="text-sm text-slate-500">
          Money moving through the property. Jobs accrue cost while in progress,
          become &quot;owed&quot; once approved, and land in paid once marked.
        </p>
      </div>

      {/* Weekly rollup */}
      <section className="grid grid-cols-3 gap-3">
        <Stat
          label="Owed now"
          value={currency(data.rollup.unpaidTotal)}
          tone="emerald"
          hint={`${unpaid.length} approved`}
        />
        <Stat
          label="Accruing"
          value={currency(data.rollup.inProgressTotal)}
          tone="amber"
          hint={`${data.inProgress.length} in progress`}
        />
        <Stat
          label="Paid · 7d"
          value={currency(data.rollup.weekPaid)}
          tone="slate"
        />
      </section>

      {nothing ? (
        <EmptyState
          title="No payments yet"
          description="Once a job is approved it'll show up as owed, and paid jobs move below."
        />
      ) : (
        <>
          {/* In progress — not yet billable */}
          {data.inProgress.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-baseline justify-between">
                <span className="text-sm font-semibold text-slate-600">In progress</span>
                <span className="text-xs text-slate-400">estimates, not yet billable</span>
              </h2>
              <div className="space-y-2">
                {data.inProgress.map((j) => (
                  <InProgressRow key={j.id} job={j} />
                ))}
              </div>
            </section>
          )}

          {/* Owed now */}
          {unpaid.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-baseline justify-between">
                <span className="text-sm font-semibold text-slate-600">Owed now</span>
                <span className="text-xs font-semibold text-emerald-700">
                  {currency(data.rollup.unpaidTotal)}
                </span>
              </h2>
              <div className="space-y-2">
                {unpaid.map((p) => (
                  <PaidRow key={p.id} p={p} onMark={() => mark(p)} />
                ))}
              </div>
            </section>
          )}

          {/* Recently paid */}
          {paid.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-slate-600">Recently paid</h2>
              <div className="space-y-2">
                {paid.map((p) => (
                  <PaidRow key={p.id} p={p} onMark={() => mark(p)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone: "emerald" | "amber" | "slate";
  hint?: string;
}) {
  const bg = {
    emerald: "bg-emerald-50 text-emerald-900",
    amber: "bg-amber-50 text-amber-900",
    slate: "bg-slate-100 text-slate-900",
  }[tone];
  return (
    <div className={`rounded-2xl p-3 ${bg}`}>
      <div className="text-[10px] font-medium uppercase tracking-wide opacity-75">{label}</div>
      <div className="mt-1 text-lg font-bold leading-tight">{value}</div>
      {hint && <div className="mt-0.5 text-[10px] opacity-70">{hint}</div>}
    </div>
  );
}

function InProgressRow({ job }: { job: InProgressJob }) {
  const isAwaiting = job.status === "AWAITING_REVIEW";
  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/jobs/${job.id}`} className="truncate font-semibold text-slate-900">
            {job.title}
          </Link>
          <div className="text-xs text-slate-500">
            {job.zone.name}
            {job.assignedWorker && ` · ${job.assignedWorker.name}`}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            isAwaiting
              ? "bg-purple-100 text-purple-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {isAwaiting ? "awaiting review" : "in progress"}
        </span>
      </div>
      <div className="flex items-end justify-between gap-2 text-xs text-slate-600">
        <span>{breakdown(job)}</span>
        <span className="text-right">
          <span className="text-[10px] uppercase tracking-wide text-slate-400">
            accrued
          </span>
          <span className="ml-1 text-sm font-semibold text-slate-800">
            {currency(job.accrued)}
          </span>
        </span>
      </div>
      {isAwaiting && (
        <Link
          to={`/jobs/${job.id}`}
          className="block rounded-lg bg-purple-50 px-3 py-1.5 text-center text-xs font-semibold text-purple-700"
        >
          Review to approve →
        </Link>
      )}
    </Card>
  );
}

function PaidRow({ p, onMark }: { p: PaymentRow; onMark: () => void }) {
  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/jobs/${p.jobId}`} className="truncate font-semibold text-slate-900">
            {p.job?.title}
          </Link>
          <div className="text-xs text-slate-500">
            {p.job?.zone.name}
            {p.job?.assignedWorker && ` · ${p.job.assignedWorker.name}`}
            {p.paid && p.paidAt && (
              <>
                {" · "}paid {relativeTime(p.paidAt)}
                {p.method ? ` via ${p.method}` : ""}
              </>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold text-slate-900">{currency(p.amount)}</div>
          {p.job && (
            <div className="text-[10px] text-slate-400">{breakdown(p.job)}</div>
          )}
        </div>
      </div>
      {!p.paid && (
        <Button size="sm" block onClick={onMark}>
          Mark paid
        </Button>
      )}
    </Card>
  );
}

function breakdown(job: {
  priceMode: "HOURLY" | "FLAT";
  hourlyRate: string | number;
  flatRate: string | number | null;
  actualHours: string | number | null;
}): string {
  if (job.priceMode === "FLAT") {
    return `${currency(job.flatRate ?? 0)} flat`;
  }
  const rate = Number(job.hourlyRate);
  const hrs = job.actualHours ? Number(job.actualHours) : 0;
  if (!hrs) return `${currency(rate)}/hr`;
  return `${currency(rate)}/hr × ${hoursFmt(hrs)}`;
}
