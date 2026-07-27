(() => {
  "use strict";
  if (!globalThis.AndroidFileBridge) return;
  globalThis.CMA_ANDROID_APP = true;

  function mimeFromName(name) {
    const lower = String(name || "").toLowerCase();
    if (lower.endsWith(".json")) return "application/json";
    if (lower.endsWith(".csv")) return "text/csv";
    if (lower.endsWith(".txt")) return "text/plain";
    return "text/plain";
  }

  const originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function androidDownloadAwareClick() {
    const filename = this.download;
    const href = this.href;
    if (!filename || !href || !globalThis.AndroidFileBridge?.saveTextFile) {
      return originalClick.call(this);
    }
    fetch(href)
      .then((response) => {
        if (!response.ok && !String(href).startsWith("blob:")) throw new Error(`Download failed (${response.status})`);
        return response.text();
      })
      .then((text) => globalThis.AndroidFileBridge.saveTextFile(filename, mimeFromName(filename), text))
      .catch(() => originalClick.call(this));
  };

  document.addEventListener("DOMContentLoaded", () => {
    document.documentElement.classList.add("android-native-app");
    const install = document.getElementById("install-app-button");
    if (install) install.hidden = true;
  }, { once: true });
})();
