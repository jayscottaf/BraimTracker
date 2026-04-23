import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth, sendError } from "../_lib/auth.js";
import { methodRouter } from "../_lib/http.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await methodRouter(req, res, {
      GET: async () => {
        const user = await requireAuth(req);
        return res.status(200).json({
          user: {
            id: user.id,
            name: user.name,
            role: user.role,
            email: user.email,
            hourlyRate: user.workerProfile?.hourlyRate ?? null,
          },
        });
      },
    });
  } catch (err) {
    sendError(res, err);
  }
}
