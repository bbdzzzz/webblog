# 博客功能 + 项目详情页 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增纯 Markdown 博客(列表/详情/管理提交页 + posts API + MySQL 表)与项目空详情页,首页加入口。

**Architecture:** server 端新增 `routes/posts.js`(marked 服务端渲染 HTML,Bearer token 鉴权写入),启动时幂等建表;前端新增 4 个静态页(blog 列表/详情、admin、projects×2),全部 fetch 同源 `/api`;本地开发经 `SERVE_STATIC` 环境变量让 Express 同源伺服静态页,MySQL 用 compose override 映射到宿主机。

**Tech Stack:** Express 4 ESM、mysql2、marked、原生 HTML/CSS/JS(沿用工业拟物体系)。

**Spec:** `docs/superpowers/specs/2026-09-23-blog-and-project-pages-design.md`

## Global Constraints

- slug 规则(前后端一致):`^[a-z0-9][a-z0-9-]{0,119}$`。
- 环境变量契约:新增 `ADMIN_TOKEN`(写入 `.env.example`,真实值只进服务器 `.env`,绝不进 git)。
- 鉴权:`Authorization: Bearer <ADMIN_TOKEN>`,用 `crypto.timingSafeEqual` 比较;`ADMIN_TOKEN` 未配置时 POST 一律 503 `{error:"admin_not_configured"}`。
- API 响应结构(逐字):POST 201 `{slug}` / 400 `{error:"invalid_input"}` / 401 `{error:"unauthorized"}` / 409 `{error:"slug_exists"}`;GET 列表 `[{slug,title,created_at,excerpt}]`(excerpt=去标记前 120 字符,created_at DESC);GET 详情 `{slug,title,created_at,html}` / 404 `{error:"not_found"}`。
- 前端零外部依赖;新页面复用 `assets/css/main.css` token 与组件类,新增样式只追加到 main.css 末尾(第 16 段)。
- marked 输出不做额外消毒(仅作者可发文,spec §3 已记录的权衡)。
- 页面路径契约:`/blog/`、`/blog/post.html`、`/admin/`、`/projects/docker-compose-blog.html`、`/projects/python-log-ai.html`。
- 本地开发约定(新增,验证全靠它):`docker compose up -d mysql`(override 映射 127.0.0.1:3306)+ `cd server && npm run dev`(`DB_HOST=127.0.0.1`、`SERVE_STATIC=<repo>/nginx/html`、`ADMIN_TOKEN` 经环境变量注入),浏览器访问 `http://127.0.0.1:3000/`。此约定同时补齐 AGENTS.md「本地开发(待补)」。

## 接口契约(跨 task)

- JS 钩子 ID:博客列表 `#post-list` `#list-state`;文章页 `#post-title` `#post-meta` `#post-body` `#post-state`;admin `#admin-token` `#admin-title` `#admin-slug` `#admin-markdown` `#admin-submit` `#admin-led` `#admin-msg`。
- 共享脚本:`assets/js/led.js` 导出全局函数 `initHealthLed(ledEl, labelEl)`(普通 script,非 module)。
- CSS 新类(第 16 段):`.card-link`、`.page-main`、`.list-panel`、`.post-row`、`.post-row__date`、`.post-body`、`.form-field`、`.form-label`、`.form-input`、`.form-textarea`、`.form-msg`、`.back-link`。

---

### Task 1: server 依赖、建表、静态伺服开关、本地开发 override

**Files:**
- Modify: `server/package.json`(加 marked)
- Create: `server/package-lock.json`(npm install 生成)
- Modify: `server/Dockerfile`(npm install → npm ci)
- Modify: `.env.example`(加 ADMIN_TOKEN)
- Modify: `server/src/index.js`(express.json、SERVE_STATIC、启动建表)
- Create: `docker-compose.override.yml`

**Interfaces:**
- Consumes: 现有 `server/src/db.js` 的默认导出 pool。
- Produces: 启动后 MySQL 存在 `posts` 表(Task 2 依赖);`SERVE_STATIC` 同源静态伺服(T3-T6 验证依赖);本地 override(T2 起所有验证依赖)。

- [ ] **Step 1: 加依赖并生成 lockfile**

`server/package.json` 的 dependencies 改为:

```json
  "dependencies": {
    "express": "^4.21.0",
    "marked": "^12.0.0",
    "mysql2": "^3.11.0"
  }
```

Run: `cd server && npm install`
Expected: 生成 `server/package-lock.json`,无报错。

- [ ] **Step 2: Dockerfile 切 npm ci**

`server/Dockerfile` 第 6 行改为:

```dockerfile
RUN npm ci --omit=dev
```

- [ ] **Step 3: .env.example 加契约**

文件末尾追加:

```
# 管理提交文章的 Bearer token(仅 server 用,必填,真实值只放服务器 .env)
ADMIN_TOKEN=
```

