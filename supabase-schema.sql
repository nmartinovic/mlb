-- Run this in the Supabase SQL editor to set up the MLB highlights tables.
-- All tables are prefixed with mlb_ to avoid conflicts with other apps sharing this project.

-- User team subscriptions
create table public.mlb_user_teams (
  user_id uuid references auth.users(id) on delete cascade not null,
  team_id integer not null,
  created_at timestamptz default now() not null,
  primary key (user_id, team_id)
);

-- Game cache (one row per game, shared across all users)
create table public.mlb_game_cache (
  game_pk integer primary key,
  team_id integer not null,
  game_date date not null,
  status text not null default 'final',
  highlight_url text,
  checked_at timestamptz default now() not null
);

-- Sent notification tracking (prevents duplicate emails)
create table public.mlb_sent_notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  game_pk integer not null,
  sent_at timestamptz default now() not null,
  unique (user_id, game_pk)
);

-- Indexes for common queries
create index idx_mlb_user_teams_team_id on public.mlb_user_teams(team_id);
create index idx_mlb_game_cache_team_date on public.mlb_game_cache(team_id, game_date);
create index idx_mlb_sent_notifications_user_game on public.mlb_sent_notifications(user_id, game_pk);

-- Row Level Security
alter table public.mlb_user_teams enable row level security;
alter table public.mlb_game_cache enable row level security;
alter table public.mlb_sent_notifications enable row level security;

-- mlb_user_teams: users can read/write their own rows
create policy "Users can view their own MLB teams"
  on public.mlb_user_teams for select
  using (auth.uid() = user_id);

create policy "Users can insert their own MLB teams"
  on public.mlb_user_teams for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own MLB teams"
  on public.mlb_user_teams for delete
  using (auth.uid() = user_id);

-- mlb_game_cache: readable by everyone (public data), writable by service role only
create policy "Anyone can read MLB game cache"
  on public.mlb_game_cache for select
  using (true);

-- mlb_sent_notifications: users can read their own
create policy "Users can view their own MLB notifications"
  on public.mlb_sent_notifications for select
  using (auth.uid() = user_id);

-- Create a view to join mlb_user_teams with auth.users for the cron worker
-- (The cron worker uses the service role key which bypasses RLS)
create view public.mlb_users as
  select id, email from auth.users;

-- Lock the view down to service_role only. Postgres views run with the
-- owner's privileges by default, so RLS on auth.users does NOT apply when
-- anon/authenticated read this view. Without this revoke, any visitor with
-- the anon key (which ships in the browser bundle) can list every signed-up
-- user's email. The cron worker uses service_role, which bypasses grants,
-- so it keeps working.
revoke all on public.mlb_users from anon, authenticated, public;

-- Cron run health log (one row per /api/cron invocation that gets past auth)
create table public.mlb_cron_runs (
  id uuid default gen_random_uuid() primary key,
  started_at timestamptz default now() not null,
  finished_at timestamptz,
  status text not null default 'running',
  games_processed integer not null default 0,
  emails_sent integer not null default 0,
  errors_count integer not null default 0,
  errors jsonb
);

create index idx_mlb_cron_runs_started_at on public.mlb_cron_runs(started_at desc);

-- Service-role-only: the cron writes via service_role (bypasses RLS) and the
-- admin page reads via service_role too. RLS is enabled with no policies, so
-- anon/authenticated get nothing.
alter table public.mlb_cron_runs enable row level security;

