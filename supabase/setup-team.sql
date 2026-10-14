-- 在 schema.sql 执行后使用。先在 Authentication > Users 创建成员账号。
-- 1. 新建团队并记录返回的 UUID（每个团队只执行一次）。
insert into public.teams(name) values ('中合村蛋鸡产业案例研究小组') returning id;

-- 2. 把以下 TEAM_UUID、MEMBER_USER_UUID 替换为真实 UUID 后，分别为每个成员执行。
-- 不要把账号密码写入本文件或提交到 Git。
-- insert into public.team_members(team_id, user_id, display_name)
-- values ('TEAM_UUID', 'MEMBER_USER_UUID', '你的姓名')
-- on conflict (team_id, user_id) do update set display_name = excluded.display_name;

-- 3. 可选：创建初始任务；替换 UUID 后取消注释。
-- insert into public.tasks(team_id, created_by, title, description, status)
-- values
-- ('TEAM_UUID', 'MEMBER_USER_UUID', '案例材料收集', '梳理事实、材料出处与待访谈问题。', 'todo'),
-- ('TEAM_UUID', 'MEMBER_USER_UUID', '案例正文撰写', '建立从养殖基础到市场连接的叙事。', 'todo'),
-- ('TEAM_UUID', 'MEMBER_USER_UUID', '理论文献搜集', '收集三个理论视角的核心文献。', 'todo'),
-- ('TEAM_UUID', 'MEMBER_USER_UUID', '分析框架完善', '对应研究问题、理论命题与案例证据。', 'todo'),
-- ('TEAM_UUID', 'MEMBER_USER_UUID', '案例图表制作', '绘制产业主体关系与事件过程图。', 'todo');

-- 4. 撤销成员资格（需要时单独执行；不会删除历史贡献）：
-- delete from public.team_members where team_id = 'TEAM_UUID' and user_id = 'MEMBER_USER_UUID';
