-- Run this in the Supabase SQL editor to set up the database.

-- User team subscriptions
create table public.user_teams (
  user_id uuid references auth.users(id) on delete cascade not null,
  team_id integer not null,
  created_at timestamptz default now() not null,
  primary key (user_id, team_id)
);

-- Game cache (one row per game, shared across all users)
create table public.game_cache (
  game_pk integer primary key,
  team_id integer not null,
  game_date date not null,
  status text not null default 'final',
  highlight_url text,
  checked_at timestamptz default now() not null
);

-- Sent notification tracking (prevents duplicate emails)
create table public.sent_notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  game_pk integer not null,
  sent_at timestamptz default now() not null,
  unique (user_id, game_pk)
);

-- Indexes for common queries
create index idx_user_teams_team_id on public.user_teams(team_id);
create index idx_game_cache_team_date on public.game_cache(team_id, game_date);
create index idx_sent_notifications_user_game on public.sent_notifications(user_id, game_pk);

-- Row Level Security
alter table public.user_teams enable row level security;
alter table public.game_cache enable row level security;
alter table public.sent_notifications enable row level security;

-- user_teams: users can read/write their own rows
create policy "Users can view their own teams"
  on public.user_teams for select
  using (auth.uid() = user_id);

create policy "Users can insert their own teams"
  on public.user_teams for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own teams"
  on public.user_teams for delete
  using (auth.uid() = user_id);

-- game_cache: readable by everyone (public data), writable by service role only
create policy "Anyone can read game cache"
  on public.game_cache for select
  using (true);

-- sent_notifications: users can read their own
create policy "Users can view their own notifications"
  on public.sent_notifications for select
  using (auth.uid() = user_id);

-- Create a view to join user_teams with auth.users for the cron worker
-- (The cron worker uses the service role key which bypasses RLS)
create view public.users as
  select id, email from auth.users;
