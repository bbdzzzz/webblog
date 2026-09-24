# gsy.bbdzpro.top 个人网站

三容器架构：Nginx（唯一入口，静态托管 + /api 反代）+ Express（内网 API）+ MySQL（内网数据库，卷持久化）。

## 首次部署（服务器）

1. 安装 Docker 与 compose 插件（略，按发行版文档）。
2. 克隆仓库：`git clone <repo-url> && cd web`
3. 配置环境变量：`cp .env.example .env`，编辑填入真实密码，`chmod 600 .env`
4. 放置证书：把 `gsy.bbdzpro.top_bundle.pem` 与 `gsy.bbdzpro.top.key` 放入 `nginx/certs/`，`chmod 600 nginx/certs/*.key`
5. 启动：`docker compose up -d --build`

## 验收清单

```bash
docker compose config            # 语法正确
docker compose up -d --build     # 三容器 Up
docker compose ps                # mysql 应为 healthy
curl --resolve gsy.bbdzpro.top:443:127.0.0.1 https://gsy.bbdzpro.top/api/health # {"status":"ok"}
curl --resolve gsy.bbdzpro.top:443:127.0.0.1 https://gsy.bbdzpro.top/api/time   # {"now":"..."} 证明后端连到 MySQL
curl --resolve gsy.bbdzpro.top:443:127.0.0.1 https://gsy.bbdzpro.top/api/posts
curl --resolve gsy.bbdzpro.top:443:127.0.0.1 https://gsy.bbdzpro.top/blog/
```

注意：80 端口会 301 跳到 HTTPS，且证书只对 `gsy.bbdzpro.top` 有效，所以本机 curl 需要用 `--resolve` 把该域名指到 `127.0.0.1`，才能在不改 `/etc/hosts`、不加 `-k` 的前提下完成有效 TLS 校验。

外网浏览器：
- `https://gsy.bbdzpro.top/` 显示"网站建设中"且页面显示"API 已连通"
- `http://gsy.bbdzpro.top/` 301 跳转到 HTTPS

## 更新

```bash
git pull && docker compose up -d --build
```

静态页改动因 volume 挂载即时生效，无需重启；Nginx 配置改动后 `docker compose restart nginx`。