- [ ] **Step 4: index.js 完整替换为**

```js
import express from "express";
import apiRouter from "./routes/api.js";
import postsRouter from "./routes/posts.js";
import pool from "./db.js";

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "1mb" }));

app.use("/api", apiRouter);
app.use("/api/posts", postsRouter);

// 本地开发同源静态伺服(生产由 nginx 托管,不设此变量则完全不影响)
if (process.env.SERVE_STATIC) {
  app.use(express.static(process.env.SERVE_STATIC));
}

// 统一错误处理(含 MySQL 连接失败)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "internal_error" });
});

// 幂等建表,就绪后才监听
const ensurePostsTable = `
CREATE TABLE IF NOT EXISTS posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(120) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  markdown MEDIUMTEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

pool
  .query(ensurePostsTable)
  .then(() => {
    app.listen(port, "0.0.0.0", () => {
      console.log(`server listening on :${port}`);
    });
  })
  .catch((err) => {
    console.error("failed to ensure posts table:", err);
    process.exit(1);
  });
```

注意:`server/src/routes/posts.js` 此时还不存在(Task 2 创建),本步验证前先看 Step 6 的临时兜底。

- [ ] **Step 5: 创建 docker-compose.override.yml(提交进 git,作为本地开发约定)**

```yaml
# 本地开发:只把 MySQL 映射到宿主机,server 用 npm run dev 在宿主机跑
services:
  mysql:
    ports:
      - "127.0.0.1:3306:3306"
```

- [ ] **Step 6: 验证**

```bash
cp .env.example .env   # 填入测试值:MYSQL_ROOT_PASSWORD=rootpw MYSQL_PASSWORD=webpw DB_PASSWORD=webpw ADMIN_TOKEN=test-secret-123;chmod 600 .env
docker compose up -d mysql
# 等 MySQL healthy:docker compose ps 里 mysql 显示 (healthy)
# posts.js 未建前 index.js 起不来,先建空占位:server/src/routes/posts.js 内容为
#   import { Router } from "express"; export default Router();
cd server
DB_HOST=127.0.0.1 DB_PORT=3306 DB_USER=web DB_PASSWORD=webpw DB_NAME=web ADMIN_TOKEN=test-secret-123 SERVE_STATIC=/Users/bbdz/projects/webblog/nginx/html PORT=3000 npm run dev &
sleep 3
curl -s http://127.0.0.1:3000/api/health        # 期望 {"status":"ok"}
curl -s http://127.0.0.1:3000/api/time          # 期望含 "now"(库连通)
curl -s http://127.0.0.1:3000/ | head -5        # 期望 index.html 内容(SERVE_STATIC 生效)
docker exec $(docker compose ps -q mysql) mysql -uweb -pwebpw web -e "SHOW TABLES LIKE 'posts'; DESCRIBE posts;"   # 期望 posts 表存在且 5 列
```
Expected: 全部如上。验证后保留 server 进程与 MySQL 运行(Task 2 继续用),占位 posts.js 由 Task 2 完整替换。

- [ ] **Step 7: Commit**

```bash
git add server/package.json server/package-lock.json server/Dockerfile .env.example server/src/index.js docker-compose.override.yml
git commit -m "build: marked dep, npm ci, posts table bootstrap, local dev override"
```

---

### Task 2: posts API(routes/posts.js 完整实现)

**Files:**
- Create: `server/src/routes/posts.js`(替换 Task 1 的占位)

**Interfaces:**
- Consumes: `../db.js` pool;环境变量 `ADMIN_TOKEN`;Task 1 的 `posts` 表与挂载点 `/api/posts`。
- Produces: spec §3 的三个端点,响应结构逐字符合 Global Constraints。

- [ ] **Step 1: 写入完整 posts.js**

```js
import { Router } from "express";
import crypto from "node:crypto";
import { marked } from "marked";
import pool from "../db.js";

const router = Router();
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,119}$/;

const adminToken = () => process.env.ADMIN_TOKEN || "";

const isAuthorized = (req) => {
  const expected = Buffer.from(adminToken());
  if (expected.length === 0) return "unconfigured";
  const header = req.get("Authorization") || "";
  const provided = Buffer.from(header.replace(/^Bearer\s+/i, ""));
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(provided, expected);
};

const stripMarkdown = (md) =>
  md
    .replace(/[#>*`\-[\]()!|~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

// 管理提交:存 Markdown 原文
router.post("/", async (req, res, next) => {
  try {
    const auth = isAuthorized(req);
    if (auth === "unconfigured") {
      return res.status(503).json({ error: "admin_not_configured" });
    }
    if (!auth) {
      return res.status(401).json({ error: "unauthorized" });
    }
    const { title, slug, markdown } = req.body || {};
    if (
      typeof title !== "string" || !title.trim() ||
      typeof slug !== "string" || !SLUG_RE.test(slug) ||
      typeof markdown !== "string" || !markdown.trim()
    ) {
      return res.status(400).json({ error: "invalid_input" });
    }
    try {
      await pool.query(
        "INSERT INTO posts (slug, title, markdown) VALUES (?, ?, ?)",
        [slug, title.trim(), markdown]
      );
    } catch (err) {
      if (err && err.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ error: "slug_exists" });
      }
      throw err;
    }
    res.status(201).json({ slug });
  } catch (err) {
    next(err);
  }
});

