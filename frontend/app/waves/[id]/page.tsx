"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Countdown } from "@/components/Countdown";
import { IssueList } from "@/components/IssueList";
import { Leaderboard } from "@/components/Leaderboard";
import { Button, ErrorNote, Spinner, Stat, StatusPill } from "@/components/ui";
import { api, API_URL, getToken, useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, explorerAddress, explorerTx, shortAddress, usdc } from "@/lib/format";
import type { Issue, LeaderboardRow, Wave } from "@/lib/types";

interface WaveResponse {
  wave: Wave;
  issues: Issue[];
  stats: { contributors: number; merged: number; points: number };
}

export default function WaveDashboard() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi<WaveResponse>(`/api/waves/${id}`);
  const board = useApi<{ leaderboard: LeaderboardRow[] }>(`/api/waves/${id}/leaderboard`);
  const [tab, setTab] = useState<"issues" | "leaderboard">("issues");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [topUp, setTopUp] = useState("");

  if (loading && !data) return <div className="flex justify-center py-24 text-mist-400"><Spinner /></div>;
  if (error || !data) return <div className="container-z py-10"><ErrorNote error={error ?? "Wave not found"} /></div>;

  const { wave, issues, stats } = data;
  const isOwner = user?.id === wave.owner_id;
  const ended = wave.end_time ? new Date(wave.end_time) <= new Date() : false;

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setActionError(null);
    try {
      await fn();
      await Promise.all([reload(), board.reload()]);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function downloadCsv() {
    const res = await fetch(`${API_URL}/api/waves/${wave.id}/report.csv`, {
      credentials: "include",
      headers: getToken() ? { authorization: `Bearer ${getToken()}` } : {},
    });
    if (!res.ok) return setActionError("Could not generate report");
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `zura-wave-${wave.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="container-z py-10">
      <div className="flex flex-col gap-4 border-b border-ink-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href={`/projects/${wave.project_id}`} className="text-sm text-mist-400 hover:text-white">← {wave.project_name}</Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{wave.duration_days}-day Wave</h1>
            <StatusPill status={wave.status} />
          </div>
          <p className="mt-1.5 text-sm text-mist-400">
            {date(wave.start_time)} → {date(wave.end_time)}
            {wave.contract_address && (
              <>
                {" · "}Pool{" "}
                <a href={explorerAddress(wave.contract_address)} className="font-mono text-mist-300 hover:text-white">
                  {shortAddress(wave.contract_address)}
                </a>
              </>
            )}
            {wave.tx_hash && (
              <>
                {" · "}
                <a href={explorerTx(wave.tx_hash)} className="text-mist-300 hover:text-white">last tx ↗</a>
              </>
            )}
          </p>
        </div>
        {isOwner && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={downloadCsv}>Download CSV</Button>
            {wave.status === "pending_funding" && (
              <Button size="sm" loading={busy === "sync"} onClick={() => run("sync", () => api(`/api/waves/${wave.id}/fund`, { method: "POST", json: { syncOnly: true } }))}>
                Sync funding from ARC
              </Button>
            )}
            {["active", "ended"].includes(wave.status) && ended && (
              <Button size="sm" loading={busy === "payout"} onClick={() => run("payout", () => api(`/api/payouts/trigger/${wave.id}`, { method: "POST" }))}>
                Distribute payouts
              </Button>
            )}
          </div>
        )}
      </div>

      <ErrorNote error={actionError} />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Reward pool" value={`${usdc(wave.pool_amount)} USDC`} accent sub={`${usdc(wave.fee_amount)} USDC platform fee`} />
        <Stat label="Time left" value={wave.status === "active" ? <Countdown end={wave.end_time} /> : "—"} />
        <Stat label="Merged PRs" value={stats.merged} sub={`${stats.contributors} contributors`} />
        <Stat
          label="Points awarded"
          value={stats.points.toLocaleString()}
          sub={stats.points ? `≈ ${usdc(Number(wave.pool_amount) / stats.points, 4)} USDC / pt` : "No points yet"}
        />
      </div>

      {isOwner && ["pending_funding", "active"].includes(wave.status) && !ended && (
        <div className="card mt-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex-1 text-sm text-mist-300">Top up the pool from your Circle wallet (4% fee applies).</div>
          <input className="input num sm:w-40" placeholder="Amount USDC" value={topUp} onChange={(e) => setTopUp(e.target.value.replace(/[^\d.]/g, ""))} />
          <Button
            size="md"
            loading={busy === "fund"}
            disabled={!topUp}
            onClick={() => run("fund", () => api(`/api/waves/${wave.id}/fund`, { method: "POST", json: { amount: topUp } }).then(() => setTopUp("")))}
          >
            Deposit
          </Button>
        </div>
      )}

      <div className="mt-10 flex gap-1 border-b border-ink-800">
        {(["issues", "leaderboard"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm capitalize transition ${tab === t ? "border-zura text-white" : "border-transparent text-mist-400 hover:text-white"}`}
          >
            {t} {t === "issues" && <span className="num text-mist-400">({issues.length})</span>}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {tab === "issues" ? (
          <IssueList issues={issues} isOwner={isOwner} onChange={reload} />
        ) : (
          <Leaderboard rows={board.data?.leaderboard ?? []} />
        )}
      </div>
    </div>
  );
}
