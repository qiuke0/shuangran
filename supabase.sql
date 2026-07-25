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
