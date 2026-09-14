"use client";

import { useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Button, Empty, ErrorNote, PageHeader, Spinner, Stat } from "@/components/ui";
import { api, useApi } from "@/lib/api";
import { date, explorerAddress, explorerTx, shortAddress, timeLeft, usdc } from "@/lib/format";

interface WalletResponse {
  walletAddress: string | null;
  kycStatus: string;
  kycRequired: boolean;
  balanceUsdc: string | null;
  payouts: Array<{ id: string; project_name: string; amount_usdc: string; points: number; status: string; tx_hash: string | null; created_at: string }>;
  withdrawals: Array<{ id: string; destination_chain: string; destination_address: string; amount_usdc: string; status: string; burn_tx_hash: string | null; created_at: string; error: string | null }>;
  pendingWaves: Array<{ wave_id: string; project_name: string; end_time: string; pool_amount: string; points: number; wave_points: number }>;
  withdrawChains: Array<{ id: string; label: string; enabled: boolean }>;
}

export default function WalletPage() {
  return (
    <RequireAuth>
      <Wallet />
    </RequireAuth>
  );
}

function Wallet() {
  const { data, error, loading, reload } = useApi<WalletResponse>("/api/wallet");
  const [chain, setChain] = useState("ARC-TESTNET");
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (loading && !data) return <div className="flex justify-center py-24 text-mist-400"><Spinner /></div>;
  if (error || !data) return <div className="container-z py-10"><ErrorNote error={error} /></div>;

  const earned = data.payouts.filter((p) => p.status === "confirmed").reduce((s, p) => s + Number(p.amount_usdc), 0);
  const pendingEstimate = data.pendingWaves.reduce((s, w) => s + (w.wave_points ? (Number(w.pool_amount) * w.points) / w.wave_points : 0), 0);
  const kycBlocked = data.kycRequired && data.kycStatus !== "approved";

  async function withdraw(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await api("/api/wallet/withdraw", { method: "POST", json: { destinationChain: chain, destinationAddress: address, amount } });
      setAmount("");
      await reload();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!data?.walletAddress) return;
    try {
      await navigator.clipboard.writeText(data.walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <div className="container-z py-10">
      <PageHeader title="Wallet" subtitle="Your Circle wallet on ARC. Gas is sponsored by Zura." />

      <div className="card mt-8 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="label">Payout address · ARC Testnet</div>
          {data.walletAddress ? (
            <a href={explorerAddress(data.walletAddress)} className="break-all font-mono text-sm text-white hover:text-zura-400">{data.walletAddress}</a>
          ) : (
            <span className="text-sm text-mist-400">Wallet not created yet</span>
          )}
        </div>
        {data.walletAddress ? (
          <Button variant="secondary" size="sm" onClick={copy}>{copied ? "Copied" : "Copy address"}</Button>
        ) : (
          <Button size="sm" onClick={() => api("/api/auth/wallet", { method: "POST" }).then(reload).catch((e) => setFormError(e.message))}>
            Create wallet
          </Button>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Stat label="Available balance" value={data.balanceUsdc !== null ? `${usdc(data.balanceUsdc)} USDC` : "—"} accent />
        <Stat label="Lifetime earned" value={`${usdc(earned)} USDC`} />
        <Stat label="Pending (est.)" value={`${usdc(pendingEstimate)} USDC`} sub={`${data.pendingWaves.length} Wave${data.pendingWaves.length === 1 ? "" : "s"} in progress`} />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          {data.pendingWaves.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-white">In progress</h2>
              <div className="card divide-y divide-ink-800 text-sm">
                {data.pendingWaves.map((w) => (
                  <a key={w.wave_id} href={`/waves/${w.wave_id}`} className="flex items-center justify-between p-4 hover:bg-ink-850">
                    <div>
                      <div className="text-white">{w.project_name}</div>
                      <div className="text-xs text-mist-400">{w.points} pts · ends in {timeLeft(w.end_time)}</div>
                    </div>
                    <div className="num text-usdc">≈ {usdc(w.wave_points ? (Number(w.pool_amount) * w.points) / w.wave_points : 0)} USDC</div>
                  </a>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-4 text-lg font-semibold text-white">Payouts</h2>
            {data.payouts.length ? (
              <div className="card divide-y divide-ink-800 text-sm">
                {data.payouts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-4">
                    <div>
                      <div className="text-white">{p.project_name}</div>
                      <div className="text-xs text-mist-400">{p.points} pts · {date(p.created_at)} · {p.status}</div>
                    </div>
                    <div className="text-right">
                      <div className="num font-medium text-usdc">+{usdc(p.amount_usdc)} USDC</div>
                      {p.tx_hash && <a href={explorerTx(p.tx_hash)} className="text-xs text-mist-400 hover:text-white">tx ↗</a>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty title="No payouts yet">Merge a PR on a tagged issue — USDC arrives here when the Wave ends.</Empty>
            )}
          </section>

          <section>
            <h2 className="mb-4 text-lg font-semibold text-white">Withdrawals</h2>
            {data.withdrawals.length ? (
              <div className="card divide-y divide-ink-800 text-sm">
                {data.withdrawals.map((w) => (
                  <div key={w.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <div className="text-white">{w.destination_chain} · <span className="font-mono">{shortAddress(w.destination_address)}</span></div>
                      <div className="truncate text-xs text-mist-400">{date(w.created_at)} · {w.status}{w.error ? ` · ${w.error}` : ""}</div>
                    </div>
                    <div className="text-right">
                      <div className="num text-white">−{usdc(w.amount_usdc)} USDC</div>
                      {w.burn_tx_hash && <a href={explorerTx(w.burn_tx_hash)} className="text-xs text-mist-400 hover:text-white">tx ↗</a>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty title="No withdrawals yet" />
            )}
          </section>
        </div>

        <aside className="card h-fit p-5">
          <h2 className="font-semibold text-white">Withdraw USDC</h2>
          <p className="mt-1 text-xs text-mist-400">Send to any ARC address, or cross-chain via Circle CCTP — native USDC, no wrapped tokens.</p>
          {kycBlocked ? (
            <div className="mt-5 space-y-3 text-sm">
              <p className="text-mist-300">Identity verification is required before withdrawing. Status: <span className="text-white">{data.kycStatus}</span></p>
              {data.kycStatus === "none" && (
                <Button size="sm" onClick={() => api("/api/wallet/kyc", { method: "POST" }).then(reload)}>Start verification</Button>
              )}
            </div>
          ) : (
            <form onSubmit={withdraw} className="mt-5 space-y-4">
              <div>
                <label className="label" htmlFor="chain">Destination</label>
                <select id="chain" className="input" value={chain} onChange={(e) => setChain(e.target.value)}>
                  {data.withdrawChains.map((c) => (
                    <option key={c.id} value={c.id} disabled={!c.enabled}>{c.label}{c.enabled ? "" : " (coming soon)"}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="address">Recipient address</label>
                <input id="address" className="input font-mono text-xs" required placeholder="0x…" value={address} onChange={(e) => setAddress(e.target.value.trim())} />
              </div>
              <div>
                <label className="label" htmlFor="withdraw-amount">Amount (USDC)</label>
                <div className="flex gap-2">
                  <input id="withdraw-amount" className="input num" required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
                  <Button type="button" variant="secondary" onClick={() => setAmount(data.balanceUsdc ?? "0")}>Max</Button>
                </div>
              </div>
              <ErrorNote error={formError} />
              <Button type="submit" className="w-full" loading={busy} disabled={!data.walletAddress}>
                {chain === "ARC-TESTNET" ? "Send on ARC" : "Burn on ARC & mint via CCTP"}
              </Button>
              {chain !== "ARC-TESTNET" && (
                <p className="text-xs text-mist-400">CCTP standard transfers wait for ARC finality and Circle&apos;s attestation, then mint on the destination chain automatically.</p>
              )}
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
