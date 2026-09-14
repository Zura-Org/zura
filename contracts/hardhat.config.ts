import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // OpenZeppelin 5.x relies on MCOPY; ARC's reth-based EVM supports Cancun opcodes.
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhat: {},
    arcTestnet: {
      url: process.env.ARC_RPC_URL || "https://rpc.testnet.arc.io",
      chainId: 5042002,
      accounts: deployerKey ? [deployerKey] : [],
    },
  },
  etherscan: {
    apiKey: { arcTestnet: process.env.ARCSCAN_API_KEY || "empty" },
    customChains: [
      {
        network: "arcTestnet",
        chainId: 5042002,
        urls: {
          apiURL: "https://testnet.arcscan.app/api",
          browserURL: "https://testnet.arcscan.app",
        },
      },
    ],
  },
  sourcify: { enabled: false },
};

export default config;
