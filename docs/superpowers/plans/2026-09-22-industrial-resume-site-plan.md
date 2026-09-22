# 工业拟物单页简历站 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把占位页替换为工业拟物风格的郭世尧单页简历站（纯静态、零构建）。

**Architecture:** 单个 `index.html` + 单个 `main.css` + 单个 `main.js`，直接放 `nginx/html/` 卷挂载目录，无构建步骤，git pull 即生效。唯一运行时依赖是既有 `GET /api/health`（状态灯），失败时全站降级可用。

**Tech Stack:** 原生 HTML/CSS/JS（无框架、无外部 CDN/字体）。

**Spec:** `docs/superpowers/specs/2026-09-22-industrial-resume-site-design.md`

## Global Constraints

- 零外部依赖：不引 CDN、不下 web 字体；图片纹理一律 inline SVG data-URI 或纯 CSS 渐变。
- 全站中文；等宽铭牌元数据用英文大写（风格元素）。
- 设计 token 必须与 spec §4 一致：底盘 `#D6D9DC`、面板 `#E9EBED`、凹陷 `#C4C8CC`、炭黑面板 `#22252A`、文字 `#2B2E33`、安全橙红 `#E8491D`（仅按钮/LED/LIVE 标签）。
- 深度只用左上亮/右下暗成对双向阴影表达，禁止用 `border` 画结构线（ dashed 分隔线除外）。
- 手机号页面源码中只以 `data-phone` 完整出现一次，默认渲染遮蔽态 `199****0852`。
- 本地预览命令（每个需要验证的 task 复用）：`python3 -m http.server 8080 --directory nginx/html`(后台运行，`lsof -ti:8080 | xargs kill` 停止）。预览时 `/api/health` 不可达，状态灯显示 OFFLINE 属预期。
- 内容文案以 `基本信息.md` 为准，项目简述照录原文，不得改写事实。

## 类名/ID 契约（跨 task 接口）

Task 1 产出的 HTML 与后续 CSS/JS 任务通过以下名字对接，不得改名：

- 结构类：`.noise` `.panel` `.recess` `.nameplate` `.nameplate__name` `.nameplate__meta` `.status` `.hero` `.eyebrow` `.hero__sub` `.hero__actions` `.btn` `.btn--primary` `.device` `.device__screen` `.screen__scanlines` `.screen__text` `.device__side` `.device__key` `.section-title` `.section-title__index` `.projects__grid` `.panel-card` `.card__vents` `.card__status` `.screw` `.screw--tl/tr/bl/br` `.pipe` `.tags` `.tag` `.edu__panel` `.edu__period` `.dark-panel` `.skills__list` `.contact__grid` `.contact__meta`
- 状态类（JS 切换）:`.led` `.led--ok` `.led--fail` `.led--power`
- JS 钩子 ID:`#status-led` `#status-label` `#phone-reveal`(带 `data-phone`)`#screen-text`

---

### Task 1: index.html — 全部内容语义化骨架

**Files:**
- Create: `nginx/html/index.html`（覆盖现有占位页）

**Interfaces:**
- Consumes: 无
- Produces: 「类名/ID 契约」中列出的全部类名与 ID

- [ ] **Step 1: 写入完整 index.html**

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>郭世尧 · 个人网站</title>
  <meta name="description" content="郭世尧 — 郑州西亚斯学院人工智能专业 2027 届本科生,独立部署运维 gsy.bbdzpro.top。" />
  <link rel="stylesheet" href="assets/css/main.css" />
</head>
<body>
  <div class="noise" aria-hidden="true"></div>

  <header class="nameplate panel">
    <div class="nameplate__name">郭世尧</div>
    <div class="nameplate__meta mono">Guo Shiyao · AI Engineering · Class of 2027</div>
    <div class="status">
      <span class="led" id="status-led" role="status" aria-label="站点 API 状态"></span>
      <span class="mono" id="status-label">STANDBY</span>
    </div>
  </header>

  <main>
    <section class="hero" id="top">
      <div class="hero__text">
        <p class="eyebrow mono">Personal Terminal · Nanjing</p>
        <h1>人工智能专业本科生,<br />把网站从裸机部署到上线。</h1>
        <p class="hero__sub">郑州西亚斯学院 · 人工智能 · 2027 届。独立完成 Docker Compose 三容器编排、Nginx HTTPS 与 MySQL 运维。可到岗时间:1 周内。</p>
        <div class="hero__actions">
          <a class="btn btn--primary" href="#projects">查看项目</a>
          <a class="btn" href="#contact">联系我</a>
        </div>
      </div>

      <div class="device" role="img" aria-label="复古终端设备模型,屏幕滚动显示个人信息">
        <div class="device__screen recess">
          <pre class="screen__text mono" id="screen-text">GUO SHIYAO
AI ENGINEERING · ZZ SIAS
GSY.BBDZPRO.TOP
STATUS: OPEN TO WORK</pre>
          <div class="screen__scanlines" aria-hidden="true"></div>
        </div>
        <div class="device__side" aria-hidden="true">
          <span class="device__key"></span>
          <span class="device__key"></span>
          <span class="device__key"></span>
          <span class="led led--power"></span>
        </div>
      </div>
    </section>

    <section class="projects" id="projects">
      <h2 class="section-title"><span class="section-title__index mono">SEC.01</span>项目经历</h2>
      <div class="projects__grid">
        <article class="panel panel-card">
          <span class="screw screw--tl" aria-hidden="true"></span>
          <span class="screw screw--tr" aria-hidden="true"></span>
          <span class="screw screw--bl" aria-hidden="true"></span>
          <span class="screw screw--br" aria-hidden="true"></span>
          <div class="card__vents" aria-hidden="true"></div>
          <div class="card__status">
            <span class="led led--ok" aria-hidden="true"></span>
            <span class="mono">LIVE · gsy.bbdzpro.top</span>
          </div>
          <h3>基于 Docker Compose 的个人网站博客系统部署</h3>
          <p>独立完成网站服务器部署,使用 Docker Compose 编排 Nginx、Node、MySQL,配置 Nginx 托管静态页面、HTTPS/301 跳转,Node 与 MySQL 仅内网 expose。最终实现 HTTPS 正常访问、Docker Compose 一键部署。</p>
          <ul class="tags">
            <li class="tag mono">Docker Compose</li>
            <li class="tag mono">Nginx</li>
            <li class="tag mono">MySQL</li>
            <li class="tag mono">Node.js</li>
            <li class="tag mono">HTTPS</li>
            <li class="tag mono">Git Hooks</li>
          </ul>
        </article>

        <div class="pipe" aria-hidden="true"></div>

        <article class="panel panel-card">
          <span class="screw screw--tl" aria-hidden="true"></span>
          <span class="screw screw--tr" aria-hidden="true"></span>
          <span class="screw screw--bl" aria-hidden="true"></span>
          <span class="screw screw--br" aria-hidden="true"></span>
          <div class="card__vents" aria-hidden="true"></div>
          <div class="card__status">
            <span class="led led--ok" aria-hidden="true"></span>
            <span class="mono">CRON · DINGTALK ALERT</span>
          </div>
          <h3>Python 日志分析脚本 + AI 分析 + SKILL</h3>
          <p>Python 编写日志分析与异常告警脚本,解析 Nginx 日志并统计 QPS、状态码分布与 Top IP/URL;基于滑动时间窗口与路径/UA 规则检测异常;集成 LLM 对告警摘要做归因分析与处置建议,通过钉钉远程告警,基于 cron 定时运行。整个链路蒸馏成 AI SKILL 可随时调用。</p>
          <ul class="tags">
            <li class="tag mono">Python</li>
            <li class="tag mono">Nginx 日志</li>
            <li class="tag mono">LLM</li>
            <li class="tag mono">Cron</li>
            <li class="tag mono">AI Skill</li>
          </ul>
        </article>
      </div>
    </section>

    <section class="edu" id="education">
      <div class="panel edu__panel">
        <h2 class="section-title"><span class="section-title__index mono">SEC.02</span>教育经历</h2>
        <p><strong>郑州西亚斯学院 · 人工智能 · 本科</strong></p>
        <p class="edu__period mono">2023.09 — 2027.06</p>
      </div>
    </section>

    <section class="dark-panel" id="skills">
      <h2 class="section-title"><span class="section-title__index mono">SEC.03</span>技术参数</h2>
      <ul class="skills__list mono">
        <li><span>Docker Compose</span><span>Orchestration · Prod</span></li>
        <li><span>Nginx</span><span>Reverse Proxy · TLS</span></li>
        <li><span>MySQL</span><span>8.4 · Persisted</span></li>
        <li><span>Node.js</span><span>Express · ESM</span></li>
        <li><span>Python</span><span>Log Analysis · Alerting</span></li>
        <li><span>Linux</span><span>Ubuntu Server Ops</span></li>
        <li><span>HTTPS</span><span>Cert · 301 Redirect</span></li>
        <li><span>Git</span><span>Hooks · Deploy Flow</span></li>
        <li><span>AI Toolchain</span><span>LLM · Skill Distillation</span></li>
      </ul>
    </section>

    <section class="contact" id="contact">
      <h2 class="section-title"><span class="section-title__index mono">SEC.04</span>联系</h2>
      <div class="contact__grid">
        <a class="btn btn--primary" href="mailto:2331298817@qq.com">2331298817@qq.com</a>
        <button class="btn mono" id="phone-reveal" type="button" data-phone="199-3724-0852">199****0852 · 点击显示</button>
        <a class="btn mono" href="https://gsy.bbdzpro.top">gsy.bbdzpro.top</a>
      </div>
      <p class="contact__meta mono">Nanjing · Available Within 1 Week</p>
    </section>
  </main>

  <footer class="mono">© 2026 Guo Shiyao · gsy.bbdzpro.top</footer>
  <script src="assets/js/main.js" defer></script>
</body>
</html>
```

- [ ] **Step 2: 启动本地预览并验证结构**

Run:
```bash
python3 -m http.server 8080 --directory nginx/html &
sleep 1
curl -s http://127.0.0.1:8080/ | grep -c 'class="panel panel-card"'   # 期望 2
curl -s http://127.0.0.1:8080/ | grep -o 'id="status-led"\|id="phone-reveal"\|id="screen-text"' | wc -l   # 期望 3
curl -s http://127.0.0.1:8080/ | grep -c '199-3724-0852'   # 期望 1(仅 data-phone)
```
Expected: 三条分别输出 `2`、`3`、`1`。

- [ ] **Step 3: Commit**

```bash
git add nginx/html/index.html
git commit -m "feat: resume site HTML skeleton with industrial panel structure"
```

---

### Task 2: main.css 第一段 — token、深度体系、铭牌栏、按钮、LED

**Files:**
- Create: `nginx/html/assets/css/main.css`

**Interfaces:**
- Consumes: Task 1 的类名契约
- Produces: 全局 token(`:root`)、`.panel` `.recess` `.noise` `.mono` `.btn` `.btn--primary` `.led*`,Task 3/4 继续向本文件追加

- [ ] **Step 1: 写入 main.css 初始内容**

```css
/* ===== 1. Tokens & Reset ===== */
:root {
  --chassis: #D6D9DC;
  --panel: #E9EBED;
  --recess: #C4C8CC;
  --dark: #22252A;
  --ink: #2B2E33;
  --ink-soft: #5A5F66;
  --accent: #E8491D;
  --accent-dark: #C23A14;
  --led-green: #3DDC74;
  --led-red: #D43A2A;
  --light-edge: rgba(255, 255, 255, .85);
  --dark-edge: rgba(30, 34, 38, .28);
  --radius: 8px;
  --font-body: system-ui, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif;
  --font-mono: ui-monospace, "SF Mono", "Cascadia Mono", Consolas, "PingFang SC", monospace;
}
*, *::before, *::after { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--chassis);
  color: var(--ink);
  font-family: var(--font-body);
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
}
.mono {
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: .12em;
}

