import { Router } from "express";
import { z } from "zod";
import { one, query } from "../db.js";
import { requireAuth } from "../lib/auth.js";
import { asyncHandler, HttpError } from "../lib/http.js";
import { parseRepoUrl } from "../services/github.js";

export const projectsRouter = Router();

const WAVE_SUMMARY = `
  left join lateral (
    select w.id, w.status, w.pool_amount, w.end_time, w.duration_days,
           (select count(*)::int from issues i where i.wave_id = w.id and i.status = 'open') as open_issues,
           (select coalesce(max(points), 0)::int from issues i where i.wave_id = w.id) as max_points,
           (select coalesce(array_agg(distinct complexity), '{}') from issues i where i.wave_id = w.id and i.status = 'open') as complexities
      from waves w
     where w.project_id = p.id
     order by (w.status = 'active') desc, w.created_at desc
     limit 1
  ) wave on true`;

projectsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        q: z.string().optional(),
        language: z.string().optional(),
        type: z.string().optional(),
        complexity: z.enum(["easy", "medium", "hard", "critical"]).optional(),
        minPoints: z.coerce.number().optional(),
        activeOnly: z.enum(["true", "false"]).optional(),
      })
      .parse(req.query);

    const where: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      params.push(value);
      where.push(sql.replaceAll("?", `$${params.length}`));
    };
    if (q.q) add("(p.name ilike ? or p.description ilike ?)", `%${q.q}%`);
    if (q.language) add("lower(p.language) = lower(?)", q.language);
    if (q.type) add("p.project_type = ?", q.type);
    if (q.complexity) add("? = any(wave.complexities)", q.complexity);
    if (q.minPoints) add("wave.max_points >= ?", q.minPoints);
    if (q.activeOnly === "true") where.push("wave.status = 'active'");

    const rows = await query(
      `select p.id, p.name, p.description, p.github_url, p.repo_full_name, p.language, p.project_type, p.verified,
              u.github_username as owner, u.avatar_url as owner_avatar,
              to_jsonb(wave) as wave
         from projects p
         join users u on u.id = p.owner_id
         ${WAVE_SUMMARY}
         ${where.length ? "where " + where.join(" and ") : ""}
        order by (wave.status = 'active') desc nulls last, wave.pool_amount desc nulls last, p.created_at desc
        limit 100`,
      params,
    );
    res.json({ projects: rows });
  }),
);

projectsRouter.get(
  "/mine",
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await query(
      `select p.*, to_jsonb(wave) as wave from projects p ${WAVE_SUMMARY} where p.owner_id = $1 order by p.created_at desc`,
      [req.user!.id],
    );
    res.json({ projects: rows });
  }),
);

projectsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(2).max(80),
        githubUrl: z.string().url(),
        description: z.string().max(2000).default(""),
        arcUsage: z.string().max(2000).default(""),
        language: z.string().max(40).optional(),
        projectType: z.enum(["defi", "payments", "infrastructure", "tooling", "wallet", "nft", "other"]).default("other"),
      })
      .parse(req.body);

    const repo = parseRepoUrl(body.githubUrl);
    if (!repo) throw new HttpError(400, "githubUrl must look like https://github.com/owner/repo");
    const fullName = `${repo.owner}/${repo.repo}`.toLowerCase();

    const exists = await one("select id from projects where repo_full_name = $1", [fullName]);
    if (exists) throw new HttpError(409, "this repository is already on Zura");

    const project = await one(
      `insert into projects (owner_id, name, github_url, repo_full_name, description, arc_usage, language, project_type)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
      [req.user!.id, body.name, `https://github.com/${repo.owner}/${repo.repo}`, fullName, body.description, body.arcUsage, body.language ?? null, body.projectType],
    );
    res.status(201).json({ project });
  }),
);

projectsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const project = await one(
      `select p.*, u.github_username as owner, u.avatar_url as owner_avatar
         from projects p join users u on u.id = p.owner_id where p.id = $1`,
      [req.params.id],
    );
    if (!project) throw new HttpError(404, "project not found");
    const waves = await query("select * from waves where project_id = $1 order by created_at desc", [project.id]);
    const current = waves.find((w) => w.status === "active") ?? waves[0];
    const issues = current
      ? await query(
          `select i.*, u.github_username as assignee,
                  (select count(*)::int from applications a where a.issue_id = i.id and a.status = 'pending') as applicants
             from issues i left join users u on u.id = i.assignee_id
            where i.wave_id = $1 order by i.points desc, i.created_at`,
          [current.id],
        )
      : [];
    res.json({ project, waves, currentWave: current ?? null, issues });
  }),
);
