export function currency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);
}

export function hours(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "0h";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "0h";
  const rounded = Math.round(n * 10) / 10;
  return rounded === Math.round(rounded) ? `${rounded}h` : `${rounded.toFixed(1)}h`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function elapsedSince(startIso: string, now: number = Date.now()): string {
  const ms = now - new Date(startIso).getTime();
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function priceLine(job: {
  priceMode: string;
  hourlyRate: string | number;
  flatRate: string | number | null;
  actualHours: string | number | null;
  totalOwed: string | number | null;
}): string {
  if (job.priceMode === "FLAT") {
    return `${currency(job.flatRate ?? 0)} flat`;
  }
  const rate = currency(job.hourlyRate);
  if (job.actualHours) {
    return `${rate}/hr · ${hours(job.actualHours)} = ${currency(job.totalOwed)}`;
  }
  return `${rate}/hr`;
}
