import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { one, query } from "../db.js";
import { requireAuth } from "../lib/auth.js";
import { asyncHandler, HttpError } from "../lib/http.js";
import { allocate, fromBaseUnits, toBaseUnits } from "../lib/points.js";
import { getRegisteredPool, readPool } from "../services/chain.js";
import { executeAndWait, isCircleConfigured } from "../services/circle.js";

export const wavesRouter = Router();

async function ownedWave(waveId: string, userId: string) {
  const wave = await one(
    `select w.*, p.owner_id, p.name as project_name, p.repo_full_name
       from waves w join projects p on p.id = w.project_id where w.id = $1`,
    [waveId],
  );
  if (!wave) throw new HttpError(404, "wave not found");
  if (wave.owner_id !== userId) throw new HttpError(403, "only the project owner can do that");
  return wave;
}

/** Pulls authoritative pool state from ARC into the database. */
async function syncFromChain(waveId: string, poolAddress: string) {
  const pool = await readPool(poolAddress);
  const status = pool.status === "funded" ? (pool.endTime > new Date() ? "active" : "ended") : pool.status === "pending" ? "pending_funding" : pool.status;
  return one(
    `update waves set pool_amount = $2, fee_amount = $3, end_time = $4, status = $5,
            start_time = coalesce(start_time, case when $5 = 'active' then now() end)
      where id = $1 returning *`,
    [waveId, fromBaseUnits(pool.lockedAmount), fromBaseUnits(pool.totalFees), pool.endTime, status],
  );
}

wavesRouter.post(
  "/create",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z.object({ projectId: z.string().uuid(), durationDays: z.union([z.literal(7), z.literal(14), z.literal(30)]) }).parse(req.body);
    const project = await one("select * from projects where id = $1", [body.projectId]);
    if (!project) throw new HttpError(404, "project not found");
    if (project.owner_id !== req.user!.id) throw new HttpError(403, "only the project owner can create a Wave");

    const open = await one(
      "select id from waves where project_id = $1 and status in ('draft','deploying','pending_funding','active')",
      [project.id],
    );
    if (open) throw new HttpError(409, "this project already has an open Wave");

    let wave = await one("insert into waves (project_id, duration_days) values ($1, $2) returning *", [project.id, body.durationDays]);

    const owner = await one("select * from users where id = $1", [req.user!.id]);
    if (!config.WAVE_FACTORY_ADDRESS || !isCircleConfigured() || !owner.circle_wallet_id) {
      return res.status(201).json({ wave, onchain: false, message: "Wave saved as draft; on-chain deployment is not configured" });
    }

    await query("update waves set status = 'deploying' where id = $1", [wave.id]);
    try {
      const { txHash } = await executeAndWait({
        walletId: owner.circle_wallet_id,
        contractAddress: config.WAVE_FACTORY_ADDRESS,
        abiFunctionSignature: "createWave(string,string,uint256)",
        abiParameters: [wave.id, project.id, String(body.durationDays)],
        refId: `wave:${wave.id}:create`,
      });
      const pool = await getRegisteredPool(wave.id);
      wave = await one(
        "update waves set status = 'pending_funding', contract_address = $2, tx_hash = $3 where id = $1 returning *",
        [wave.id, pool, txHash],
      );
      res.status(201).json({ wave, onchain: true });
    } catch (err) {
      await query("update waves set status = 'failed' where id = $1", [wave.id]);
      throw err;
    }
  }),
);

wavesRouter.post(
  "/:id/fund",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        amount: z.string().regex(/^\d+(\.\d{1,6})?$/).optional(),
        // Funded from an external wallet (e.g. MetaMask) - just sync state from ARC.
        syncOnly: z.boolean().optional(),
      })
      .parse(req.body);
    const wave = await ownedWave(req.params.id, req.user!.id);
    if (!wave.contract_address) throw new HttpError(409, "wave has not been deployed on-chain");
    if (!["pending_funding", "active"].includes(wave.status)) throw new HttpError(409, `wave is ${wave.status}`);

    if (!body.syncOnly) {
      if (!body.amount) throw new HttpError(400, "amount is required");
      const amount = toBaseUnits(body.amount);
      if (amount < 10_000_000n) throw new HttpError(400, "minimum Wave pool is 10 USDC");
      const owner = await one("select * from users where id = $1", [req.user!.id]);
      if (!owner.circle_wallet_id) throw new HttpError(409, "no Circle wallet on this account");

      await executeAndWait({
        walletId: owner.circle_wallet_id,
        contractAddress: config.USDC_ADDRESS,
        abiFunctionSignature: "approve(address,uint256)",
        abiParameters: [wave.contract_address, amount.toString()],
        refId: `wave:${wave.id}:approve`,
      });
      const { txHash } = await executeAndWait({
        walletId: owner.circle_wallet_id,
        contractAddress: wave.contract_address,
        abiFunctionSignature: "deposit(uint256)",
        abiParameters: [amount.toString()],
        refId: `wave:${wave.id}:deposit`,
      });
      await query("update waves set tx_hash = $2 where id = $1", [wave.id, txHash]);
    }

    const updated = await syncFromChain(wave.id, wave.contract_address);
    res.json({ wave: updated });
  }),
);

wavesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const wave = await one(
      `select w.*, p.name as project_name, p.repo_full_name, p.github_url, p.owner_id,
              u.github_username as owner
         from waves w join projects p on p.id = w.project_id join users u on u.id = p.owner_id
        where w.id = $1`,
      [req.params.id],
    );
    if (!wave) throw new HttpError(404, "wave not found");
    const issues = await query(
      `select i.*, u.github_username as assignee, u.avatar_url as assignee_avatar,
              (select count(*)::int from applications a where a.issue_id = i.id and a.status = 'pending') as applicants
         from issues i left join users u on u.id = i.assignee_id
        where i.wave_id = $1 order by i.points desc`,
      [wave.id],
    );
    const stats = await one(
      `select count(distinct c.contributor_id)::int as contributors,
              count(c.id)::int as merged,
              coalesce(sum(c.points_awarded), 0)::int as points
         from contributions c join issues i on i.id = c.issue_id where i.wave_id = $1`,
      [wave.id],
    );
    res.json({ wave, issues, stats });
  }),
);

async function leaderboard(waveId: string) {
  const wave = await one("select pool_amount from waves where id = $1", [waveId]);
  if (!wave) throw new HttpError(404, "wave not found");
  const rows = await query(
    `select u.id, u.github_username, u.avatar_url, u.wallet_address,
            sum(c.points_awarded)::int as points, count(c.id)::int as merged
       from contributions c join issues i on i.id = c.issue_id join users u on u.id = c.contributor_id
      where i.wave_id = $1
      group by u.id order by points desc, merged desc`,
    [waveId],
  );
  const shares = allocate(
    toBaseUnits(wave.pool_amount),
    rows.map((r) => ({ contributorId: r.id, walletAddress: r.wallet_address ?? "", points: r.points })),
  );
  const byId = new Map(shares.map((s) => [s.contributorId, fromBaseUnits(s.amount)]));
  return rows.map((r, i) => ({
    rank: i + 1,
    githubUsername: r.github_username,
    avatarUrl: r.avatar_url,
    points: r.points,
    merged: r.merged,
    estimatedUsdc: byId.get(r.id) ?? "0.000000",
  }));
}

wavesRouter.get(
  "/:id/leaderboard",
  asyncHandler(async (req, res) => {
    res.json({ leaderboard: await leaderboard(req.params.id) });
  }),
);

wavesRouter.get(
  "/:id/report.csv",
  requireAuth,
  asyncHandler(async (req, res) => {
    const wave = await ownedWave(req.params.id, req.user!.id);
    const rows = await query(
      `select u.github_username, i.github_issue_url, i.complexity, c.points_awarded, c.pr_url, c.merged_at,
              p.amount_usdc, p.tx_hash
         from contributions c
         join issues i on i.id = c.issue_id
         join users u on u.id = c.contributor_id
         left join payouts p on p.wave_id = i.wave_id and p.contributor_id = u.id
        where i.wave_id = $1 order by c.merged_at`,
      [wave.id],
    );
    const esc = (v: unknown) => {
      const s = v instanceof Date ? v.toISOString() : v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ["contributor", "issue", "complexity", "points", "pull_request", "merged_at", "payout_usdc_total", "payout_tx"];
    const csv = [header, ...rows.map((r) => [r.github_username, r.github_issue_url, r.complexity, r.points_awarded, r.pr_url, r.merged_at, r.amount_usdc, r.tx_hash])]
      .map((line) => line.map(esc).join(","))
      .join("\n");
    res.setHeader("content-type", "text/csv");
    res.setHeader("content-disposition", `attachment; filename="zura-wave-${wave.id}.csv"`);
    res.send(csv);
  }),
);
