-- 中合村案例研究工作台 / Supabase PostgreSQL
-- 在新建项目的 SQL Editor 中执行一次；重复执行不会清空已有数据。
begin;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  created_at timestamptz not null default now()
);
create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 100),
  primary key (team_id, user_id)
);
create table if not exists public.literature (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 300),
  authors text not null check (char_length(trim(authors)) between 1 and 200),
  journal text not null check (char_length(trim(journal)) between 1 and 300),
  year integer not null check (year between 1800 and 2200),
  keywords text[] not null default '{}',
  tags text[] not null default '{}',
  theory_tags text[] not null default '{}',
  source_url text not null default '' check (source_url = '' or source_url ~* '^https?://'),
  file_path text,
  file_name text,
  file_size bigint check (file_size > 0 and file_size <= 20971520),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, team_id),
  check ((file_path is null and file_name is null and file_size is null) or
         (file_path is not null and file_name is not null and file_size is not null and
          split_part(file_path, '/', 1) = team_id::text and
          split_part(file_path, '/', 2) = id::text)),
  check (tags <@ array['乡村治理','基层干部','协同治理','嵌入性治理','乡村产业发展','公共管理案例']::text[]),
  check (theory_tags <@ array['嵌入性治理','社会角色','协同治理']::text[])
);
create table if not exists public.reading_notes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  literature_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  application text not null default '' check (char_length(application) <= 12000),
  core_ideas text not null default '' check (char_length(core_ideas) <= 12000),
  theory_support text not null default '' check (char_length(theory_support) <= 12000),
  updated_at timestamptz not null default now(),
  unique (literature_id, user_id),
  foreign key (literature_id, team_id) references public.literature(id, team_id) on delete cascade
);
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 5000),
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  assignee_id uuid references auth.users(id) on delete set null,
  due_date date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_title text not null,
  created_at timestamptz not null default now()
);

create index if not exists literature_team_created on public.literature(team_id, created_at desc);
create index if not exists tasks_team_created on public.tasks(team_id, created_at);
create index if not exists reading_notes_team_updated on public.reading_notes(team_id, updated_at desc);
create index if not exists activity_logs_team_created on public.activity_logs(team_id, created_at desc);
create index if not exists team_members_user on public.team_members(user_id, team_id);

-- 避免 team_members 的 RLS 递归；固定 search_path，并只返回当前用户的成员资格。
create or replace function public.is_team_member(target_team uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.team_members m where m.team_id = target_team and m.user_id = (select auth.uid()));
$$;
revoke all on function public.is_team_member(uuid) from public;
grant execute on function public.is_team_member(uuid) to authenticated;

-- 更新版本由数据库生成，用于检测同一任务 / 笔记的并发覆盖。
create or replace function public.guard_research_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.team_id <> old.team_id then
    raise exception '不能改变记录身份或团队';
  end if;
  if tg_table_name = 'reading_notes' then
    if new.user_id <> old.user_id or new.literature_id <> old.literature_id then
      raise exception '不能改变笔记作者或所属文献';
    end if;
  else
    if new.created_at <> old.created_at then
      raise exception '不能改变创建时间';
    end if;
    -- auth.users 删除造成外键 SET NULL 时，允许数据库清空作者引用。
    if new.created_by is distinct from old.created_by and not
       (new.created_by is null and not exists(select 1 from auth.users u where u.id = old.created_by)) then
      raise exception '不能改变记录创建者';
    end if;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
-- 身份保护函数查询 auth.users 时使用 definer，避免普通成员访问 auth schema。
alter function public.guard_research_update() security definer;
revoke all on function public.guard_research_update() from public;
drop trigger if exists research_version on public.tasks;
create trigger research_version before update on public.tasks for each row execute function public.guard_research_update();
drop trigger if exists research_version on public.reading_notes;
create trigger research_version before update on public.reading_notes for each row execute function public.guard_research_update();
drop trigger if exists research_version on public.literature;
create trigger research_version before update on public.literature for each row execute function public.guard_research_update();

create or replace function public.record_research_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  row_data jsonb;
  row_team uuid;
  title_text text;
  action_text text;
begin
  if tg_op = 'DELETE' then row_data := to_jsonb(old); else row_data := to_jsonb(new); end if;
  row_team := (row_data ->> 'team_id')::uuid;
  if not exists(select 1 from public.teams t where t.id = row_team) then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_table_name = 'reading_notes' then
    -- 删除文献会级联删除笔记；文献自身的删除记录已经覆盖该事件。
    if tg_op = 'DELETE' then return old; end if;
    select l.title into title_text from public.literature l where l.id = (row_data ->> 'literature_id')::uuid;
    action_text := '更新了阅读笔记';
  else
    title_text := row_data ->> 'title';
    if tg_table_name = 'literature' then
      action_text := case tg_op when 'INSERT' then '添加了文献' when 'DELETE' then '删除了文献' else '更新了文献' end;
    else
      action_text := case tg_op when 'INSERT' then '创建了任务' when 'DELETE' then '删除了任务' else '更新了任务' end;
    end if;
  end if;
  insert into public.activity_logs(team_id, user_id, action, entity_title)
    values(row_team, auth.uid(), action_text, coalesce(title_text, '阅读笔记'));
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function public.record_research_activity() from public;
drop trigger if exists research_activity on public.literature;
create trigger research_activity after insert or update or delete on public.literature for each row execute function public.record_research_activity();
drop trigger if exists research_activity on public.tasks;
create trigger research_activity after insert or update or delete on public.tasks for each row execute function public.record_research_activity();
drop trigger if exists research_activity on public.reading_notes;
create trigger research_activity after insert or update or delete on public.reading_notes for each row execute function public.record_research_activity();

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.literature enable row level security;
alter table public.tasks enable row level security;
alter table public.reading_notes enable row level security;
alter table public.activity_logs enable row level security;