/* ===== 2. 全局噪点(哑光塑料表面) ===== */
.noise {
  position: fixed; inset: 0; z-index: 999; pointer-events: none; opacity: .045;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='140' height='140' filter='url(%23n)'/></svg>");
}

/* ===== 3. 深度体系(双向阴影,不用 border) ===== */
.panel {
  background: var(--panel);
  border-radius: var(--radius);
  box-shadow: -6px -6px 14px var(--light-edge), 6px 6px 14px var(--dark-edge);
}
.recess {
  background: var(--recess);
  border-radius: var(--radius);
  box-shadow: inset -4px -4px 9px var(--light-edge), inset 4px 4px 9px var(--dark-edge);
}

/* ===== 4. 布局 ===== */
.nameplate, main > section, footer {
  width: min(1120px, calc(100% - 48px));
  margin-inline: auto;
}
main > section { margin-top: 96px; }
h1 { font-size: clamp(1.8rem, 4vw, 3rem); line-height: 1.25; margin: .4em 0; }
h3 { margin: 14px 0 8px; font-size: 1.1rem; }
.section-title { font-size: 1.35rem; display: flex; align-items: baseline; gap: 14px; margin: 0 0 28px; }
.section-title__index { font-size: .8rem; color: var(--accent); }

/* ===== 5. 铭牌栏 ===== */
.nameplate {
  display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
  padding: 16px 24px; margin-top: 24px;
}
.nameplate__name { font-size: 1.25rem; font-weight: 700; }
.nameplate__meta { font-size: .72rem; color: var(--ink-soft); flex: 1; }
.status { display: flex; align-items: center; gap: 8px; font-size: .7rem; color: var(--ink-soft); }

