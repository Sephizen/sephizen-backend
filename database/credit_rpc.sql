create or replace function public.adjust_daily_credits(
  p_user_id uuid,
  p_credits_delta integer,
  p_daily_limit integer default null
)
returns table (
  user_id uuid,
  daily_limit integer,
  daily_used integer,
  remaining_credits integer,
  last_reset_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.user_credits%rowtype;
  v_today date := (timezone('utc', now()))::date;
  v_default_limit integer := coalesce(p_daily_limit, 1000);
begin
  insert into public.user_credits (
    user_id,
    daily_limit,
    daily_used,
    remaining_credits,
    last_reset_at,
    updated_at
  )
  values (
    p_user_id,
    coalesce((select daily_limit from public.user_credits where user_id = p_user_id limit 1), v_default_limit),
    0,
    coalesce((select daily_limit from public.user_credits where user_id = p_user_id limit 1), v_default_limit),
    now(),
    now()
  )
  on conflict (user_id) do nothing;

  select *
  into v_row
  from public.user_credits
  where user_id = p_user_id
  for update;

  if (timezone('utc', v_row.last_reset_at))::date <> v_today then
    update public.user_credits
    set daily_used = 0,
        remaining_credits = daily_limit,
        last_reset_at = now(),
        updated_at = now()
    where user_id = p_user_id
    returning * into v_row;
  end if;

  if p_credits_delta >= 0 then
    if v_row.remaining_credits < p_credits_delta then
      raise exception 'Insufficient credits' using errcode = 'P0001';
    end if;
  else
    if (v_row.daily_used + p_credits_delta) < 0 then
      raise exception 'Refund would make daily used negative' using errcode = 'P0001';
    end if;
  end if;

  update public.user_credits
  set daily_used = daily_used + p_credits_delta,
      remaining_credits = remaining_credits - p_credits_delta,
      updated_at = now()
  where user_id = p_user_id
  returning * into v_row;

  return query
  select
    v_row.user_id,
    v_row.daily_limit,
    v_row.daily_used,
    v_row.remaining_credits,
    v_row.last_reset_at,
    v_row.updated_at;
end;
$$;

create or replace function public.record_chat_reply(
  p_user_id uuid,
  p_session_id uuid,
  p_content text,
  p_model_key text,
  p_credits_used integer,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  message_id uuid,
  session_id uuid,
  user_id uuid,
  role text,
  content text,
  model_key text,
  credits_used integer,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message public.chat_messages%rowtype;
begin
  insert into public.chat_messages (
    user_id,
    session_id,
    role,
    content,
    model_key,
    credits_used,
    metadata,
    created_at
  )
  values (
    p_user_id,
    p_session_id,
    'assistant',
    p_content,
    p_model_key,
    p_credits_used,
    p_metadata,
    now()
  )
  returning * into v_message;

  update public.chat_sessions
  set updated_at = now(),
      last_message_at = now(),
      last_message_preview = left(coalesce(p_content, ''), 140)
  where id = p_session_id
    and user_id = p_user_id;

  return query
  select
    v_message.id,
    v_message.session_id,
    v_message.user_id,
    v_message.role,
    v_message.content,
    v_message.model_key,
    v_message.credits_used,
    v_message.metadata,
    v_message.created_at;
end;
$$;
