import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

// Execute the actual migration in PostgreSQL (WASM), with minimal Supabase
// Auth/Storage stubs. These tests verify SQL and RLS, not the hosted SDK/service.
const db = new PGlite()
const teamA = '10000000-0000-4000-8000-000000000001', teamB = '10000000-0000-4000-8000-000000000002'
const userA = '20000000-0000-4000-8000-000000000001', userB = '20000000-0000-4000-8000-000000000002', outsider = '20000000-0000-4000-8000-000000000003', colleague = '20000000-0000-4000-8000-000000000004'
const litA = '30000000-0000-4000-8000-000000000001', litB = '30000000-0000-4000-8000-000000000002'
async function asUser<T = Record<string, unknown>>(user: string, sql: string, args: unknown[] = []) {
  return db.transaction(async tx => {
    await tx.exec('set local role authenticated')
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [user])
    return tx.query<T>(sql, args)
  })
}
beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1, '/') $$;
    grant usage on schema public, auth, storage to anon, authenticated;
    grant select, insert, delete on storage.objects to authenticated;
  `)
  const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8')
  await db.exec(schema)
  await db.exec(schema) // idempotent initialization
  await db.query('insert into auth.users values ($1),($2),($3),($4)', [userA, userB, outsider, colleague])
  await db.query("insert into public.teams(id,name) values ($1,'A组'),($2,'B组')", [teamA, teamB])
  await db.query("insert into public.team_members values ($1,$2,'甲'),($3,$4,'乙'),($1,$5,'同组成员')", [teamA, userA, teamB, userB, colleague])
  await asUser(userA, "insert into public.literature(id,team_id,title,authors,journal,year,created_by) values ($1,$2,'A组文献','甲','资料',2026,$3)", [litA, teamA, userA])
  await asUser(userB, "insert into public.literature(id,team_id,title,authors,journal,year,created_by) values ($1,$2,'B组文献','乙','资料',2026,$3)", [litB, teamB, userB])
}, 60000)
afterAll(async () => { await db.close() })

describe('数据库初始化与团队隔离', () => {
  it('实际脚本能重复执行，成员只读到自己的团队记录', async () => {
    const result = await asUser(userA, 'select title from public.literature')
    expect(result.rows).toEqual([{ title: 'A组文献' }])
    expect((await asUser(outsider, 'select * from public.literature')).rows).toEqual([])
    const bucket = await db.query<{ public: boolean }>("select public from storage.buckets where id = 'literature-files'")
    expect(bucket.rows[0].public).toBe(false)
  })
  it('不能跨团队写入，也不能给自己添加成员资格或伪造日志', async () => {
    await expect(asUser(userB, "insert into public.literature(team_id,title,authors,journal,year,created_by) values ($1,'越权','乙','资料',2026,$2)", [teamA, userB])).rejects.toThrow(/row-level security/)
    await expect(asUser(outsider, "insert into public.team_members values ($1,$2,'越权')", [teamA, outsider])).rejects.toThrow(/permission denied/)
    await expect(asUser(userA, "insert into public.activity_logs(team_id,action,entity_title) values ($1,'伪造','测试')", [teamA])).rejects.toThrow(/permission denied/)
  })
})
describe('笔记归属与文献完整性', () => {
  it('同组成员可以读笔记，但不能改写别人的笔记', async () => {
    await asUser(userA, "insert into public.reading_notes(team_id,literature_id,user_id,application) values ($1,$2,$3,'甲的笔记')", [teamA, litA, userA])
    const readable = await asUser(colleague, 'select application from public.reading_notes where literature_id = $1', [litA])
    expect(readable.rows[0]).toEqual({ application: '甲的笔记' })
    const changed = await asUser(colleague, "update public.reading_notes set application='冒名修改' where literature_id=$1 returning id", [litA])
    expect(changed.rows).toEqual([])
    await expect(asUser(colleague, "insert into public.reading_notes(team_id,literature_id,user_id) values ($1,$2,$3)", [teamA, litA, userA])).rejects.toThrow(/row-level security/)
  })
  it('不能把另一个团队的文献关联到本组笔记', async () => {
    await expect(asUser(userA, 'insert into public.reading_notes(team_id,literature_id,user_id) values ($1,$2,$3)', [teamA, litB, userA])).rejects.toThrow(/foreign key/)
  })
})
describe('任务版本、负责人和审计记录', () => {
  it('数据库自动推进版本，过期版本无法覆盖；任务编辑产生日志', async () => {
    const task = await asUser<{ id: string; updated_at: string }>(userA, "insert into public.tasks(team_id,title,created_by) values ($1,'权限测试任务',$2) returning id, updated_at::text", [teamA, userA])
    const { id, updated_at } = task.rows[0]
    const changed = await asUser<{ updated_at: string }>(colleague, "update public.tasks set status='doing' where id=$1 and updated_at=$2::timestamptz returning updated_at::text", [id, updated_at])
    expect(changed.rows).toHaveLength(1)
    expect(changed.rows[0].updated_at).not.toBe(updated_at)
    expect((await asUser(userA, "update public.tasks set status='done' where id=$1 and updated_at=$2::timestamptz returning id", [id, updated_at])).rows).toEqual([])
    const logs = await asUser<{ action: string }>(userA, "select action from public.activity_logs where entity_title='权限测试任务' order by created_at")
    expect(logs.rows.map(x => x.action)).toEqual(['创建了任务', '更新了任务'])
    await asUser(userA, 'delete from public.tasks where id=$1', [id])
    expect((await asUser<{ action: string }>(userA, "select action from public.activity_logs where entity_title='权限测试任务' and action='删除了任务'")).rows).toHaveLength(1)
  })
  it('拒绝给非团队成员分配任务，拒绝修改团队归属', async () => {
    await expect(asUser(userA, "insert into public.tasks(team_id,title,created_by,assignee_id) values ($1,'越权负责人',$2,$3)", [teamA, userA, userB])).rejects.toThrow(/row-level security/)
    const task = await asUser<{ id: string }>(userA, "insert into public.tasks(team_id,title,created_by) values ($1,'固定归属',$2) returning id", [teamA, userA])
    await expect(asUser(userA, 'update public.tasks set team_id=$1 where id=$2', [teamB, task.rows[0].id])).rejects.toThrow('不能改变记录身份或团队')
  })
})
describe('私有附件权限', () => {
  it('附件必须归属当前成员团队，其他团队不能读写或删除', async () => {
    const path = `${teamA}/${litA}/test.pdf`
    await asUser(userA, "insert into storage.objects(bucket_id,name) values ('literature-files',$1)", [path])
    expect((await asUser(colleague, 'select name from storage.objects')).rows).toEqual([{ name: path }])
    expect((await asUser(userB, 'select * from storage.objects')).rows).toEqual([])
    expect((await asUser(userB, 'delete from storage.objects returning id')).rows).toEqual([])
    await expect(asUser(userB, "insert into storage.objects(bucket_id,name) values ('literature-files',$1)", [path + '2'])).rejects.toThrow(/row-level security/)
    await asUser(userA, 'delete from storage.objects where name=$1', [path])
  })
})
