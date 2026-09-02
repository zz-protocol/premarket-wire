create table if not exists public.tape_snapshot (
  id int primary key default 1 check (id = 1),
  html text not null default '',
  snapshot_at timestamptz,
  pred jsonb,
  updated_at timestamptz not null default now()
);
alter table public.tape_snapshot enable row level security;
create policy tape_snapshot_public_read on public.tape_snapshot for select to anon, authenticated using (true);
-- no public insert/update
insert into public.tape_snapshot (id, html) values (1, '') on conflict (id) do nothing;
