# 三容器个人网站最小骨架 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在空仓库中产出一个可直接 `docker compose up -d --build` 跑通的三容器骨架（Nginx 唯一入口托管静态占位页 + 反代 `/api`，Express 后端仅内网并连通 MySQL，MySQL 命名卷持久化），服务器上可验证 HTTPS + 三段连通。

**Architecture:** 三容器（nginx / server / mysql）同处自定义 bridge 网络 `webnet`；只有 nginx 暴露 80/443；server 用官方 Node 镜像构建；nginx 用官方镜像 + volume 挂载 conf/html/certs；mysql 用官方镜像 + 命名卷 `mysql-data` 持久化。所有敏感配置经 `.env` 注入，不进 git。

**Tech Stack:** Docker Compose v2、nginx:1.27-alpine、node:22-alpine、Express 4、mysql2、mysql:8.4、纯手写 HTML。

**Spec:** [docs/superpowers/specs/2026-09-16-docker-three-tier-site-design.md](../specs/2026-09-16-docker-three-tier-site-design.md)

## Global Constraints

- 本机（macOS）**没有 Docker**，所有验证只能靠静态手段（YAML 语法、Node 语法、路径/引用一致性自检）；compose 真正跑通以服务器验收清单（Task 8）为准。
- Node 后端用纯 JavaScript（ESM），`"type": "module"`，不引入 TypeScript、构建步骤或任何业务框架。
- 端口固定：对外 80/443（nginx），内网 3000（server）、3306（mysql），均来自 spec，不在代码中硬编码密钥。
- 所有密钥、密码经 `.env` 注入；`.env` 与 `nginx/certs/` 必须在 `.gitignore` 中。
- 域名固定 `gsy.bbdzpro.top`；证书文件名固定 `gsy.bbdzpro.top_bundle.pem` / `gsy.bbdzpro.top.key`。
- Git 提交用户已配置为 `bbdz`；本计划所有 `git commit` 均沿用当前 git 配置，不额外覆盖。

---

### Task 1: 仓库元文件（.gitignore / .env.example / .dockerignore）

**Files:**
- Create: `.gitignore`
- Create: `.env.example`
- Create: `.dockerignore`

**Interfaces:**
- Consumes: 无
- Produces: `.env.example` 定义后续所有任务使用的环境变量名（`MYSQL_ROOT_PASSWORD`、`MYSQL_DATABASE`、`MYSQL_USER`、`MYSQL_PASSWORD`、`DB_HOST`、`DB_PORT`、`DB_NAME`、`DB_USER`、`DB_PASSWORD`、`PORT`），Task 2/3/4 都依赖这份变量名清单。

- [ ] **Step 1: 写 `.gitignore`**

```gitignore
# 依赖
node_modules/

# 环境变量与密钥
.env

# 证书(私钥绝不能进 git)
nginx/certs/

# 系统文件
.DS_Store

# 日志
*.log
```

- [ ] **Step 2: 写 `.env.example`**

```dotenv
# MySQL 容器自身初始化用
MYSQL_ROOT_PASSWORD=
MYSQL_DATABASE=web
MYSQL_USER=web
MYSQL_PASSWORD=

# 后端连接 MySQL 用(容器内运行时 DB_HOST=mysql)
DB_HOST=mysql
DB_PORT=3306
DB_NAME=web
DB_USER=web
DB_PASSWORD=

# 后端监听端口
PORT=3000
```

- [ ] **Step 3: 写 `.dockerignore`（只影响 server 构建上下文）**

```dockerignore
node_modules
npm-debug.log
.git
.env
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore .env.example .dockerignore
git commit -m "chore: add repo meta files (.gitignore, .env.example, .dockerignore)"
```

---

### Task 2: Express 后端占位服务

**Files:**
- Create: `server/package.json`
- Create: `server/src/index.js`
- Create: `server/src/db.js`
- Create: `server/src/routes/api.js`

**Interfaces:**
- Consumes: `.env` 中的 `PORT`、`DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`（Task 1 定义）。
- Produces: HTTP 服务监听 `0.0.0.0:${PORT}`；两个路由 `GET /api/health` → `{status:"ok"}`、`GET /api/time` → `{now: <db时间>}`；Task 3 的 Dockerfile 依赖 `package.json` 的 `start` 脚本与依赖列表；Task 4 的 Nginx 反代依赖 `/api/*` 路径存在。

