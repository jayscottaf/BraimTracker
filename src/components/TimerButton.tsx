import { useEffect, useState } from "react";
import { Button } from "./ui";
import { elapsedSince } from "../lib/format";
import { post } from "../lib/api";

interface Props {
  jobId: string;
  openSince: string | null;
  onChanged: () => void;
  disabled?: boolean;
}

export default function TimerButton({ jobId, openSince, onChanged, disabled }: Props) {
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!openSince) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [openSince]);

  async function toggle() {
    setBusy(true);
    try {
      if (openSince) {
        await post(`/api/jobs/${jobId}/stop`);
      } else {
        await post(`/api/jobs/${jobId}/start`);
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        size="lg"
        variant={openSince ? "danger" : "primary"}
        onClick={toggle}
        disabled={busy || disabled}
        block
      >
        {openSince ? `⏹ Stop · ${elapsedSince(openSince, now)}` : "▶ Start timer"}
      </Button>
    </div>
  );
}
