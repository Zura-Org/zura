-- Zura core schema (PostgreSQL / Supabase)
create extension if not exists pgcrypto;

create table if not exists users (
  id                uuid primary key default gen_random_uuid(),
  github_id         bigint unique not null,
  github_username   text unique not null,
  avatar_url        text,
  circle_wallet_id  text,
  wallet_address    text,
  kyc_status        text not null default 'none'
                      check (kyc_status in ('none', 'pending', 'approved', 'rejected')),
  created_at        timestamptz not null default now()
);

create table if not exists projects (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references users(id),
  name            text not null,
  github_url      text not null,
  repo_full_name  text unique not null,  -- "owner/repo", lowercased
  arc_chain       text not null default 'arc-testnet',
  description     text not null default '',
  arc_usage       text not null default '',  -- what they are building on ARC
  language        text,
  project_type    text,
  verified        boolean not null default false,
  github_installation_id bigint,  -- Zura GitHub App installation, captured from webhooks
  created_at      timestamptz not null default now()
);

create table if not exists waves (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects(id),
  duration_days     int not null check (duration_days in (7, 14, 30)),
  pool_amount       numeric(20, 6) not null default 0,  -- net USDC locked
  fee_amount        numeric(20, 6) not null default 0,  -- 4% taken by Zura
  start_time        timestamptz,
  end_time          timestamptz,
  status            text not null default 'draft'
                      check (status in ('draft', 'deploying', 'pending_funding', 'active',
                                        'ended', 'distributing', 'distributed', 'refund_available',
                                        'refunded', 'failed')),
  contract_address  text,
  tx_hash           text,
  created_at        timestamptz not null default now()
);
create index if not exists waves_project_idx on waves(project_id);
create index if not exists waves_status_idx on waves(status);

create table if not exists issues (
  id                  uuid primary key default gen_random_uuid(),
  wave_id             uuid not null references waves(id),
  github_issue_id     bigint unique not null,
  github_issue_number int not null,
  github_issue_url    text not null,
  title               text not null default '',
  complexity          text not null check (complexity in ('easy', 'medium', 'hard', 'critical')),
  points              int not null,
  status              text not null default 'open'
                        check (status in ('open', 'assigned', 'in_review', 'completed', 'closed')),
  assignee_id         uuid references users(id),
  created_at          timestamptz not null default now()
);
create index if not exists issues_wave_idx on issues(wave_id);

create table if not exists applications (
  id              uuid primary key default gen_random_uuid(),
  issue_id        uuid not null references issues(id),
  contributor_id  uuid not null references users(id),
  note            text,
  status          text not null default 'pending'
                    check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  created_at      timestamptz not null default now(),
  unique (issue_id, contributor_id)
);

create table if not exists contributions (
  id              uuid primary key default gen_random_uuid(),
  issue_id        uuid not null references issues(id),
  contributor_id  uuid not null references users(id),
  pr_url          text not null,
  pr_number       int not null,
  points_awarded  int not null,
  merged_at       timestamptz not null,
  unique (issue_id)
);
create index if not exists contributions_contributor_idx on contributions(contributor_id);

create table if not exists payouts (
  id              uuid primary key default gen_random_uuid(),
  wave_id         uuid not null references waves(id),
  contributor_id  uuid not null references users(id),
  points          int not null,
  amount_usdc     numeric(20, 6) not null,
  circle_tx_id    text,
  tx_hash         text,
  status          text not null default 'pending'
                    check (status in ('pending', 'sent', 'confirmed', 'failed')),
  created_at      timestamptz not null default now(),
  unique (wave_id, contributor_id)
);

create table if not exists withdrawals (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references users(id),
  destination_chain   text not null,
  destination_address text not null,
  amount_usdc         numeric(20, 6) not null,
  circle_tx_id        text,
  burn_tx_hash        text,
  mint_tx_hash        text,
  status              text not null default 'pending'
                        check (status in ('pending', 'burned', 'attested', 'completed', 'failed')),
  error               text,
  created_at          timestamptz not null default now()
);

create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id),
  type        text not null,
  payload     jsonb not null default '{}',
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications(user_id, read);

create table if not exists schema_migrations (
  name        text primary key,
  applied_at  timestamptz not null default now()
);