- [ ] **Step 1: 写 `server/package.json`**

```json
{
  "name": "web-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js"
  },
  "dependencies": {
    "express": "^4.21.0",
    "mysql2": "^3.11.0"
  }
}
```

- [ ] **Step 2: 写 `server/src/db.js`（mysql2 连接池）**

```js
import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "mysql",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "web",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "web",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;
```

- [ ] **Step 3: 写 `server/src/routes/api.js`**

```js
import { Router } from "express";
import pool from "../db.js";

const router = Router();

// 不查库,用于容器/部署探活
router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// 查库,证明后端能连通 MySQL
router.get("/time", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT NOW() AS now");
    res.json({ now: rows[0].now });
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 4: 写 `server/src/index.js`**

```js
import express from "express";
import apiRouter from "./routes/api.js";

const app = express();
const port = Number(process.env.PORT || 3000);

app.use("/api", apiRouter);

// 统一错误处理(含 MySQL 连接失败)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "internal_error" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`server listening on :${port}`);
});
```

- [ ] **Step 5: 静态校验（本机无 Docker，只能验语法）**

Run:
```bash
node --check server/src/index.js
node --check server/src/db.js
node --check server/src/routes/api.js
```
Expected: 三条命令均无输出（语法正确）。

- [ ] **Step 6: Commit**

```bash
git add server/package.json server/src/
git commit -m "feat(server): minimal Express app with /api/health and /api/time"
```

---

### Task 3: server Dockerfile

**Files:**
- Create: `server/Dockerfile`

**Interfaces:**
- Consumes: `server/package.json` 的 `dependencies` 与 `scripts.start`（Task 2）；`.dockerignore`（Task 1，已在仓库根，需在 server 子目录也放一份或确认构建上下文）。
- Produces: 可构建的 Node 镜像，容器启动命令 `node src/index.js`，监听 3000；Task 6 的 compose `build: ./server` 依赖它。

> 注意：`.dockerignore` 需要作用于 `server/` 构建上下文。Task 1 把它放在了仓库根；compose 的 `build: ./server` 上下文是 `server/`，因此这里在 `server/.dockerignore` 再放一份（内容与根目录一致）。这一步在本任务内完成。

- [ ] **Step 1: 写 `server/.dockerignore`**

```dockerignore
node_modules
npm-debug.log
.env
```

- [ ] **Step 2: 写 `server/Dockerfile`**

```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src

EXPOSE 3000

