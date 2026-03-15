const STYLE_ID = "recss-injected-style";
const hostname = location.hostname.replace(/^www\./, "");

async function isEnabled() {
  const key = `enabled_${hostname}`;
  const result = await browser.storage.local.get(key);
  // Default to enabled
  return result[key] !== false;
}

async function injectCSS() {
  const enabled = await isEnabled();
  if (!enabled) return;

  // Ask background to fetch (handles caching)
  const css = await browser.runtime.sendMessage({
    type: "GET_CSS",
    hostname
  });

  if (!css) return;

  // Remove any existing injected style
  removeCSS();

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.setAttribute("data-recss", "true");
  style.textContent = css;
  document.documentElement.appendChild(style);
}

function removeCSS() {
  const existing = document.getElementById(STYLE_ID);
  if (existing) existing.remove();
}

// Listen for toggle messages from popup
browser.runtime.onMessage.addListener((message) => {
  if (message.type === "TOGGLE") {
    if (message.enabled) {
      injectCSS();
    } else {
      removeCSS();
    }
  }
  if (message.type === "RELOAD_CSS") {
    removeCSS();
    injectCSS();
  }
});

// Run on page load
injectCSS();
