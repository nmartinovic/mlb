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