/* ===== 6. LED ===== */
.led {
  width: 10px; height: 10px; border-radius: 50%; flex: none;
  background: #9AA0A5;
  box-shadow: inset 1px 1px 2px rgba(0, 0, 0, .35);
}
.led--ok {
  background: var(--led-green);
  box-shadow: 0 0 6px var(--led-green), 0 0 14px rgba(61, 220, 116, .55),
              inset 1px 1px 2px rgba(0, 0, 0, .25);
  animation: breathe 2.4s ease-in-out infinite;
}
.led--fail {
  background: var(--led-red);
  box-shadow: 0 0 6px rgba(212, 58, 42, .6), inset 1px 1px 2px rgba(0, 0, 0, .25);
}
.led--power {
  width: 8px; height: 8px;
  background: var(--accent);
  box-shadow: 0 0 6px rgba(232, 73, 29, .7), inset 1px 1px 1px rgba(0, 0, 0, .3);
}
@keyframes breathe { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }

/* ===== 7. 实体按钮 ===== */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  min-height: 44px; padding: 12px 26px;
  border: 0; border-radius: var(--radius);
  background: var(--panel); color: var(--ink);
  font: inherit; font-weight: 600; text-decoration: none; cursor: pointer;
  box-shadow: -4px -4px 9px var(--light-edge), 4px 4px 9px var(--dark-edge);
  transition: transform .08s ease, box-shadow .08s ease;
}
.btn:hover {
  transform: translateY(-2px);
  box-shadow: -5px -7px 12px var(--light-edge), 5px 7px 12px var(--dark-edge);
}
.btn:active {
  transform: translateY(1px);
  box-shadow: inset -3px -3px 7px var(--light-edge), inset 3px 3px 7px var(--dark-edge);
}
.btn--primary {
  background: var(--accent); color: #FFF;
  box-shadow: -4px -4px 9px var(--light-edge), 4px 4px 9px var(--dark-edge),
              inset 0 1px 0 rgba(255, 255, 255, .35);
}
.btn--primary:active {
  background: var(--accent-dark);
  box-shadow: inset 3px 3px 7px rgba(0, 0, 0, .28);
}
:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; border-radius: 4px; }

