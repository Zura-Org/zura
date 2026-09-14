import Link from "next/link";
import { usdc } from "@/lib/format";
import type { LeaderboardRow } from "@/lib/types";
import { Avatar, Empty } from "./ui";

export function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
  if (!rows.length) {
    return <Empty title="No merged contributions yet">Points appear here the moment a tagged PR merges.</Empty>;
  }
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="border-b border-ink-800 text-left text-xs uppercase tracking-wide text-mist-400">
            <th className="px-4 py-3 font-medium">#</th>
            <th className="px-4 py-3 font-medium">Contributor</th>
            <th className="px-4 py-3 text-right font-medium">PRs</th>
            <th className="px-4 py-3 text-right font-medium">Points</th>
            <th className="px-4 py-3 text-right font-medium">Est. payout</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.githubUsername} className="border-b border-ink-800/60 last:border-0">
              <td className="num px-4 py-3 text-mist-400">{r.rank}</td>
              <td className="px-4 py-3">
                <Link href={`/contributor/${r.githubUsername}`} className="flex items-center gap-2 text-white hover:text-zura-400">
                  <Avatar src={r.avatarUrl} name={r.githubUsername} size={24} />
                  {r.githubUsername}
                </Link>
              </td>
              <td className="num px-4 py-3 text-right text-mist-300">{r.merged}</td>
              <td className="num px-4 py-3 text-right font-medium text-white">{r.points.toLocaleString()}</td>
              <td className="num px-4 py-3 text-right font-medium text-usdc">{usdc(r.estimatedUsdc)} USDC</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
