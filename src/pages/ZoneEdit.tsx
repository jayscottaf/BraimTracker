import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { del, get, patch } from "../lib/api";
import { Button, Card, Field, inputClass, StatusBadge } from "../components/ui";
import type { Priority, Zone } from "../types";

export default function ZoneEdit() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const [zone, setZone] = useState<Zone | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = () => get<{ zone: Zone }>(`/api/zones/${id}`).then((d) => setZone(d.zone));

  useEffect(() => {
    void refresh();
  }, [id]);

  if (!zone) return <div className="py-8 text-center text-slate-400">Loading…</div>;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!zone) return;
    setSaving(true);
    try {
      await patch(`/api/zones/${id}`, {
        name: zone.name,
        description: zone.description,
        priority: zone.priority,
        notes: zone.notes,
      });
      nav("/zones");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this zone?")) return;
    try {
      await del(`/api/zones/${id}`);
      nav("/zones", { replace: true });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Edit zone</h1>
      <Card>
        <form onSubmit={save} className="space-y-3">
          <Field label="Name" required>
            <input
              className={inputClass}
              value={zone.name}
              onChange={(e) => setZone({ ...zone, name: e.target.value })}
            />
          </Field>
          <Field label="Priority">
            <select
              className={inputClass}
              value={zone.priority}
              onChange={(e) => setZone({ ...zone, priority: e.target.value as Priority })}
            >
              <option value="HIGH">High — showcase</option>
              <option value="NORMAL">Normal</option>
              <option value="LOW">Low — minimal effort</option>
            </select>
          </Field>
          <Field label="Description">
            <textarea
              className={inputClass}
              rows={3}
              value={zone.description ?? ""}
              onChange={(e) => setZone({ ...zone, description: e.target.value })}
            />
          </Field>
          <Field label="Notes">
            <textarea
              className={inputClass}
              rows={3}
              value={zone.notes ?? ""}
              onChange={(e) => setZone({ ...zone, notes: e.target.value })}
            />
          </Field>
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving} block>
              Save
            </Button>
            <Button type="button" variant="danger" onClick={remove}>
              Delete
            </Button>
          </div>
        </form>
      </Card>

      {zone.jobs && zone.jobs.length > 0 && (
        <Card>
          <div className="mb-2 text-sm font-semibold text-slate-700">Jobs in this zone</div>
          <ul className="divide-y divide-slate-100 text-sm">
            {zone.jobs.map((j) => (
              <li key={j.id}>
                <Link to={`/jobs/${j.id}`} className="flex items-center justify-between py-2">
                  <span>{j.title}</span>
                  <StatusBadge status={j.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
