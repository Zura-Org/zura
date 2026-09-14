export const COMPLEXITY_POINTS = {
  easy: 100,
  medium: 300,
  hard: 700,
  critical: 1500,
} as const;

export type Complexity = keyof typeof COMPLEXITY_POINTS;

export const LABEL_PREFIX = "zura:";

/** Maps GitHub labels like "zura:hard" to a complexity. Highest complexity wins if several are present. */
export function complexityFromLabels(labels: Array<string | { name?: string }>): Complexity | null {
  const order: Complexity[] = ["critical", "hard", "medium", "easy"];
  const names = new Set(
    labels.map((l) => (typeof l === "string" ? l : l.name ?? "").trim().toLowerCase()),
  );
  return order.find((c) => names.has(`${LABEL_PREFIX}${c}`)) ?? null;
}

/** USDC has 6 decimals on ARC's ERC-20 interface; all on-chain math uses base units (bigint). */
export const USDC_DECIMALS = 6;

export function toBaseUnits(amount: string | number): bigint {
  const [whole, frac = ""] = String(amount).split(".");
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(frac)) throw new Error(`invalid USDC amount: ${amount}`);
  return BigInt(whole) * 10n ** 6n + BigInt(frac.padEnd(USDC_DECIMALS, "0").slice(0, USDC_DECIMALS) || "0");
}

export function fromBaseUnits(units: bigint): string {
  const whole = units / 1_000_000n;
  const frac = (units % 1_000_000n).toString().padStart(6, "0");
  return `${whole}.${frac}`;
}

export const FEE_BPS = 400n;

export function splitDeposit(gross: bigint) {
  const fee = (gross * FEE_BPS) / 10_000n;
  return { fee, net: gross - fee };
}

export interface Allocation {
  contributorId: string;
  walletAddress: string;
  points: number;
  amount: bigint;
}

/** Mirrors WavePool.distribute(): proportional shares, dust to the last recipient. */
export function allocate(
  pool: bigint,
  rows: Array<{ contributorId: string; walletAddress: string; points: number }>,
): Allocation[] {
  const eligible = rows.filter((r) => r.points > 0);
  const total = BigInt(eligible.reduce((s, r) => s + r.points, 0));
  if (total === 0n) return [];
  let sent = 0n;
  return eligible.map((r, i) => {
    const amount = i === eligible.length - 1 ? pool - sent : (pool * BigInt(r.points)) / total;
    sent += amount;
    return { ...r, amount };
  });
}
