import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { readSession } from "./lib/auth.js";
import { errorHandler } from "./lib/http.js";
import { authRouter } from "./routes/auth.js";
import { contributorsRouter } from "./routes/contributors.js";
import { issuesRouter } from "./routes/issues.js";
import { payoutsRouter } from "./routes/payouts.js";
import { projectsRouter } from "./routes/projects.js";
import { walletRouter } from "./routes/wallet.js";
import { wavesRouter } from "./routes/waves.js";
import { webhooksRouter } from "./routes/webhooks.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: config.FRONTEND_URL.split(","), credentials: true }));

  // Webhooks need the raw body for HMAC verification, so mount before the JSON parser.
  app.use("/api/webhooks", webhooksRouter);

  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use(readSession);

  app.get("/health", (_req, res) => res.json({ ok: true, service: "zura-backend", chainId: config.ARC_CHAIN_ID }));

  app.use("/api/auth", authRouter);
  app.use("/api/projects", projectsRouter);
  app.use("/api/waves", wavesRouter);
  app.use("/api/issues", issuesRouter);
  app.use("/api/contributors", contributorsRouter);
  app.use("/api/payouts", payoutsRouter);
  app.use("/api/wallet", walletRouter);

  app.use((_req, res) => res.status(404).json({ error: "not found" }));
  app.use(errorHandler);
  return app;
}
