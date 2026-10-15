-- 仅管理员在 Supabase SQL Editor 执行；先运行 schema.sql 和 invitations.sql。
-- 将 TEAM_UUID 替换成已有团队 UUID，按需修改 7 天有效期和 20 个新成员名额。
-- 每执行一次生成一个新的随机邀请码。不要把执行结果保存进公开仓库。
with generated as (
  select replace(gen_random_uuid()::text, '-', '') as code
), created as (
  insert into research_private.team_invites(team_id, code_hash, expires_at, max_uses)
  select 'TEAM_UUID'::uuid, encode(sha256(convert_to(code, 'UTF8')), 'hex'), now() + interval '7 days', 20
  from generated
  returning id, expires_at, max_uses
)
select created.id as invite_id, generated.code as invite_code, created.expires_at, created.max_uses
from created cross join generated;

-- 撤销时单独执行，并将 INVITE_UUID 替换成上面返回的 invite_id：
-- update research_private.team_invites set revoked = true where id = 'INVITE_UUID'::uuid;
-- 撤销邀请码不会移除已经加入的成员。
