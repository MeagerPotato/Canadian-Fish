-- Applied to project fnandjtzwhihgefkfwzj via Supabase MCP on 2026-08-20
-- (mirror copy; the live DB is the source of truth for applied migrations)

create extension if not exists pg_cron;

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (char_length(code) = 6),
  status text not null default 'lobby' check (status in ('lobby','playing','finished')),
  state jsonb not null,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  last_activity timestamptz not null default now()
);
create index rooms_last_activity_idx on public.rooms (last_activity);

create table public.rate_limits (
  bucket text primary key,
  count integer not null default 0,
  window_start timestamptz not null default now()
);

-- RLS on, and zero policies for client roles: anon/authenticated are fully denied.
alter table public.rooms enable row level security;
alter table public.rate_limits enable row level security;

-- Belt and suspenders: revoke grants and schema usage from client roles entirely.
revoke all on table public.rooms from anon, authenticated;
revoke all on table public.rate_limits from anon, authenticated;
revoke usage on schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- Hard-delete rooms 6h after last activity: nothing survives the session.
select cron.schedule('delete-stale-rooms', '*/15 * * * *',
  $$delete from public.rooms where last_activity < now() - interval '6 hours'$$);
select cron.schedule('clean-rate-limits', '17 * * * *',
  $$delete from public.rate_limits where window_start < now() - interval '2 hours'$$);
