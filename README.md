# 中合村蛋鸡产业案例研究协作平台

正式 GitHub Pages 地址：[中合村案例研究协作平台](https://hyfabby060713-dotcom.github.io/zhonghe-research/)。连接 Supabase 后即可使用真实团队协作。

也可直接使用 GitHub Pages：已准备自动部署工作流，完整操作步骤见 [GITHUB-PAGES.md](./GITHUB-PAGES.md)。

面向公共管理案例大赛小组的研究工作台。技术栈：**React + TypeScript + Vite + Tailwind CSS + Supabase**，可部署至 Netlify。

已新增**成员自主注册、邮箱验证和邀请码入组**。组长不必逐个创建账号或收集密码。首次配置与旧项目升级请按 [SUPABASE-SETUP.md](./SUPABASE-SETUP.md) 操作；必须在 Supabase 执行新增的 `invitations.sql` 才能兑换邀请码。

## 1. 基础版包含什么

| 页面 | 功能 |
| --- | --- |
| 研究概览 | 案例主题、简介、三个研究问题、分析主题、研究路径、资料统计、协作动态 |
| 理论框架 | 嵌入性治理、社会角色、协同治理；三重角色与多主体网络；理论逻辑图；证据收集提示 |
| 文献资料库 | PDF / DOC / DOCX 上传、题录录入、六类标签、理论标签、关键词搜索、年份排序、列表 / 卡片视图 |
| 文献详情 | 题录、文件下载、来源链接、每位成员独立的三个维度阅读笔记、团队笔记、删除确认 |
| 团队任务 | 待完成 / 进行中 / 已完成看板；新增、编辑、删除、拖动、状态菜单、负责人、截止日期、协作记录 |

首页案例介绍依据项目需求编写，不补造销量、收益或事件日期。理论应用是待证的分析假设，需用访谈与文件材料检验。演示空间的任务是示例；两篇经典文献只有题录和 DOI 链接，没有全文附件。

## 2. 本地运行：无需 Supabase 也能体验

准备 Node.js **22.12 或更新版本**（建议 Node 22 LTS 或 24 LTS）。在 PowerShell 中运行：

```powershell
Set-Location -LiteralPath 'D:\《拍案政经》案例大赛\zhonghe-research'
npm install
npm run dev
```

浏览器访问终端显示的地址，通常为 `http://127.0.0.1:5173`。

没有设置三项 Supabase 环境变量时，自动进入**本机演示模式**。文献、附件、笔记、任务保存在当前浏览器的 IndexedDB 中，刷新后保留；同一浏览器同一源的多个标签页会同步。该模式不提供跨设备 / 跨成员协作，浏览器清理网站数据也会删除演示资料。不同地址、端口或浏览器拥有独立的数据。

已配置部分变量时会显示配置错误，不会悄悄切回演示模式。正式研究建议在配置好 Supabase 后开始。演示数据不会自动迁移到云端。

其他命令：

```powershell
npm run typecheck
npm test
npm run build
npm run preview
```

构建产物在 `dist`。提交了 `package-lock.json` 后，可用 `npm ci` 重现依赖安装。

## 3. 创建 Supabase 数据库与文件存储

### 第一步：建立项目

1. 在 [Supabase Dashboard](https://supabase.com/dashboard) 创建一个项目。
2. 等待数据库初始化完成。
3. 打开 **SQL Editor → New query**，粘贴并运行 `supabase/schema.sql` 的完整内容。
4. 在 Table Editor 中确认存在 `teams`、`team_members`、`literature`、`reading_notes`、`tasks`、`activity_logs` 六张表。
5. 在 Storage 中确认存在 **literature-files** 存储桶，且是 **Private**。

脚本包括表结构、索引、行级权限、版本时间戳、协作记录触发器、Realtime publication 和存储策略。可重复执行，不会清空数据；将来修改表结构需要另外写迁移，而不是依靠 `create table if not exists` 修改已有字段。

文件限制：PDF、DOC、DOCX，单文件最大 **20 MB**。路径格式为 `团队UUID/文献UUID/随机UUID.扩展名`，原文件名保存在文献题录中。下载前生成有效期 **60 秒**的签名链接，文件不使用公开永久 URL。

### 第二步：开启自主注册

1. 在 SQL Editor 执行 `supabase/invitations.sql`。旧项目也需要补执行此文件。
2. 在 Authentication 开启新用户注册、Email 登录和 Confirm email。
3. 配置正式网站 Site URL、允许回调地址和自定义 SMTP，详见 [SUPABASE-SETUP.md](./SUPABASE-SETUP.md)。默认 SMTP 不能向普通研究成员任意发验证邮件。
4. 成员在网站点击“注册账号”，自行填写邮箱、姓名并设置密码。邮箱验证后再输入团队邀请码。

旧的管理员预建账号仍可登录。忘记密码由管理员处理；本次未新增密码重置或站内邀请码管理面板。

### 第三步：创建团队并加入成员

在 SQL Editor 中只执行一次：

```sql
insert into public.teams(name)
values ('中合村蛋鸡产业案例研究小组')
returning id;
```

记录返回的 `id`，这是后续使用的 **TEAM_UUID**。将 `supabase/create-invite.sql` 中的 TEAM_UUID 替换为此值，在 SQL Editor 执行后，将返回的 invite_code 私下分享给小组。新成员可自行入组，无需逐个预建成员记录。

如果需要由管理员手动添加成员，仍可执行以下语句，替换占位符：

```sql
insert into public.team_members(team_id, user_id, display_name)
values ('你的TEAM_UUID', '该成员的USER_UID', '成员姓名')
on conflict (team_id, user_id)
do update set display_name = excluded.display_name;
```

`supabase/setup-team.sql` 中也提供了这些模板，以及五项初始任务的可选 SQL。正式云端工作台从空资料库开始，不会自动导入演示任务或示例笔记。

成员撤销资格：

```sql
delete from public.team_members
where team_id = '你的TEAM_UUID' and user_id = '该成员的USER_UID';
```

撤销后该成员无法继续读取团队数据，历史贡献保留。如果曾负责未完成任务，请另行调整负责人。已经生成的文件签名链接会在最多 60 秒后失效。

### 第四步：设置本地环境变量

```powershell
Copy-Item -LiteralPath '.env.example' -Destination '.env'
```

在 `.env` 填写：

```dotenv
VITE_SUPABASE_URL=https://你的项目引用.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=你的publishable公开密钥
VITE_TEAM_ID=你的TEAM_UUID
```

项目 URL 和 **publishable key** 在 Supabase 的项目连接 / API Keys 设置中查看。也兼容旧版 **anon** 公开密钥。**不要使用 `service_role` 或 `sb_secret_…` 密钥。** `VITE_` 变量会被写入浏览器构建包，这是预期行为；真实数据访问由登录状态与 RLS 共同控制。

保存后重启 `npm run dev`，用已添加到团队的账号登录。团队 UUID 只是选择当前团队，不是安全凭证，知道它也不会获得成员权限。

## 4. 部署到 Netlify

项目已提供 `netlify.toml`，构建命令为 `npm run build`，发布目录为 `dist`，Node 版本为 22。SPA 回退规则保证直接访问或刷新 `/framework`、`/literature`、`/literature/:id`、`/tasks` 时能正常进入 React。

匿名临时发布使用 `VITE_ROUTER_MODE=hash`，分享链接带 `/#/`，兼容未处理 SPA 重写的发布路径。本地 `.env.production.local` 已设置此模式且不会提交；常规正式构建可设置 `VITE_ROUTER_MODE=history` 并保留上述 Netlify 回退规则。当前线上状态见 `DEPLOYMENT.md`。

### 推荐：Git 持续部署

1. 将 `zhonghe-research` 目录的代码上传到 GitHub / GitLab 等仓库，包含 `package-lock.json`。
2. 不提交 `node_modules`、`dist`、`.env` 或密钥；`.gitignore` 已配置。
3. 在 Netlify 选择 **Add new project → Import an exist
4. ing project** 并选择仓库。
5. 如果仓库根目录就是本项目，Base directory 留空；若仓库包含整个比赛资料目录，Base directory 设置为 `zhonghe-research`，不要上传不需要的比赛文档。
6. Build command：`npm run build`；Publish directory：`dist`。平台会读取 `netlify.toml`。
7. 在项目的 **Environment variables** 中新增三项：`VITE_SUPABASE_URL`、`VITE_SUPABASE_PUBLISHABLE_KEY`、`VITE_TEAM_ID`。需要对 **Builds / Production** 环境生效。
8. 触发部署，等待构建成功，打开 Netlify 返回的网址。
9. 用两个已加入同一团队的账号，在不同浏览器中登录并完成下方验收。

环境变量在**构建时**写入 Vite。更改后要重新构建 / 部署；只刷新页面不会更新配置。若使用 Deploy Preview，可为预览环境连接单独的 Supabase 测试项目，避免预览操作影响正式研究资料。

Supabase 的 Site URL 可设置为 Netlify 正式地址，便于将来启用邮箱确认 / 密码重置。当前邮箱密码登录无需 OAuth 重定向。

Netlify 扫描如把公开 publishable / anon key 标为敏感值，先确认确实是公开 key；仅对这一个公开值使用平台提供的精确例外配置，不要关闭整个密钥扫描。secret / service_role 密钥不能加入前端。

### 备选：手动部署构建产物

1. 先在本地 `.env` 配置 Supabase。
2. 运行 `npm run build`。
3. 将 **dist 目录**上传到 Netlify 的手动部署界面。
4. 确认 `dist/_redirects` 随产物上传。项目已包含 `public/_redirects`，Vite 会自动复制它，手动上传同样支持 SPA 刷新。

手动部署时，Netlify 的环境变量不会改写已经构建的文件。变更配置需在本地重新构建并再次上传。

## 5. 团队协作与权限边界

- 团队成员可以读取所在团队的文献、附件、任务、笔记和成员姓名，不能读取其他团队资料。
- 团队成员可以新增 / 删除文献，添加 / 编辑 / 删除任务；删除文献会同时删除阅读笔记，并清理附件。
- 阅读笔记按“文献 + 成员”唯一保存。团队可以查看每个人的笔记，但只有作者能修改自己的笔记。
- 团队创建、成员移除与邀请码生成 / 撤销保留在 Supabase SQL Editor。已验证用户只有通过有效邀请码才能自行入组，不能直接写入成员表。
- 协作记录由数据库触发器生成。成员可以阅读，不能直接插入、修改或删除这些日志。
- Realtime 订阅追加式协作日志，触发器覆盖文献、笔记、任务的增删改。断连时仍每 30 秒刷新，窗口重新获得焦点时也会刷新。
- 同一任务或笔记被多个窗口编辑时，通过 `updated_at` 比较避免覆盖。冲突会提示刷新重试。

Supabase 模式需要联网，不包含离线编辑队列。正式研究建议定期在 Supabase 做数据库备份，并单独备份 Storage 文件；数据库备份本身不包含附件内容。

## 6. 验收清单

1. 首页案例标题、分析主题、三个研究问题完整，统计随资料变化。
2. 理论页展示三个理论、三重角色、多主体网络与五步逻辑链。
3. 上传 PDF、DOC 或 DOCX，输入题录、分类和理论标签；搜索、筛选、排序正常。
4. 打开详情，下载附件；填写三项笔记并保存，刷新后仍存在。
5. 第二个同团队成员能看到新文献与笔记；不能修改第一个成员的笔记。
6. 新增任务、分配负责人、设置日期；拖动卡片或使用状态菜单；修改和删除产生协作记录。
7. 非团队账号看不到资料；其他团队账号不能读取本团队数据库行或文件。
8. 手机宽度下打开导航与表单，任务可以用状态菜单切换。
9. Netlify 上刷新文献详情、理论页和任务页不会出现 404。

## 7. 常见问题

| 现象 | 处理 |
| --- | --- |
| npm 提示 Node 版本不满足 | 升级至 Node 22.12+ 或 24 LTS，再安装依赖 |
| npm 下载报 ENOTFOUND / ECONNRESET | 检查网络或代理后重试 `npm install`，不要用 `--force` 隐藏依赖问题 |
| 页面仍显示演示模式 | 检查三项环境变量是否已填写；本地重启，Netlify 重新部署 |
| 账号登录成功但没有团队权限 | 检查 `team_members` 的 `user_id` 是否为 Auth User UID，以及 `team_id` 与 `VITE_TEAM_ID` 是否相同 |
| `relation does not exist` | 先完整执行 `supabase/schema.sql`，确认项目 URL 指向同一 Supabase 项目 |
| 上传触发 RLS 错误 | 确认用户已入团队、桶名为 `literature-files`，schema 脚本完整执行；不要改成公开桶绕过权限 |
| 实时状态未连接 | 检查 Realtime 是否启用以及 `activity_logs` 是否加入 publication；每 30 秒刷新仍能更新 |
| 附件下载链接过期 | 再次点击下载生成新链接 |
| 文献删除后附件清理失败 | 前端会明确提示；管理员到 Storage 清理对应文献目录中的遗留文件 |
| 刷新深层页面出现 404 | Git 部署检查 `netlify.toml`；手动部署检查 `dist/_redirects` |

## 8. 项目结构

```text
zhonghe-research/
  public/                 # 网站图标与手动部署回退规则
  src/
    components/           # 侧栏、布局、弹窗、通用界面
    pages/                # 首页、理论、文献、详情、任务、连接指南
    lib/api.ts            # Supabase 访问、上传、下载、并发检测
    lib/demo.ts           # IndexedDB 演示数据与附件、跨标签页同步
    lib/seed.ts           # 明确标注的示例内容
    context.tsx           # 登录会话、共享数据、刷新与提示
    styles.css            # Tailwind 与自适应学术风格
  supabase/schema.sql     # 数据库、私有桶、RLS、触发器与 Realtime
  supabase/setup-team.sql # 团队、成员与初始任务配置模板
  tests/                  # 本地持久化、并发行为、SQL 权限测试
  netlify.toml
  .env.example
```

## 9. 参考文档

- [Vite 使用说明](https://vite.dev/guide/)
- [Tailwind CSS 的 Vite 集成](https://tailwindcss.com/docs/installation/using-vite)
- [Supabase 行级权限](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Storage 访问控制](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Netlify SPA 重写规则](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/)
- [Granovetter（1985）原始文献](https://doi.org/10.1086/228311)
- [Ansell & Gash（2008）原始文献](https://doi.org/10.1093/jopart/mum032)

没有提供真实 Supabase 项目凭据，因此在线账号、云端上传、Realtime 与 Netlify 实际发布需在你们配置项目后按验收清单确认。不会在代码中放入真实账号或私密项目密钥。
