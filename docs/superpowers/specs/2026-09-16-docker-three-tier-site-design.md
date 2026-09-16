# 三容器个人网站架构设计（gsy.bbdzpro.top）

- 日期：2026-09-16
- 状态：已与用户对齐，待实施
- 范围：仅搭建可跑通的最小骨架（占位前端、占位后端、MySQL、Nginx、HTTPS），业务功能后续迭代

> 注：本机（macOS）没有 Docker 环境，所有文件均为静态编写并尽可能静态校验；compose 是否真正跑通以服务器验收清单（第 7 节）为准。

## 1. 背景与目标

用户要一个部署在自己服务器上的个人网站，域名 `gsy.bbdzpro.top`，已有 CA 签发的证书（zip 内含 `_bundle.pem` 与 `.key`）。目标架构：

- Nginx 作为唯一对外入口，托管纯手写静态页，并把 `/api` 反代给后端。
- Node.js（Express + mysql2）后端仅内网暴露，处理动态接口，连接 MySQL。
- MySQL 不对外暴露，数据用命名卷持久化。
- 三容器在同一 Docker 网络，用服务名互访；服务器上 `git pull && docker compose up -d --build` 一键部署。

**当前阶段的特殊约束**：

- 本机没有 Docker 环境，无法本地验证 compose；采用静态校验 + 服务器验收清单兜底。
- 本阶段不开发任何业务功能；前端、后端均为最小占位实现，目标是"服务器上跑通三段连通"。

## 2. 非目标（本阶段不做）

- 任何业务接口（登录、留言、统计等）。
- 前端样式与多页面。
- 数据库初始化脚本、迁移工具。
- 本地开发环境优化（`docker-compose.override.yml` 等），待服务器验证通过、回到本机写代码时再做。
- CI/CD、镜像仓库、自动部署。

## 3. 总体架构

```
                ┌─────────────────────────────────────────┐
   Internet     │           Docker 主机 (服务器)            │
      │         │                                         │
      ▼         │   ┌─────────┐   ┌─────────┐   ┌───────┐ │
   443/80 ─────►│   │  nginx  │──►│ server  │──►│ mysql │ │
                │   │ (唯一入口)│   │(Express)│   │       │ │
                │   └─────────┘   └─────────┘   └───────┘ │
                │        │ 内网 webnet（服务名互访）          │
                │   volume: ./nginx/{conf.d,html,certs}   │
                └─────────────────────────────────────────┘
```

- `nginx`：唯一 `ports` 暴露 `80:80`、`443:443`。
- `server`：无 `ports`，仅 `expose 3000`（仅 `webnet` 内可见）。
- `mysql`：无 `ports`，仅 `expose 3306`；命名卷 `mysql-data` 持久化。
- 三者在自定义 bridge 网络 `webnet`，服务名即主机名。

## 4. 目录结构

```
web/
├── docker-compose.yml          # 编排定义(server 需 build; nginx/mysql 用官方镜像)
├── .env                        # 密钥与端口(.gitignore,手动放服务器)
├── .env.example                # 变量名模板(进 git)
├── .gitignore
├── .dockerignore
├── README.md                   # 部署与验证步骤
├── nginx/
│   ├── conf.d/default.conf     # 站点配置(volume 挂载,改后 restart nginx)
│   ├── html/                   # 手写静态页(volume 挂载,改即生效)
│   │   └── index.html          # 占位页:展示"建设中" + 调 /api/health 显示连通状态
│   └── certs/                  # 证书(.gitignore,手动放置)
│       ├── gsy.bbdzpro.top_bundle.pem
│       └── gsy.bbdzpro.top.key
├── server/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js            # 入口,启动 HTTP 服务
│       ├── db.js               # mysql2 连接池
│       └── routes/
│           └── api.js          # /api/health、/api/time
└── docs/
    └── superpowers/specs/      # 设计文档
```

## 5. 关键设计

### 5.1 docker-compose.yml

要点：

- 只有 `nginx` 有 `ports`；其余服务只 `expose`（仅 `webnet` 内可达）。
- `server` 通过 `build: ./server` 构建；`nginx`、`mysql` 直接用官方镜像。
- `depends_on` 配合 MySQL `healthcheck`，保证库就绪后再起 server。
- 所有敏感配置从 `.env` 注入，不进 git。
- 所有服务 `restart: unless-stopped`。

形态（最终以实施产出为准）：

```yaml
services:
  nginx:
    image: nginx:1.27-alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx/conf.d/default.conf:/etc/nginx/conf.d/default.conf:ro
      - ./nginx/html:/usr/share/nginx/html:ro
      - ./nginx/certs:/etc/nginx/certs:ro
    depends_on: [server]
    networks: [webnet]
    restart: unless-stopped

  server:
    build: ./server
    expose: ["3000"]
    env_file: [.env]
    depends_on:
      mysql:
        condition: service_healthy
    networks: [webnet]
    restart: unless-stopped

  mysql:
    image: mysql:8.4
    expose: ["3306"]
    env_file: [.env]
    volumes:
      - mysql-data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-p$$MYSQL_ROOT_PASSWORD"]
      interval: 5s
      timeout: 3s
      retries: 20
    networks: [webnet]
    restart: unless-stopped

networks:
  webnet:
    driver: bridge

volumes:
  mysql-data:
```

