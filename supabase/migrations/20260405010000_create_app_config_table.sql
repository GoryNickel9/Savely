-- app_config: generic key-value store for server-side configuration
-- Used by Edge Functions to cache dynamic config like the active MangaWorld domain
create table if not exists app_config (
  key        text        primary key,
  value      text        not null,
  updated_at timestamptz not null default now()
);

-- Only service role can access this table (used exclusively from Edge Functions)
alter table app_config enable row level security;
-- No user-facing policies intentionally: accessed only via service_role key
