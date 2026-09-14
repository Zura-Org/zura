import express, { Router } from "express";
import { handleGithubEvent } from "../services/bot.js";
import { verifyWebhookSignature } from "../services/github.js";

export const webhooksRouter = Router();

webhooksRouter.post("/github", express.raw({ type: "application/json", limit: "5mb" }), (req, res) => {
  const raw = req.body as Buffer;
  if (!Buffer.isBuffer(raw) || !verifyWebhookSignature(raw, req.header("x-hub-signature-256"))) {
    return res.status(401).json({ error: "invalid signature" });
  }

  const event = req.header("x-github-event") ?? "";
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "invalid JSON" });
  }

  // Acknowledge immediately; GitHub times out deliveries after 10s.
  res.status(202).json({ received: true });
  handleGithubEvent(event, payload).catch((err) => {
    console.error(`webhook ${event} (${req.header("x-github-delivery")}) failed`, err);
  });
});
