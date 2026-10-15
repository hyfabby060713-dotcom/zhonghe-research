-- 先执行 schema.sql，再执行本文件。可重复运行；不会创建或公开邀请码。
begin;
create schema if not exists research_private;
revoke all on schema research_private from public, anon, authenticated;
-- 仅用于调用非暴露 schema 内的受限函数，不授予任何表权限。
grant usage on schema research_private to authenticated;

create table if not exists research_private.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  code_hash text not null unique,
  expires_at timestamptz not null,
  max_uses integer not null check (max_uses between 1 and 1000),
  uses integer not null default 0 check (uses >= 0 and uses <= max_uses),
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists team_invites_team on research_private.team_invites(team_id);
create table if not exists research_private.invite_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default now(),
  failures integer not null default 0
);
alter table research_private.team_invites enable row level security;
alter table research_private.invite_attempts enable row level security;
revoke all on research_private.team_invites, research_private.invite_attempts from public, anon, authenticated;

-- 必须提升权限才能校验私有凭据并创建成员资格；固定路径，仅允许当前已验证用户入组。
create or replace function research_private.redeem_invite(target_team uuid, invite_code text, member_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  verified boolean;
  invitation research_private.team_invites%rowtype;
  attempt research_private.invite_attempts%rowtype;
  inserted integer;
begin
  if caller is null then
    return jsonb_build_object('joined', false, 'message', '请先登录。');
  end if;
  -- 同一账号的所有兑换请求串行执行，失败计数不能被并发绕过。
  select (u.email_confirmed_at is not null and not coalesce(u.is_anonymous, false))
    into verified from auth.users u where u.id = caller for update;
  if verified is distinct from true then
    return jsonb_build_object('joined', false, 'message', '请先完成邮箱验证，再加入团队。');
  end if;
  if exists(select 1 from public.team_members where team_id = target_team and user_id = caller) then
    return jsonb_build_object('joined', true);
  end if;
  if member_name is null or char_length(trim(member_name)) not between 1 and 100 then
    return jsonb_build_object('joined', false, 'message', '请填写 1–100 字的成员姓名。');
  end if;
  insert into research_private.invite_attempts(user_id) values (caller) on conflict do nothing;
  update research_private.invite_attempts set window_start = now(), failures = 0
    where user_id = caller and window_start <= now() - interval '15 minutes';
  select * into attempt from research_private.invite_attempts where user_id = caller;
  if attempt.failures >= 5 then
    return jsonb_build_object('joined', false, 'message', '尝试次数过多，请在 15 分钟后重试。');
  end if;
  -- SHA-256 只保存摘要。原始码不存入用户资料、URL 或公开表。
  select * into invitation from research_private.team_invites
    where team_id = target_team
      and code_hash = encode(sha256(convert_to(lower(trim(coalesce(invite_code, ''))), 'UTF8')), 'hex')
    for update;
  if invitation.id is null or invitation.revoked or invitation.expires_at <= now()
     or invitation.uses >= invitation.max_uses then
    update research_private.invite_attempts set failures = failures + 1 where user_id = caller;
    -- 返回业务失败，避免异常回滚导致失败计数丢失。
    return jsonb_build_object('joined', false, 'message', '邀请码无效、已过期或名额已用完，请联系组长。');
  end if;
  insert into public.team_members(team_id, user_id, display_name)
    values (target_team, caller, trim(member_name)) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 1 then
    update research_private.team_invites set uses = uses + 1 where id = invitation.id;
    insert into public.activity_logs(team_id, user_id, action, entity_title)
      values (target_team, caller, '加入了研究团队', trim(member_name));
  end if;
  delete from research_private.invite_attempts where user_id = caller;
  return jsonb_build_object('joined', true);
end;
$$;
revoke all on function research_private.redeem_invite(uuid,text,text) from public, anon, authenticated;
grant execute on function research_private.redeem_invite(uuid,text,text) to authenticated;

-- Data API 只暴露无提权包装函数；实际校验函数保留在非暴露 schema。
create or replace function public.join_team_with_invite(target_team uuid, invite_code text, member_name text)
returns jsonb language sql security invoker set search_path = '' as $$
  select research_private.redeem_invite(target_team, invite_code, member_name);
$$;
revoke all on function public.join_team_with_invite(uuid,text,text) from public, anon, authenticated;
grant execute on function public.join_team_with_invite(uuid,text,text) to authenticated;
commit;
