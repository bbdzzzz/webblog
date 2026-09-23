// 共享:健康状态灯。用法:引入后调用 initHealthLed(ledEl, labelEl)。
function initHealthLed(led, label) {
  "use strict";
  if (!led || !label) return;
  const setStatus = (ok) => {
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
}
