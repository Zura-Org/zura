import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export interface SessionUser {
  id: string;
  githubUsername: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export const SESSION_COOKIE = "zura_session";

export function signSession(user: SessionUser) {
  return jwt.sign(user, config.JWT_SECRET, { expiresIn: "7d" });
}

export function readSession(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : req.cookies?.[SESSION_COOKIE];
  if (token) {
    try {
      const payload = jwt.verify(token, config.JWT_SECRET) as SessionUser;
      req.user = { id: payload.id, githubUsername: payload.githubUsername };
    } catch {
      // invalid/expired token: treat as anonymous
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "authentication required" });
  next();
}
