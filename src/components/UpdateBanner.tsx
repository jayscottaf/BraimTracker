import { Button } from "./ui";
import { useVersionCheck } from "../lib/useVersionCheck";

export default function UpdateBanner() {
  const { newVersion, dismiss } = useVersionCheck();

  if (!newVersion) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-40 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg md:inset-auto md:bottom-4 md:right-4 md:w-80">
      <div className="text-sm font-semibold text-slate-800">A new version is available</div>
      <p className="mt-1 text-xs text-slate-500">
        Refresh to get the latest fixes and improvements.
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={dismiss}>
          Later
        </Button>
        <Button size="sm" onClick={() => window.location.reload()}>
          Update
        </Button>
      </div>
    </div>
  );
}
