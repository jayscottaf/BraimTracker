import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Button, Spinner } from "./ui";
import type { PhotoType } from "../types";
import { getToken } from "../lib/api";

interface Props {
  jobId: string;
  type: PhotoType;
  label: string;
  disabled?: boolean;
  onUploaded: () => void;
}

async function downscale(file: File, maxSide = 1600): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/heic") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const scale = Math.min(1, maxSide / Math.max(width, height));
    if (scale === 1) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.88),
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export default function PhotoUploader({ jobId, type, label, disabled, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const resized = await downscale(file);
      await upload(`jobs/${jobId}/${type}/${Date.now()}-${resized.name}`, resized, {
        access: "public",
        handleUploadUrl: "/api/photos/upload",
        clientPayload: JSON.stringify({ jobId, type, token: getToken() ?? "" }),
      });
      onUploaded();
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : "Upload failed";
      // The @vercel/blob/client library returns this generic message
      // whenever /api/photos/upload doesn't respond with a valid token,
      // which almost always means BLOB_READ_WRITE_TOKEN is missing from
      // the Vercel project's environment variables.
      const msg = /failed to retrieve the client token/i.test(raw)
        ? "Photo upload isn't configured. The owner needs to connect Vercel Blob storage to the project (adds BLOB_READ_WRITE_TOKEN)."
        : raw;
      setError(msg);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <Button
        type="button"
        variant="secondary"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || busy}
        block
      >
        {busy ? <Spinner /> : <>📷 {label}</>}
      </Button>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
