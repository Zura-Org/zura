/**
 * Local development only: fills the database with demo projects, a live Wave, issues and contributions
 * so every page has something to render. Refuses to run in production.
 */
import { config } from "./config.js";
import { one, pool, query } from "./db.js";

if (config.NODE_ENV === "production") throw new Error("seed is for local development only");

const DAY = 86_400_000;

async function user(githubId: number, username: string) {
  return one(
    `insert into users (github_id, github_username, avatar_url) values ($1, $2, $3)
     on conflict (github_id) do update set github_username = excluded.github_username returning *`,
    [githubId, username, `https://avatars.githubusercontent.com/u/${githubId}?v=4`],
  );
}

async function main() {
  const existing = await one("select count(*)::int as n from projects");
  if (existing.n > 0) {
    console.log("database already has projects; skipping seed");
    return pool.end();
  }

  const owner = await user(9000001, "demo-maintainer");
  const alice = await user(9000002, "demo-alice");
  const bob = await user(9000003, "demo-bob");

  const projects = [
    ["Arc Pay SDK", "demo-org/arc-pay-sdk", "TypeScript SDK for USDC checkout flows on ARC.", "payments", "TypeScript", "2400"],
    ["Stable Swap", "demo-org/stable-swap", "Low-slippage USDC/EURC AMM deployed on ARC testnet.", "defi", "Solidity", "5760"],
    ["Arc Indexer", "demo-org/arc-indexer", "Fast event indexer and GraphQL API for ARC contracts.", "infrastructure", "Rust", "960"],
  ];

  for (const [i, [name, repo, description, type, language, poolAmount]] of projects.entries()) {
    const project = await one(
      `insert into projects (owner_id, name, github_url, repo_full_name, description, arc_usage, language, project_type, verified)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning *`,
      [owner.id, name, `https://github.com/${repo}`, repo, description, "Demo data for local development.", language, type, i === 0],
    );
    const wave = await one(
      `insert into waves (project_id, duration_days, pool_amount, fee_amount, start_time, end_time, status)
       values ($1, 14, $2, $3, $4, $5, 'active') returning *`,
      [project.id, poolAmount, (Number(poolAmount) / 0.96 * 0.04).toFixed(6), new Date(Date.now() - 3 * DAY), new Date(Date.now() + (11 - i * 4) * DAY)],
    );

    const issues = [
      ["Add retry logic to RPC client", "medium", 300],
      ["Fix decimals bug in USDC formatter", "easy", 100],
      ["Support CCTP v2 fast transfers", "hard", 700],
      ["Audit reentrancy in settlement path", "critical", 1500],
    ] as const;

    for (const [n, [title, complexity, points]] of issues.entries()) {
      const issue = await one(
        `insert into issues (wave_id, github_issue_id, github_issue_number, github_issue_url, title, complexity, points, status, assignee_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning *`,
        [
          wave.id,
          (i + 1) * 1000 + n,
          n + 1,
          `https://github.com/${repo}/issues/${n + 1}`,
          title,
          complexity,
          points,
          n === 0 && i === 0 ? "completed" : n === 1 && i === 0 ? "completed" : n === 2 ? "assigned" : "open",
          n === 0 && i === 0 ? alice.id : n === 1 && i === 0 ? bob.id : n === 2 ? alice.id : null,
        ],
      );
      if (issue.status === "completed") {
        await query(
          `insert into contributions (issue_id, contributor_id, pr_url, pr_number, points_awarded, merged_at) values ($1, $2, $3, $4, $5, $6)`,
          [issue.id, issue.assignee_id, `https://github.com/${repo}/pull/${10 + n}`, 10 + n, points, new Date(Date.now() - DAY)],
        );
      }
      if (issue.status === "open") {
        await query("insert into applications (issue_id, contributor_id, note) values ($1, $2, $3)", [
          issue.id,
          bob.id,
          "I've shipped similar work on ARC and can start today.",
        ]);
      }
    }
  }

  console.log("seeded demo data (log in locally as demo-maintainer, demo-alice or demo-bob)");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
