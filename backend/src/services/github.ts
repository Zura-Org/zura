import crypto from "node:crypto";
import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { config } from "../config.js";
import type { CheckResult, PrFile } from "../lib/eligibility.js";

/** Octokit authenticated as the Zura GitHub App installation on a repo. */
export function installationClient(installationId: number) {
  if (!config.GITHUB_APP_ID || !config.GITHUB_APP_PRIVATE_KEY) {
    throw new Error("GitHub App credentials are not configured");
  }
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: config.GITHUB_APP_ID,
      privateKey: config.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n"),
      installationId,
    },
  });
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!config.GITHUB_WEBHOOK_SECRET || !signature?.startsWith("sha256=")) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", config.GITHUB_WEBHOOK_SECRET).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Combines legacy commit statuses and check runs into a single verdict. */
export async function getCiState(gh: Octokit, owner: string, repo: string, ref: string): Promise<CheckResult> {
  const [statuses, checks] = await Promise.all([
    gh.repos.getCombinedStatusForRef({ owner, repo, ref }),
    gh.checks.listForRef({ owner, repo, ref, per_page: 100 }),
  ]);

  const runs = checks.data.check_runs;
  const hasStatuses = statuses.data.total_count > 0;
  if (!hasStatuses && runs.length === 0) return { state: "none" };

  if (hasStatuses && statuses.data.state === "failure") return { state: "failure" };
  if (runs.some((r) => r.conclusion && !["success", "neutral", "skipped"].includes(r.conclusion))) {
    return { state: "failure" };
  }
  if ((hasStatuses && statuses.data.state === "pending") || runs.some((r) => r.status !== "completed")) {
    return { state: "pending" };
  }
  return { state: "success" };
}

export async function getPrFiles(gh: Octokit, owner: string, repo: string, pull_number: number): Promise<PrFile[]> {
  const files = await gh.paginate(gh.pulls.listFiles, { owner, repo, pull_number, per_page: 100 });
  return files.map((f) => ({ filename: f.filename, patch: f.patch, additions: f.additions, deletions: f.deletions }));
}

export async function comment(gh: Octokit, owner: string, repo: string, issue_number: number, body: string) {
  await gh.issues.createComment({ owner, repo, issue_number, body });
}

/** GitHub OAuth (user login) helpers. */
export function oauthAuthorizeUrl(state: string) {
  const params = new URLSearchParams({
    client_id: config.GITHUB_CLIENT_ID ?? "",
    redirect_uri: `${config.API_URL}/api/auth/github/callback`,
    scope: "read:user user:email",
    state,
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

export async function exchangeOAuthCode(code: string) {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      client_id: config.GITHUB_CLIENT_ID,
      client_secret: config.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const data = (await res.json()) as { access_token?: string; error_description?: string };
  if (!data.access_token) throw new Error(data.error_description ?? "GitHub OAuth failed");

  const gh = new Octokit({ auth: data.access_token });
  const { data: user } = await gh.users.getAuthenticated();
  return { id: user.id, login: user.login, avatarUrl: user.avatar_url };
}

export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  const m = url.trim().match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i);
  return m ? { owner: m[1], repo: m[2] } : null;
}