-- 最小权限：团队和成员管理仅由项目管理员在 SQL Editor 中执行。
revoke all on public.teams, public.team_members, public.literature, public.tasks, public.reading_notes, public.activity_logs from anon, authenticated;
grant select on public.teams, public.team_members, public.activity_logs to authenticated;
grant select, insert, delete on public.literature to authenticated;
grant select, insert, update, delete on public.tasks, public.reading_notes to authenticated;

drop policy if exists member_read on public.teams;
create policy member_read on public.teams for select to authenticated using (public.is_team_member(id));
drop policy if exists member_read on public.team_members;
create policy member_read on public.team_members for select to authenticated using (public.is_team_member(team_id));
drop policy if exists member_read on public.activity_logs;
create policy member_read on public.activity_logs for select to authenticated using (public.is_team_member(team_id));

drop policy if exists member_read on public.literature;
create policy member_read on public.literature for select to authenticated using (public.is_team_member(team_id));
drop policy if exists member_insert on public.literature;
create policy member_insert on public.literature for insert to authenticated with check (public.is_team_member(team_id) and created_by = (select auth.uid()));
drop policy if exists member_delete on public.literature;
create policy member_delete on public.literature for delete to authenticated using (public.is_team_member(team_id));

drop policy if exists member_read on public.tasks;
create policy member_read on public.tasks for select to authenticated using (public.is_team_member(team_id));
drop policy if exists member_insert on public.tasks;
create policy member_insert on public.tasks for insert to authenticated with check (
  public.is_team_member(team_id) and created_by = (select auth.uid()) and
  (assignee_id is null or exists(select 1 from public.team_members m where m.team_id = tasks.team_id and m.user_id = tasks.assignee_id))
);
drop policy if exists member_update on public.tasks;
create policy member_update on public.tasks for update to authenticated using (public.is_team_member(team_id)) with check (
  public.is_team_member(team_id) and (assignee_id is null or exists(select 1 from public.team_members m where m.team_id = tasks.team_id and m.user_id = tasks.assignee_id))
);
drop policy if exists member_delete on public.tasks;
create policy member_delete on public.tasks for delete to authenticated using (public.is_team_member(team_id));

drop policy if exists member_read on public.reading_notes;
create policy member_read on public.reading_notes for select to authenticated using (public.is_team_member(team_id));
drop policy if exists own_insert on public.reading_notes;
create policy own_insert on public.reading_notes for insert to authenticated with check (public.is_team_member(team_id) and user_id = (select auth.uid()));
drop policy if exists own_update on public.reading_notes;
create policy own_update on public.reading_notes for update to authenticated using (public.is_team_member(team_id) and user_id = (select auth.uid())) with check (public.is_team_member(team_id) and user_id = (select auth.uid()));
drop policy if exists own_delete on public.reading_notes;
create policy own_delete on public.reading_notes for delete to authenticated using (public.is_team_member(team_id) and user_id = (select auth.uid()));

-- 私有存储，20 MB 上限；不开放任意可执行文件类型。
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('literature-files', 'literature-files', false, 20971520,
        array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 路径首段即团队 UUID；比较文本而不是直接强转，避免恶意路径转换错误。
drop policy if exists research_files_read on storage.objects;
create policy research_files_read on storage.objects for select to authenticated using (
  bucket_id = 'literature-files' and exists(select 1 from public.team_members m where m.user_id = (select auth.uid()) and m.team_id::text = (storage.foldername(name))[1])
);
drop policy if exists research_files_insert on storage.objects;
create policy research_files_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'literature-files' and exists(select 1 from public.team_members m where m.user_id = (select auth.uid()) and m.team_id::text = (storage.foldername(name))[1])
);
drop policy if exists research_files_delete on storage.objects;
create policy research_files_delete on storage.objects for delete to authenticated using (
  bucket_id = 'literature-files' and exists(select 1 from public.team_members m where m.user_id = (select auth.uid()) and m.team_id::text = (storage.foldername(name))[1])
);

-- 仅订阅追加式协作日志：文献/笔记/任务的新增、修改、删除均由触发器覆盖。
do $$ begin
  if not exists(select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activity_logs') then
    alter publication supabase_realtime add table public.activity_logs;
  end if;
end $$;

commit;