// 公开列表:新的在前
router.get("/", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT slug, title, markdown, created_at FROM posts ORDER BY created_at DESC, id DESC"
    );
    res.json(
      rows.map((r) => ({
        slug: r.slug,
        title: r.title,
        created_at: r.created_at,
        excerpt: stripMarkdown(r.markdown),
      }))
    );
  } catch (err) {
    next(err);
  }
});

// 公开详情:服务端渲染 HTML
router.get("/:slug", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT slug, title, markdown, created_at FROM posts WHERE slug = ?",
      [req.params.slug]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "not_found" });
    }
    const post = rows[0];
    res.json({
      slug: post.slug,
      title: post.title,
      created_at: post.created_at,
      html: marked(post.markdown),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 2: 全量 curl 验收矩阵**(Task 1 的 server 进程会因 --watch 自动重载)

```bash
B=http://127.0.0.1:3000/api/posts
curl -s -X POST $B -H 'Content-Type: application/json' -d '{"title":"t","slug":"ok-1","markdown":"# hi"}'                       # 401 unauthorized
curl -s -X POST $B -H 'Authorization: Bearer wrong' -H 'Content-Type: application/json' -d '{"title":"t","slug":"ok-1","markdown":"x"}'  # 401
curl -s -X POST $B -H 'Authorization: Bearer test-secret-123' -H 'Content-Type: application/json' -d '{"title":"t","slug":"BAD SLUG","markdown":"x"}'  # 400 invalid_input
curl -s -X POST $B -H 'Authorization: Bearer test-secret-123' -H 'Content-Type: application/json' -d '{"title":"第一篇测试","slug":"hello-world","markdown":"# 标题\n\n正文 **加粗** 与 `code`。\n\n- 列表项"}'   # 201 {"slug":"hello-world"}
curl -s -X POST $B -H 'Authorization: Bearer test-secret-123' -H 'Content-Type: application/json' -d '{"title":"重复","slug":"hello-world","markdown":"x"}'  # 409 slug_exists
curl -s $B                                            # 200 列表,含 hello-world 与 excerpt
curl -s $B/hello-world                                # 200,html 含 <h1> 与 <strong>
curl -s $B/no-such-post                               # 404 not_found
```
Expected: 注释中的状态/内容逐条命中。

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/posts.js
git commit -m "feat: posts API with bearer auth and server-side markdown rendering"
```

---

### Task 3: led.js 抽取 + 首页改动 + 项目空详情页

**Files:**
- Create: `nginx/html/assets/js/led.js`
- Modify: `nginx/html/assets/js/main.js`(删除健康灯段,改由 led.js 负责)
- Modify: `nginx/html/index.html`(引 led.js、hero 加博客按钮、两卡片整卡链接)
- Modify: `nginx/html/assets/css/main.css`(末尾追加第 16 段之一:`.card-link` `.page-main` `.back-link`)
- Create: `nginx/html/projects/docker-compose-blog.html`、`nginx/html/projects/python-log-ai.html`

**Interfaces:**
- Consumes: T1 的 SERVE_STATIC 伺服;main.css 现有组件类。
- Produces: `initHealthLed(ledEl, labelEl)`(T4/T5 页面复用);项目详情页 URL(T4 不依赖,首页卡片直接链接)。

- [ ] **Step 1: 创建 assets/js/led.js**

```js
// 共享:健康状态灯。用法:引入后调用 initHealthLed(ledEl, labelEl)。
function initHealthLed(led, label) {
  "use strict";
  if (!led || !label) return;
  const setStatus = (ok) => {
    led.classList.remove("led--ok", "led--fail");
    led.classList.add(ok ? "led--ok" : "led--fail");
    label.textContent = ok ? "SYSTEM OPERATIONAL" : "OFFLINE";
  };
  const checkHealth = () => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setStatus(d.status === "ok"))
      .catch(() => setStatus(false));
  };
  checkHealth();
  setInterval(checkHealth, 30000);
}
```

- [ ] **Step 2: main.js 改为(删除健康灯段,保留手机显示与打字机;文件顶部 IIFE 结构不变)**

完整替换为:

```js
(() => {
  "use strict";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  initHealthLed(document.getElementById("status-led"), document.getElementById("status-label"));

  /* 手机号点击显示:按钮替换为 tel 链接 */
  const phoneBtn = document.getElementById("phone-reveal");
  phoneBtn.addEventListener("click", () => {
    const a = document.createElement("a");
    a.className = phoneBtn.className;
    a.href = "tel:" + phoneBtn.dataset.phone.replace(/-/g, "");
    a.textContent = phoneBtn.dataset.phone;
    phoneBtn.replaceWith(a);
  }, { once: true });

  /* CRT 屏幕打字循环(reduced-motion 时保持静态全文) */
  const screen = document.getElementById("screen-text");
  const lines = [
    "GUO SHIYAO",
    "AI ENGINEERING · ZZ SIAS",
    "GSY.BBDZPRO.TOP",
    "STATUS: OPEN TO WORK",
  ];
  if (!reduceMotion && screen) {
    let li = 0, ci = 0;
    screen.textContent = "";
    const tick = () => {
      const line = lines[li];
      ci += 1;
      screen.textContent = lines.slice(0, li).join("\n") + (li ? "\n" : "") + line.slice(0, ci);
      if (ci >= line.length) {
        ci = 0;
        if (li < lines.length - 1) { li += 1; setTimeout(tick, 700); }
        else { setTimeout(() => { li = 0; screen.textContent = ""; tick(); }, 4000); }
      } else {
        setTimeout(tick, 55);
      }
    };
    setTimeout(tick, 900);
  }
})();
```

- [ ] **Step 3: index.html 三处改动**

a) `<script src="assets/js/main.js" defer></script>` 之前插入一行:
```html
  <script src="assets/js/led.js" defer></script>
