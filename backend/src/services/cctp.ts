import { ethers } from "ethers";
import { config } from "../config.js";
import { one, query } from "../db.js";
import { fromBaseUnits, toBaseUnits } from "../lib/points.js";
import { executeAndWait } from "./circle.js";

/**
 * CCTP v2 withdrawals from ARC to other chains.
 *
 *   1. approve(TokenMessengerV2, amount) from the contributor's Circle wallet on ARC
 *   2. depositForBurn(...) burns USDC on ARC (domain 26)
 *   3. Circle's Iris API attests the burn
 *   4. a Zura relayer wallet on the destination chain calls receiveMessage() to mint native USDC
 *
 * Steps 1-2 are sponsored by Gas Station on ARC; step 4 by Gas Station on the destination chain.
 */

export const ARC_DOMAIN = 26;

export const CCTP_DESTINATIONS = {
  "ETH-SEPOLIA": { domain: 0, label: "Ethereum Sepolia", relayerWalletId: () => config.CIRCLE_RELAYER_WALLET_ETH_SEPOLIA },
  "BASE-SEPOLIA": { domain: 6, label: "Base Sepolia", relayerWalletId: () => config.CIRCLE_RELAYER_WALLET_BASE_SEPOLIA },
} as const;

export type CctpDestination = keyof typeof CCTP_DESTINATIONS;

/** Standard transfer: wait for hard finality, no fast-transfer fee. */
const MIN_FINALITY_THRESHOLD = 2000;
const MAX_FEE = 0n;

export function addressToBytes32(address: string) {
  return ethers.zeroPadValue(ethers.getAddress(address), 32);
}

export async function burnOnArc(input: {
  walletId: string;
  amount: bigint;
  destination: CctpDestination;
  destinationAddress: string;
  refId: string;
}) {
  const dest = CCTP_DESTINATIONS[input.destination];

  await executeAndWait({
    walletId: input.walletId,
    contractAddress: config.USDC_ADDRESS,
    abiFunctionSignature: "approve(address,uint256)",
    abiParameters: [config.CCTP_TOKEN_MESSENGER_ARC, input.amount.toString()],
    refId: `${input.refId}:approve`,
  });

  return executeAndWait({
    walletId: input.walletId,
    contractAddress: config.CCTP_TOKEN_MESSENGER_ARC,
    abiFunctionSignature: "depositForBurn(uint256,uint32,bytes32,address,bytes32,uint256,uint32)",
    abiParameters: [
      input.amount.toString(),
      String(dest.domain),
      addressToBytes32(input.destinationAddress),
      config.USDC_ADDRESS,
      ethers.ZeroHash, // any relayer may call receiveMessage
      MAX_FEE.toString(),
      String(MIN_FINALITY_THRESHOLD),
    ],
    refId: `${input.refId}:burn`,
  });
}

export async function fetchAttestation(burnTxHash: string): Promise<{ message: string; attestation: string } | null> {
  const res = await fetch(`${config.CCTP_IRIS_API}/v2/messages/${ARC_DOMAIN}?transactionHash=${burnTxHash}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Iris API ${res.status}`);
  const body = (await res.json()) as { messages?: Array<{ status: string; message: string; attestation: string }> };
  const msg = body.messages?.[0];
  if (!msg || msg.status !== "complete" || !msg.attestation || msg.attestation === "PENDING") return null;
  return { message: msg.message, attestation: msg.attestation };
}

export async function mintOnDestination(destination: CctpDestination, message: string, attestation: string, refId: string) {
  const walletId = CCTP_DESTINATIONS[destination].relayerWalletId();
  if (!walletId) throw new Error(`no relayer wallet configured for ${destination}`);
  return executeAndWait({
    walletId,
    contractAddress: config.CCTP_MESSAGE_TRANSMITTER,
    abiFunctionSignature: "receiveMessage(bytes,bytes)",
    abiParameters: [message, attestation],
    refId: `${refId}:mint`,
  });
}

/** Advances in-flight CCTP withdrawals; called by the background worker. */
export async function processPendingWithdrawals() {
  const rows = await query(
    "select * from withdrawals where status = 'burned' and destination_chain <> 'ARC-TESTNET' order by created_at limit 20",
  );
  for (const w of rows) {
    try {
      const att = await fetchAttestation(w.burn_tx_hash);
      if (!att) continue;
      await query("update withdrawals set status = 'attested' where id = $1", [w.id]);
      const { txHash } = await mintOnDestination(w.destination_chain, att.message, att.attestation, w.id);
      await query("update withdrawals set status = 'completed', mint_tx_hash = $2 where id = $1", [w.id, txHash]);
      const user = await one("select id from users where id = $1", [w.user_id]);
      if (user) {
        await query("insert into notifications(user_id, type, payload) values ($1, 'withdrawal_completed', $2)", [
          user.id,
          { withdrawalId: w.id, amount: fromBaseUnits(toBaseUnits(w.amount_usdc)), txHash },
        ]);
      }
    } catch (err) {
      console.error(`withdrawal ${w.id} failed`, err);
      await query("update withdrawals set status = 'failed', error = $2 where id = $1", [w.id, String(err)]);
    }
  }
}
