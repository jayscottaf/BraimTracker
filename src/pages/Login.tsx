import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button, Card, Field, inputClass, Spinner } from "../components/ui";

type Mode = "WORKER" | "OWNER";

export default function Login() {
  const [mode, setMode] = useState<Mode>("WORKER");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { loginOwner, loginWorker } = useAuth();
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "OWNER") await loginOwner(password);
      else await loginWorker(code);
      nav("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-b from-brand-50 to-slate-100 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg">
            <span className="text-xl font-bold">BT</span>
          </div>
          <h1 className="text-2xl font-bold">BraimTracker</h1>
          <p className="text-sm text-slate-500">Sign in to manage yard work</p>
        </div>

        <Card>
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setMode("WORKER")}
              className={`rounded-lg py-2 text-sm font-medium ${
                mode === "WORKER" ? "bg-white shadow-sm" : "text-slate-500"
              }`}
            >
              I'm a worker
            </button>
            <button
              onClick={() => setMode("OWNER")}
              className={`rounded-lg py-2 text-sm font-medium ${
                mode === "OWNER" ? "bg-white shadow-sm" : "text-slate-500"
              }`}
            >
              I'm the owner
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "WORKER" ? (
              <Field label="Login code" hint="4-digit code from the owner">
                <input
                  className={`${inputClass} text-center text-xl tracking-[0.5em]`}
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={6}
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••"
                />
              </Field>
            ) : (
              <Field label="Owner password">
                <input
                  className={inputClass}
                  type="password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                />
              </Field>
            )}

            {error && <div className="rounded-md bg-rose-50 p-2 text-sm text-rose-700">{error}</div>}

            <Button type="submit" block size="lg" disabled={busy}>
              {busy ? <Spinner /> : "Sign in"}
            </Button>
          </form>
        </Card>

        <p className="mt-4 text-center text-xs text-slate-400">
          Tip: add this page to your home screen for app-style use.
        </p>
      </div>
    </div>
  );
}
