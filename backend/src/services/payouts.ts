import { ethers } from "ethers";
import { config } from "../config.js";
import { one, query, tx } from "../db.js";
import { HttpError } from "../lib/http.js";
import { allocate, fromBaseUnits, toBaseUnits } from "../lib/points.js";
import { provider, readPool } from "./chain.js";
import { executeAndWait } from "./circle.js";

const BADGE_ABI = ["function badgeOf(address) view returns (uint256)"];

function operatorWallet() {
  if (!config.CIRCLE_OPERATOR_WALLET_ID) throw new HttpError(503, "operator wallet not configured");
  return config.CIRCLE_OPERATOR_WALLET_ID;
}

/**
 * Settles a finished Wave: computes each contributor's points, calls WavePool.distribute() from
 * Zura's operator wallet, records payouts and refreshes reputation badges.
 * Zero contributions → enableRefund() so the project owner can reclaim the pool.
 */
export async function triggerPayout(waveId: string) {
  const wave = await one("select * from waves where id = $1", [waveId]);
  if (!wave) throw new HttpError(404, "wave not found");
  if (!wave.contract_address) throw new HttpError(409, "wave has no pool contract");
  if (!["active", "ended"].includes(wave.status)) throw new HttpError(409, `wave is ${wave.status}`);
  if (!wave.end_time || new Date(wave.end_time) > new Date()) throw new HttpError(409, "wave has not ended yet");

  const onchain = await readPool(wave.contract_address);
  if (onchain.status !== "funded") throw new HttpError(409, `pool is ${onchain.status}`);

  const rows = await query(
    `select c.contributor_id, u.wallet_address, sum(c.points_awarded)::int as points
       from contributions c
       join issues i on i.id = c.issue_id
       join users u on u.id = c.contributor_id
      where i.wave_id = $1 and u.wallet_address is not null
      group by c.contributor_id, u.wallet_address
      order by points desc`,
    [waveId],
  );

  const wallet = operatorWallet();

  if (!rows.length) {
    const { txHash } = await executeAndWait({
      walletId: wallet,
      contractAddress: wave.contract_address,
      abiFunctionSignature: "enableRefund()",
      abiParameters: [],
      refId: `wave:${waveId}:refund`,
    });
    await query("update waves set status = 'refund_available' where id = $1", [waveId]);
    return { status: "refund_available", txHash, payouts: [] };
  }

  const allocations = allocate(
    onchain.lockedAmount,
    rows.map((r) => ({ contributorId: r.contributor_id, walletAddress: r.wallet_address, points: r.points })),
  );
  const totalPoints = allocations.reduce((s, a) => s + a.points, 0);

  await tx(async (client) => {
    await client.query("update waves set status = 'distributing' where id = $1", [waveId]);
    for (const a of allocations) {
      await client.query(
        `insert into payouts (wave_id, contributor_id, points, amount_usdc, status) values ($1, $2, $3, $4, 'pending')
         on conflict (wave_id, contributor_id) do update set points = excluded.points, amount_usdc = excluded.amount_usdc, status = 'pending'`,
        [waveId, a.contributorId, a.points, fromBaseUnits(a.amount)],
      );
    }
  });

  try {
    const { circleTxId, txHash } = await executeAndWait({
      walletId: wallet,
      contractAddress: wave.contract_address,
      abiFunctionSignature: "distribute(address[],uint256[],uint256)",
      abiParameters: [
        allocations.map((a) => a.walletAddress),
        allocations.map((a) => String(a.points)),
        String(totalPoints),
      ],
      refId: `wave:${waveId}:distribute`,
    });

    await query("update payouts set status = 'confirmed', tx_hash = $2, circle_tx_id = $3 where wave_id = $1", [
      waveId,
      txHash,
      circleTxId,
    ]);
    await query("update waves set status = 'distributed' where id = $1", [waveId]);
    for (const a of allocations) {
      await query("insert into notifications(user_id, type, payload) values ($1, 'payout_sent', $2)", [
        a.contributorId,
        { waveId, amount: fromBaseUnits(a.amount), txHash },
      ]);
    }

    await refreshBadges(allocations.map((a) => ({ contributorId: a.contributorId, walletAddress: a.walletAddress })));

    return {
      status: "distributed",
      txHash,
      payouts: allocations.map((a) => ({ ...a, amount: fromBaseUnits(a.amount) })),
    };
  } catch (err) {
    await query("update payouts set status = 'failed' where wave_id = $1 and status = 'pending'", [waveId]);
    await query("update waves set status = 'ended' where id = $1", [waveId]);
    throw err;
  }
}

/** Mints a soul-bound badge on first payout and syncs lifetime stats. Best effort. */
async function refreshBadges(contributors: Array<{ contributorId: string; walletAddress: string }>) {
  if (!config.REPUTATION_BADGE_ADDRESS) return;
  const badge = new ethers.Contract(config.REPUTATION_BADGE_ADDRESS, BADGE_ABI, provider);
  const wallet = operatorWallet();

  for (const c of contributors) {
    try {
      const stats = await one(
        `select coalesce((select sum(amount_usdc) from payouts where contributor_id = $1 and status = 'confirmed'), 0)::text as earned,
                (select count(*) from contributions where contributor_id = $1)::int as merges`,
        [c.contributorId],
      );
      if ((await badge.badgeOf(c.walletAddress)) === 0n) {
        await executeAndWait({
          walletId: wallet,
          contractAddress: config.REPUTATION_BADGE_ADDRESS,
          abiFunctionSignature: "mint(address)",
          abiParameters: [c.walletAddress],
        });
      }
      await executeAndWait({
        walletId: wallet,
        contractAddress: config.REPUTATION_BADGE_ADDRESS,
        abiFunctionSignature: "updateMetadata(address,uint256,uint256)",
        abiParameters: [c.walletAddress, toBaseUnits(stats.earned).toString(), String(stats.merges)],
      });
    } catch (err) {
      console.error(`badge refresh failed for ${c.contributorId}`, err);
    }
  }
}

/** Marks Waves past their end time as ended and settles them. Called by the worker. */
export async function settleEndedWaves() {
  await query("update waves set status = 'ended' where status = 'active' and end_time <= now()");
  const due = await query("select id from waves where status = 'ended' order by end_time limit 5");
  for (const w of due) {
    try {
      await triggerPayout(w.id);
    } catch (err) {
      console.error(`auto payout failed for wave ${w.id}`, err);
    }
  }
}
