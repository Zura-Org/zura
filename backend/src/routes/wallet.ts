import { Router } from "express";
import { ethers } from "ethers";
import { z } from "zod";
import { config } from "../config.js";
import { one, query } from "../db.js";
import { requireAuth } from "../lib/auth.js";
import { asyncHandler, HttpError } from "../lib/http.js";
import { fromBaseUnits, toBaseUnits } from "../lib/points.js";
import { burnOnArc, CCTP_DESTINATIONS, type CctpDestination } from "../services/cctp.js";
import { usdcBalance } from "../services/chain.js";
import { transferUsdc, waitForTransaction } from "../services/circle.js";

export const walletRouter = Router();

walletRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await one("select id, wallet_address, kyc_status from users where id = $1", [req.user!.id]);
    let balance: string | null = null;
    if (user.wallet_address) {
      try {
        balance = fromBaseUnits(await usdcBalance(user.wallet_address));
      } catch (err) {
        console.error("balance lookup failed", err);
      }
    }
    const [payouts, withdrawals, pending] = await Promise.all([
      query(
        `select po.*, p.name as project_name from payouts po
           join waves w on w.id = po.wave_id join projects p on p.id = w.project_id
          where po.contributor_id = $1 order by po.created_at desc`,
        [user.id],
      ),
      query("select * from withdrawals where user_id = $1 order by created_at desc limit 50", [user.id]),
      // Points earned in Waves that have not paid out yet.
      query(
        `select w.id as wave_id, p.name as project_name, w.end_time, w.pool_amount,
                sum(c.points_awarded)::int as points,
                (select sum(c2.points_awarded) from contributions c2 join issues i2 on i2.id = c2.issue_id where i2.wave_id = w.id)::int as wave_points
           from contributions c join issues i on i.id = c.issue_id join waves w on w.id = i.wave_id join projects p on p.id = w.project_id
          where c.contributor_id = $1 and w.status in ('active', 'ended', 'distributing')
          group by w.id, p.name`,
        [user.id],
      ),
    ]);
    res.json({
      walletAddress: user.wallet_address,
      kycStatus: user.kyc_status,
      kycRequired: config.KYC_REQUIRED,
      balanceUsdc: balance,
      payouts,
      withdrawals,
      pendingWaves: pending,
      withdrawChains: [
        { id: "ARC-TESTNET", label: "ARC (same chain)", enabled: true },
        ...Object.entries(CCTP_DESTINATIONS).map(([id, d]) => ({ id, label: `${d.label} via CCTP`, enabled: Boolean(d.relayerWalletId()) })),
      ],
    });
  }),
);

walletRouter.post(
  "/withdraw",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        destinationChain: z.enum(["ARC-TESTNET", "ETH-SEPOLIA", "BASE-SEPOLIA"]),
        destinationAddress: z.string().refine((a) => ethers.isAddress(a), "invalid EVM address"),
        amount: z.string().regex(/^\d+(\.\d{1,6})?$/),
      })
      .parse(req.body);

    const user = await one("select * from users where id = $1", [req.user!.id]);
    if (!user.circle_wallet_id) throw new HttpError(409, "no Circle wallet on this account");
    if (config.KYC_REQUIRED && user.kyc_status !== "approved") throw new HttpError(403, "complete KYC before withdrawing");

    const amount = toBaseUnits(body.amount);
    if (amount <= 0n) throw new HttpError(400, "amount must be positive");
    const balance = await usdcBalance(user.wallet_address);
    if (amount > balance) throw new HttpError(400, `insufficient balance (${fromBaseUnits(balance)} USDC)`);

    const withdrawal = await one(
      `insert into withdrawals (user_id, destination_chain, destination_address, amount_usdc) values ($1, $2, $3, $4) returning *`,
      [user.id, body.destinationChain, body.destinationAddress, fromBaseUnits(amount)],
    );

    try {
      if (body.destinationChain === "ARC-TESTNET") {
        const id = await transferUsdc(user.circle_wallet_id, body.destinationAddress, fromBaseUnits(amount), withdrawal.id);
        const { txHash } = await waitForTransaction(id);
        const done = await one(
          "update withdrawals set status = 'completed', circle_tx_id = $2, burn_tx_hash = $3 where id = $1 returning *",
          [withdrawal.id, id, txHash],
        );
        return res.status(201).json({ withdrawal: done });
      }

      const { circleTxId, txHash } = await burnOnArc({
        walletId: user.circle_wallet_id,
        amount,
        destination: body.destinationChain as CctpDestination,
        destinationAddress: body.destinationAddress,
        refId: withdrawal.id,
      });
      // The worker waits for Circle's attestation and mints on the destination chain.
      const burned = await one(
        "update withdrawals set status = 'burned', circle_tx_id = $2, burn_tx_hash = $3 where id = $1 returning *",
        [withdrawal.id, circleTxId, txHash],
      );
      res.status(201).json({ withdrawal: burned });
    } catch (err) {
      await query("update withdrawals set status = 'failed', error = $2 where id = $1", [withdrawal.id, String(err)]);
      throw err;
    }
  }),
);

/** KYC placeholder: records intent. A provider integration (e.g. Persona / Sumsub) is a Milestone 3 item. */
walletRouter.post(
  "/kyc",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await one(
      "update users set kyc_status = case when kyc_status = 'approved' then kyc_status else 'pending' end where id = $1 returning kyc_status",
      [req.user!.id],
    );
    res.json({ kycStatus: user.kyc_status });
  }),
);

walletRouter.get(
  "/notifications",
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await query("select * from notifications where user_id = $1 order by created_at desc limit 50", [req.user!.id]);
    await query("update notifications set read = true where user_id = $1 and not read", [req.user!.id]);
    res.json({ notifications: rows });
  }),
);
