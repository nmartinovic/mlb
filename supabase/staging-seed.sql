-- Staging fixture seed for the automated cron dry-run (#180).
--
-- Apply this ONCE to the STAGING Supabase project, AFTER supabase-schema.sql.
-- Never run it against production.
--
-- It seeds two fixture subscribers so the automated dry-run
-- (`npm run test:staging` / lib/cron-jobs.staging.test.js) always has real
-- rows to fan out against:
--
--   * a "superfan" subscribed to all 30 MLB teams, so whichever games MLB
--     actually played in the last few days, the fan-out path is exercised;
--   * a second subscriber on two teams, for multi-subscriber realism.
--
-- The dry-run never sends email and never writes mlb_sent_notifications, so
-- these fixture accounts stay inert. Their addresses use the RFC 2606
-- example.com domain, which has no MX record — even an accidental real send
-- could not deliver. The seed is idempotent: re-running it is a no-op.
--
-- mlb_user_teams.user_id has a foreign key to auth.users, so the fixture
-- accounts must exist there first. The inserts below use the standard
-- direct-insert form. If your Supabase version rejects writes to auth.users,
-- create two users via the dashboard (Authentication -> Add user) instead and
-- replace the UUIDs below with the ones it assigns.

insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-0000000d0001',
    'authenticated', 'authenticated',
    'staging-dry-run-superfan@example.com',
    '', now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-0000000d0002',
    'authenticated', 'authenticated',
    'staging-dry-run-fan-b@example.com',
    '', now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}'
  )
on conflict (id) do nothing;

-- Superfan: every MLB team, so any recent real game matches a subscription.
insert into public.mlb_user_teams (user_id, team_id)
select '00000000-0000-0000-0000-0000000d0001', team_id
from unnest(array[
  108, 109, 110, 111, 112, 113, 114, 115, 116, 117,
  118, 119, 120, 121, 133, 134, 135, 136, 137, 138,
  139, 140, 141, 142, 143, 144, 145, 146, 147, 158
]) as team_id
on conflict (user_id, team_id) do nothing;

-- Fan B: Yankees (147) and Dodgers (119) — exercises multi-subscriber fan-out
-- and the both-fanbases-subscribed case when these two meet.
insert into public.mlb_user_teams (user_id, team_id)
values
  ('00000000-0000-0000-0000-0000000d0002', 147),
  ('00000000-0000-0000-0000-0000000d0002', 119)
on conflict (user_id, team_id) do nothing;
