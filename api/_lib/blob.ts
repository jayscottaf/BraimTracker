import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { del } from "@vercel/blob";

export { handleUpload, del };
export type { HandleUploadBody };
