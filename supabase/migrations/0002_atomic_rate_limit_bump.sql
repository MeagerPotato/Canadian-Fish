-- Applied to project fnandjtzwhihgefkfwzj via Supabase MCP on 2026-08-20
-- SECURITY_REVIEW F2: the edge function's read-modify-write rate limiter let 80
-- concurrent actions through with zero 429s. Replace it with a single atomic
-- upsert-increment executed inside Postgres.

create or replace function public.bump_rate_limit(p_bucket text)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.rate_limits (bucket, count, window_start)
  values (p_bucket, 1, now())
  on conflict (bucket) do update set count = public.rate_limits.count + 1
  returning count;
$$;

-- Only the server (service role) may call it; clients have no path to it.
revoke all on function public.bump_rate_limit(text) from public, anon, authenticated;
grant execute on function public.bump_rate_limit(text) to service_role;
