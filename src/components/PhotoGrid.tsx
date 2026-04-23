import { useState } from "react";
import clsx from "clsx";
import type { JobPhoto, PhotoType } from "../types";
import { del } from "../lib/api";

interface Props {
  photos: JobPhoto[];
  type: PhotoType;
  canDelete?: boolean;
  onDeleted?: () => void;
}

export default function PhotoGrid({ photos, type, canDelete, onDeleted }: Props) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const filtered = photos.filter((p) => p.type === type);

  if (filtered.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-400">
        No {type.toLowerCase()} photos yet
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {filtered.map((p) => (
          <div key={p.id} className="relative aspect-square overflow-hidden rounded-xl bg-slate-100">
            <button
              className="h-full w-full"
              onClick={() => setLightbox(p.url)}
              aria-label="View photo"
            >
              <img
                src={p.url}
                alt={p.caption ?? type}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </button>
            {canDelete && (
              <button
                onClick={async () => {
                  if (!confirm("Delete this photo?")) return;
                  await del(`/api/photos/${p.id}`);
                  onDeleted?.();
                }}
                className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-xs text-white"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      {lightbox && (
        <button
          onClick={() => setLightbox(null)}
          className={clsx(
            "fixed inset-0 z-30 flex items-center justify-center bg-black/80 p-4",
          )}
        >
          <img src={lightbox} className="max-h-full max-w-full rounded-lg" />
        </button>
      )}
    </>
  );
}
