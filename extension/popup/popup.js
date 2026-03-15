const GITHUB_BASE = "https://github.com/chksky/recss/blob/main/sites/";

let currentHostname = null;
let currentTabId = null;

const elSiteName   = document.getElementById("site-name");
const elToggle     = document.getElementById("toggle");
const elStatusDot  = document.getElementById("status-dot");
const elStatusText = document.getElementById("status-text");
const elCacheInfo  = document.getElementById("cache-info");
const elCacheAge   = document.getElementById("cache-age");
const elBtnRefresh = document.getElementById("btn-refresh");
const elBtnGitHub  = document.getElementById("btn-github");

function setStatus(type, text) {
  elStatusDot.className = `status-indicator ${type}`;
  elStatusText.textContent = text;
}

async function loadPopup() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab || !tab.url) {
    setStatus("inactive", "No active tab");
    return;
  }

  currentTabId = tab.id;

  try {
    const url = new URL(tab.url);
    currentHostname = url.hostname.replace(/^www\./, "");
  } catch {
    setStatus("inactive", "Not a web page");
    return;
  }

  elSiteName.textContent = currentHostname;
  elBtnGitHub.href = `${GITHUB_BASE}${currentHostname}.css`;

  // Load enabled state
  const key = `enabled_${currentHostname}`;
  const stored = await browser.storage.local.get(key);
  const enabled = stored[key] !== false;
  elToggle.checked = enabled;

  if (!enabled) {
    setStatus("inactive", "Disabled for this site");
    return;
  }

  setStatus("loading", "Checking…");

  // Get cache info from background
  const info = await browser.runtime.sendMessage({
    type: "GET_CACHE_INFO",
    hostname: currentHostname
  });

  if (info.cached && !info.expired) {
    if (info.hasCSS) {
      setStatus("active", "CSS applied ✓");
    } else {
      setStatus("inactive", `No .css file found for this site`);
    }
    elCacheInfo.style.display = "flex";
    elCacheAge.textContent = info.ageMinutes === 0
      ? "just now"
      : `${info.ageMinutes}m ago`;
  } else {
    // Trigger a fresh fetch
    const css = await browser.runtime.sendMessage({
      type: "GET_CSS",
      hostname: currentHostname
    });
    if (css) {
      setStatus("active", "CSS applied ✓");
    } else {
      setStatus("inactive", `No .css file found for this site`);
    }
    elCacheInfo.style.display = "flex";
    elCacheAge.textContent = "just now";
  }
}

// Toggle enable/disable
elToggle.addEventListener("change", async () => {
  const enabled = elToggle.checked;
  const key = `enabled_${currentHostname}`;
  await browser.storage.local.set({ [key]: enabled });

  // Tell the content script
  if (currentTabId !== null) {
    browser.tabs.sendMessage(currentTabId, { type: "TOGGLE", enabled }).catch(() => {});
  }

  if (enabled) {
    setStatus("loading", "Applying CSS…");
    elCacheInfo.style.display = "none";
    // Re-run loadPopup to pick up current state
    setTimeout(loadPopup, 300);
  } else {
    setStatus("inactive", "Disabled for this site");
    elCacheInfo.style.display = "none";
  }
});

// Refresh button — clear cache and re-inject
elBtnRefresh.addEventListener("click", async () => {
  if (!currentHostname) return;
  elBtnRefresh.disabled = true;
  setStatus("loading", "Fetching from GitHub…");
  elCacheInfo.style.display = "none";

  await browser.runtime.sendMessage({ type: "CLEAR_CACHE", hostname: currentHostname });

  if (currentTabId !== null) {
    browser.tabs.sendMessage(currentTabId, { type: "RELOAD_CSS" }).catch(() => {});
  }

  setTimeout(async () => {
    await loadPopup();
    elBtnRefresh.disabled = false;
  }, 500);
});

loadPopup();
