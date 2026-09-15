import crypto from "node:crypto";
import { Router } from "express";
import { config } from "../config.js";
import { one, query } from "../db.js";
import { SESSION_COOKIE, requireAuth, signSession } from "../lib/auth.js";
import { asyncHandler, HttpError } from "../lib/http.js";
import { createUserWallet, isCircleConfigured } from "../services/circle.js";
import { exchangeOAuthCode, oauthAuthorizeUrl } from "../services/github.js";

export const authRouter = Router();

const STATE_COOKIE = "zura_oauth_state";
const cookieOpts = {
  httpOnly: true,
  secure: config.NODE_ENV === "production",
  sameSite: (config.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
};

authRouter.get("/github", (req, res) => {
  if (!config.GITHUB_CLIENT_ID) throw new HttpError(503, "GitHub OAuth not configured");
  const next = typeof req.query.next === "string" && req.query.next.startsWith("/") ? req.query.next : "/explore";
  const state = `${crypto.randomBytes(16).toString("hex")}.${Buffer.from(next).toString("base64url")}`;
  res.cookie(STATE_COOKIE, state, { ...cookieOpts, maxAge: 10 * 60 * 1000 });
  res.redirect(oauthAuthorizeUrl(state));
});

authRouter.get(
  "/github/callback",
  asyncHandler(async (req, res) => {
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code || !state || state !== req.cookies?.[STATE_COOKIE]) throw new HttpError(400, "invalid OAuth state");
    res.clearCookie(STATE_COOKIE);
    const next = Buffer.from(state.split(".")[1] ?? "", "base64url").toString() || "/explore";

    const gh = await exchangeOAuthCode(code);
    const user = await one(
      `insert into users (github_id, github_username, avatar_url) values ($1, $2, $3)
       on conflict (github_id) do update set github_username = excluded.github_username, avatar_url = excluded.avatar_url
       returning *`,
      [gh.id, gh.login, gh.avatarUrl],
    );

    // Every user gets a Circle wallet on ARC as their USDC payout address - no keys to manage.
    if (!user.wallet_address && isCircleConfigured()) {
      try {
        const wallet = await createUserWallet(user.id);
        await query("update users set circle_wallet_id = $2, wallet_address = $3 where id = $1", [
          user.id,
          wallet.id,
          wallet.address,
        ]);
      } catch (err) {
        console.error("Circle wallet creation failed", err);
      }
    }

    const token = signSession({ id: user.id, githubUsername: user.github_username });
    res.cookie(SESSION_COOKIE, token, { ...cookieOpts, maxAge: 7 * 24 * 3600 * 1000 });
    res.redirect(`${config.FRONTEND_URL}/auth/callback#token=${token}&next=${encodeURIComponent(next)}`);
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await one(
      "select id, github_username, avatar_url, wallet_address, kyc_status, created_at from users where id = $1",
      [req.user!.id],
    );
    if (!user) throw new HttpError(401, "user not found");
    const unread = await one("select count(*)::int as n from notifications where user_id = $1 and not read", [user.id]);
    res.json({ user, unreadNotifications: unread?.n ?? 0 });
  }),
);

authRouter.post(
  "/wallet",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await one("select * from users where id = $1", [req.user!.id]);
    if (user.wallet_address) return res.json({ walletAddress: user.wallet_address });
    if (!isCircleConfigured()) throw new HttpError(503, "Circle wallets not configured");
    const wallet = await createUserWallet(user.id);
    await query("update users set circle_wallet_id = $2, wallet_address = $3 where id = $1", [user.id, wallet.id, wallet.address]);
    res.json({ walletAddress: wallet.address });
  }),
);

/**
 * Local development only: sign in as an existing user without GitHub OAuth.
 * Requires NODE_ENV=development AND DEV_LOGIN=true; never mounted otherwise.
 */
if (config.NODE_ENV === "development" && config.DEV_LOGIN) {
  authRouter.get(
    "/dev-login",
    asyncHandler(async (req, res) => {
      const username = String(req.query.username ?? "demo-maintainer");
      const next = typeof req.query.next === "string" && req.query.next.startsWith("/") ? req.query.next : "/explore";
      const user = await one("select * from users where github_username = $1", [username]);
      if (!user) throw new HttpError(404, "no such local user - run npm run seed -w backend");
      const token = signSession({ id: user.id, githubUsername: user.github_username });
      res.cookie(SESSION_COOKIE, token, { ...cookieOpts, maxAge: 7 * 24 * 3600 * 1000 });
      res.redirect(`${config.FRONTEND_URL}/auth/callback#token=${token}&next=${encodeURIComponent(next)}`);
    }),
  );
}

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, cookieOpts);
  res.json({ ok: true });
});