/* ===== 8. 降级动效 ===== */
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```

- [ ] **Step 2: 验证**

Run:
```bash
curl -s http://127.0.0.1:8080/assets/css/main.css | grep -c '\-\-chassis: #D6D9DC\|\.btn--primary\|@keyframes breathe'   # 期望 3
```
Expected: `3`。然后由 reviewer 截图 `http://127.0.0.1:8080/`(1280×800)：铭牌栏呈浮起面板、按钮有立体阴影、LED 为灰色待机态（API 不可达时 JS 未跑前）或红色 OFFLINE。

- [ ] **Step 3: Commit**

```bash
git add nginx/html/assets/css/main.css
git commit -m "feat: design tokens, depth system, nameplate, buttons, LEDs"
```

---

### Task 3: main.css 第二段 — Hero 与纯 CSS 3D 设备模型

**Files:**
- Modify: `nginx/html/assets/css/main.css`（追加到文件末尾）

**Interfaces:**
- Consumes: Task 1 的 `.hero .device .device__screen .screen__*` `.device__side .device__key .eyebrow .hero__sub .hero__actions`
- Produces: hero 双列网格与设备模型全部样式

- [ ] **Step 1: 追加 Hero + 设备模型样式**

```css
/* ===== 9. Hero ===== */
.hero {
  display: grid; grid-template-columns: 1.1fr .9fr;
  gap: 64px; align-items: center;
}
.eyebrow { font-size: .72rem; color: var(--ink-soft); margin: 0; }
.hero__sub { color: var(--ink-soft); max-width: 46ch; }
.hero__actions { display: flex; gap: 16px; margin-top: 32px; flex-wrap: wrap; }

/* ===== 10. 设备模型(签名元素) ===== */
.device {
  position: relative;
  transform: rotate(-1deg);
  display: flex;
  padding: 22px 52px 22px 22px;
  border-radius: 18px;
  background:
    repeating-linear-gradient(45deg, rgba(255, 255, 255, .03) 0 2px, transparent 2px 4px),
    repeating-linear-gradient(-45deg, rgba(255, 255, 255, .03) 0 2px, transparent 2px 4px),
    #2E3237;
  box-shadow: -8px -8px 18px var(--light-edge), 10px 12px 22px rgba(30, 34, 38, .4);
}
.device__screen {
  position: relative; flex: 1; aspect-ratio: 4 / 3; overflow: hidden;
  border-radius: 10px;
  background: radial-gradient(ellipse at 50% 40%, #1C2A22 0%, #0D1512 75%);
  box-shadow: inset 0 0 0 3px #101312,
              inset 4px 6px 14px rgba(0, 0, 0, .8),
              inset -2px -2px 8px rgba(255, 255, 255, .06);
}
.screen__text {
  position: absolute; inset: 0; margin: 0; padding: 20px;
  color: #6FE8A0;
  font-size: clamp(.62rem, 1.2vw, .8rem);
  line-height: 1.9; white-space: pre-wrap;
  text-shadow: 0 0 8px rgba(111, 232, 160, .6);
}
.screen__scanlines {
  position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(0deg, rgba(0, 0, 0, .28) 0 2px, transparent 2px 4px);
  animation: scan 9s linear infinite;
}
@keyframes scan { to { background-position: 0 120px; } }
.device__side {
  position: absolute; right: 13px; top: 22px; bottom: 22px; width: 26px;
  display: flex; flex-direction: column; align-items: center; gap: 14px;
}
.device__key {
  width: 18px; height: 12px; border-radius: 3px;
  background: #3A3F45;
  box-shadow: inset 1px 1px 2px rgba(255, 255, 255, .15),
              inset -1px -1px 2px rgba(0, 0, 0, .5);
}
```

