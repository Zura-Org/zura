export type Complexity = "easy" | "medium" | "hard" | "critical";

export const COMPLEXITY_POINTS: Record<Complexity, number> = {
  easy: 100,
  medium: 300,
  hard: 700,
  critical: 1500,
};

export interface User {
  id: string;
  github_username: string;
  avatar_url: string | null;
  wallet_address: string | null;
  kyc_status: "none" | "pending" | "approved" | "rejected";
  created_at: string;
}

export type WaveStatus =
  | "draft"
  | "deploying"
  | "pending_funding"
  | "active"
  | "ended"
  | "distributing"
  | "distributed"
  | "refund_available"
  | "refunded"
  | "failed";

export interface WaveSummary {
  id: string;
  status: WaveStatus;
  pool_amount: string;
  end_time: string | null;
  duration_days: number;
  open_issues: number;
  max_points: number;
  complexities: Complexity[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  arc_usage?: string;
  github_url: string;
  repo_full_name: string;
  language: string | null;
  project_type: string | null;
  verified: boolean;
  owner: string;
  owner_id?: string;
  owner_avatar: string | null;
  wave: WaveSummary | null;
}

export interface Wave {
  id: string;
  project_id: string;
  project_name?: string;
  repo_full_name?: string;
  github_url?: string;
  owner?: string;
  owner_id?: string;
  duration_days: number;
  pool_amount: string;
  fee_amount: string;
  start_time: string | null;
  end_time: string | null;
  status: WaveStatus;
  contract_address: string | null;
  tx_hash: string | null;
  created_at: string;
}

export interface Issue {
  id: string;
  wave_id: string;
  github_issue_number: number;
  github_issue_url: string;
  title: string;
  complexity: Complexity;
  points: number;
  status: "open" | "assigned" | "in_review" | "completed" | "closed";
  assignee: string | null;
  assignee_avatar?: string | null;
  applicants: number;
}

export interface LeaderboardRow {
  rank: number;
  githubUsername: string;
  avatarUrl: string | null;
  points: number;
  merged: number;
  estimatedUsdc: string;
}

export interface Application {
  id: string;
  issue_id: string;
  contributor_id: string;
  github_username: string;
  avatar_url: string | null;
  note: string | null;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  merged_total: number;
  created_at: string;
}
