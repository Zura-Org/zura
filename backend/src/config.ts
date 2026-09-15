import "dotenv/config";
import { z } from "zod";

const optional = z.string().optional().transform((v) => (v ? v : undefined));

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  API_URL: z.string().default("http://localhost:4000"),
  JWT_SECRET: z.string().min(16).default("dev-only-insecure-secret-change-me"),
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/zura"),

  GITHUB_CLIENT_ID: optional,
  GITHUB_CLIENT_SECRET: optional,
  GITHUB_APP_ID: optional,
  GITHUB_APP_PRIVATE_KEY: optional,
  GITHUB_WEBHOOK_SECRET: optional,

  CIRCLE_API_KEY: optional,
  CIRCLE_ENTITY_SECRET: optional,
  CIRCLE_WALLET_SET_ID: optional,
  CIRCLE_ACCOUNT_TYPE: z.enum(["SCA", "EOA"]).default("SCA"),
  CIRCLE_BLOCKCHAIN: z.string().default("ARC-TESTNET"),
  CIRCLE_OPERATOR_WALLET_ID: optional,

  ARC_RPC_URL: z.string().default("https://rpc.testnet.arc.io"),
  ARC_CHAIN_ID: z.coerce.number().default(5042002),
  USDC_ADDRESS: z.string().default("0x3600000000000000000000000000000000000000"),
  WAVE_FACTORY_ADDRESS: optional,
  WAVE_REGISTRY_ADDRESS: optional,
  REPUTATION_BADGE_ADDRESS: optional,

  CCTP_IRIS_API: z.string().default("https://iris-api-sandbox.circle.com"),
  CCTP_TOKEN_MESSENGER_ARC: z.string().default("0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA"),
  CCTP_MESSAGE_TRANSMITTER: z.string().default("0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275"),
  CIRCLE_RELAYER_WALLET_ETH_SEPOLIA: optional,
  CIRCLE_RELAYER_WALLET_BASE_SEPOLIA: optional,

  KYC_REQUIRED: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  DEV_LOGIN: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  WORKER_ENABLED: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
});

export const config = schema.parse(process.env);

if (config.NODE_ENV === "production" && config.JWT_SECRET.startsWith("dev-only")) {
  throw new Error("JWT_SECRET must be set in production");
}

export type Config = typeof config;