- [ ] **Step 2: 验证**

Run:
```bash
curl -s http://127.0.0.1:8080/assets/css/main.css | grep -c '\.device__screen\|@keyframes scan\|\.hero__actions'   # 期望 3
```
Expected: `3`。reviewer 截图：右侧出现深色碳纤维设备、绿色 CRT 屏幕带扫描线、侧边三个按键 + 橙色电源 LED、整体微倾斜。

- [ ] **Step 3: Commit**

```bash
git add nginx/html/assets/css/main.css
git commit -m "feat: hero layout and pure-CSS terminal device model"
```

---

### Task 4: main.css 第三段 — 项目面板、教育、暗色技能面板、联系区

**Files:**
- Modify: `nginx/html/assets/css/main.css`（追加到文件末尾）

**Interfaces:**
- Consumes: Task 1 的 `.projects__grid .panel-card .card__vents .card__status .screw* .pipe .tags .tag .edu__panel .edu__period .dark-panel .skills__list .contact__grid .contact__meta` 与 footer
- Produces: 上述全部组件样式

- [ ] **Step 1: 追加组件样式**

```css
/* ===== 11. 项目面板 ===== */
.projects__grid {
  display: grid; grid-template-columns: 1fr auto 1fr;
  gap: 28px; align-items: center;
}
.panel-card {
  position: relative; padding: 46px 28px 28px;
  transition: transform .18s cubic-bezier(.34, 1.56, .64, 1), box-shadow .18s ease;
}
.projects__grid .panel-card:nth-child(1) { transform: rotate(-.6deg); }
.projects__grid .panel-card:nth-child(3) { transform: rotate(.8deg); }
.panel-card:hover {
  transform: translateY(-5px) rotate(0deg);
  box-shadow: -8px -10px 18px var(--light-edge), 8px 12px 20px var(--dark-edge);
}
.panel-card p { margin: 0; color: var(--ink-soft); font-size: .92rem; }
.card__vents {
  position: absolute; top: 14px; left: 28px; right: 28px; height: 8px;
  border-radius: 2px;
  background: repeating-linear-gradient(90deg, var(--recess) 0 10px, transparent 10px 20px);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, .2);
}
.card__status {
  display: flex; align-items: center; gap: 8px;
  margin-top: 14px; font-size: .68rem; color: var(--ink-soft);
}
.screw {
  position: absolute; width: 12px; height: 12px; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #F4F5F6, #9EA3A8 72%);
  box-shadow: inset 1px 1px 2px rgba(255, 255, 255, .9), inset -1px -1px 2px rgba(0, 0, 0, .35);
}
.screw::after {
  content: ""; position: absolute; left: 1.5px; right: 1.5px; top: 50%;
  height: 1.5px; margin-top: -.75px; border-radius: 1px;
  background: rgba(0, 0, 0, .35); transform: rotate(48deg);
}
.screw--tl { top: 10px; left: 10px; }
.screw--tr { top: 10px; right: 10px; }
.screw--bl { bottom: 10px; left: 10px; }
.screw--br { bottom: 10px; right: 10px; }
.pipe {
  justify-self: center; width: 30px; height: 64px; border-radius: 15px;
  background: linear-gradient(90deg, #B4B9BD 0%, #F1F3F4 45%, #A3A8AD 100%);
  box-shadow: 3px 4px 8px var(--dark-edge), -2px -2px 5px var(--light-edge),
              inset 0 -3px 4px rgba(0, 0, 0, .15);
}
.tags { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0 0; padding: 0; list-style: none; }
.tag {
  position: relative; padding: 5px 10px 5px 22px; border-radius: 4px;
  background: var(--chassis); color: var(--ink-soft); font-size: .62rem;
  box-shadow: inset -2px -2px 4px var(--light-edge), inset 2px 2px 4px var(--dark-edge);
}
.tag::before {
  content: ""; position: absolute; left: 8px; top: 50%;
  width: 6px; height: 6px; margin-top: -3px; border-radius: 50%;
  box-shadow: inset 1px 1px 2px rgba(0, 0, 0, .4), inset -1px -1px 1px rgba(255, 255, 255, .7);
}

/* ===== 12. 教育经历 ===== */
.edu__panel { display: flex; align-items: center; gap: 28px; flex-wrap: wrap; padding: 26px 28px; }
.edu__panel .section-title { margin: 0; }
.edu__panel p { margin: 0; }
.edu__period { font-size: .8rem; color: var(--ink-soft); }

/* ===== 13. 暗色技能面板(明暗呼吸) ===== */
.dark-panel {
  padding: 40px; border-radius: var(--radius);
  background:
    repeating-linear-gradient(45deg, rgba(255, 255, 255, .02) 0 2px, transparent 2px 4px),
    var(--dark);
  color: #C9CED3;
  box-shadow: inset 0 2px 10px rgba(0, 0, 0, .5),
              -6px -6px 14px var(--light-edge), 6px 6px 14px var(--dark-edge);
}
.dark-panel .section-title { color: #E7EAEC; }
.skills__list {
  list-style: none; margin: 0; padding: 0;
  display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2px 40px;
}
.skills__list li {
  display: flex; justify-content: space-between; gap: 16px;
  padding: 9px 2px; font-size: .72rem;
  border-bottom: 1px dashed rgba(255, 255, 255, .14);
}
.skills__list li span:last-child { color: #7FD99E; }

/* ===== 14. 联系区与页脚 ===== */
.contact__grid { display: flex; gap: 16px; flex-wrap: wrap; }
.contact__meta { margin-top: 22px; font-size: .7rem; color: var(--ink-soft); }
footer { margin-top: 110px; margin-bottom: 36px; text-align: center; font-size: .66rem; color: var(--ink-soft); }
```

