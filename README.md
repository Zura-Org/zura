# Zura

**Contributor rewards infrastructure for the ARC ecosystem.** Project owners fund Waves in USDC, contributors earn USDC for merged PRs, and everything settles on ARC via Circle Wallets, Gas Station and CCTP.

| Side | What they do |
| --- | --- |
| Project owners | Submit an ARC project, fund a 7/14/30-day **Wave** with USDC, tag GitHub issues by complexity, approve applicants |
| Contributors | Browse ARC projects, apply to issues, open PRs, earn points on merge, receive USDC when the Wave ends |
| Zura | Takes a 4% fee on every Wave pool, deducted by the escrow contract at deposit |

## Repository layout

```
contracts/   Solidity (Hardhat): WavePool, WaveFactory, WaveRegistry, ReputationBadge
backend/     Node.js + Express API, GitHub App webhook bot, Circle integrations, PostgreSQL
frontend/    Next.js 14 + Tailwind web app
```

## ARC testnet

| | |
| --- | --- |
| Chain ID | `5042002` |
| RPC | `https://rpc.testnet.arc.io` |
| Explorer | https://testnet.arcscan.app |
| USDC (ERC-20 interface, 6 decimals) | `0x3600000000000000000000000000000000000000` |
| CCTP domain | `26` |
| TokenMessengerV2 | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` |
| Faucet | https://faucet.circle.com |

USDC is ARC's native gas token (18 decimals natively); contracts only use the 6-decimal ERC-20 interface.

## Smart contracts

- **WaveFactory** – permissionless `createWave(waveId, projectId, durationDays)`; deploys a `WavePool` and registers it.
- **WavePool** – `deposit(amount)` sends 4% to the treasury and locks the rest; `distribute(contributors, points, totalPoints)` pays proportional shares after the Wave ends; `emergencyRefund()` returns funds when there were zero contributions (operator-confirmed, or automatically after a 7-day grace period).
- **WaveRegistry** – `createWave(...)` / `getWave(waveId)` on-chain index with live pool status.
- **ReputationBadge** – soul-bound ERC-721 (EIP-5192) with fully on-chain metadata: total USDC earned and merge count.

```bash
npm install
npm run contracts:test
cp contracts/.env.example contracts/.env   # fill DEPLOYER_PRIVATE_KEY, OPERATOR_ADDRESS, TREASURY_ADDRESS
npm run contracts:deploy
```

## Running locally

```bash
npm install
cp backend/.env.example backend/.env && cp frontend/.env.example frontend/.env.local
npm run db:migrate
npm run backend:dev    # :4000
npm run frontend:dev   # :3000
```

See [backend/README.md](backend/README.md) for the API and bot, and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Supabase, Circle, ARC, GitHub App, Railway and Vercel setup.

## Milestones

1. **Foundation** – contracts on ARC testnet, Circle Wallets, GitHub OAuth, project submission
2. **Core product** – Wave funding, GitHub bot, dashboards + leaderboard, Gas Station
3. **Full platform** – KYC, CCTP withdrawals, reputation SBT, first live testnet Wave, demo video
4. **Mainnet** – ARC mainnet deploy, first 5 ecosystem projects, first real USDC payouts

## License

MIT
