create extension if not exists pgcrypto;

create table if not exists public.couple_wishes (
  id uuid primary key default gen_random_uuid(),
  slot int not null check (slot >= 1 and slot <= 99),
  title text not null default '',
  description text default '',
  category text default '日常',
  status text default 'todo',
  time_mode text default 'unsure',
  plan_date date,
  start_date date,
  end_date date,
  deadline date,
  added_by text not null check (added_by in ('wang', 'han')),
  surprise jsonb default '{}'::jsonb,
  memory jsonb default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(slot)
);

create table if not exists public.couple_wish_messages (
  id uuid primary key default gen_random_uuid(),
  wish_id uuid not null references public.couple_wishes(id) on delete cascade,
  by_role text not null check (by_role in ('wang', 'han')),
  text text not null,
  hearts jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.couple_wish_records (
  id uuid primary key default gen_random_uuid(),
  wish_id uuid not null references public.couple_wishes(id) on delete cascade,
  by_role text not null check (by_role in ('wang', 'han')),
  text text not null,
  created_at timestamptz default now()
);

create table if not exists public.couple_wish_images (
  id uuid primary key default gen_random_uuid(),
  wish_id uuid not null references public.couple_wishes(id) on delete cascade,
  by_role text not null check (by_role in ('wang', 'han')),
  file_path text not null,
  public_url text,
  created_at timestamptz default now()
);

create table if not exists public.couple_daily_entries (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  by_role text not null check (by_role in ('wang', 'han')),
  status_text varchar(5),
  question text,
  answer text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(day, by_role)
);

create table if not exists public.couple_activities (
  id uuid primary key default gen_random_uuid(),
  by_role text check (by_role in ('wang', 'han')),
  text text not null,
  type text default 'normal',
  created_at timestamptz default now()
);

create table if not exists public.couple_app_state (
  id text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table public.couple_wishes enable row level security;
alter table public.couple_wish_messages enable row level security;
alter table public.couple_wish_records enable row level security;
alter table public.couple_wish_images enable row level security;
alter table public.couple_daily_entries enable row level security;
alter table public.couple_activities enable row level security;
alter table public.couple_app_state enable row level security;

grant usage on schema public to anon;
grant select, insert, update, delete on public.couple_wishes to anon;
grant select, insert, update, delete on public.couple_wish_messages to anon;
grant select, insert, update, delete on public.couple_wish_records to anon;
grant select, insert, update, delete on public.couple_wish_images to anon;
grant select, insert, update, delete on public.couple_daily_entries to anon;
grant select, insert, update, delete on public.couple_activities to anon;
grant select, insert, update, delete on public.couple_app_state to anon;

drop policy if exists "anon all couple_wishes" on public.couple_wishes;
create policy "anon all couple_wishes" on public.couple_wishes for all to anon using (true) with check (true);
drop policy if exists "anon all couple_wish_messages" on public.couple_wish_messages;
create policy "anon all couple_wish_messages" on public.couple_wish_messages for all to anon using (true) with check (true);
drop policy if exists "anon all couple_wish_records" on public.couple_wish_records;
create policy "anon all couple_wish_records" on public.couple_wish_records for all to anon using (true) with check (true);
drop policy if exists "anon all couple_wish_images" on public.couple_wish_images;
create policy "anon all couple_wish_images" on public.couple_wish_images for all to anon using (true) with check (true);
drop policy if exists "anon all couple_daily_entries" on public.couple_daily_entries;
create policy "anon all couple_daily_entries" on public.couple_daily_entries for all to anon using (true) with check (true);
drop policy if exists "anon all couple_activities" on public.couple_activities;
create policy "anon all couple_activities" on public.couple_activities for all to anon using (true) with check (true);
drop policy if exists "anon all couple_app_state" on public.couple_app_state;
create policy "anon all couple_app_state" on public.couple_app_state for all to anon using (true) with check (true);

insert into public.couple_app_state (id, value)
values ('egg', '{"wang": false, "han": false, "finalAt": null}'::jsonb)
on conflict (id) do nothing;

-- Storage:
-- 1. In Supabase Dashboard, create a private bucket named: couple-photos
-- 2. Then run these policies:
drop policy if exists "anon read couple photos" on storage.objects;
create policy "anon read couple photos" on storage.objects for select to anon using (bucket_id = 'couple-photos');

drop policy if exists "anon upload couple photos" on storage.objects;
create policy "anon upload couple photos" on storage.objects for insert to anon with check (bucket_id = 'couple-photos');

drop policy if exists "anon update couple photos" on storage.objects;
create policy "anon update couple photos" on storage.objects for update to anon using (bucket_id = 'couple-photos') with check (bucket_id = 'couple-photos');

drop policy if exists "anon delete couple photos" on storage.objects;
create policy "anon delete couple photos" on storage.objects for delete to anon using (bucket_id = 'couple-photos');
