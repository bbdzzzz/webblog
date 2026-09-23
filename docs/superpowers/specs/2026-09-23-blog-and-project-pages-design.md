# 博客功能 + 项目详情页 — 设计 Spec

日期:2026-09-23
状态:已与作者确认(2026-09-23)
上游文档:`design.md`(工业拟物)、`docs/superpowers/specs/2026-09-22-industrial-resume-site-design.md`(前端体系)、`AGENTS.md`(三容器架构契约)

## 1. 目标与范围

为 gsy.bbdzpro.top 增加博客与项目详情入口:

- **做**:博客列表页、文章详情页、管理提交页(密码保护)、后端文章 API(纯 Markdown 存储)、MySQL posts 表、首页博客入口按钮、项目卡片可点击进详情页(空占位)。
- **不做**:文章编辑/删除接口、分页、标签、评论、RSS、搜索、富文本编辑器、项目详情页正文内容(留空待填)。

## 2. 数据层

MySQL(现有容器,库名来自 `DB_NAME`)新增 `posts` 表:

| 列 | 类型 | 说明 |
|---|---|---|
| id | INT AUTO_INCREMENT PRIMARY KEY | |
| slug | VARCHAR(120) NOT NULL UNIQUE | URL 标识,小写字母/数字/连字符 |
| title | VARCHAR(200) NOT NULL | |
| markdown | MEDIUMTEXT NOT NULL | 纯 Markdown 原文 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | |

server 启动时执行 `CREATE TABLE IF NOT EXISTS`,幂等,免迁移工具。无 updated_at(无编辑功能)。

## 3. 后端 API(server,Express ESM 沿用现有风格)

新增 `server/src/routes/posts.js`,挂载到 `/api/posts`。

| 方法/路径 | 鉴权 | 行为 | 响应 |
|---|---|---|---|
| `POST /api/posts` | `Authorization: Bearer <ADMIN_TOKEN>` | 校验 body `{title, slug, markdown}`(三者必填非空;slug 匹配 `^[a-z0-9][a-z0-9-]{0,119}$`),插入原文 | 201 `{slug}`;400 `{error:"invalid_input"}`;401 `{error:"unauthorized"}`;409 `{error:"slug_exists"}` |
| `GET /api/posts` | 公开 | 按 created_at 倒序返回列表 | `[{slug, title, created_at, excerpt}]`,excerpt = markdown 去标记后前 120 字符 |
| `GET /api/posts/:slug` | 公开 | 取原文,marked 渲染为 HTML | `{slug, title, created_at, html}`;404 `{error:"not_found"}` |

- `ADMIN_TOKEN` 为新增环境变量,写入 `.env.example`(契约),`.env` 不进 git。server 启动时若 `ADMIN_TOKEN` 缺失,POST 一律 503 `{error:"admin_not_configured"}`,GET 不受影响。
- Markdown 渲染:服务端 `marked`(新增 npm 依赖)。**已知权衡**:输出不做额外消毒——仅持 token 的作者可发文,风险自担;若未来开放他人提交必须加消毒。
- 鉴权比较用 `crypto.timingSafeEqual` 防时序侧信道(长度不等先返回 401)。
- 统一错误处理沿用 `index.js` 的 500 兜底。

## 4. 前端页面(全部沿用工业拟物 token/组件体系,零外部依赖)

新增静态页(nginx/html 下):

| 页面 | 路径 | 内容 |
|---|---|---|
| 博客列表 | `/blog/index.html` | 铭牌栏(复用首页结构,状态灯保留)+ 列表区:每行等宽日期 + 标题链接(指向 `post.html?slug=…`);空态 `NO ENTRIES · 暂无文章`;加载失败显示 OFFLINE 面板 |
| 文章详情 | `/blog/post.html` | 按 `?slug=` 拉取 `GET /api/posts/:slug`,注入服务端渲染的 HTML 到面板容器;含"返回列表"链接;slug 缺失/404 显示提示面板 |
| 管理提交 | `/admin/index.html` | 密码输入框(type=password)+ 标题 + slug + Markdown textarea(均凹陷样式)+ 橙色实体提交按钮;成功 LED 绿 + 显示文章链接;失败 LED 红 + 错误文案;密码仅存内存变量,不落盘 |
| 项目详情 ×2 | `/projects/docker-compose-blog.html`、`/projects/python-log-ai.html` | 空占位:铭牌栏 + 项目标题 + "内容建设中"面板 + 返回首页链接 |

首页(index.html)改动:
- hero 操作区加第三个按钮"博客"(次级样式),指向 `/blog/`。
- 两张项目卡片整卡可点击(stretched-link:标题为真实 `<a>`,`a::after` 绝对定位铺满卡片),分别指向上述两个详情页;键盘焦点落在标题链接上,`:focus-visible` 已有体系;hover 抬升不变,不改卡片其他结构。

文章正文渲染区样式:`.post-body`(main.css 新增段落),为 marked 输出的 h2/h3/p/ul/ol/code/pre/blockquote/a 定义工业拟物内联样式(等宽 code、凹陷 pre 代码块、橙色链接),全部在现有 token 内。

## 5. 部署影响

- `server/package.json` 新增 `marked` 依赖;**顺手处理遗留事项**:服务器首次构建生成 `package-lock.json` 后提交,Dockerfile 切到 `npm ci --omit=dev`。本机已有 Docker,本地生成 lockfile 并提交。
- `.env.example` 增加 `ADMIN_TOKEN=`;服务器 `.env` 需手动加真实值(不进 git)。
- nginx 配置不变(静态页 + `/api/` 反代已覆盖)。
- 部署命令变为 `git pull && docker compose up -d --build`(server 镜像需重建)。

## 6. 错误与降级

- MySQL 未就绪/查询失败:API 500,前端列表/文章页显示 OFFLINE 面板,不白屏。
- 静态预览(无后端):博客页显示 OFFLINE 面板;admin 提交报网络错误文案。
- JS 禁用:列表/文章页不可用(显示静态提示),首页与项目详情页完整可读。
- marked 渲染异常(理论上不抛):500 兜底。

## 7. 验证与验收

本机(Docker 可用):

1. 本地起整套 compose(临时 `.env`,含 ADMIN_TOKEN),`docker compose up -d --build`。
2. curl 验收:`POST` 无 token → 401;错误 slug → 400;正常发文 → 201;`GET /api/posts` 含该文;`GET /api/posts/:slug` 含渲染 HTML;重复 slug → 409。
3. 浏览器走查(1280 + 390):博客列表(空态 + 有文)、文章页、admin 提交全流程、首页博客按钮、项目卡片链接 → 空详情页。
4. 服务器实测:同 spec §8 的 curl 清单 + 浏览器目检。

## 8. API/页面契约一览(实现与评审以此为据)

- 环境变量:`ADMIN_TOKEN`(新增,必填于 .env,见 §3)。
- 请求/响应 JSON 结构:见 §3 表。
- 页面路径:`/blog/`、`/blog/post.html`、`/admin/`、`/projects/docker-compose-blog.html`、`/projects/python-log-ai.html`。
- slug 规则:`^[a-z0-9][a-z0-9-]{0,119}$`。