```

b) hero 操作区(`<div class="hero__actions">` 内,"联系我" 按钮后)加:
```html
          <a class="btn" href="/blog/">博客</a>
```

c) 两张项目卡片的 `<h3>` 标题改为链接(其余结构不动):
- 卡 1:`<h3><a class="card-link" href="/projects/docker-compose-blog.html">基于 Docker Compose 的个人网站博客系统部署</a></h3>`
- 卡 2:`<h3><a class="card-link" href="/projects/python-log-ai.html">Python 日志分析脚本 + AI 分析 + SKILL</a></h3>`

- [ ] **Step 4: main.css 末尾追加**

```css
/* ===== 16a. 整卡链接与内页通用 ===== */
.card-link { color: inherit; text-decoration: none; }
.card-link::after { content: ""; position: absolute; inset: 0; }
.card-link:hover { text-decoration: underline; text-underline-offset: 4px; }
.page-main { margin-top: 48px; }
.back-link { display: inline-block; margin-bottom: 24px; color: var(--ink-soft); font-size: .8rem; text-decoration: none; }
.back-link:hover { color: var(--accent); }
```

- [ ] **Step 5: 创建两个项目详情页(结构相同,仅标题/返回文案不同)**

`nginx/html/projects/docker-compose-blog.html`:

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>基于 Docker Compose 的个人网站博客系统部署 · 郭世尧</title>
  <link rel="stylesheet" href="/assets/css/main.css" />
</head>
<body>
  <div class="noise" aria-hidden="true"></div>
  <header class="nameplate panel">
    <div class="nameplate__name">郭世尧</div>
    <div class="nameplate__meta mono">Project · Docker Compose Blog</div>
    <div class="status">
      <span class="led" id="status-led" aria-label="站点 API 状态"></span>
      <span class="mono" id="status-label" role="status">STANDBY</span>
    </div>
  </header>
  <main class="page-main nameplate">
    <a class="back-link mono" href="/">← 返回首页</a>
    <article class="panel panel-card">
      <span class="screw screw--tl" aria-hidden="true"></span>
      <span class="screw screw--tr" aria-hidden="true"></span>
      <span class="screw screw--bl" aria-hidden="true"></span>
      <span class="screw screw--br" aria-hidden="true"></span>
      <div class="card__vents" aria-hidden="true"></div>
      <h1 style="font-size:1.5rem">基于 Docker Compose 的个人网站博客系统部署</h1>
      <p>内容建设中,敬请期待。</p>
    </article>
  </main>
  <footer class="mono">© 2026 Guo Shiyao · gsy.bbdzpro.top</footer>
  <script src="/assets/js/led.js" defer></script>
  <script>addEventListener("DOMContentLoaded", () => initHealthLed(document.getElementById("status-led"), document.getElementById("status-label")));</script>
</body>
</html>
```

`nginx/html/projects/python-log-ai.html`:同上,仅三处替换:title 与 nameplate__meta 与 h1 改为 `Python 日志分析脚本 + AI 分析 + SKILL`,meta 行改为 `Project · Python Log AI`。

- [ ] **Step 6: 验证**

```bash
node --check nginx/html/assets/js/led.js && node --check nginx/html/assets/js/main.js && echo JS_OK
curl -s http://127.0.0.1:3000/ | grep -c 'href="/blog/"\|card-link'   # 期望 3
curl -s http://127.0.0.1:3000/projects/docker-compose-blog.html | grep -c '内容建设中'   # 期望 1
```
Expected: `JS_OK`、`3`、`1`。reviewer 浏览器走查 http://127.0.0.1:3000/(1280×800):hero 出现"博客"按钮;卡片标题为链接、整卡可点;LED 为绿色 OPERATIONAL(本地 API 已通);两个详情页可打开。

