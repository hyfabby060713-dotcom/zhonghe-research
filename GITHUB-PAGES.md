# 使用 GitHub Pages 发布研究平台

本项目已经配置 GitHub Actions 自动构建与发布，不需要 Netlify。未配置 Supabase 时发布演示版；连接 Supabase 后可在同一 GitHub Pages 网址使用团队共享数据。

## 第一次发布（网页上传方式）

1. 登录 GitHub，在右上角 `+` 中选择 **New repository**。
2. Repository name 填 `zhonghe-research`。普通免费账号使用 **Public** 仓库。勾选 **Add a README file**，点击 **Create repository**，这样可以先开启 Pages 再上传工作流。
3. 打开该仓库 **Settings → Pages**，在 **Build and deployment → Source** 选择 **GitHub Actions**。
4. 下载本机更新后的 `zhonghe-research-source.zip` 并解压。在仓库 **Code → Add file → Upload files** 中，上传解压后的项目文件和子文件夹，包含 `.github`、`src`、`public`、`supabase`、`tests`、`package.json`、`package-lock.json`、`vite.config.ts`、`tsconfig.json`、`index.html` 等。
5. **项目文件放在仓库根目录**：打开仓库首页就应看到 `package.json`，而不是先进入一个 `zhonghe-research` 子文件夹。上传整个压缩包不会自动部署，需要上传解压后的文件。
6. 若上传时未包含 `.github`，使用 **Add file → Create new file**，文件名填写 `.github/workflows/deploy.yml`，粘贴本项目同名文件的内容并提交。
7. 点击 **Commit changes**，提交到 `main` 分支。打开 **Actions**，找到 **Deploy research workspace to GitHub Pages**，等待绿色勾号。
8. 工作流成功后，打开 **Settings → Pages → Visit site**，或者点击 Actions 中 `github-pages` 的部署网址。

仓库名为 `zhonghe-research` 时，访问网址通常是：

```text
https://你的GitHub用户名.github.io/zhonghe-research/
```

理论、文献、任务页面使用 `/#/framework`、`/#/literature`、`/#/tasks` 路由，刷新不依赖服务器重写规则。仓库名或用户名改变时，工作流会从 GitHub Pages 配置自动取得资源路径，无须手改源码。

只上传网页项目代码。`node_modules`、本地 `.env`、`.netlify`、`qa`、临时认领凭据和原始比赛资料都不在源码包中。公开仓库会公开源码，研究资料仍通过后续的 Supabase 私有存储和团队权限管理。

## 后续更新

把修改后的源文件提交到 `main` 或 `master`，Actions 会重新构建并发布。页面链接保持不变。

如果没有自动启动，打开 **Actions → Deploy research workspace to GitHub Pages → Run workflow**，选择默认分支并运行。

## 后续开启真实团队协作

先按 [SUPABASE-SETUP.md](./SUPABASE-SETUP.md) 完成数据库、邀请码和邮箱注册设置。成员现在可以自行注册、验证邮箱、使用邀请码入组，无需逐个预建账号。然后在仓库 **Settings → Secrets and variables → Actions → Variables** 中添加三个 **Repository variables**：

| 名称 | 内容 |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase 项目 URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | publishable / anon 公开密钥 |
| `VITE_TEAM_ID` | 已创建的团队 UUID |

三个值需要一起配置。工作流会在构建时读入它们。设置完成后重新 **Run workflow**，新成员即可在登录页点击注册，验证邮箱后输入邀请码。老成员可直接登录。

这里使用的是公开浏览器密钥；不要设置 service_role / secret key。账号密码不需要添加到 GitHub。更改变量后必须重新构建，刷新浏览器不会修改旧构建。

## 常见问题

| 现象 | 检查 |
| --- | --- |
| Actions 找不到 `package.json` 或 lock file | 文件是否位于仓库根目录；是否上传了 `package-lock.json` |
| 找不到 Pages site / Pages not enabled | Settings → Pages 的 Source 是否已选择 GitHub Actions |
| 仓库中没有 Actions 工作流 | 是否上传 `.github/workflows/deploy.yml`，文件扩展名是否正确 |
| 免费账号没有 Pages 选项 | 是否使用 Public 仓库；组织账号还可能受管理员策略限制 |
| Pages 页面第一次访问是 404 | 确认 Actions 已完成且成功；从 Settings → Pages 的实际地址打开 |
| 页面空白、CSS / JS 资源 404 | 确认使用此版本 `vite.config.ts` 和工作流；不要把项目套在另一层目录里 |
| 网页可以用，但成员间资料不共享 | 当前是本机演示模式，需要连接 Supabase |

参考：[Vite GitHub Pages 部署](https://vite.dev/guide/static-deploy.html#github-pages)、[GitHub 自定义 Pages 工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。
