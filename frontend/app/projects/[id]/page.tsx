"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Countdown } from "@/components/Countdown";
import { IssueList } from "@/components/IssueList";
import { GithubIcon } from "@/components/Nav";
import { Avatar, Button, ErrorNote, Spinner, Stat, StatusPill } from "@/components/ui";
import { useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { usdc } from "@/lib/format";
import type { Issue, Project, Wave } from "@/lib/types";

interface ProjectResponse {
  project: Project & { owner_id: string; arc_usage: string };
  waves: Wave[];
  currentWave: Wave | null;
  issues: Issue[];
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi<ProjectResponse>(`/api/projects/${id}`);

  if (loading && !data) return <div className="flex justify-center py-24 text-mist-400"><Spinner /></div>;
  if (error || !data) return <div className="container-z py-10"><ErrorNote error={error ?? "Project not found"} /></div>;

  const { project, currentWave: wave, issues } = data;
  const isOwner = user?.id === project.owner_id;
  const open = issues.filter((i) => i.status === "open").length;

  return (
    <div className="container-z py-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <Avatar src={project.owner_avatar} name={project.name} size={56} />
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{project.name}</h1>
              {project.verified && <span className="rounded-md bg-usdc/15 px-2 py-0.5 text-xs text-usdc">Verified</span>}
            </div>
            <a href={project.github_url} className="mt-1 inline-flex items-center gap-1.5 font-mono text-sm text-mist-400 hover:text-white">
              <GithubIcon className="h-3.5 w-3.5" /> {project.repo_full_name}
            </a>
            <p className="mt-3 max-w-2xl text-sm text-mist-300">{project.description}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {wave && <Button variant="secondary" href={`/waves/${wave.id}`}>Wave dashboard</Button>}
          {isOwner && (!wave || ["distributed", "refunded", "failed"].includes(wave.status)) && (
            <Button href={`/waves/create?projectId=${project.id}`}>Launch a Wave</Button>
          )}
        </div>
      </div>

      {wave ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Reward pool" value={`${usdc(wave.pool_amount)} USDC`} accent sub="Net of 4% platform fee" />
          <Stat label="Status" value={<StatusPill status={wave.status} />} sub={`${wave.duration_days}-day Wave`} />
          <Stat label="Time left" value={wave.status === "active" ? <Countdown end={wave.end_time} /> : "—"} />
          <Stat label="Open issues" value={open} sub={`${issues.length} tagged total`} />
        </div>
      ) : (
        <div className="card mt-8 p-6 text-sm text-mist-300">This project has no Wave yet.</div>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
        <section>
          <h2 className="mb-4 text-lg font-semibold text-white">Issues</h2>
          <IssueList issues={issues} isOwner={isOwner} onChange={reload} />
        </section>
        <aside className="space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-medium text-white">Building on ARC</h3>
            <p className="mt-2 whitespace-pre-line text-sm text-mist-300">{project.arc_usage || "—"}</p>
          </div>
          <div className="card p-5 text-sm">
            <h3 className="font-medium text-white">How payouts work</h3>
            <ul className="mt-2 space-y-1.5 text-mist-400">
              <li>1. Apply and get assigned</li>
              <li>2. Open a PR with <code className="text-mist-200">Fixes #issue</code></li>
              <li>3. Points awarded on merge</li>
              <li>4. USDC sent to your wallet when the Wave ends</li>
            </ul>
          </div>
          {data.waves.length > 1 && (
            <div className="card p-5 text-sm">
              <h3 className="font-medium text-white">Past Waves</h3>
              <ul className="mt-2 space-y-1">
                {data.waves.filter((w) => w.id !== wave?.id).map((w) => (
                  <li key={w.id}>
                    <Link href={`/waves/${w.id}`} className="flex justify-between text-mist-300 hover:text-white">
                      <span>{w.duration_days}-day Wave</span>
                      <span className="num text-usdc">{usdc(w.pool_amount, 0)} USDC</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
