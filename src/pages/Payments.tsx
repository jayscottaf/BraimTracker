import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get, post } from "../lib/api";
import { Button, Card, EmptyState } from "../components/ui";
import { currency, relativeTime } from "../lib/format";
import type { Payment } from "../types";

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [unpaidTotal, setUnpaidTotal] = useState(0);

  const refresh = () =>
    get<{ payments: Payment[]; unpaidTotal: number }>("/api/payments").then((d) => {
      setPayments(d.payments);
      setUnpaidTotal(d.unpaidTotal);
    });

  useEffect(() => {
    void refresh();
  }, []);

  async function mark(p: Payment) {
    if (p.paid) return;
    const method = prompt("Payment method? (cash, venmo, check…)") ?? undefined;
    await post(`/api/payments/${p.id}/mark-paid`, { method });
    await refresh();
  }

  const unpaid = payments.filter((p) => !p.paid);
  const paid = payments.filter((p) => p.paid);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold">Payments</h1>
        <p className="text-sm text-slate-500">
          Outstanding: <span className="font-semibold text-slate-800">{currency(unpaidTotal)}</span>
        </p>
      </div>

      {unpaid.length === 0 && paid.length === 0 ? (
        <EmptyState title="No payments yet" description="Approved jobs will show up here." />
      ) : (
        <>
          {unpaid.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-slate-600">Owed</h2>
              <div className="space-y-2">
                {unpaid.map((p) => (
                  <PaymentRow key={p.id} p={p} onMark={() => mark(p)} />
                ))}
              </div>
            </section>
          )}
          {paid.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-slate-600">Paid</h2>
              <div className="space-y-2">
                {paid.map((p) => (
                  <PaymentRow key={p.id} p={p} onMark={() => mark(p)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function PaymentRow({ p, onMark }: { p: Payment; onMark: () => void }) {
  return (
    <Card className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="truncate font-semibold">
          <Link to={`/jobs/${p.jobId}`}>{p.job?.title}</Link>
        </div>
        <div className="text-xs text-slate-500">
          {p.job?.zone.name}
          {p.job?.assignedWorker && ` · ${p.job.assignedWorker.name}`}
          {p.paid && p.paidAt && ` · paid ${relativeTime(p.paidAt)}${p.method ? ` via ${p.method}` : ""}`}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right text-sm font-semibold">{currency(p.amount)}</div>
        {!p.paid && (
          <Button size="sm" onClick={onMark}>
            Mark paid
          </Button>
        )}
      </div>
    </Card>
  );
}
