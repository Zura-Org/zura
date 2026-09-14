import crypto from "node:crypto";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { config } from "../config.js";

/**
 * Circle Developer-Controlled Wallets.
 *
 * Every Zura user gets an SCA (smart contract account) wallet on ARC. SCA wallets are covered by
 * Circle Gas Station: once a sponsorship policy is enabled for ARC-TESTNET in the Circle console,
 * every transaction below (Wave creation, funding, withdrawals, CCTP burns) has its gas paid by
 * Zura's paymaster, so contributors never need to hold USDC just for gas.
 */

type Client = ReturnType<typeof initiateDeveloperControlledWalletsClient>;
let client: Client | undefined;

export function isCircleConfigured() {
  return Boolean(config.CIRCLE_API_KEY && config.CIRCLE_ENTITY_SECRET && config.CIRCLE_WALLET_SET_ID);
}

export function circle(): Client {
  if (!config.CIRCLE_API_KEY || !config.CIRCLE_ENTITY_SECRET) {
    throw new Error("Circle API key / entity secret not configured");
  }
  client ??= initiateDeveloperControlledWalletsClient({
    apiKey: config.CIRCLE_API_KEY,
    entitySecret: config.CIRCLE_ENTITY_SECRET,
  });
  return client;
}

const FEE = { type: "level", config: { feeLevel: "MEDIUM" } } as const;

export async function createUserWallet(refId: string, blockchain = config.CIRCLE_BLOCKCHAIN) {
  if (!config.CIRCLE_WALLET_SET_ID) throw new Error("CIRCLE_WALLET_SET_ID not configured");
  const res = await circle().createWallets({
    walletSetId: config.CIRCLE_WALLET_SET_ID,
    blockchains: [blockchain as any],
    count: 1,
    accountType: config.CIRCLE_ACCOUNT_TYPE,
    metadata: [{ name: `zura:${refId}`, refId }],
    idempotencyKey: crypto.randomUUID(),
  });
  const wallet = res.data?.wallets?.[0];
  if (!wallet) throw new Error("Circle did not return a wallet");
  return { id: wallet.id, address: wallet.address };
}

export async function executeContract(input: {
  walletId: string;
  contractAddress: string;
  abiFunctionSignature: string;
  abiParameters: unknown[];
  refId?: string;
}): Promise<string> {
  const res = await circle().createContractExecutionTransaction({
    walletId: input.walletId,
    contractAddress: input.contractAddress,
    abiFunctionSignature: input.abiFunctionSignature,
    abiParameters: input.abiParameters as any[],
    refId: input.refId,
    fee: FEE as any,
    idempotencyKey: crypto.randomUUID(),
  });
  const id = res.data?.id;
  if (!id) throw new Error(`Circle rejected ${input.abiFunctionSignature}`);
  return id;
}

export async function transferUsdc(walletId: string, destinationAddress: string, amount: string, refId?: string) {
  const res = await circle().createTransaction({
    walletId,
    destinationAddress,
    amount: [amount],
    tokenAddress: config.USDC_ADDRESS,
    blockchain: config.CIRCLE_BLOCKCHAIN as any,
    refId,
    fee: FEE as any,
    idempotencyKey: crypto.randomUUID(),
  });
  const id = res.data?.id;
  if (!id) throw new Error("Circle rejected USDC transfer");
  return id;
}

const TERMINAL_FAILURES = new Set(["FAILED", "CANCELLED", "DENIED"]);

export async function waitForTransaction(id: string, timeoutMs = 180_000): Promise<{ txHash: string }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await circle().getTransaction({ id });
    const tx = res.data?.transaction;
    if (tx?.state === "COMPLETE" || tx?.state === "CONFIRMED") {
      if (tx.txHash) return { txHash: tx.txHash };
    }
    if (tx?.state && TERMINAL_FAILURES.has(tx.state)) {
      throw new Error(`Circle transaction ${id} ${tx.state}: ${tx.errorReason ?? "unknown reason"}`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Circle transaction ${id} timed out`);
}

export async function executeAndWait(input: Parameters<typeof executeContract>[0]) {
  const id = await executeContract(input);
  const { txHash } = await waitForTransaction(id);
  return { circleTxId: id, txHash };
}

/** USDC balance of a Circle wallet as a decimal string. */
export async function walletUsdcBalance(walletId: string): Promise<string> {
  const res = await circle().getWalletTokenBalance({ id: walletId });
  const usdc = res.data?.tokenBalances?.find(
    (b) => b.token?.symbol === "USDC" || b.token?.tokenAddress?.toLowerCase() === config.USDC_ADDRESS.toLowerCase(),
  );
  return usdc?.amount ?? "0";
}
