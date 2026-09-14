import { describe, expect, it } from "vitest";
import { checkEligibility, isMeaningfulDiff, linkedIssueNumbers, type EligibilityInput } from "./eligibility.js";

const base: EligibilityInput = {
  now: new Date("2026-09-10T00:00:00Z"),
  wave: { status: "active", endTime: new Date("2026-09-20T00:00:00Z") },
  issueTagged: true,
  prAuthorGithubUsername: "alice",
  assigneeGithubUsername: "Alice",
  ci: { state: "success" },
  files: [{ filename: "src/index.ts", patch: "@@ -1 +1 @@\n-const a = 1;\n+const a = 2;", additions: 1, deletions: 1 }],
};

describe("checkEligibility", () => {
  it("passes when every check is satisfied", () => {
    expect(checkEligibility(base)).toEqual({ ok: true });
  });

  it("allows repos without CI", () => {
    expect(checkEligibility({ ...base, ci: { state: "none" } })).toEqual({ ok: true });
  });

  it("collects every failure reason", () => {
    const result = checkEligibility({
      ...base,
      now: new Date("2026-09-21T00:00:00Z"),
      issueTagged: false,
      assigneeGithubUsername: "bob",
      ci: { state: "failure" },
      files: [{ filename: "a.ts", patch: "@@\n-foo()\n+  foo()", additions: 1, deletions: 1 }],
    });
    expect(result).toEqual({
      ok: false,
      reasons: ["wave_inactive", "ci_failed", "issue_not_tagged", "author_not_assignee", "diff_not_meaningful"],
    });
  });

  it("rejects unassigned issues and pending CI", () => {
    const result = checkEligibility({ ...base, assigneeGithubUsername: null, ci: { state: "pending" } });
    expect(result.ok).toBe(false);
  });
});

describe("isMeaningfulDiff", () => {
  it("ignores whitespace-only and lockfile changes", () => {
    expect(
      isMeaningfulDiff([
        { filename: "package-lock.json", patch: "+\"x\": 1", additions: 1, deletions: 0 },
        { filename: "a.ts", patch: "-if(x){\n+if (x) {", additions: 1, deletions: 1 },
      ]),
    ).toBe(false);
  });

  it("counts binary files", () => {
    expect(isMeaningfulDiff([{ filename: "logo.png", additions: 0, deletions: 0 }, { filename: "b.bin", additions: 1, deletions: 0 }])).toBe(true);
  });
});

describe("linkedIssueNumbers", () => {
  it("parses closing keywords for the same repo only", () => {
    const body = "Fixes #12\ncloses zura-org/zura#7, resolves other/repo#99 and Resolved: #3";
    expect(linkedIssueNumbers(body, "Zura-Org/zura").sort((a, b) => a - b)).toEqual([3, 7, 12]);
    expect(linkedIssueNumbers("mentions #5", "a/b")).toEqual([]);
  });
});
