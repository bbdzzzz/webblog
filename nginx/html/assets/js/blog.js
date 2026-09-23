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
