import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get, post } from "../lib/api";
import { Button, Card, Field, inputClass, Spinner } from "../components/ui";
import type { Zone, Worker, TaskType, Priority, PriceMode } from "../types";

const TASK_TYPES: TaskType[] = ["MULCH", "EDGING", "CLEANUP", "TRIMMING", "PRUNING", "OTHER"];
const PRIORITIES: Priority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

export default function JobNew() {
  const nav = useNavigate();
  const [zones, setZones] = useState<Zone[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("CLEANUP");
  const [priority, setPriority] = useState<Priority>("NORMAL");
  const [workerId, setWorkerId] = useState<string>("");
  const [instructions, setInstructions] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [priceMode, setPriceMode] = useState<PriceMode>("HOURLY");
  const [hourlyRate, setHourlyRate] = useState("");
  const [flatRate, setFlatRate] = useState("");
  const [tasks, setTasks] = useState<string>("");

  useEffect(() => {
    void get<{ zones: Zone[] }>("/api/zones").then((d) => {
      setZones(d.zones);
      if (d.zones[0]) setZoneId(d.zones[0].id);
    });
    void get<{ workers: Worker[] }>("/api/workers").then((d) => setWorkers(d.workers));
  }, []);

  // autofill hourly rate from selected worker
  useEffect(() => {
    if (!workerId || priceMode !== "HOURLY") return;
    const w = workers.find((x) => x.id === workerId);
    if (w?.workerProfile?.hourlyRate) {
      setHourlyRate(String(w.workerProfile.hourlyRate));
    }
  }, [workerId, priceMode, workers]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const taskLabels = tasks
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const body: Record<string, unknown> = {
        title,
        zoneId,
        taskType,
        priority,
        instructions: instructions || undefined,
        estimatedHours: estimatedHours ? Number(estimatedHours) : undefined,
        assignedWorkerId: workerId || undefined,
        priceMode,
        tasks: taskLabels.length ? taskLabels : undefined,
      };
      if (priceMode === "HOURLY" && hourlyRate) body.hourlyRate = Number(hourlyRate);
      if (priceMode === "FLAT") body.flatRate = Number(flatRate);

      const { job } = await post<{ job: { id: string } }>("/api/jobs", body);
      nav(`/jobs/${job.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create job");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-lg font-bold">New job</h1>

      <Card>
        <div className="space-y-4">
          <Field label="Title" required>
            <input
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Edge and clean pool bed"
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Zone" required>
              <select
                className={inputClass}
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                required
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Type">
              <select
                className={inputClass}
                value={taskType}
                onChange={(e) => setTaskType(e.target.value as TaskType)}
              >
                {TASK_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Assign worker">
            <select
              className={inputClass}
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
            >
              <option value="">— unassigned (save as draft) —</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Priority">
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`flex-1 rounded-lg border px-3 py-1.5 text-sm ${
                    priority === p
                      ? "border-brand-600 bg-brand-50 text-brand-700"
                      : "border-slate-300 text-slate-600"
                  }`}
                >
                  {p.toLowerCase()}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Instructions">
            <textarea
              className={inputClass}
              rows={4}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="What, where, and anything to leave alone."
            />
          </Field>

          <Field label="Task checklist" hint="One per line. Worker can check these off as they go.">
            <textarea
              className={inputClass}
              rows={4}
              value={tasks}
              onChange={(e) => setTasks(e.target.value)}
              placeholder={"Edge full perimeter\nPull weeds\nHaul clippings"}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <div className="mb-3 text-sm font-semibold text-slate-700">Pay</div>
        <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setPriceMode("HOURLY")}
            className={`rounded-lg py-2 text-sm font-medium ${
              priceMode === "HOURLY" ? "bg-white shadow-sm" : "text-slate-500"
            }`}
          >
            Hourly
          </button>
          <button
            type="button"
            onClick={() => setPriceMode("FLAT")}
            className={`rounded-lg py-2 text-sm font-medium ${
              priceMode === "FLAT" ? "bg-white shadow-sm" : "text-slate-500"
            }`}
          >
            Flat rate
          </button>
        </div>

        {priceMode === "HOURLY" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hourly rate ($)">
              <input
                className={inputClass}
                type="number"
                step="0.5"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="20"
              />
            </Field>
            <Field label="Estimated hours">
              <input
                className={inputClass}
                type="number"
                step="0.25"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                placeholder="3"
              />
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Job price ($)" required>
              <input
                className={inputClass}
                type="number"
                step="1"
                value={flatRate}
                onChange={(e) => setFlatRate(e.target.value)}
                placeholder="200"
                required
              />
            </Field>
            <Field label="Estimated hours" hint="Informational">
              <input
                className={inputClass}
                type="number"
                step="0.25"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                placeholder="4"
              />
            </Field>
          </div>
        )}
      </Card>

      {error && <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

      <div className="flex gap-2">
        <Button type="submit" disabled={busy} size="lg" block>
          {busy ? <Spinner /> : "Create job"}
        </Button>
      </div>
    </form>
  );
}