- [ ] **Step 2: 验证**

Run:
```bash
curl -s http://127.0.0.1:8080/assets/css/main.css | grep -c '\.pipe\|\.tag::before\|\.dark-panel\|\.screw--tl'   # 期望 4
```
Expected: `4`。reviewer 截图：项目卡带四角螺丝、顶部散热缝、中间金属管道连接件、冲孔吊牌；技能区为炭黑暗面板。

- [ ] **Step 3: Commit**

```bash
git add nginx/html/assets/css/main.css
git commit -m "feat: project panels with screws/vents/pipe, dark skills panel, contact"
```

---

### Task 5: main.js — 状态灯、手机号显示、屏幕打字

**Files:**
- Create: `nginx/html/assets/js/main.js`

**Interfaces:**
- Consumes: `#status-led` `#status-label` `#phone-reveal[data-phone]` `#screen-text`,LED 状态类 `.led--ok` `.led--fail`
- Produces: 无下游

- [ ] **Step 1: 写入 main.js**

```js
(() => {
  "use strict";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* 1. /api/health 状态灯:失败时全站其余功能不受影响 */
  const led = document.getElementById("status-led");
  const label = document.getElementById("status-label");
  const setStatus = (ok) => {
    led.classList.remove("led--ok", "led--fail");
    led.classList.add(ok ? "led--ok" : "led--fail");
    label.textContent = ok ? "SYSTEM OPERATIONAL" : "OFFLINE";
  };
  fetch("/api/health")
    .then((r) => r.json())
    .then((d) => setStatus(d.status === "ok"))
    .catch(() => setStatus(false));

  /* 2. 手机号点击显示:按钮替换为 tel 链接 */
  const phoneBtn = document.getElementById("phone-reveal");
  phoneBtn.addEventListener("click", () => {
    const a = document.createElement("a");
    a.className = phoneBtn.className;
    a.href = "tel:" + phoneBtn.dataset.phone.replace(/-/g, "");
    a.textContent = phoneBtn.dataset.phone;
    phoneBtn.replaceWith(a);
  }, { once: true });

  /* 3. CRT 屏幕打字循环(reduced-motion 时保持 Task 1 的静态全文) */
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

- [ ] **Step 2: 验证**

Run:
```bash
node --check nginx/html/assets/js/main.js && echo JS_OK
curl -s http://127.0.0.1:8080/ | grep -c 'assets/js/main.js'   # 期望 1
```
Expected: `JS_OK` 与 `1`。reviewer 在浏览器确认：状态灯变红 OFFLINE(本地无 API)、点击手机号按钮变为 `199-3724-0852` 链接、屏幕文字逐字打出并循环。

- [ ] **Step 3: Commit**

```bash
git add nginx/html/assets/js/main.js
git commit -m "feat: health LED polling, phone reveal, CRT typewriter"
```

---

### Task 6: 响应式媒体查询 + 双视口走查

**Files:**
- Modify: `nginx/html/assets/css/main.css`（追加到文件末尾）

**Interfaces:**
- Consumes: Task 2–4 全部组件类
- Produces: <720px 单列布局规则

- [ ] **Step 1: 追加响应式样式**

```css
/* ===== 15. 移动端:物理隐喻全部保留 ===== */
@media (max-width: 719px) {
  main > section { margin-top: 72px; }
  .hero { grid-template-columns: 1fr; gap: 48px; }
  .device { max-width: 420px; margin-inline: auto; transform: rotate(-.5deg); }
  .projects__grid { grid-template-columns: 1fr; }
  .pipe { transform: rotate(90deg); margin: 10px 0; }
  .hero__actions .btn, .contact__grid .btn, .contact__grid a.btn { width: 100%; }
  .nameplate__meta { flex-basis: 100%; order: 3; }
  .dark-panel { padding: 28px 22px; }
  footer { margin-top: 80px; }
}
```

- [ ] **Step 2: 验证**

Run:
```bash
curl -s http://127.0.0.1:8080/assets/css/main.css | grep -c 'max-width: 719px'   # 期望 1
```
Expected: `1`。

- [ ] **Step 3: 双视口截图走查(reviewer 执行)**

用浏览器工具分别截图 1280×800 与 390×844，逐项核对 spec 签名元素清单：
- [ ] 铭牌栏 + LED 状态灯（等宽标签）
- [ ] 3D 设备模型：碳纤维、扫描线、侧边按键、电源 LED、±1° 旋转
- [ ] 项目卡：四角螺丝、散热缝、管道连接件、冲孔吊牌、LIVE LED
- [ ] 炭黑技能面板（明暗呼吸）
- [ ] 移动端：单列堆叠、按钮全宽、隐喻未退化
发现缺项则修复后重截。

- [ ] **Step 4: Commit**

```bash
git add nginx/html/assets/css/main.css
git commit -m "feat: responsive mobile layout preserving physical metaphors"
```

---

### Task 7: 收尾 — 最终验收与交付

**Files:**
- Modify: `AGENTS.md`（更新「项目现状」与「下一步」段落，反映前端已上线）

**Interfaces:**
- Consumes: 全部前序任务
- Produces: 无

- [ ] **Step 1: 最终全量检查**

Run:
```bash
node --check nginx/html/assets/js/main.js
curl -s http://127.0.0.1:8080/ > /dev/null && echo SERVE_OK
curl -s http://127.0.0.1:8080/ | grep -c '199-3724-0852'   # 期望仍只有 1
lsof -ti:8080 | xargs kill   # 停止预览服务器
```
Expected: 无语法错误、`SERVE_OK`、`1`。

- [ ] **Step 2: 更新 AGENTS.md**

把「项目现状」段落中"业务功能尚未开发，当前是占位实现"改为"单页简历站已上线（纯静态，工业拟物风格）"；把「下一步」改为博客/文章功能规划占位。不要改动其他段落。

- [ ] **Step 3: Commit 并交付部署指令**

```bash
git add AGENTS.md
git commit -m "docs: update project status after resume site launch"
```
最后向用户输出服务器部署指令：`git pull && docker compose up -d`（静态文件卷挂载，无需 rebuild)，以及验收 curl 两条（同 spec §8)。

## Self-Review 记录

- Spec 覆盖：§3.1→T1/T2,§3.2→T1/T3/T5,§3.3→T1/T4,§3.4→T1/T4,§3.5→T1/T4,§3.6→T1/T4/T5,§4→T2,§5→T2/T5,§6→T6,§7→T1(JS 禁用降级)/T5,§8→T6/T7。无缺口。
- Placeholder：所有代码步骤均含完整代码，无 TBD。
- 类型/命名一致：全计划统一使用「类名/ID 契约」;`.screen__scanlines` `.screen__text` `.device__key` 在 HTML(T1)、CSS(T3)、JS(T5）三处拼写一致。
