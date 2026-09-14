# Zura backend

Express API, GitHub App webhook bot and background settlement worker.

```bash
cp .env.example .env
npm run migrate      # applies db/migrations to DATABASE_URL (Supabase works)
npm run dev          # http://localhost:4000
npm test
```

## Circle setup

1. Create an API key and register an entity secret at https://console.circle.com.
2. Create a wallet set; put its id in `CIRCLE_WALLET_SET_ID`.
3. Create an **SCA** wallet on `ARC-TESTNET` for the Zura operator, fund nothing - then enable a
   **Gas Station** policy for ARC-TESTNET so every SCA wallet's gas is sponsored.
4. Deploy the contracts with `OPERATOR_ADDRESS` = that wallet's address; set `CIRCLE_OPERATOR_WALLET_ID`.
5. For CCTP, create SCA relayer wallets on `ETH-SEPOLIA` / `BASE-SEPOLIA` (Gas Station enabled there too).

## API

| Method | Route | Notes |
| --- | --- | --- |
| GET | `/api/auth/github` | GitHub OAuth login; creates a Circle wallet on first login |
| GET | `/api/auth/me` | Current user |
| GET | `/api/projects` | Browse; filters `q, language, type, complexity, minPoints, activeOnly` |
| POST | `/api/projects` | Submit an ARC project |
| GET | `/api/projects/:id` | Project, Waves, current issues |
| POST | `/api/waves/create` | `{ projectId, durationDays }` → deploys WavePool via WaveFactory |
| POST | `/api/waves/:id/fund` | `{ amount }` approve + deposit from owner's Circle wallet, or `{ syncOnly: true }` |
| GET | `/api/waves/:id` | Wave dashboard data |
| GET | `/api/waves/:id/leaderboard` | Points, merges, estimated USDC share |
| GET | `/api/waves/:id/report.csv` | Post-Wave report (owner) |
| POST | `/api/issues/apply` | `{ issueId, note? }` |
| GET | `/api/issues/:id/applications` | Owner only |
| POST | `/api/issues/:id/assign` | `{ applicationId }`; mirrors assignment on GitHub |
| GET | `/api/contributors/:githubUsername` | Public profile |
| POST | `/api/payouts/trigger/:waveId` | Settle an ended Wave (worker also does this automatically) |
| GET | `/api/wallet` | Balance, payouts, pending Waves, withdrawals |
| POST | `/api/wallet/withdraw` | `{ destinationChain, destinationAddress, amount }` ARC transfer or CCTP |
| POST | `/api/webhooks/github` | GitHub App webhooks (HMAC verified) |

## GitHub bot

Label issues `zura:easy` (100), `zura:medium` (300), `zura:hard` (700) or `zura:critical` (1500).
On a merged PR that references a tracked issue (`Fixes #12`), the bot checks that the Wave is active,
CI passed, the issue is still labeled, the author is the assigned contributor and the diff is not
whitespace/lockfile-only - then awards points and comments on the PR.
