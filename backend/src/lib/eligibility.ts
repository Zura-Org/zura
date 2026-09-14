/**
 * Pure checks the GitHub bot runs before awarding points for a merged PR.
 * Kept free of I/O so it can be unit tested exhaustively.
 */

export interface PrFile {
  filename: string;
  patch?: string;
  additions: number;
  deletions: number;
}

export interface CheckResult {
  state: "success" | "failure" | "pending" | "none";
}

export interface EligibilityInput {
  now: Date;
  wave: { status: string; endTime: Date | null } | null;
  issueTagged: boolean;
  prAuthorGithubUsername: string;
  assigneeGithubUsername: string | null;
  ci: CheckResult;
  files: PrFile[];
}

export type EligibilityFailure =
  | "wave_inactive"
  | "ci_failed"
  | "issue_not_tagged"
  | "author_not_assignee"
  | "diff_not_meaningful";

export function checkEligibility(input: EligibilityInput): { ok: true } | { ok: false; reasons: EligibilityFailure[] } {
  const reasons: EligibilityFailure[] = [];

  if (!input.wave || input.wave.status !== "active" || !input.wave.endTime || input.now >= input.wave.endTime) {
    reasons.push("wave_inactive");
  }
  // Repos with no CI configured ("none") are allowed; anything not green is rejected.
  if (input.ci.state === "failure" || input.ci.state === "pending") reasons.push("ci_failed");
  if (!input.issueTagged) reasons.push("issue_not_tagged");
  if (
    !input.assigneeGithubUsername ||
    input.assigneeGithubUsername.toLowerCase() !== input.prAuthorGithubUsername.toLowerCase()
  ) {
    reasons.push("author_not_assignee");
  }
  if (!isMeaningfulDiff(input.files)) reasons.push("diff_not_meaningful");

  return reasons.length ? { ok: false, reasons } : { ok: true };
}

const LOCKFILES = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|Cargo\.lock|go\.sum)$/;

/** A diff is meaningful if at least one non-lockfile line changes in a way beyond whitespace. */
export function isMeaningfulDiff(files: PrFile[]): boolean {
  for (const file of files) {
    if (LOCKFILES.test(file.filename)) continue;
    if (!file.patch) {
      // Binary or very large files have no patch; count them if they changed anything.
      if (file.additions + file.deletions > 0) return true;
      continue;
    }
    const removed: string[] = [];
    const added: string[] = [];
    for (const line of file.patch.split("\n")) {
      if (line.startsWith("+++") || line.startsWith("---")) continue;
      if (line.startsWith("+")) added.push(line.slice(1).replace(/\s+/g, ""));
      else if (line.startsWith("-")) removed.push(line.slice(1).replace(/\s+/g, ""));
    }
    const a = added.filter(Boolean).sort().join("\n");
    const r = removed.filter(Boolean).sort().join("\n");
    if (a !== r) return true;
  }
  return false;
}

/** Extracts issue numbers a PR closes: "closes #12", "fixes owner/repo#3" (same repo only). */
export function linkedIssueNumbers(body: string | null | undefined, repoFullName: string): number[] {
  if (!body) return [];
  const re = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s+(?:([\w.-]+\/[\w.-]+))?#(\d+)/gi;
  const found = new Set<number>();
  for (const m of body.matchAll(re)) {
    if (m[1] && m[1].toLowerCase() !== repoFullName.toLowerCase()) continue;
    found.add(Number(m[2]));
  }
  return [...found];
}

export const FAILURE_MESSAGES: Record<EligibilityFailure, string> = {
  wave_inactive: "the Wave for this project is not active",
  ci_failed: "CI checks did not pass",
  issue_not_tagged: "the linked issue has no `zura:` complexity label",
  author_not_assignee: "the PR author is not the contributor assigned on Zura",
  diff_not_meaningful: "the diff only contains whitespace or lockfile changes",
};
