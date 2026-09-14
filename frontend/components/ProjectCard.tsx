import Link from "next/link";
import { compactUsdc, timeLeft } from "@/lib/format";
import type { Project } from "@/lib/types";
import { Avatar, ComplexityBadge, StatusPill } from "./ui";

export function ProjectCard({ project }: { project: Project }) {
  const wave = project.wave;
  return (
    <Link href={`/projects/${project.id}`} className="card group flex flex-col p-5 transition hover:border-ink-600 hover:bg-ink-850">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar src={project.owner_avatar} name={project.name} size={36} />
          <div className="min-w-0">
            <div className="truncate font-medium text-white group-hover:text-zura-400">{project.name}</div>
            <div className="truncate font-mono text-xs text-mist-400">{project.repo_full_name}</div>
          </div>
        </div>
        {wave && <StatusPill status={wave.status} />}
      </div>

      <p className="mt-4 line-clamp-2 min-h-[2.5rem] text-sm text-mist-300">{project.description || "No description yet."}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {project.language && <span className="rounded-md bg-ink-800 px-2 py-0.5 text-xs text-mist-300">{project.language}</span>}
        {project.project_type && <span className="rounded-md bg-ink-800 px-2 py-0.5 text-xs capitalize text-mist-300">{project.project_type}</span>}
        {wave?.complexities?.map((c) => <ComplexityBadge key={c} complexity={c} />)}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-ink-800 pt-4 text-sm">
        <div>
          <div className="text-xs text-mist-400">Pool</div>
          <div className="num font-semibold text-usdc">{wave ? `${compactUsdc(wave.pool_amount)} USDC` : "—"}</div>
        </div>
        <div>
          <div className="text-xs text-mist-400">Open issues</div>
          <div className="num font-semibold text-white">{wave?.open_issues ?? 0}</div>
        </div>
        <div>
          <div className="text-xs text-mist-400">Ends in</div>
          <div className="num font-semibold text-white">{wave?.status === "active" ? timeLeft(wave.end_time) : "—"}</div>
        </div>
      </div>
    </Link>
  );
}
