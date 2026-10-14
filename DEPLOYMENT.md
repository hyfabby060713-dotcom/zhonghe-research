# Netlify 发布记录

日期：2026 年 10 月 14 日。

## 当前可访问的演示站点

访问地址：<https://glowing-cannoli-392e97.netlify.app/>

已通过 Netlify 官方 CLI 的匿名部署流程发布；服务器返回 `ready`，浏览器确认首页正常渲染并通过 HTTPS 访问，无需 Netlify 登录。理论、文献、任务页面分别刷新后正常。当前版本未配置 Supabase，文献、笔记和任务修改只保存到各自浏览器。

该匿名发布未处理服务器 SPA 重写，因此临时版采用 `VITE_ROUTER_MODE=hash`，页面链接为 `/#/framework`、`/#/literature`、`/#/tasks`。使用页面菜单或完整的 hash 链接。

临时站点的首页“了解案例”与键盘跳转链接有 hash 兼容问题，可通过“研究概览”回到首页，再向下浏览案例简介。本地源码已修复这两处跳转，但 Netlify 返回匿名发布每日额度已用尽，修复未能同步到临时站点。

**这不是已经绑定账号的长期发布。Netlify CLI 提示匿名站点需在生成后 60 分钟内认领。** 当前 Google 在内置浏览器及用户常用浏览器中均拒绝登录，因此账号授权与认领尚未完成。

CLI 在上传后发生网络中断；服务器实际完成部署，但当前站点的认领令牌未能保留。下面文件中的认领地址对应较早的 `dashing-snickerdoodle-d97527` 版本，不对应当前访问网址。长期部署建议恢复账号授权后直接使用下方已建立的正式项目。

较早版本的认领地址只保存在本机已忽略目录：

`D:\《拍案政经》案例大赛\zhonghe-netlify-preview\.netlify\claim-url.txt`

当前部署身份保存在同目录的 `drop-progress.json`。访问网址可以分享给小组成员；认领网址用于将站点绑定到自己的 Netlify 账号。

当前匿名站点 ID：`9865b731-9c83-463c-a7d4-f838d6ec6537`

当前部署 ID：`6acf74c54d597b661ae4a345`

## 已创建、尚未完成正式发布的项目

- 项目名：`zhonghe-research`
- 项目 ID：`f635b02e-1a1b-4edd-8897-eb8543c88401`
- 团队：`hyfabby060713`
- 控制台：<https://app.netlify.com/projects/zhonghe-research>
- 本地关联：项目根目录 `.netlify/state.json`，`.netlify/` 已加入 `.gitignore`。
- 当前尚无成功生产部署，新项目的默认访问权限为私有。

恢复账号授权后，应复用此正式项目，不要再次创建同名项目。重新生成官方授权请求，完成授权后执行：

```powershell
Set-Location -LiteralPath 'D:\《拍案政经》案例大赛\zhonghe-research'
npx --yes netlify-cli@latest login --request=zhonghe-research-deploy --json
# 在自己常用浏览器打开返回的官方授权 URL，完成授权。
# 再执行返回的 check_command，确认授权已保存。
npm run build
npx --yes netlify-cli@latest deploy --dir=dist --prod --site=f635b02e-1a1b-4edd-8897-eb8543c88401 --no-build --json
```

生产部署完成后检查项目的访问设置。如果要让演示站点无需 Netlify 账号即可访问，将正式项目设为 Public，然后以未登录请求检查首页及 `/framework`、`/literature`、`/tasks`。

本轮发布物仅包含 `dist` 中的静态网页、公开示例数据、图标、路由规则与响应头，不包含源码、原始比赛文件或账号密钥。
