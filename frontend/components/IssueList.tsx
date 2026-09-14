"use client";

import { useState } from "react";
import { api, loginUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Application, Issue } from "@/lib/types";
import { Avatar, Button, ComplexityBadge, Empty, ErrorNote } from "./ui";

const STATUS_LABEL: Record<Issue["status"], string> = {
  open: "Open",
  assigned: "Assigned",
  in_review: "In review",
  completed: "Merged",
  closed: "Closed",
};

export function IssueList({ issues, isOwner, onChange }: { issues: Issue[]; isOwner: boolean; onChange: () => void }) {
  if (!issues.length) {
    return (
      <Empty title="No tagged issues yet">
        {isOwner
          ? "Install the Zura GitHub App on your repo and add a zura:easy, zura:medium, zura:hard or zura:critical label to any issue."
          : "The maintainers haven't tagged issues for this Wave yet."}
      </Empty>
    );
  }
  return (
    <div className="card divide-y divide-ink-800">
      {issues.map((issue) => <IssueRow key={issue.id} issue={issue} isOwner={isOwner} onChange={onChange} />)}
    </div>
  );
}

function IssueRow({ issue, isOwner, onChange }: { issue: Issue; isOwner: boolean; onChange: () => void }) {
  const { user } = useAuth();
  const [mode, setMode] = useState<"idle" | "apply" | "review">("idle");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [applications, setApplications] = useState<Application[] | null>(null);

  async function apply() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/issues/apply", { method: "POST", json: { issueId: issue.id, note: note || undefined } });
      setApplied(true);
      setMode("idle");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function openReview() {
    setMode("review");
    setError(null);
    try {
      const res = await api<{ applications: Application[] }>(`/api/issues/${issue.id}/applications`);
      setApplications(res.applications);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function decide(applicationId: string, approve: boolean) {
    setBusy(true);
    try {
      if (approve) await api(`/api/issues/${issue.id}/assign`, { method: "POST", json: { applicationId } });
      else await api(`/api/issues/applications/${applicationId}/reject`, { method: "POST" });
      setMode("idle");
      onChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <a href={issue.github_issue_url} target="_blank" rel="noreferrer" className="font-medium text-white hover:text-zura-400">
            <span className="num text-mist-400">#{issue.github_issue_number}</span> {issue.title}
          </a>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-mist-400">
            <ComplexityBadge complexity={issue.complexity} points={issue.points} />
            <span>{STATUS_LABEL[issue.status]}</span>
            {issue.assignee && (
              <span className="flex items-center gap-1">
                · <Avatar src={issue.assignee_avatar} name={issue.assignee} size={16} /> {issue.assignee}
              </span>
            )}
            {issue.status === "open" && issue.applicants > 0 && <span>· {issue.applicants} applicant{issue.applicants === 1 ? "" : "s"}</span>}
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          {isOwner && issue.status === "open" && issue.applicants > 0 && (
            <Button size="sm" variant="secondary" onClick={openReview}>Review applicants</Button>
          )}
          {!isOwner && issue.status === "open" && (
            applied ? (
              <span className="text-xs text-easy">Applied ✓</span>
            ) : user ? (
              <Button size="sm" onClick={() => setMode(mode === "apply" ? "idle" : "apply")}>Apply</Button>
            ) : (
              <Button size="sm" variant="secondary" href={loginUrl(typeof window !== "undefined" ? window.location.pathname : "/explore")}>
                Sign in to apply
              </Button>
            )
          )}
        </div>
      </div>

      {mode === "apply" && (
        <div className="mt-4 space-y-3 rounded-xl border border-ink-700 bg-ink-850 p-4">
          <label className="label" htmlFor={`note-${issue.id}`}>Note to maintainer (optional)</label>
          <textarea
            id={`note-${issue.id}`}
            className="input min-h-[80px]"
            placeholder="How you'd approach it, relevant experience…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
          />
          <ErrorNote error={error} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>Cancel</Button>
            <Button size="sm" loading={busy} onClick={apply}>Submit application</Button>
          </div>
        </div>
      )}

      {mode === "review" && (
        <div className="mt-4 space-y-2 rounded-xl border border-ink-700 bg-ink-850 p-4">
          <ErrorNote error={error} />
          {!applications ? (
            <div className="text-sm text-mist-400">Loading…</div>
          ) : (
            applications.filter((a) => a.status === "pending").map((a) => (
              <div key={a.id} className="flex flex-col gap-2 rounded-lg bg-ink-900 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <a href={`/contributor/${a.github_username}`} className="flex items-center gap-2 text-sm font-medium text-white">
                    <Avatar src={a.avatar_url} name={a.github_username} size={20} /> {a.github_username}
                    <span className="text-xs font-normal text-mist-400">· {a.merged_total} merged on Zura</span>
                  </a>
                  {a.note && <p className="mt-1 text-sm text-mist-300">{a.note}</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => decide(a.id, false)}>Reject</Button>
                  <Button size="sm" loading={busy} onClick={() => decide(a.id, true)}>Assign</Button>
                </div>
              </div>
            ))
          )}
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>Close</Button>
          </div>
        </div>
      )}
    </div>
  );
}
