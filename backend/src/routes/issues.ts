import { Router } from "express";
import { z } from "zod";
import { one, query, tx } from "../db.js";
import { requireAuth } from "../lib/auth.js";
import { asyncHandler, HttpError } from "../lib/http.js";
import { installationClient } from "../services/github.js";

export const issuesRouter = Router();

async function issueWithOwner(issueId: string) {
  const issue = await one(
    `select i.*, w.status as wave_status, p.owner_id, p.repo_full_name, p.github_installation_id
       from issues i join waves w on w.id = i.wave_id join projects p on p.id = w.project_id
      where i.id = $1`,
    [issueId],
  );
  if (!issue) throw new HttpError(404, "issue not found");
  return issue;
}

issuesRouter.post(
  "/apply",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z.object({ issueId: z.string().uuid(), note: z.string().max(1000).optional() }).parse(req.body);
    const issue = await issueWithOwner(body.issueId);
    if (issue.status !== "open") throw new HttpError(409, "issue is not open for applications");
    if (!["active", "pending_funding"].includes(issue.wave_status)) throw new HttpError(409, "wave is not active");
    if (issue.owner_id === req.user!.id) throw new HttpError(400, "project owners cannot apply to their own issues");

    const application = await one(
      `insert into applications (issue_id, contributor_id, note) values ($1, $2, $3)
       on conflict (issue_id, contributor_id) do update set note = excluded.note, status = 'pending'
       returning *`,
      [issue.id, req.user!.id, body.note ?? null],
    );
    await query("insert into notifications(user_id, type, payload) values ($1, 'new_application', $2)", [
      issue.owner_id,
      { issueId: issue.id, title: issue.title, applicant: req.user!.githubUsername },
    ]);
    res.status(201).json({ application });
  }),
);

issuesRouter.get(
  "/:id/applications",
  requireAuth,
  asyncHandler(async (req, res) => {
    const issue = await issueWithOwner(req.params.id);
    if (issue.owner_id !== req.user!.id) throw new HttpError(403, "only the project owner can view applications");
    const applications = await query(
      `select a.*, u.github_username, u.avatar_url,
              (select count(*)::int from contributions c where c.contributor_id = u.id) as merged_total
         from applications a join users u on u.id = a.contributor_id
        where a.issue_id = $1 order by a.created_at`,
      [issue.id],
    );
    res.json({ applications });
  }),
);

issuesRouter.post(
  "/:id/assign",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z.object({ applicationId: z.string().uuid() }).parse(req.body);
    const issue = await issueWithOwner(req.params.id);
    if (issue.owner_id !== req.user!.id) throw new HttpError(403, "only the project owner can assign");
    if (!["open", "assigned"].includes(issue.status)) throw new HttpError(409, `issue is ${issue.status}`);

    const application = await one("select a.*, u.github_username from applications a join users u on u.id = a.contributor_id where a.id = $1 and a.issue_id = $2", [
      body.applicationId,
      issue.id,
    ]);
    if (!application) throw new HttpError(404, "application not found");

    await tx(async (client) => {
      await client.query("update applications set status = 'approved' where id = $1", [application.id]);
      await client.query("update applications set status = 'rejected' where issue_id = $1 and id <> $2 and status = 'pending'", [issue.id, application.id]);
      await client.query("update issues set assignee_id = $2, status = 'assigned' where id = $1", [issue.id, application.contributor_id]);
      await client.query("insert into notifications(user_id, type, payload) values ($1, 'issue_assigned', $2)", [
        application.contributor_id,
        { issueId: issue.id, title: issue.title, url: issue.github_issue_url, points: issue.points },
      ]);
    });

    // Mirror the assignment on GitHub so the bot can verify PR authorship later.
    let githubAssigned = false;
    if (issue.github_installation_id) {
      try {
        const [owner, repo] = issue.repo_full_name.split("/");
        await installationClient(issue.github_installation_id).issues.addAssignees({
          owner,
          repo,
          issue_number: issue.github_issue_number,
          assignees: [application.github_username],
        });
        githubAssigned = true;
      } catch (err) {
        console.error("GitHub assignment failed", err);
      }
    }
    res.json({ ok: true, githubAssigned });
  }),
);

issuesRouter.post(
  "/applications/:id/reject",
  requireAuth,
  asyncHandler(async (req, res) => {
    const application = await one("select * from applications where id = $1", [req.params.id]);
    if (!application) throw new HttpError(404, "application not found");
    const issue = await issueWithOwner(application.issue_id);
    if (issue.owner_id !== req.user!.id) throw new HttpError(403, "only the project owner can reject");
    await query("update applications set status = 'rejected' where id = $1", [application.id]);
    res.json({ ok: true });
  }),
);
