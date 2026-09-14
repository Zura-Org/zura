# Deploying Zura

## 1. Database — Supabase

1. Create a Supabase project and copy the **connection string** (Session pooler) into `DATABASE_URL`.
2. `npm run db:migrate` (Railway also runs this on every deploy).

## 2. Circle

1. https://console.circle.com → API key + entity secret.
2. Create a wallet set → `CIRCLE_WALLET_SET_ID`.
3. Create an **SCA** wallet on `ARC-TESTNET` for the operator → `CIRCLE_OPERATOR_WALLET_ID`.
4. **Gas Station**: enable a sponsorship policy for `ARC-TESTNET` (and `ETH-SEPOLIA` / `BASE-SEPOLIA` for CCTP relayers).
5. CCTP relayers: SCA wallets on Ethereum Sepolia / Base Sepolia → `CIRCLE_RELAYER_WALLET_*`.

## 3. Contracts — ARC testnet

```bash
cd contracts
cp .env.example .env   # DEPLOYER_PRIVATE_KEY (fund it at faucet.circle.com), OPERATOR_ADDRESS, TREASURY_ADDRESS
npm run deploy:testnet
```

Copy `waveFactory`, `waveRegistry`, `reputationBadge` from `deployments/arcTestnet.json` into the backend env.

## 4. GitHub

- **OAuth App** (login): callback `https://<api>/api/auth/github/callback` → `GITHUB_CLIENT_ID/SECRET`.
- **GitHub App** (bot): use `backend/github-app.yml`; webhook URL `https://<api>/api/webhooks/github`,
  set a webhook secret, generate a private key → `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` (newlines as `\n`), `GITHUB_WEBHOOK_SECRET`.

## 5. Backend — Railway

New service from the repo, root directory `/`, config `backend/railway.json`. Set every variable from
`backend/.env.example` with `NODE_ENV=production`, `FRONTEND_URL=https://<vercel-domain>`, `API_URL=https://<railway-domain>`.

## 6. Frontend — Vercel

Import the repo, root directory `frontend`, framework Next.js. Env: `NEXT_PUBLIC_API_URL=https://<railway-domain>`.
