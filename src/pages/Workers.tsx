import { useEffect, useState } from "react";
import { del, get, patch, post } from "../lib/api";
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

  async function toggleActive(w: Worker) {
    await patch(`/api/workers/${w.id}`, { active: !(w.workerProfile?.active ?? true) });
    await refresh();
  }

  async function updateRate(w: Worker) {
    const raw = prompt(`New hourly rate for ${w.name}?`, String(w.workerProfile?.hourlyRate ?? 20));
    if (!raw) return;
    const rate = Number(raw);
    if (Number.isNaN(rate)) return;
    await patch(`/api/workers/${w.id}`, { hourlyRate: rate });
    await refresh();
  }

  async function remove(w: Worker) {
    if (!confirm(`Delete ${w.name}?`)) return;
    try {
      await del(`/api/workers/${w.id}`);
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
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
          {workers.map((w) => (
            <Card key={w.id} className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">{w.name}</div>
                <div className="text-xs text-slate-500">
                  Code <span className="font-mono">{w.loginCode}</span> ·{" "}
                  {currency(w.workerProfile?.hourlyRate)}/hr ·{" "}
                  {w._count?.assignedJobs ?? 0} job{(w._count?.assignedJobs ?? 0) === 1 ? "" : "s"}
                  {w.workerProfile?.active === false && (
                    <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-slate-600">inactive</span>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="secondary" onClick={() => updateRate(w)}>
                  Rate
                </Button>
                <Button size="sm" variant="secondary" onClick={() => toggleActive(w)}>
                  {w.workerProfile?.active === false ? "Activate" : "Pause"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(w)}>
                  ✕
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
