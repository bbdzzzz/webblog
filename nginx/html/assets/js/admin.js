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
