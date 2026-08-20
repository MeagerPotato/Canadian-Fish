/**
 * Public client configuration.
 *
 * These two values are public by design and are meant to ship inside the browser
 * bundle: the Supabase URL is a hostname, and the anon key is a Supabase
 * *publishable* key whose only power is what row-level security grants it — and
 * this project grants it nothing (RLS is enabled on every table with zero
 * policies for `anon`, and schema usage is revoked; see
 * supabase/migrations/0001 and SECURITY_REVIEW.md, where direct table access was
 * confirmed to fail with 42501). All authority lives in the edge function, which
 * holds the service-role key that never leaves Supabase.
 *
 * They are committed rather than injected because a build with them missing is
 * silently broken: `import.meta.env.*` becomes `undefined`, every request goes
 * out without an apikey header, and the deployed site returns 401 on its first
 * API call. That is exactly what happened on the first production deploy —
 * Vercel builds from the repo, where `.env.local` is gitignored. An env var
 * still wins when present, so other deployments can point elsewhere.
 */
export const SUPABASE_URL: string =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://fnandjtzwhihgefkfwzj.supabase.co'

export const SUPABASE_ANON_KEY: string =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuYW5kanR6d2hpaGdlZmtmd3pqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyMjI1MTcsImV4cCI6MjEwMjc5ODUxN30.SNWcbukdagL6hxHNfNWOhLuQLDASVPCGbyImR46MwbM'