### 5.2 Nginx 配置（`nginx/conf.d/default.conf`）

- 80 端口：`return 301 https://gsy.bbdzpro.top$request_uri;`
- 443 端口：
  - `ssl_certificate     /etc/nginx/certs/gsy.bbdzpro.top_bundle.pem;`
  - `ssl_certificate_key /etc/nginx/certs/gsy.bbdzpro.top.key;`
  - 现代 TLS 参数（TLSv1.2+、合理 cipher、session 缓存）。
  - `root /usr/share/nginx/html; index index.html;`
  - `location / { try_files $uri $uri/ =404; }`
  - `location /api/ { proxy_pass http://server:3000; }` 并设置 `Host`、`X-Real-IP`、`X-Forwarded-For`、`X-Forwarded-Proto`。
  - 基本安全头：`X-Content-Type-Options nosniff`、`X-Frame-Options DENY`、`Referrer-Policy no-referrer`；`server_tokens off;`。

### 5.3 Express 后端（纯 JavaScript, ESM）

- `server/src/index.js`：创建 app，挂载 `routes/api.js`，监听 `0.0.0.0:${PORT || 3000}`。
- `server/src/db.js`：`mysql2/promise` 连接池，参数来自 `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`。
- `server/src/routes/api.js`：
  - `GET /api/health` → `{ status: "ok" }`（不查库，用于容器/部署探活）。
  - `GET /api/time` → 执行 `SELECT NOW() AS now` 返回结果，用于证明"后端→MySQL"连通。
- `server/Dockerfile`：`FROM node:22-alpine` → `WORKDIR /app` → 拷贝 `package*.json` → `npm ci --omit=dev` → 拷贝 `src/` → `CMD ["node", "src/index.js"]`。
- `server/package.json`：`"type": "module"`，依赖 `express`、`mysql2`；`scripts.start = "node src/index.js"`。

### 5.4 前端占位页（`nginx/html/index.html`）

- 纯手写 HTML，无构建。
- 页面显示"网站建设中"。
- 内嵌一小段 JS：`fetch('/api/health')` 成功后把"API 连通"显示在页面上；失败显示"API 未连通"。打开页面即可肉眼判断三段是否跑通。

### 5.5 环境与密钥（`.env`）

`.env.example`（进 git，仅列变量名）：

```
MYSQL_ROOT_PASSWORD=
MYSQL_DATABASE=web
MYSQL_USER=web
MYSQL_PASSWORD=
DB_HOST=mysql
DB_PORT=3306
DB_NAME=web
DB_USER=web
DB_PASSWORD=
PORT=3000
```

- 服务器上 `.env` 由用户手动创建（参考 `.env.example`），权限 `chmod 600`，不进 git。
- `DB_HOST=mysql` 是 compose 网络内的服务名，后端在容器内运行时使用。

## 6. 错误处理与边界

- **MySQL 未就绪**：compose `depends_on + healthcheck` 保证启动顺序；server 的 mysql2 连接池本身会重试。
- **后端宕机**：Nginx `/api` 返回 502，静态页仍可访问。
- **证书缺失/过期**：Nginx 启动失败或 SSL 握手失败；`docker compose ps` / `logs nginx` 可见；更新证书后 `docker compose restart nginx`。
- **端口冲突**：服务器 80/443 被占用时 nginx 容器起不来，需先释放端口。

## 7. 测试与验收

本阶段没有单测；验收靠服务器上的一组人工命令。验收清单（会写进 README）：

1. `docker compose config` 无语法错误。
2. `docker compose up -d --build` 三容器全部 `Up`。
3. `docker compose ps` 显示 `mysql` 为 `healthy`。
4. `curl --resolve gsy.bbdzpro.top:443:127.0.0.1 https://gsy.bbdzpro.top/api/health`（服务器本机）返回 `{"status":"ok"}`。
5. `curl --resolve gsy.bbdzpro.top:443:127.0.0.1 https://gsy.bbdzpro.top/api/time` 返回数据库当前时间，证明后端连到 MySQL。
6. 外网浏览器访问 `https://gsy.bbdzpro.top/` 显示占位页，且页面显示"API 连通"。
7. 外网访问 `http://gsy.bbdzpro.top/` 301 跳转到 HTTPS。

## 8. 部署流程（服务器）

首次：

1. 安装 Docker 与 compose 插件。
2. `git clone` 仓库到服务器。
3. 在仓库根目录创建 `.env`（参考 `.env.example` 填值），`chmod 600 .env`。
4. 把证书文件放入 `nginx/certs/`（`gsy.bbdzpro.top_bundle.pem`、`gsy.bbdzpro.top.key`），确保私钥权限 `chmod 600`。
5. `docker compose up -d --build`。
6. 按第 7 节验收清单逐项验证。

后续更新：

- `git pull && docker compose up -d --build`（仅 server 有 build，秒级；前端改动因 volume 挂载即时生效，无需重启）。

## 9. 后续迭代（本阶段不做，仅记录方向）

- 本地开发环境：`docker-compose.override.yml`（MySQL 临时映射 3306 到宿主机）+ `node --watch` 跑后端。
- 业务功能：在 `server/src/routes/` 下扩展；数据库初始化/迁移脚本放 `server/db/`。
- 前端：在 `nginx/html/` 内扩展多页或引入构建流程。