- [ ] **Step 7: Commit**

```bash
git add nginx/html/assets/js/led.js nginx/html/assets/js/main.js nginx/html/index.html nginx/html/assets/css/main.css nginx/html/projects/
git commit -m "feat: shared LED script, blog entry button, clickable project cards, empty project pages"
```

---

### Task 4: 博客列表页 + 文章详情页

**Files:**
- Create: `nginx/html/blog/index.html`、`nginx/html/blog/post.html`
- Create: `nginx/html/assets/js/blog.js`、`nginx/html/assets/js/post.js`
- Modify: `nginx/html/assets/css/main.css`(末尾追加第 16b 段)

**Interfaces:**
- Consumes: `initHealthLed`;API `GET /api/posts`、`GET /api/posts/:slug`;钩子 ID `#post-list` `#list-state` `#post-title` `#post-meta` `#post-body` `#post-state`。
- Produces: `/blog/`、`/blog/post.html?slug=…` 可用页面。

- [ ] **Step 1: 创建 blog/index.html**

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>博客 · 郭世尧</title>
  <link rel="stylesheet" href="/assets/css/main.css" />
</head>
<body>
  <div class="noise" aria-hidden="true"></div>
  <header class="nameplate panel">
    <div class="nameplate__name">郭世尧</div>
    <div class="nameplate__meta mono">Blog · Entries</div>
    <div class="status">
      <span class="led" id="status-led" aria-label="站点 API 状态"></span>
      <span class="mono" id="status-label" role="status">STANDBY</span>
    </div>
  </header>
  <main class="page-main nameplate">
    <a class="back-link mono" href="/">← 返回首页</a>
    <section class="dark-panel">
      <h2 class="section-title"><span class="section-title__index mono">LOG</span>文章列表</h2>
      <p class="mono form-msg" id="list-state">LOADING…</p>
      <ul class="post-list mono" id="post-list"></ul>
    </section>
  </main>
  <footer class="mono">© 2026 Guo Shiyao · gsy.bbdzpro.top</footer>
  <script src="/assets/js/led.js" defer></script>
  <script src="/assets/js/blog.js" defer></script>
</body>
</html>
```

- [ ] **Step 2: 创建 assets/js/blog.js**

```js
addEventListener("DOMContentLoaded", () => {
  "use strict";
  initHealthLed(document.getElementById("status-led"), document.getElementById("status-label"));

  const list = document.getElementById("post-list");
  const state = document.getElementById("list-state");

  const fmtDate = (iso) => {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
  };

  fetch("/api/posts")
    .then((r) => r.json())
    .then((posts) => {
      if (!Array.isArray(posts)) throw new Error("bad payload");
      if (posts.length === 0) {
        state.textContent = "NO ENTRIES · 暂无文章";
        return;
      }
      state.remove();
      for (const p of posts) {
        const li = document.createElement("li");
        li.className = "post-row";
        const a = document.createElement("a");
        a.href = "/blog/post.html?slug=" + encodeURIComponent(p.slug);
        const date = document.createElement("span");
        date.className = "post-row__date";
        date.textContent = fmtDate(p.created_at);
        const title = document.createElement("span");
        title.className = "post-row__title";
        title.textContent = p.title;
        a.append(date, title);
        li.append(a);
        if (p.excerpt) {
          const ex = document.createElement("p");
          ex.className = "post-row__excerpt";
          ex.textContent = p.excerpt;
          li.append(ex);
        }
        list.append(li);
      }
    })
    .catch(() => {
      state.textContent = "OFFLINE · 列表加载失败,请稍后再试";
    });
});
```

- [ ] **Step 3: 创建 blog/post.html**

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>文章 · 郭世尧</title>
  <link rel="stylesheet" href="/assets/css/main.css" />
</head>
<body>
  <div class="noise" aria-hidden="true"></div>
  <header class="nameplate panel">
    <div class="nameplate__name">郭世尧</div>
    <div class="nameplate__meta mono">Blog · Entry</div>
    <div class="status">
      <span class="led" id="status-led" aria-label="站点 API 状态"></span>
      <span class="mono" id="status-label" role="status">STANDBY</span>
    </div>
  </header>
  <main class="page-main nameplate">
    <a class="back-link mono" href="/blog/">← 返回列表</a>
    <article class="panel panel-card">
      <span class="screw screw--tl" aria-hidden="true"></span>
      <span class="screw screw--tr" aria-hidden="true"></span>
      <span class="screw screw--bl" aria-hidden="true"></span>
      <span class="screw screw--br" aria-hidden="true"></span>
      <div class="card__vents" aria-hidden="true"></div>
      <p class="mono form-msg" id="post-state">LOADING…</p>
      <h1 id="post-title" style="font-size:1.5rem"></h1>
      <p class="mono" id="post-meta"></p>
      <div class="post-body" id="post-body"></div>
    </article>
  </main>
  <footer class="mono">© 2026 Guo Shiyao · gsy.bbdzpro.top</footer>
  <script src="/assets/js/led.js" defer></script>
  <script src="/assets/js/post.js" defer></script>
</body>
</html>
```

