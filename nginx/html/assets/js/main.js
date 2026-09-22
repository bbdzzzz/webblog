(() => {
  "use strict";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* 1. /api/health 状态灯:失败时全站其余功能不受影响 */
  const led = document.getElementById("status-led");
  const label = document.getElementById("status-label");
  const setStatus = (ok) => {
    if (!led || !label) return;
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
