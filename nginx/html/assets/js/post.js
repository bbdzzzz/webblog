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