- [ ] **Step 4: 创建 assets/js/post.js**

```js
addEventListener("DOMContentLoaded", () => {
  "use strict";
  initHealthLed(document.getElementById("status-led"), document.getElementById("status-label"));

  const state = document.getElementById("post-state");
  const titleEl = document.getElementById("post-title");
  const metaEl = document.getElementById("post-meta");
  const bodyEl = document.getElementById("post-body");

  const slug = new URLSearchParams(location.search).get("slug");
  if (!slug) {
    state.textContent = "MISSING SLUG · 缺少文章标识";
    return;
  }

  fetch("/api/posts/" + encodeURIComponent(slug))
    .then((r) => {
      if (r.status === 404) throw new Error("not_found");
      return r.json();
    })
    .then((post) => {
      state.remove();
      document.title = post.title + " · 郭世尧";
      titleEl.textContent = post.title;
      const d = new Date(post.created_at);
      const p = (n) => String(n).padStart(2, "0");
      metaEl.textContent = `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} · ${post.slug}`;
      bodyEl.innerHTML = post.html;
    })
    .catch((err) => {
      state.textContent = err.message === "not_found"
        ? "NOT FOUND · 文章不存在"
        : "OFFLINE · 加载失败,请稍后再试";
    });
});
```

- [ ] **Step 5: main.css 末尾追加**

```css
/* ===== 16b. 博客列表与文章正文 ===== */
.post-list { list-style: none; margin: 0; padding: 0; }
.post-row { padding: 14px 2px; border-bottom: 1px dashed rgba(255, 255, 255, .14); }
.post-row a { display: flex; gap: 18px; align-items: baseline; color: #E7EAEC; text-decoration: none; font-size: .78rem; }
.post-row a:hover .post-row__title { color: #7FD99E; }
.post-row__date { color: #7FD99E; flex: none; }
.post-row__excerpt { margin: 6px 0 0; font-size: .68rem; color: #9AA0A5; }
.form-msg { font-size: .72rem; color: #9AA0A5; }
.post-body { margin-top: 18px; color: var(--ink); font-size: .95rem; }
.post-body h2, .post-body h3 { margin: 1.2em 0 .4em; }
.post-body p { margin: .6em 0; }
.post-body ul, .post-body ol { padding-left: 1.4em; }
.post-body code { font-family: var(--font-mono); font-size: .85em; background: var(--recess); padding: 2px 6px; border-radius: 4px; }
.post-body pre { background: var(--recess); border-radius: var(--radius); padding: 16px; overflow-x: auto; box-shadow: inset -3px -3px 7px var(--light-edge), inset 3px 3px 7px var(--dark-edge); }
.post-body pre code { background: none; padding: 0; }
.post-body blockquote { margin: 1em 0; padding: 4px 16px; border-left: 3px solid var(--accent); color: var(--ink-soft); }
.post-body a { color: var(--accent); }
.post-body img { max-width: 100%; }
```

- [ ] **Step 6: 验证**(Task 2 的 `hello-world` 文章仍在库中)

```bash
node --check nginx/html/assets/js/blog.js && node --check nginx/html/assets/js/post.js && echo JS_OK
curl -s http://127.0.0.1:3000/blog/ | grep -c 'post-list\|list-state'   # 期望 2
```
Expected: `JS_OK`、`2`。reviewer 浏览器走查(1280×800):`/blog/` 显示 hello-world(日期+标题+摘要,炭黑面板);点击进入 `post.html?slug=hello-world` 显示渲染后的标题/加粗/code/列表;`/blog/post.html`(无 slug)显示 MISSING SLUG;`?slug=nope` 显示 NOT FOUND。

- [ ] **Step 7: Commit**

```bash
git add nginx/html/blog/ nginx/html/assets/js/blog.js nginx/html/assets/js/post.js nginx/html/assets/css/main.css
git commit -m "feat: blog list and article pages with server-rendered markdown"
```

---

### Task 5: 管理提交页

**Files:**
- Create: `nginx/html/admin/index.html`
- Create: `nginx/html/assets/js/admin.js`
- Modify: `nginx/html/assets/css/main.css`(末尾追加第 16c 段)

**Interfaces:**
- Consumes: `initHealthLed`;`POST /api/posts`(Bearer);钩子 ID `#admin-token` `#admin-title` `#admin-slug` `#admin-markdown` `#admin-submit` `#admin-led` `#admin-msg`。
- Produces: `/admin/` 可提交文章。

