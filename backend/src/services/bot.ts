import type { Octokit } from "@octokit/rest";
import { one, query } from "../db.js";
import { checkEligibility, FAILURE_MESSAGES, linkedIssueNumbers } from "../lib/eligibility.js";
import { COMPLEXITY_POINTS, complexityFromLabels } from "../lib/points.js";
import { comment, getCiState, getPrFiles, installationClient } from "./github.js";

type Payload = Record<string, any>;

async function notify(userId: string, type: string, payload: Record<string, unknown>) {
  await query("insert into notifications(user_id, type, payload) values ($1, $2, $3)", [userId, type, payload]);
}

async function projectForRepo(payload: Payload) {
  const fullName = String(payload.repository?.full_name ?? "").toLowerCase();
  const project = await one("select * from projects where repo_full_name = $1", [fullName]);
  if (project && payload.installation?.id && project.github_installation_id !== payload.installation.id) {
    await query("update projects set github_installation_id = $2 where id = $1", [project.id, payload.installation.id]);
  }
  return project;
}

/** The Wave issues attach to: the newest one that has not finished. */
async function currentWave(projectId: string) {
  return one(
    `select * from waves where project_id = $1 and status in ('draft', 'deploying', 'pending_funding', 'active')
     order by created_at desc limit 1`,
    [projectId],
  );
}

export async function handleGithubEvent(event: string, payload: Payload) {
  const key = `${event}.${payload.action}`;
  switch (key) {
    case "issues.labeled":
    case "issues.unlabeled":
      return syncIssueLabels(payload);
    case "issues.assigned":
      return onIssueAssigned(payload);
    case "pull_request.opened":
      return onPullRequestOpened(payload);
    case "pull_request.closed":
      if (payload.pull_request?.merged) return onPullRequestMerged(payload);
      return;
    default:
      return;
  }
}

async function syncIssueLabels(payload: Payload) {
  const project = await projectForRepo(payload);
  if (!project) return;
  const gi = payload.issue;
  const complexity = complexityFromLabels(gi.labels ?? []);
  const existing = await one("select * from issues where github_issue_id = $1", [gi.id]);

  if (!complexity) {
    if (existing && existing.status === "open") {
      await query("update issues set status = 'closed' where id = $1", [existing.id]);
    }
    return;
  }

  if (existing) {
    await query(
      "update issues set complexity = $2, points = $3, title = $4, status = case when status = 'closed' then 'open' else status end where id = $1",
      [existing.id, complexity, COMPLEXITY_POINTS[complexity], gi.title],
    );
    return;
  }

  const wave = await currentWave(project.id);
  if (!wave) return;
  await query(
    `insert into issues (wave_id, github_issue_id, github_issue_number, github_issue_url, title, complexity, points)
     values ($1, $2, $3, $4, $5, $6, $7) on conflict (github_issue_id) do nothing`,
    [wave.id, gi.id, gi.number, gi.html_url, gi.title, complexity, COMPLEXITY_POINTS[complexity]],
  );
}

async function onIssueAssigned(payload: Payload) {
  const issue = await one("select * from issues where github_issue_id = $1", [payload.issue.id]);
  if (!issue) return;
  const user = await one("select * from users where lower(github_username) = lower($1)", [payload.assignee?.login]);
  if (!user) return;
  if (!issue.assignee_id) {
    await query("update issues set assignee_id = $2, status = 'assigned' where id = $1", [issue.id, user.id]);
  }
  await notify(user.id, "issue_assigned", {
    issueId: issue.id,
    title: issue.title,
    url: issue.github_issue_url,
    points: issue.points,
  });
}

async function trackedIssuesForPr(payload: Payload) {
  const pr = payload.pull_request;
  const numbers = linkedIssueNumbers(pr.body, payload.repository.full_name);
  if (!numbers.length) return [];
  const project = await projectForRepo(payload);
  if (!project) return [];
  return query(
    `select i.*, w.status as wave_status, w.end_time as wave_end_time, u.github_username as assignee_username
       from issues i
       join waves w on w.id = i.wave_id
       left join users u on u.id = i.assignee_id
      where w.project_id = $1 and i.github_issue_number = any($2::int[])`,
    [project.id, numbers],
  ).then((rows) => rows.map((r) => ({ ...r, project })));
}

async function onPullRequestOpened(payload: Payload) {
  const pr = payload.pull_request;
  for (const issue of await trackedIssuesForPr(payload)) {
    await notify(issue.project.owner_id, "pr_submitted", {
      issueId: issue.id,
      issueTitle: issue.title,
      prUrl: pr.html_url,
      author: pr.user?.login,
    });
    if (issue.assignee_username?.toLowerCase() === pr.user?.login?.toLowerCase()) {
      await query("update issues set status = 'in_review' where id = $1 and status = 'assigned'", [issue.id]);
    }
  }
}

async function onPullRequestMerged(payload: Payload) {
  const pr = payload.pull_request;
  const [owner, repo] = String(payload.repository.full_name).split("/");
  const issues = await trackedIssuesForPr(payload);
  if (!issues.length) return;

  const gh: Octokit = installationClient(payload.installation.id);
  const [ci, files] = await Promise.all([
    getCiState(gh, owner, repo, pr.head.sha),
    getPrFiles(gh, owner, repo, pr.number),
  ]);

  for (const issue of issues) {
    // Re-read labels from GitHub so a label removed after syncing is respected.
    const { data: ghIssue } = await gh.issues.get({ owner, repo, issue_number: issue.github_issue_number });
    const result = checkEligibility({
      now: new Date(pr.merged_at ?? Date.now()),
      wave: { status: issue.wave_status, endTime: issue.wave_end_time ? new Date(issue.wave_end_time) : null },
      issueTagged: complexityFromLabels(ghIssue.labels as any[]) !== null,
      prAuthorGithubUsername: pr.user.login,
      assigneeGithubUsername: issue.assignee_username,
      ci,
      files,
    });

    if (!result.ok) {
      const reasons = result.reasons.map((r) => `- ${FAILURE_MESSAGES[r]}`).join("\n");
      await comment(gh, owner, repo, pr.number, `**Zura** could not award points for #${issue.github_issue_number}:\n\n${reasons}`);
      continue;
    }

    const contributor = await one("select * from users where lower(github_username) = lower($1)", [pr.user.login]);
    if (!contributor) continue;

    const inserted = await one(
      `insert into contributions (issue_id, contributor_id, pr_url, pr_number, points_awarded, merged_at)
       values ($1, $2, $3, $4, $5, $6) on conflict (issue_id) do nothing returning id`,
      [issue.id, contributor.id, pr.html_url, pr.number, issue.points, pr.merged_at],
    );
    if (!inserted) continue;

    await query("update issues set status = 'completed' where id = $1", [issue.id]);
    await notify(contributor.id, "points_awarded", { issueId: issue.id, points: issue.points, prUrl: pr.html_url });
    await comment(
      gh,
      owner,
      repo,
      pr.number,
      `Points awarded! 🎉\n\n@${pr.user.login} earned **${issue.points} points** (${issue.complexity}) for #${issue.github_issue_number}. ` +
        `USDC is distributed to your Circle wallet on ARC when the Wave ends.`,
    );
  }
}
