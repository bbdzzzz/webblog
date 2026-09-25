# AGENTS.md — gsy.bbdzpro.top 个人网站

## 项目现状（截至 2026-09-25）

最小三容器骨架已上线并验证通过，域名 `https://gsy.bbdzpro.top/` 可访问。单页简历站已上线(纯静态 index.html + main.css + main.js,工业拟物风格,零外部依赖)。博客已上线:posts API(Bearer 鉴权提交,marked 服务端渲染)+ /blog/ 列表、/admin/ 提交页、两个项目空详情页。

## 架构

```
Internet ──443/80──► nginx ──/api──► server(Express) ──► mysql
                     (唯一入口)        (仅内网:3000)      (仅内网:3306)
                       │ 内网 webnet(bridge,服务名互访)
                       └─ volume: ./nginx/{conf.d,html,certs}
```

- **nginx**（官方镜像 `nginx:1.27-alpine`）：唯一暴露端口（80/443）；80 全站 301 跳 HTTPS；443 托管 `nginx/html` 静态页 + 反代 `/api/` 到 `server:3000`。conf/html/certs 全部 volume 挂载，改静态页即时生效，改 conf 后 `docker compose restart nginx`。
- **server**（自建镜像，`node:22-alpine`）：Express + mysql2，纯 JavaScript ESM。仅 `expose 3000`，无 `ports`。路由：`GET /api/health`（不查库，探活）、`GET /api/time`（查 `SELECT NOW()`，验证到库连通）。
- **mysql**（官方镜像 `mysql:8.4`）：仅 `expose 3306`；命名卷 `mysql-data` 持久化；healthcheck 就绪后才放行 server 启动。

## 关键文件与契约

| 文件 | 作用 | 注意 |
|---|---|---|
| `docker-compose.yml` | 三服务编排 | 只 nginx 有 `ports`；`env_file: .env` 注入 server+mysql |
| `docker-compose.local.yml` | 本地开发 | 与 `-f` 联用映射 MySQL 到 127.0.0.1:3306;prod 无 override 不受影响 |
| `.env` / `.env.example` | 密钥与端口 | `.env` 不进 git，服务器上 `chmod 600`；变量名是契约（含 `ADMIN_TOKEN`） |
| `nginx/conf.d/default.conf` | 站点配置 | 证书路径 `/etc/nginx/certs/gsy.bbdzpro.top_{bundle.pem,key}` |
| `nginx/html/index.html` | 简历单页 | 工业拟物;状态灯轮询 `/api/health` |
| `nginx/certs/` | 证书 | 不进 git（`.gitkeep` 除外）；私钥 `chmod 600` |
| `server/src/{index,db,routes/api}.js` | 后端 | `db.js` 读 `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME` |
| `server/src/routes/posts.js` | 博客 API | `GET /` 列表、`GET /:slug` 详情(无需鉴权);`POST /` 需 Bearer ADMIN_TOKEN;slug 规则见 .env.example 段 |
| `server/Dockerfile` | 后端镜像 | `npm ci --omit=dev`(lockfile 已提交) |

环境变量契约（`.env.example` 为准）：`MYSQL_ROOT_PASSWORD`、`MYSQL_DATABASE`、`MYSQL_USER`、`MYSQL_PASSWORD`、`DB_HOST`（容器内=`mysql`）、`DB_PORT`、`DB_NAME`、`DB_USER`、`DB_PASSWORD`、`ADMIN_TOKEN`、`PORT`。

## 部署（服务器）

```bash
# 首次
cp .env.example .env        # 填值,chmod 600 .env
# 证书放入 nginx/certs/,chmod 600 nginx/certs/*.key
docker compose up -d --build

# 后续更新
git pull && docker compose up -d --build
```

验收（服务器上）：

```bash
curl --resolve gsy.bbdzpro.top:443:127.0.0.1 https://gsy.bbdzpro.top/api/health
curl --resolve gsy.bbdzpro.top:443:127.0.0.1 https://gsy.bbdzpro.top/api/time
```

> 80 端口全站 301 到 HTTPS，证书又是签给 `gsy.bbdzpro.top` 的，所以本地验证必须 `--resolve` 把域名钉到 `127.0.0.1`；不能直接 `curl http://localhost/api/...`。

## 本地开发

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d mysql   # local.yml 映射 MySQL 到 127.0.0.1:3306
cp .env.example .env          # 填值
cd server && DB_HOST=127.0.0.1 SERVE_STATIC=<repo绝对路径>/nginx/html npm run dev   # npm run dev 经 --env-file 读 ../.env,inline 变量优先
```

浏览器打开 `http://127.0.0.1:3000/`。

## 工作方式约定（给后续 agent）

- **流程**：新功能走 brainstorming → writing-plans → subagent-driven-development；不要跳过设计直接写代码。
- **验证**：本机已有 Docker(OrbStack),compose 改动可本地实测,服务器实测仍为最终验收。
- **密钥**：绝不把 `.env`、`nginx/certs/` 下的真实证书/私钥提交进 git。
- **文档**：设计与计划存 `docs/superpowers/{specs,plans}/`，并提交。

## 已知遗留（不阻塞，记录在案）

- `.gitignore` 中 `nginx/certs/*` + `!nginx/certs/.gitkeep` 规则缺一行解释注释。
- Nginx 未加 HSTS 头（HTTPS 上线后再评估）。
- `docker-compose.yml` 顶部缺一行"需要 .env"注释；mysql healthcheck 无 `start_period`；nginx `depends_on server` 是短形式（server 无 healthcheck）。

## 下一步

项目详情页正文撰写;文章编辑/删除与分页(需要时另起 brainstorming)。