-- Game-aware cron schedule (#76). The daily scheduler endpoint
-- (/api/cron/schedule) writes one row per game in today's slate with
-- expected_finish_at = first_pitch + 3.5h. The main cron (/api/cron) reads
-- this table and early-returns when no row's expected_finish_at falls inside
-- the polling window (now-2.5h to now+30m), so offseason and overnight
-- invocations exit without hitting MLB Stats API or any Supabase write path.
create table public.mlb_cron_schedule (
  game_pk integer primary key,
  expected_finish_at timestamptz not null,
  game_date date not null,
  created_at timestamptz default now() not null
);

create index idx_mlb_cron_schedule_expected_finish on public.mlb_cron_schedule(expected_finish_at);

-- Service-role-only: only the cron worker reads/writes this table.
alter table public.mlb_cron_schedule enable row level security;

-- Out-of-band SLO alarms (#107). A pg_cron job runs every 5 minutes and
-- emails ADMIN_EMAIL when either of these silent-failure SLOs trip:
--   B1: no row with status starting 'schedule_' in mlb_cron_runs for 26h.
--   B2: no row at all in mlb_cron_runs for 30m, during MLB regular season
--       (April–October in America/New_York).
-- We only email on edge transitions (not firing -> firing) so a stuck
-- alarm doesn't spam every 5 minutes. Recovery is silent.
--
-- Prereqs (enable once via Supabase dashboard → Database → Extensions):
--   - pg_cron  (lets Postgres run scheduled SQL)
--   - pg_net   (lets SQL make outbound HTTP requests)
-- The CREATE EXTENSION calls below are idempotent and will succeed if the
-- extensions are already enabled. On hosted Supabase, only project owners
-- can enable these — if these statements fail with "permission denied",
-- enable them in the dashboard first.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Vault secrets the alarm function reads (set via Supabase dashboard →
-- Project Settings → Vault, or `select vault.create_secret(...)`):
--   - brevo_api_key  the same Brevo transactional key as EMAIL_API_KEY
--   - from_email     same value as the FROM_EMAIL worker var
--   - admin_email    same value as the ADMIN_EMAIL worker secret
-- Storing these in Vault keeps them off disk and out of pg_dump.

-- Per-SLO state. last_notified_at is informational; firing is what gates
-- the next email. Rows are seeded below.
create table if not exists public.mlb_alarm_state (
  slo_id text primary key,
  firing boolean not null default false,
  last_changed_at timestamptz not null default now(),
  last_notified_at timestamptz
);

alter table public.mlb_alarm_state enable row level security;

insert into public.mlb_alarm_state (slo_id, firing) values
  ('schedule_stale_26h', false),
  ('cron_silent_30m', false)
on conflict (slo_id) do nothing;

-- Email sender. Reads Brevo creds from Vault and posts asynchronously via
-- pg_net. pg_net.http_post returns immediately; failures land in
-- net._http_response and do not raise here.
create or replace function public._mlb_send_alarm_email(p_subject text, p_body text)
returns void
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  v_brevo_key text;
  v_from text;
  v_admin text;
begin
  select decrypted_secret into v_brevo_key from vault.decrypted_secrets where name = 'brevo_api_key';
  select decrypted_secret into v_from      from vault.decrypted_secrets where name = 'from_email';
  select decrypted_secret into v_admin     from vault.decrypted_secrets where name = 'admin_email';

  if v_brevo_key is null or v_from is null or v_admin is null then
    raise warning 'mlb_alarm: missing vault secret (brevo_api_key/from_email/admin_email); skipping send';
    return;
  end if;

  perform net.http_post(
    url := 'https://api.brevo.com/v3/smtp/email',
    headers := jsonb_build_object(
      'api-key', v_brevo_key,
      'Content-Type', 'application/json',
      'Accept', 'application/json'
    ),
    body := jsonb_build_object(
      'sender', jsonb_build_object('email', v_from, 'name', 'Ninth Inning Alarm'),
      'to', jsonb_build_array(jsonb_build_object('email', v_admin)),
      'subject', p_subject,
      'htmlContent', '<pre>' || p_body || '</pre>'
    )
  );
end;
$$;

-- Evaluate both SLOs and fire on edge transitions only.
create or replace function public.mlb_check_slo_alarms()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_in_season boolean := extract(month from (v_now at time zone 'America/New_York')) between 4 and 10;
  v_schedule_recent_count int;
  v_cron_recent_count int;
  v_schedule_firing boolean;
  v_cron_firing boolean;
  v_prev_schedule boolean;
  v_prev_cron boolean;
begin
  select count(*) into v_schedule_recent_count
  from public.mlb_cron_runs
  where status like 'schedule_%'
    and started_at > v_now - interval '26 hours';

  select count(*) into v_cron_recent_count
  from public.mlb_cron_runs
  where started_at > v_now - interval '30 minutes';

  v_schedule_firing := v_schedule_recent_count = 0;
  v_cron_firing := v_in_season and v_cron_recent_count = 0;

  select firing into v_prev_schedule from public.mlb_alarm_state where slo_id = 'schedule_stale_26h';
  select firing into v_prev_cron     from public.mlb_alarm_state where slo_id = 'cron_silent_30m';

  -- B1: schedule_* row missing for 26h
  if v_schedule_firing and not coalesce(v_prev_schedule, false) then
    perform public._mlb_send_alarm_email(
      '[ninthinning] SLO B1 firing: scheduler silent for 26h',
      format(
        'No row with status starting "schedule_" has been written to mlb_cron_runs in the last 26 hours.%s' ||
        'The daily 9am-ET scheduler (/api/cron/schedule) may be broken. Check /admin and the Cloudflare cron triggers.%s' ||
        'Detected at: %s UTC',
        E'\n\n', E'\n\n', v_now
      )
    );
    update public.mlb_alarm_state
       set firing = true, last_changed_at = v_now, last_notified_at = v_now
     where slo_id = 'schedule_stale_26h';
  elsif (not v_schedule_firing) and coalesce(v_prev_schedule, false) then
    update public.mlb_alarm_state
       set firing = false, last_changed_at = v_now
     where slo_id = 'schedule_stale_26h';
  end if;

  -- B2: any row missing for 30m, in-season only
  if v_cron_firing and not coalesce(v_prev_cron, false) then
    perform public._mlb_send_alarm_email(
      '[ninthinning] SLO B2 firing: cron silent for 30m',
      format(
        'No rows have been written to mlb_cron_runs in the last 30 minutes, and we are in MLB regular season (Apr–Oct ET).%s' ||
        'The Cloudflare cron triggers may be down — every-15-min /api/cron should be writing a heartbeat row each tick.%s' ||
        'Detected at: %s UTC',
        E'\n\n', E'\n\n', v_now
      )
    );
    update public.mlb_alarm_state
       set firing = true, last_changed_at = v_now, last_notified_at = v_now
     where slo_id = 'cron_silent_30m';
  elsif (not v_cron_firing) and coalesce(v_prev_cron, false) then
    update public.mlb_alarm_state
       set firing = false, last_changed_at = v_now
     where slo_id = 'cron_silent_30m';
  end if;
end;
$$;

-- Schedule: every 5 minutes. Idempotent — drops any prior schedule under
-- the same name before re-creating, so re-running this file in the SQL
-- editor is safe.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'mlb-slo-alarms') then
    perform cron.unschedule('mlb-slo-alarms');
  end if;
  perform cron.schedule(
    'mlb-slo-alarms',
    '*/5 * * * *',
    $job$select public.mlb_check_slo_alarms()$job$
  );
end $$;
