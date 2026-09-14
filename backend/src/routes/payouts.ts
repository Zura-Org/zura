import { Router } from "express";
import { one } from "../db.js";
import { requireAuth } from "../lib/auth.js";
import { asyncHandler, HttpError } from "../lib/http.js";
import { triggerPayout } from "../services/payouts.js";

export const payoutsRouter = Router();

payoutsRouter.post(
  "/trigger/:waveId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const wave = await one(
      "select w.id, p.owner_id from waves w join projects p on p.id = w.project_id where w.id = $1",
      [req.params.waveId],
    );
    if (!wave) throw new HttpError(404, "wave not found");
    if (wave.owner_id !== req.user!.id) throw new HttpError(403, "only the project owner can trigger payouts");
    res.json(await triggerPayout(wave.id));
  }),
);
