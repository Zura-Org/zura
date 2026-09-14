import { ethers } from "ethers";
import { config } from "../config.js";

export const provider = new ethers.JsonRpcProvider(config.ARC_RPC_URL, config.ARC_CHAIN_ID, { staticNetwork: true });

export const WAVE_POOL_ABI = [
  "function status() view returns (uint8)",
  "function owner() view returns (address)",
  "function endTime() view returns (uint256)",
  "function lockedAmount() view returns (uint256)",
  "function totalDeposited() view returns (uint256)",
  "function totalFees() view returns (uint256)",
  "event Deposited(address indexed from, uint256 gross, uint256 fee, uint256 net)",
];

export const WAVE_REGISTRY_ABI = [
  "function waveExists(string waveId) view returns (bool)",
  "function getWave(string waveId) view returns (tuple(string waveId, string projectId, address pool, address owner, uint256 startTime, uint256 endTime, uint8 status, uint256 lockedAmount, uint256 totalDeposited))",
];

export const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];

export const POOL_STATUS = ["pending", "funded", "distributed", "refunded"] as const;

export async function readPool(address: string) {
  const pool = new ethers.Contract(address, WAVE_POOL_ABI, provider);
  const [status, owner, endTime, lockedAmount, totalDeposited, totalFees] = await Promise.all([
    pool.status(),
    pool.owner(),
    pool.endTime(),
    pool.lockedAmount(),
    pool.totalDeposited(),
    pool.totalFees(),
  ]);
  return {
    status: POOL_STATUS[Number(status)],
    owner: owner as string,
    endTime: new Date(Number(endTime) * 1000),
    lockedAmount: lockedAmount as bigint,
    totalDeposited: totalDeposited as bigint,
    totalFees: totalFees as bigint,
  };
}

export async function getRegisteredPool(waveId: string): Promise<string | null> {
  if (!config.WAVE_REGISTRY_ADDRESS) throw new Error("WAVE_REGISTRY_ADDRESS not configured");
  const registry = new ethers.Contract(config.WAVE_REGISTRY_ADDRESS, WAVE_REGISTRY_ABI, provider);
  if (!(await registry.waveExists(waveId))) return null;
  const wave = await registry.getWave(waveId);
  return wave.pool as string;
}

export async function usdcBalance(address: string): Promise<bigint> {
  const usdc = new ethers.Contract(config.USDC_ADDRESS, ERC20_ABI, provider);
  return usdc.balanceOf(address);
}

export function explorerTx(hash: string) {
  return `https://testnet.arcscan.app/tx/${hash}`;
}
