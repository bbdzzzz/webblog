# gsy.bbdzpro.top · 个人网站

一个真实上线的个人网站，包含**简历首页**和**博客系统**。三容器架构，一行 `docker compose up -d --build` 即可整体拉起。

🌐 **在线访问**：https://gsy.bbdzpro.top/

---

## ✨ 架构一览

```
Internet ──443/80──► nginx ──/api──► server(Express) ──► mysql
                     (唯一入口)        (仅内网:3000)      (仅内网:3306)
                       │ 内网 webnet(bridge, 服务名互访)
                       └─ volume: ./nginx/{conf.d,html,certs}
```

| 服务 | 镜像 | 职责 | 端口 |
|------|------|------|------|
| **nginx** | `nginx:1.27-alpine` | 唯一入口：静态托管 + `/api` 反代 + HTTPS | 80 / 443（仅它对外） |
| **server** | 自建（`node:22-alpine`） | Express API：探活、查库、博客文章 | 3000（仅内网） |
| **mysql** | `mysql:8.4` | 数据持久化（命名卷 `mysql-data`） | 3306（仅内网） |

> **安全设计**：三个服务里**只有 nginx 用 `ports` 暴露端口**，server 和 mysql 只用 `expose` 留在 Docker 内网——公网上唯一的入口就是 nginx 的 443。

## 🚀 功能

- **简历首页**：纯静态 HTML/CSS/JS，工业拟物风格，零外部依赖；状态灯轮询 `/api/health` 实时显示 API 连通状态。
- **博客系统**：
  - `GET /api/posts`（列表）、`GET /api/posts/:slug`（详情）公开访问；
  - `POST /api/posts` 需 Bearer `ADMIN_TOKEN` 鉴权提交，Markdown 由服务端 `marked` 渲染；
  - 前端页面：`/blog/` 列表页、`/blog/post.html` 文章页、`/admin/` 提交页。

## 📁 目录结构

```
├── docker-compose.yml          # 三服务编排（生产）
├── docker-compose.local.yml    # 本地开发 override（映射 MySQL 到 127.0.0.1）
├── .env.example                # 环境变量契约（复制为 .env 并填值）
├── nginx/
│   ├── conf.d/default.conf     # 站点配置（301 跳转 + SSL + 反代）
│   ├── html/                   # 静态页（首页 / blog / admin / projects）
│   └── certs/                  # 证书与私钥（不进 git）
├── server/
│   ├── Dockerfile
│   └── src/
│       ├── index.js            # 入口
│       ├── db.js               # MySQL 连接
│       └── routes/             # api.js(探活) + posts.js(博客)
└── docs/superpowers/           # 设计文档与实施计划
```

## 🔧 首次部署（服务器）

```bash
# 1. 克隆
git clone https://github.com/bbdzzzz/webblog.git && cd webblog

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入真实密码与 ADMIN_TOKEN
chmod 600 .env

# 3. 放置证书
# 把 gsy.bbdzpro.top_bundle.pem 与 .key 放入 nginx/certs/
chmod 600 nginx/certs/*.key

# 4. 启动
docker compose up -d --build
```

### 环境变量

以 `.env.example` 为准，包括：`MYSQL_ROOT_PASSWORD`、`MYSQL_DATABASE`、`MYSQL_USER`、`MYSQL_PASSWORD`、`DB_HOST`（容器内=`mysql`）、`DB_PORT`、`DB_NAME`、`DB_USER`、`DB_PASSWORD`、`PORT`、`ADMIN_TOKEN`。

## ✅ 验收

```bash
docker compose config            # 语法校验
docker compose ps                # mysql 应为 healthy

# 必须用 --resolve 把域名钉到本机:80 全站 301 跳 HTTPS,
# 且证书签给 gsy.bbdzpro.top,直接对 localhost/IP 握手会校验失败
curl --resolve gsy.bbdzpro.top:443:127.0.0.1 https://gsy.bbdzpro.top/api/health  # {"status":"ok"}
curl --resolve gsy.bbdzpro.top:443:127.0.0.1 https://gsy.bbdzpro.top/api/time    # {"now":"..."} 证明 server→mysql 连通
curl --resolve gsy.bbdzpro.top:443:127.0.0.1 https://gsy.bbdzpro.top/api/posts   # 博客列表
```

## 💻 本地开发

```bash
# 启动 MySQL(local.yml 会把它映射到 127.0.0.1:3306)
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d mysql

cp .env.example .env   # 填值

# 起后端(npm run dev 经 --env-file 读 ../.env,inline 变量优先)
cd server && DB_HOST=127.0.0.1 SERVE_STATIC=<repo绝对路径>/nginx/html npm run dev
```

浏览器打开 `http://127.0.0.1:3000/`。

## 🔄 更新

```bash
git pull && docker compose up -d --build
```

静态页改动因 volume 挂载即时生效；改 nginx 配置后 `docker compose restart nginx`。

## ⚠️ 运维要点

- **密钥**：`.env`、`nginx/certs/` 下的真实证书/私钥**绝不进 git**；服务器上 `chmod 600`。
- **最小暴露面**：数据库/后端不映射到宿主机，仅 nginx 对外。
- **备份**：MySQL 数据在命名卷 `mysql-data`，定期 `mysqldump` 导出异地保存。

---

<div align="center">
  <sub>Built with Docker · Nginx · Express · MySQL · 以及大量 AI pair-programming</sub>
</div>
