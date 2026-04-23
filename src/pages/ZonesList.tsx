import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get, post } from "../lib/api";
import { Button, Card, EmptyState, Field, inputClass, PriorityBadge } from "../components/ui";
import type { Priority, Zone } from "../types";

export default function ZonesList() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [priority, setPriority] = useState<Priority>("NORMAL");

  const refresh = () => get<{ zones: Zone[] }>("/api/zones").then((d) => setZones(d.zones));

  useEffect(() => {
    void refresh();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await post("/api/zones", { name: name.trim(), priority });
    setName("");
    setPriority("NORMAL");
    setAdding(false);
    await refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Zones</h1>
        <Button onClick={() => setAdding((v) => !v)}>{adding ? "Cancel" : "+ Zone"}</Button>
      </div>

      {adding && (
        <Card>
          <form onSubmit={add} className="space-y-3">
            <Field label="Name" required>
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Back patio"
                autoFocus
              />
            </Field>
            <Field label="Priority">
              <select
                className={inputClass}
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                <option value="HIGH">High — showcase</option>
                <option value="NORMAL">Normal</option>
                <option value="LOW">Low — minimal effort</option>
              </select>
            </Field>
            <Button type="submit" block>
              Create
            </Button>
          </form>
        </Card>
      )}

      {zones.length === 0 ? (
        <EmptyState title="No zones yet" description="Create zones like Pool Area, Front Beds, or House Perimeter." />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {zones.map((z) => (
            <Link
              key={z.id}
              to={`/zones/${z.id}`}
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow"
            >
              <div>
                <div className="font-semibold">{z.name}</div>
                {z.description && (
                  <div className="mt-0.5 text-xs text-slate-500 line-clamp-1">{z.description}</div>
                )}
                <div className="mt-1 text-xs text-slate-500">
                  {z._count?.jobs ?? 0} job{(z._count?.jobs ?? 0) === 1 ? "" : "s"}
                </div>
              </div>
              <PriorityBadge priority={z.priority} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
