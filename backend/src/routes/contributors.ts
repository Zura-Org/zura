import { Router } from "express";
import { one, query } from "../db.js";
import { asyncHandler, HttpError } from "../lib/http.js";

export const contributorsRouter = Router();

contributorsRouter.get(
  "/:githubUsername",
  asyncHandler(async (req, res) => {
    const user = await one(
      "select id, github_username, avatar_url, wallet_address, created_at from users where lower(github_username) = lower($1)",
      [req.params.githubUsername],
    );
    if (!user) throw new HttpError(404, "contributor not found");

    const [stats, contributions, payouts, projects] = await Promise.all([
      one(
        `select coalesce((select sum(points_awarded) from contributions where contributor_id = $1), 0)::int as points,
                (select count(*) from contributions where contributor_id = $1)::int as merged,
                coalesce((select sum(amount_usdc) from payouts where contributor_id = $1 and status = 'confirmed'), 0)::text as earned_usdc,
                (select count(distinct i.wave_id) from contributions c join issues i on i.id = c.issue_id where c.contributor_id = $1)::int as waves`,
        [user.id],
      ),
      query(
        `select c.pr_url, c.points_awarded, c.merged_at, i.title, i.complexity, i.github_issue_url,
                p.id as project_id, p.name as project_name
           from contributions c
           join issues i on i.id = c.issue_id
           join waves w on w.id = i.wave_id
           join projects p on p.id = w.project_id
          where c.contributor_id = $1 order by c.merged_at desc limit 50`,
        [user.id],
      ),
      query(
        `select po.amount_usdc, po.tx_hash, po.status, po.created_at, p.name as project_name
           from payouts po join waves w on w.id = po.wave_id join projects p on p.id = w.project_id
          where po.contributor_id = $1 order by po.created_at desc`,
        [user.id],
      ),
      query("select id, name, github_url from projects where owner_id = $1", [user.id]),
    ]);

    res.json({ contributor: user, stats, contributions, payouts, projects });
  }),
);
