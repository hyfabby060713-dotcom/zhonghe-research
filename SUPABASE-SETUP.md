# 开启成员自主注册和邀请码入组

组长只需配置一次 Supabase 和 GitHub。成员自行填写姓名、邮箱、密码，无需将密码交给组长。网站没有连接 Supabase 时继续显示演示工作台，不会开放无法使用的注册入口。

## 1. 初始化数据库

在 Supabase 项目的 SQL Editor 依次执行：

1. [supabase/schema.sql](./supabase/schema.sql)：基础数据表、权限和私有存储。之前已成功运行的项目可跳过。
2. [supabase/invitations.sql](./supabase/invitations.sql)：邀请码表和兑换函数。升级旧项目也需要执行，可重复运行，不清空资料。

不要将 `research_private` 加入 Data API 的 Exposed schemas；保持它私有。脚本已经明确授予必要的表和函数权限，不能通过关闭 RLS 解决访问问题。

## 2. 创建团队

如果已创建团队，继续使用已有 UUID。否则在 SQL Editor 执行一次：

```sql
insert into public.teams(name)
values ('中合村蛋鸡产业案例研究小组')
returning id;
```

记录返回的 `id`，这就是后续使用的团队 UUID。无需预先收集成员邮箱或创建成员账号。

## 3. 生成并分发邀请码

打开 [supabase/create-invite.sql](./supabase/create-invite.sql)，把 `TEAM_UUID` 替换成上述 UUID，在 SQL Editor 运行。

结果会返回 `invite_id`、`invite_code`、`expires_at` 和 `max_uses`。将 **invite_code** 私下发到研究小组群；`invite_id` 留给管理员撤销时使用。不要将结果上传公开仓库。

默认邀请码有效 **7 天**，可供 **20 个新成员**使用。生成前可以调整脚本内的有效期和人数。每次运行生成一个新码；生成新码不会自动撤销旧码。

邀请码只保存 SHA-256 摘要，不能从数据库中找回原始码，遗失后生成新码即可。重复提交已加入的成员不会消耗新名额。任一已验证账号连续输错 5 次后，需等待最多 15 分钟再试。

撤销邀请码，在 SQL Editor 单独执行（替换 UUID）：

```sql
update research_private.team_invites
set revoked = true
where id = '需要撤销的invite_id'::uuid;
```

撤销只阻止新的加入，不移除现有成员。移除成员可使用 README 的成员撤销 SQL；如果不希望其再次入组，还应撤销其已知的有效邀请码。

## 4. 配置邮箱注册与邮件

在 Supabase **Authentication** 的设置中：

- 开启 **Allow new users to sign up**（允许新用户注册）。
- 开启 Email 邮箱登录，并开启 **Confirm email**（邮箱验证）。不要启用匿名登录来替代注册。
- 在 **URL Configuration** 中，将 Site URL 和 Redirect URLs 都设置为下列正式地址，保留结尾斜杠，不加 `/#/`：

```text
https://hyfabby060713-dotcom.github.io/zhonghe-research/
```

**给普通成员发送验证邮件前，配置自定义 SMTP。** Supabase 默认邮件服务只允许发给 Supabase 项目组织团队中的邮箱，并有严格频率限制；研究小组成员不必成为 Supabase 后台管理员。应在 Auth 邮件设置中连接你自己的 SMTP 服务，填写发件地址、主机、端口和凭据。SMTP 密码只放在 Supabase 后台，不能放入 GitHub 的 VITE_ 变量。

保持验证邮件模板使用 Supabase 的确认链接（默认模板即可）。从邮件打开链接后会返回网站；如果没有自动登录，可回到登录页手动登录。本站使用邮箱密码和确认邮件，不使用 Google 登录。

参考：[注册 API](https://supabase.com/docs/reference/javascript/auth-signup)、[认证回调地址](https://supabase.com/docs/guides/auth/redirect-urls)、[自定义 SMTP 与默认邮件限制](https://supabase.com/docs/guides/auth/auth-smtp)。

## 5. 配置 GitHub Pages

打开仓库 **Settings → Secrets and variables → Actions → Variables**，添加三个 **Repository variables**：

| 名称 | 内容 |
| --- | --- |
| `VITE_SUPABASE_URL` | 项目 Connect 中的 Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key（sb_publishable_ 开头） |
| `VITE_TEAM_ID` | 第 2 步的团队 UUID |

使用 **Variables**，不是 Secrets。浏览器配置只使用公开密钥，不能使用 secret / service_role。

在 **Actions → Deploy research workspace to GitHub Pages → Run workflow** 选择 main 并运行。等待成功后打开正式链接，强制刷新。Netlify 和本地开发的变量配置见 README。

## 6. 成员怎么使用

1. 打开网站，点击“注册账号”。
2. 自己填写姓名、邮箱、至少 8 位的密码，并确认密码。
3. 查收验证邮件并点击确认链接；必要时检查垃圾邮件目录。
4. 回到网站登录，填写姓名并粘贴组长的邀请码。
5. 点击“加入研究小组”。以后直接登录，无需再次输入邀请码。

验证前看不到团队资料，验证邮箱也不会自动获得成员资格。姓名属于展示信息，团队权限只由数据库成员表决定。已由管理员添加到团队的老账号可照常登录。

## 7. 配置后的验收

- 两位成员用各自邮箱注册、验证并使用同一个码入组，确认能共享同一任务。
- 第三个新账号未兑换邀请码时应停留在入组页，不能读取资料。
- 测试错误、过期或撤销的邀请码会失败；正确码加入后刷新可继续访问。
- 确认 PDF 上传和下载正常；原有私有存储权限保持有效。

邮件发送、真实确认回跳、云端会话和跨设备同步，需要在真实 Supabase 项目完成配置后验证。本地 SQL 测试不等同于托管邮件服务验收。

## 常见问题

| 现象 | 检查 |
| --- | --- |
| 仍是演示空间 | 三项 GitHub 变量是否全部保存并重新部署 |
| 提示未开放注册 | Auth 中是否允许新用户注册，Email 是否启用 |
| 邮件发送失败或普通成员收不到 | 自定义 SMTP 是否配置、发件域名是否验证、服务商发送限制与垃圾邮件目录 |
| 验证邮件回到 localhost | URL Configuration 是否填写正式地址并允许精确回调 URL |
| 提示入组功能尚未初始化 | 在同一项目执行 invitations.sql；稍后重试，等待 API schema cache 刷新 |
| 邀请码无效 | 是否复制 invite_code 而非 invite_id；是否属于当前团队；是否过期、撤销或已满 |
| 已入组却无法读取资料 | VITE_TEAM_ID 是否与创建邀请码时使用的 team_id 一致；基础 schema 是否完整执行 |