- [ ] **Step 1: 创建 admin/index.html**

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>提交文章 · 郭世尧</title>
  <meta name="robots" content="noindex" />
  <link rel="stylesheet" href="/assets/css/main.css" />
</head>
<body>
  <div class="noise" aria-hidden="true"></div>
  <header class="nameplate panel">
    <div class="nameplate__name">郭世尧</div>
    <div class="nameplate__meta mono">Admin · New Entry</div>
    <div class="status">
      <span class="led" id="status-led" aria-label="站点 API 状态"></span>
      <span class="mono" id="status-label" role="status">STANDBY</span>
    </div>
  </header>
  <main class="page-main nameplate">
    <a class="back-link mono" href="/blog/">← 返回列表</a>
    <section class="panel panel-card">
      <span class="screw screw--tl" aria-hidden="true"></span>
      <span class="screw screw--tr" aria-hidden="true"></span>
      <span class="screw screw--bl" aria-hidden="true"></span>
      <span class="screw screw--br" aria-hidden="true"></span>
      <div class="card__vents" aria-hidden="true"></div>
      <h1 style="font-size:1.3rem">提交文章</h1>
      <form id="admin-form" novalidate>
        <div class="form-field">
          <label class="form-label mono" for="admin-token">管理密码</label>
          <input class="form-input recess" id="admin-token" type="password" autocomplete="current-password" required />
        </div>
        <div class="form-field">
          <label class="form-label mono" for="admin-title">标题</label>
          <input class="form-input recess" id="admin-title" type="text" required />
        </div>
        <div class="form-field">
          <label class="form-label mono" for="admin-slug">Slug(小写字母/数字/连字符)</label>
          <input class="form-input recess mono" id="admin-slug" type="text" pattern="[a-z0-9][a-z0-9\-]*" required />
        </div>
        <div class="form-field">
          <label class="form-label mono" for="admin-markdown">正文(Markdown)</label>
          <textarea class="form-textarea recess mono" id="admin-markdown" rows="12" required></textarea>
        </div>
        <div class="form-actions">
          <button class="btn btn--primary" id="admin-submit" type="submit">发布</button>
          <span class="led" id="admin-led" aria-hidden="true"></span>
          <span class="mono form-msg" id="admin-msg"></span>
        </div>
      </form>
    </section>
  </main>
  <footer class="mono">© 2026 Guo Shiyao · gsy.bbdzpro.top</footer>
  <script src="/assets/js/led.js" defer></script>
  <script src="/assets/js/admin.js" defer></script>
