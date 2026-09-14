"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { GithubIcon } from "@/components/Nav";
import { Avatar, ComplexityBadge, Empty, ErrorNote, Spinner, Stat } from "@/components/ui";
import { useApi } from "@/lib/api";
import { date, explorerAddress, explorerTx, shortAddress, usdc } from "@/lib/format";
import type { Complexity } from "@/lib/types";

interface ProfileResponse {
  contributor: { github_username: string; avatar_url: string | null; wallet_address: string | null; created_at: string };
  stats: { points: number; merged: number; earned_usdc: string; waves: number };
  contributions: Array<{
    pr_url: string;
    points_awarded: number;
    merged_at: string;
    title: string;
    complexity: Complexity;
    project_id: string;
    project_name: string;
  }>;
  payouts: Array<{ amount_usdc: string; tx_hash: string | null; status: string; created_at: string; project_name: string }>;
}

export default function ContributorProfile() {
  const { username } = useParams<{ username: string }>();
  const { data, error, loading } = useApi<ProfileResponse>(`/api/contributors/${username}`);

  if (loading && !data) return <div className="flex justify-center py-24 text-mist-400"><Spinner /></div>;
  if (error || !data) return <div className="container-z py-10"><ErrorNote error={error ?? "Contributor not found"} /></div>;

  const { contributor: c, stats, contributions, payouts } = data;

  return (
    <div className="container-z py-10">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar src={c.avatar_url} name={c.github_username} size={72} />
        <div>
          <h1 className="text-2xl font-semibold text-white">{c.github_username}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-mist-400">
            <a href={`https://github.com/${c.github_username}`} className="inline-flex items-center gap-1.5 hover:text-white">
              <GithubIcon className="h-3.5 w-3.5" /> GitHub
            </a>
            {c.wallet_address && (
              <a href={explorerAddress(c.wallet_address)} className="font-mono hover:text-white">{shortAddress(c.wallet_address)}</a>
            )}
            <span>Joined {date(c.created_at)}</span>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Earned" value={`${usdc(stats.earned_usdc)} USDC`} accent />
        <Stat label="Merged PRs" value={stats.merged} />
        <Stat label="Points" value={stats.points.toLocaleString()} />
        <Stat label="Waves" value={stats.waves} />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_340px]">
        <section>
          <h2 className="mb-4 text-lg font-semibold text-white">Contributions</h2>
          {contributions.length ? (
            <div className="card divide-y divide-ink-800">
              {contributions.map((k) => (
                <div key={k.pr_url} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <a href={k.pr_url} className="font-medium text-white hover:text-zura-400">{k.title}</a>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-mist-400">
                      <Link href={`/projects/${k.project_id}`} className="hover:text-white">{k.project_name}</Link>
                      <span>· {date(k.merged_at)}</span>
                    </div>
                  </div>
                  <ComplexityBadge complexity={k.complexity} points={k.points_awarded} />
                </div>
              ))}
            </div>
          ) : (
            <Empty title="No merged contributions yet" />
          )}
        </section>
        <aside>
          <h2 className="mb-4 text-lg font-semibold text-white">Payouts</h2>
          {payouts.length ? (
            <div className="card divide-y divide-ink-800 text-sm">
              {payouts.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-4">
                  <div>
                    <div className="text-white">{p.project_name}</div>
                    <div className="text-xs text-mist-400">{date(p.created_at)}</div>
                  </div>
                  <div className="text-right">
                    <div className="num font-medium text-usdc">{usdc(p.amount_usdc)} USDC</div>
                    {p.tx_hash && <a href={explorerTx(p.tx_hash)} className="text-xs text-mist-400 hover:text-white">view tx ↗</a>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="No payouts yet" />
          )}
        </aside>
      </div>
    </div>
  );
}
