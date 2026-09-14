"use client";

import Link from "next/link";
import { RequireAuth } from "@/components/RequireAuth";
import { Button, Empty, PageHeader, Spinner, StatusPill } from "@/components/ui";
import { useApi } from "@/lib/api";
import { date, timeLeft, usdc } from "@/lib/format";
import type { Project } from "@/lib/types";

interface Notification {
  id: string;
  type: string;
  payload: Record<string, any>;
  read: boolean;
  created_at: string;
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  );
}

function describe(n: Notification) {
  const p = n.payload;
  switch (n.type) {
    case "new_application":
      return `${p.applicant} applied to “${p.title}”`;
    case "pr_submitted":
      return `${p.author} opened a PR for “${p.issueTitle}”`;
    case "issue_assigned":
      return `You were assigned “${p.title}” (${p.points} pts)`;
    case "points_awarded":
      return `+${p.points} points for a merged PR`;
    case "payout_sent":
      return `${usdc(p.amount)} USDC paid to your wallet`;
    case "withdrawal_completed":
      return `Withdrawal of ${usdc(p.amount)} USDC completed`;
    default:
      return n.type;
  }
}

function Dashboard() {
  const projects = useApi<{ projects: Project[] }>("/api/projects/mine");
  const notes = useApi<{ notifications: Notification[] }>("/api/wallet/notifications");

  return (
    <div className="container-z py-10">
      <PageHeader
        title="Dashboard"
        subtitle="Your projects, Waves and activity."
        actions={
          <>
            <Button variant="secondary" href="/projects/new">Submit project</Button>
            <Button href="/waves/create">Launch a Wave</Button>
          </>
        }
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <section>
          <h2 className="mb-4 text-lg font-semibold text-white">Your projects</h2>
          {projects.loading && !projects.data ? (
            <div className="flex justify-center py-12 text-mist-400"><Spinner /></div>
          ) : projects.data?.projects.length ? (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-ink-800 text-left text-xs uppercase tracking-wide text-mist-400">
                    <th className="px-4 py-3 font-medium">Project</th>
                    <th className="px-4 py-3 font-medium">Wave</th>
                    <th className="px-4 py-3 text-right font-medium">Pool</th>
                    <th className="px-4 py-3 text-right font-medium">Open issues</th>
                    <th className="px-4 py-3 text-right font-medium">Ends</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.data.projects.map((p) => (
                    <tr key={p.id} className="border-b border-ink-800/60 last:border-0">
                      <td className="px-4 py-3">
                        <Link href={`/projects/${p.id}`} className="font-medium text-white hover:text-zura-400">{p.name}</Link>
                        <div className="font-mono text-xs text-mist-400">{p.repo_full_name}</div>
                      </td>
                      <td className="px-4 py-3">
                        {p.wave ? (
                          <Link href={`/waves/${p.wave.id}`}><StatusPill status={p.wave.status} /></Link>
                        ) : (
                          <Link href={`/waves/create?projectId=${p.id}`} className="text-xs text-zura-400 hover:underline">Launch Wave</Link>
                        )}
                      </td>
                      <td className="num px-4 py-3 text-right text-usdc">{p.wave ? `${usdc(p.wave.pool_amount, 0)} USDC` : "—"}</td>
                      <td className="num px-4 py-3 text-right text-white">{p.wave?.open_issues ?? "—"}</td>
                      <td className="num px-4 py-3 text-right text-mist-300">{p.wave?.status === "active" ? timeLeft(p.wave.end_time) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="No projects yet">
              Submit your ARC project, then install the{" "}
              <a href="https://github.com/apps/zura-bot" className="text-zura-400 hover:underline">Zura GitHub App</a> on the repo.
            </Empty>
          )}
        </section>

        <aside>
          <h2 className="mb-4 text-lg font-semibold text-white">Activity</h2>
          {notes.data?.notifications.length ? (
            <ul className="card divide-y divide-ink-800 text-sm">
              {notes.data.notifications.map((n) => (
                <li key={n.id} className="p-4">
                  <div className={n.read ? "text-mist-300" : "text-white"}>{describe(n)}</div>
                  <div className="mt-0.5 text-xs text-mist-400">{date(n.created_at)}</div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Nothing yet">Applications, PRs and payouts will show up here.</Empty>
          )}
        </aside>
      </div>
    </div>
  );
}