</body>
</html>
```

- [ ] **Step 2: 创建 assets/js/admin.js**

```js
addEventListener("DOMContentLoaded", () => {
  "use strict";
  initHealthLed(document.getElementById("status-led"), document.getElementById("status-label"));

  const form = document.getElementById("admin-form");
  const led = document.getElementById("admin-led");
  const msg = document.getElementById("admin-msg");
  const submit = document.getElementById("admin-submit");

  const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,119}$/;
  const ERR_TEXT = {
    unauthorized: "密码错误",
    invalid_input: "输入不合法,检查标题/slug/正文",
    slug_exists: "slug 已存在,换一个",
    admin_not_configured: "服务端未配置 ADMIN_TOKEN",
  };

  const flash = (ok, text) => {
    led.classList.remove("led--ok", "led--fail");
    led.classList.add(ok ? "led--ok" : "led--fail");
    msg.textContent = text;
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const token = document.getElementById("admin-token").value;
    const title = document.getElementById("admin-title").value.trim();
    const slug = document.getElementById("admin-slug").value.trim();
    const markdown = document.getElementById("admin-markdown").value;
    if (!token || !title || !markdown.trim() || !SLUG_RE.test(slug)) {
      flash(false, "请完整填写,slug 仅限小写字母/数字/连字符");
      return;
    }
    submit.disabled = true;
    fetch("/api/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ title, slug, markdown }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (r.status === 201) {
          flash(true, "已发布 → /blog/post.html?slug=" + data.slug);
          form.reset();
        } else {
          flash(false, ERR_TEXT[data.error] || "发布失败(" + r.status + ")");
        }
      })
      .catch(() => flash(false, "网络错误,未提交"))
      .finally(() => { submit.disabled = false; });
  });
});
```

- [ ] **Step 3: main.css 末尾追加**

```css
/* ===== 16c. 管理表单 ===== */
.form-field { margin: 16px 0; }
.form-label { display: block; margin-bottom: 6px; font-size: .68rem; color: var(--ink-soft); }
.form-input, .form-textarea { width: 100%; padding: 10px 14px; border: 0; color: var(--ink); font: inherit; }
.form-textarea { resize: vertical; line-height: 1.6; }
.form-input:focus, .form-textarea:focus { outline: 3px solid var(--accent); outline-offset: 2px; }
.form-actions { display: flex; align-items: center; gap: 14px; margin-top: 20px; }
```

- [ ] **Step 4: 验证**

```bash
node --check nginx/html/assets/js/admin.js && echo JS_OK
curl -s http://127.0.0.1:3000/admin/ | grep -c 'admin-token\|admin-markdown\|admin-submit'   # 期望 3
```
Expected: `JS_OK`、`3`。reviewer 浏览器全流程(1280×800):`/admin/` 空提交 → 红灯提示;错误密码 → "密码错误";正确密码(test-secret-123)+ 合法表单 → 绿灯"已发布";到 `/blog/` 能看到新文章;重复 slug → "slug 已存在"。

- [ ] **Step 5: Commit**

```bash
git add nginx/html/admin/ nginx/html/assets/js/admin.js nginx/html/assets/css/main.css
git commit -m "feat: admin submission page with token auth and LED feedback"
```

---

### Task 6: 全栈验收 + 文档更新收尾

**Files:**
- Modify: `AGENTS.md`(项目现状、关键文件表、本地开发段落、下一步)
- Modify: `README.md`(验收命令清单补充)

**Interfaces:**
- Consumes: 全部前序任务。
- Produces: 无下游。

- [ ] **Step 1: 完整验收矩阵(本地一次性跑完)**

```bash
B=http://127.0.0.1:3000
# API
curl -s $B/api/health                                   # {"status":"ok"}
curl -s -X POST $B/api/posts -H 'Content-Type: application/json' -d '{}'   # 401
curl -s $B/api/posts | grep -c hello-world              # ≥1
curl -s $B/api/posts/hello-world | grep -c '<h1'        # ≥1
curl -s -o /dev/null -w '%{http_code}' $B/api/posts/ghost   # 404
# 页面可达
for p in / /blog/ /blog/post.html /admin/ /projects/docker-compose-blog.html /projects/python-log-ai.html; do curl -s -o /dev/null -w "$p %{http_code}\n" $B$p; done   # 全 200
```

- [ ] **Step 2: 双视口走查(reviewer 执行)**

1280×800 与 390×844 各截:首页(博客按钮+卡片链接)、/blog/(有文章)、文章页、/admin/。核对:工业拟物组件完整(铭牌/LED/螺丝/散热缝/炭黑列表)、移动端堆叠不破版、无横向溢出(document.documentElement.scrollWidth ≤ 视口宽)。

- [ ] **Step 3: 更新 AGENTS.md**

- 「项目现状」段落:在简历站一句后追加"博客已上线:posts API(Bearer 鉴权提交,marked 服务端渲染)+ /blog/ 列表、/admin/ 提交页、两个项目空详情页。"
- 「关键文件与契约」表:新增行 `server/src/routes/posts.js | 博客 API | POST 需 Bearer ADMIN_TOKEN;slug 规则见 .env.example 段`;`.env` 行的"变量名是契约"注意里追加 `ADMIN_TOKEN`;`docker-compose.override.yml | 本地开发 | 仅映射 MySQL 到 127.0.0.1:3306`。
- 「本地开发(待补)」整段替换为「## 本地开发」:`docker compose up -d mysql`(override 已映射 3306)→ `cp .env.example .env` 填值 → `cd server && DB_HOST=127.0.0.1 SERVE_STATIC=<repo绝对路径>/nginx/html npm run dev` → 浏览器 `http://127.0.0.1:3000/`。
- 「下一步」:替换为"项目详情页正文撰写;文章编辑/删除与分页(需要时另起 brainstorming)。"

- [ ] **Step 4: 更新 README.md 验收段落**,追加:

```bash
curl --resolve gsy.bbdzpro.top:443:127.0.0.1 https://gsy.bbdzpro.top/api/posts
curl --resolve gsy.bbdzpro.top:443:127.0.0.1 https://gsy.bbdzpro.top/blog/
```

- [ ] **Step 5: 清理验证环境并 Commit**

```bash
# 停掉本地 server 进程(npm run dev)与 MySQL:docker compose down(保留数据卷,测试文章留库无妨,服务器是新库)
git add AGENTS.md README.md
git commit -m "docs: local dev guide and blog acceptance commands"
```

## Self-Review 记录

- Spec 覆盖:§2→T1;§3→T1(ADMIN_TOKEN 契约)+T2;§4→T3(首页/详情页/led)+T4(博客页)+T5(admin)+CSS 16a/b/c;§5→T1;§6→T2/T4/T5 错误路径;§7→T6。无缺口。
- Placeholder:全部代码步骤含完整代码;无 TBD。
- 命名一致:钩子 ID、`initHealthLed`、CSS 类、slug 规则、错误文案在 T2-T6 逐字一致;`stripMarkdown` 只出现在 posts.js。
- T1 的 Step 6 显式说明 posts.js 占位由 T2 替换,避免"引用未定义模块"断链。
