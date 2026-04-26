import { useEffect, useState } from "react";

const POLL_MS = 5 * 60 * 1000;
const DISMISS_KEY = "bt:update-dismissed";

async function fetchRemoteVersion(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: unknown };
    return typeof data.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

export function useVersionCheck() {
  const [newVersion, setNewVersion] = useState<string | null>(null);

  useEffect(() => {
    if (__APP_VERSION__ === "dev") return;

    let cancelled = false;

    const check = async () => {
      const remote = await fetchRemoteVersion();
      if (cancelled || !remote || remote === __APP_VERSION__) return;
      if (localStorage.getItem(DISMISS_KEY) === remote) return;
      setNewVersion(remote);
    };

    void check();
    const id = window.setInterval(check, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  function dismiss() {
    if (newVersion) localStorage.setItem(DISMISS_KEY, newVersion);
    setNewVersion(null);
  }

  return { newVersion, dismiss };
}
