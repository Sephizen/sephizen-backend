alter table public.profiles enable row level security;
alter table public.user_credits enable row level security;
alter table public.usage_logs enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "user_credits_select_own" on public.user_credits;
create policy "user_credits_select_own"
on public.user_credits
for select
using (auth.uid() = user_id);

drop policy if exists "usage_logs_select_own" on public.usage_logs;
create policy "usage_logs_select_own"
on public.usage_logs
for select
using (auth.uid() = user_id);

drop policy if exists "chat_sessions_crud_own" on public.chat_sessions;
create policy "chat_sessions_crud_own"
on public.chat_sessions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "chat_messages_crud_own" on public.chat_messages;
create policy "chat_messages_crud_own"
on public.chat_messages
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
