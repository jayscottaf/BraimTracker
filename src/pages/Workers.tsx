import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get, post } from "../lib/api";
import { Button, Card, EmptyState, Field, inputClass } from "../components/ui";
import { currency } from "../lib/format";
import type { Worker } from "../types";

export default function Workers() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [hourlyRate, setHourlyRate] = useState("20");
  const [error, setError] = useState<string | null>(null);

  const refresh = () => get<{ workers: Worker[] }>("/api/workers").then((d) => setWorkers(d.workers));

  useEffect(() => {
    void refresh();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await post("/api/workers", {
        name: name.trim(),
        loginCode: loginCode.trim(),
        hourlyRate: Number(hourlyRate) || 20,
      });
      setName("");
      setLoginCode("");
      setHourlyRate("20");
      setAdding(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add worker");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Workers</h1>
        <Button onClick={() => setAdding((v) => !v)}>{adding ? "Cancel" : "+ Worker"}</Button>
      </div>

      {adding && (
        <Card>
          <form onSubmit={add} className="space-y-3">
            <Field label="Name" required>
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="4-digit code" required>
                <input
                  className={inputClass}
                  value={loginCode}
                  onChange={(e) => setLoginCode(e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  maxLength={6}
                  required
                />
              </Field>
              <Field label="Hourly rate ($)">
                <input
                  className={inputClass}
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  type="number"
                  step="0.5"
                />
              </Field>
            </div>
            {error && <div className="text-sm text-rose-700">{error}</div>}
            <Button type="submit" block>
              Create
            </Button>
          </form>
        </Card>
      )}

      {workers.length === 0 ? (
        <EmptyState title="No workers yet" description="Add a worker with a 4-digit login code so they can log in and receive jobs." />
      ) : (
        <div className="space-y-2">
          {workers.map((w) => {
            const jobCount = w._count?.assignedJobs ?? 0;
            return (
              <Link
                key={w.id}
                to={`/workers/${w.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{w.name}</span>
                    {w.workerProfile?.active === false && (
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-700">
                        Paused
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    Code <span className="font-mono">{w.loginCode}</span> ·{" "}
                    {currency(w.workerProfile?.hourlyRate)}/hr · {jobCount} job
                    {jobCount === 1 ? "" : "s"}
                  </div>
                </div>
                <span className="text-xl text-slate-300">›</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
