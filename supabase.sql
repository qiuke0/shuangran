create table if not exists shuangran_state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table shuangran_state enable row level security;

drop policy if exists "public read shuangran state" on shuangran_state;
drop policy if exists "public insert shuangran state" on shuangran_state;
drop policy if exists "public update shuangran state" on shuangran_state;

create policy "public read shuangran state"
on shuangran_state for select
using (true);

create policy "public insert shuangran state"
on shuangran_state for insert
with check (true);

create policy "public update shuangran state"
on shuangran_state for update
using (true)
with check (true);

insert into storage.buckets (id, name, public)
values ('record-images', 'record-images', true)
on conflict (id) do update set public = true;

drop policy if exists "public read record images" on storage.objects;
drop policy if exists "public insert record images" on storage.objects;
drop policy if exists "public update record images" on storage.objects;

create policy "public read record images"
on storage.objects for select
using (bucket_id = 'record-images');

create policy "public insert record images"
on storage.objects for insert
with check (bucket_id = 'record-images');

create policy "public update record images"
on storage.objects for update
using (bucket_id = 'record-images')
with check (bucket_id = 'record-images');