CMD ["node", "src/index.js"]
```

> 说明：本阶段没有 `package-lock.json`（本机不跑 `npm install` 以避免污染；首次服务器构建时 `npm install` 会生成锁文件，届时建议把锁文件提交进仓库改用 `npm ci`）。这是本机无 Docker 环境下的务实选择，并在 README 中提示用户首次构建后提交锁文件。

- [ ] **Step 3: 静态校验**

Run: `cat server/Dockerfile` 肉眼核对指令顺序（先拷 package 再装依赖再拷源码，最大化利用构建缓存）。
Expected: 指令顺序如上。

- [ ] **Step 4: Commit**

```bash
git add server/Dockerfile server/.dockerignore
git commit -m "build(server): add Dockerfile and .dockerignore"
```

---

### Task 4: Nginx 配置 + 占位静态页

**Files:**
- Create: `nginx/conf.d/default.conf`
- Create: `nginx/html/index.html`
- Create: `nginx/certs/.gitkeep`（占位，实际证书不进 git）

**Interfaces:**
- Consumes: 域名 `gsy.bbdzpro.top`、证书文件名（Global Constraints）；后端 `/api/*` 路径（Task 2）。
- Produces: HTTPS 站点，80→443 跳转，`/api` 反代到 `server:3000`；Task 6 compose 的 volume 挂载路径依赖这里的目录结构。

- [ ] **Step 1: 写 `nginx/conf.d/default.conf`**

```nginx
# HTTP -> HTTPS 跳转
server {
    listen 80;
    server_name gsy.bbdzpro.top;
    return 301 https://$host$request_uri;
}

# HTTPS 主站
server {
    listen 443 ssl;
    server_name gsy.bbdzpro.top;

    ssl_certificate     /etc/nginx/certs/gsy.bbdzpro.top_bundle.pem;
    ssl_certificate_key /etc/nginx/certs/gsy.bbdzpro.top.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    server_tokens off;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy no-referrer always;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location /api/ {
        proxy_pass http://server:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

- [ ] **Step 2: 写 `nginx/html/index.html`（占位页 + 连通性自检）**

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>网站建设中</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; min-height: 100vh; align-items: center; justify-content: center; margin: 0; }
    .card { text-align: center; }
    #api-status.ok { color: #0a7d2c; }
    #api-status.fail { color: #b00020; }
  </style>
</head>
<body>
  <div class="card">
    <h1>网站建设中</h1>
    <p id="api-status">API 检测中…</p>
  </div>
  <script>
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => {
        const el = document.getElementById("api-status");
        el.textContent = d.status === "ok" ? "API 已连通" : "API 异常";
        el.className = d.status === "ok" ? "ok" : "fail";
      })
      .catch(() => {
        const el = document.getElementById("api-status");
        el.textContent = "API 未连通";
        el.className = "fail";
      });
  </script>
</body>
</html>
```

- [ ] **Step 3: 建 `nginx/certs/.gitkeep` 并在 README 提示放证书**

```bash
mkdir -p nginx/certs && touch nginx/certs/.gitkeep
```

- [ ] **Step 4: 静态校验（路径与引用一致性）**

核对清单（肉眼）：
- conf 中 `ssl_certificate` 路径 `/etc/nginx/certs/...` 与 Task 6 compose 挂载目标一致。
- conf 中 `proxy_pass http://server:3000` 与 Task 2 后端端口、Task 6 服务名一致。
- html 中 `fetch("/api/health")` 与 Task 2 路由 `router.get("/health")` + `app.use("/api", ...)` 一致。
Expected: 全部对得上。

- [ ] **Step 5: Commit**

```bash
git add nginx/
git commit -m "feat(nginx): add site config and placeholder index.html"
```

---

### Task 5: docker-compose.yml

**Files:**
- Create: `docker-compose.yml`

**Interfaces:**
- Consumes: `.env`（Task 1 变量）、`server/Dockerfile`（Task 3）、`nginx/conf.d` + `nginx/html` + `nginx/certs`（Task 4）。
- Produces: 一键起三容器的编排；Task 8 的验收清单围绕它。

- [ ] **Step 1: 写 `docker-compose.yml`**

```yaml
services:
  nginx:
    image: nginx:1.27-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d/default.conf:/etc/nginx/conf.d/default.conf:ro
      - ./nginx/html:/usr/share/nginx/html:ro
      - ./nginx/certs:/etc/nginx/certs:ro
    depends_on:
      - server
    networks:
      - webnet
    restart: unless-stopped

  server:
    build: ./server
    expose:
      - "3000"
    env_file:
      - .env
    depends_on:
      mysql:
        condition: service_healthy
    networks:
      - webnet
    restart: unless-stopped

  mysql:
    image: mysql:8.4
    expose:
      - "3306"
    env_file:
      - .env
    volumes:
      - mysql-data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-p$$MYSQL_ROOT_PASSWORD"]
      interval: 5s
      timeout: 3s
      retries: 20
    networks:
      - webnet
    restart: unless-stopped

networks:
  webnet:
    driver: bridge

volumes:
  mysql-data:
```

- [ ] **Step 2: 静态校验（YAML 语法）**

Run（本机有 python 即可，无需 docker）:
```bash
python3 -c "import yaml,sys; yaml.safe_load(open('docker-compose.yml')); print('yaml ok')"
```
Expected: 输出 `yaml ok`。

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "build: add docker-compose for nginx/server/mysql three-tier"
```

---

### Task 6: README（部署与验收）

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: 前 5 个任务产出的所有路径与命令。
- Produces: 服务器首次部署步骤 + 验收清单（用户照做的操作手册）。

- [ ] **Step 1: 写 `README.md`**

````markdown
# gsy.bbdzpro.top 个人网站

三容器架构：Nginx（唯一入口，静态托管 + /api 反代）+ Express（内网 API）+ MySQL（内网数据库，卷持久化）。

## 首次部署（服务器）

1. 安装 Docker 与 compose 插件（略，按发行版文档）。
2. 克隆仓库：`git clone <repo-url> && cd web`
3. 配置环境变量：`cp .env.example .env`，编辑填入真实密码，`chmod 600 .env`
4. 放置证书：把 `gsy.bbdzpro.top_bundle.pem` 与 `gsy.bbdzpro.top.key` 放入 `nginx/certs/`，`chmod 600 nginx/certs/*.key`
5. 启动：`docker compose up -d --build`
6. 提交锁文件（可选但推荐）：首次构建后 `server/package-lock.json` 已生成，回本机 `git add server/package-lock.json && git commit`，并把 `server/Dockerfile` 中 `npm install --omit=dev` 改为 `npm ci --omit=dev`

## 验收清单

```bash
docker compose config            # 语法正确
docker compose up -d --build     # 三容器 Up
docker compose ps                # mysql 应为 healthy
curl http://localhost/api/health # {"status":"ok"}
curl http://localhost/api/time   # {"now":"..."} 证明后端连到 MySQL
```

外网浏览器：
- `https://gsy.bbdzpro.top/` 显示"网站建设中"且页面显示"API 已连通"
- `http://gsy.bbdzpro.top/` 301 跳转到 HTTPS

## 更新

```bash
git pull && docker compose up -d --build
```

静态页改动因 volume 挂载即时生效，无需重启；Nginx 配置改动后 `docker compose restart nginx`。
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with deploy and acceptance steps"
```

---

### Task 7: 最终自检（本机可做的所有验证）

**Files:**
- 不新增文件，只做检查。

- [ ] **Step 1: 检查 git 状态干净且文件齐全**

Run:
```bash
git status --short
find . -type f -not -path "./.git/*" | sort
```
Expected: 工作区干净；文件清单包含：
- `.dockerignore`、`.env.example`、`.gitignore`、`README.md`、`docker-compose.yml`
- `docs/superpowers/specs/2026-09-16-docker-three-tier-site-design.md`
- `docs/superpowers/plans/2026-09-16-docker-three-tier-site-plan.md`
- `nginx/conf.d/default.conf`、`nginx/html/index.html`、`nginx/certs/.gitkeep`
- `server/.dockerignore`、`server/Dockerfile`、`server/package.json`、`server/src/{index.js,db.js,routes/api.js}`

- [ ] **Step 2: 敏感文件确实不会被提交**

Run:
```bash
git check-ignore -v .env nginx/certs/secret.key 2>&1 || true
```
Expected: 两条路径都被 `.gitignore` 命中。

- [ ] **Step 3: 关键引用全局一致性 grep**

Run:
```bash
grep -rn "3000" --include="*.js" --include="*.yml" --include="*.conf" --include="Dockerfile" .
grep -rn "gsy.bbdzpro.top" --include="*.conf" --include="*.md" .
grep -rn "mysql" docker-compose.yml server/src/db.js
```
Expected:
- `3000` 出现在 server 源码、Dockerfile EXPOSE、compose expose、Nginx proxy_pass 中，无矛盾。
- 域名只出现在 Nginx conf 与文档中。
- `db.js` 默认 host 为 `mysql`，与 compose 服务名一致。

---

### Task 8: 交付给用户到服务器验证（人工步骤，计划到此结束）

本计划在本机的所有可自动化步骤到此为止。剩余为**用户在服务器上的人工操作**，不在本计划自动化范围内：

1. 把仓库推到远端并在服务器 `git clone`。
2. 按 README 完成 `.env` 与证书放置。
3. 执行 README 验收清单。
4. 把结果反馈回来：若全部通过，进入业务功能开发；若失败，把 `docker compose ps`、`docker compose logs <service>` 输出带回来定位。

---

## Self-Review 记录

- **Spec 覆盖**：spec 第 4-8 节（目录结构、compose、Nginx、Express、前端占位、.env、错误处理、验收、部署）均映射到 Task 1-6；第 6 节错误处理已体现在 compose healthcheck / depends_on / Express 错误中间件 / Nginx 安全头；第 9 节"后续迭代"属非目标，未安排任务，符合 spec。
- **占位符扫描**：无 TBD/TODO；所有代码块均为可直接落盘的完整内容。
- **类型/命名一致性**：路由路径 `/api/health`、`/api/time` 在 Task 2（定义）、Task 4（前端 fetch）、Task 6（验收 curl）三处一致；环境变量名在 Task 1（.env.example）、Task 2（代码读取）、Task 5（env_file 注入）三处一致；服务名 `server`/`mysql`/`nginx` 与网络 `webnet` 在 Task 4（proxy_pass）、Task 5（compose）一致。
