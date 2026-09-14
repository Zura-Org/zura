const EXPLORER = process.env.NEXT_PUBLIC_ARC_EXPLORER ?? "https://testnet.arcscan.app";

export function usdc(value: string | number | null | undefined, digits = 2) {
  const n = Number(value ?? 0);
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function compactUsdc(value: string | number | null | undefined) {
  const n = Number(value ?? 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return usdc(n, n % 1 === 0 ? 0 : 2);
}

export function shortAddress(addr: string | null | undefined) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "—";
}

export function timeLeft(end: string | null | undefined, now = Date.now()) {
  if (!end) return "—";
  const ms = new Date(end).getTime() - now;
  if (ms <= 0) return "Ended";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function date(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
}

export const explorerTx = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const explorerAddress = (addr: string) => `${EXPLORER}/address/${addr}`;

export const WAVE_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  deploying: "Deploying",
  pending_funding: "Awaiting funds",
  active: "Live",
  ended: "Ended",
  distributing: "Paying out",
  distributed: "Paid out",
  refund_available: "Refund available",
  refunded: "Refunded",
  failed: "Failed",
};
