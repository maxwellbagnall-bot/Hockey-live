create extension if not exists "pgcrypto";

create type public.match_status as enum ('scheduled', 'live', 'finished');
create type public.verification_level as enum ('community', 'confirmed', 'official');
create type public.event_type as enum (
  'goal', 'short_corner', 'green_card', 'yellow_card', 'red_card', 'period_end', 'comment'
);

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  badge_url text,
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references public.clubs(id) on delete cascade,
  name text not null,
  age_group text,
  gender text,
  created_at timestamptz not null default now()
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  home_team_id uuid not null references public.teams(id),
  away_team_id uuid not null references public.teams(id),
  starts_at timestamptz not null,
  venue text,
  competition text,
  status public.match_status not null default 'scheduled',
  verification public.verification_level not null default 'community',
  home_score int not null default 0 check (home_score >= 0),
  away_score int not null default 0 check (away_score >= 0),
  period text,
  created_at timestamptz not null default now()
);

create table public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  event_type public.event_type not null,
  team_id uuid references public.teams(id),
  minute int check (minute is null or minute >= 0),
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.clubs enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;
alter table public.match_events enable row level security;

create policy "public read clubs" on public.clubs for select using (true);
create policy "public read teams" on public.teams for select using (true);
create policy "public read matches" on public.matches for select using (true);
create policy "public read match events" on public.match_events for select using (true);

create policy "signed in users can add events"
  on public.match_events for insert
  to authenticated
  with check (auth.uid() = created_by);

create index matches_starts_at_idx on public.matches(starts_at);
create index match_events_match_created_idx on public.match_events(match_id, created_at desc);
