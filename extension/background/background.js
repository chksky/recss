const GITHUB_RAW_BASE =
  "https://raw.githubusercontent.com/chksky/recss/main/sites/";
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

/**
 * Fetches CSS for a given hostname from the GitHub repo.
 * Returns the CSS string, or null if not found.
 * Results are cached in browser.storage.local for 1 hour.
 */
async function fetchCSS(hostname) {
  const cacheKey = `css_cache_${hostname}`;
  const now = Date.now();

  // Check cache first
  const cached = await browser.storage.local.get(cacheKey);
  if (cached[cacheKey]) {
    const entry = cached[cacheKey];
    if (now - entry.timestamp < CACHE_DURATION_MS) {
      return entry.css; // null means "no file found", still valid cached result
    }
  }

  // Fetch from GitHub
  const url = `${GITHUB_RAW_BASE}${hostname}.css`;
  let css = null;
  try {
    const response = await fetch(url);
    if (response.ok) {
      css = await response.text();
    }
    // 404 means no CSS for this site — cache that too so we don't keep hitting GitHub
  } catch (e) {
    console.warn(`[recss] Network error fetching CSS for ${hostname}:`, e);
    // Don't cache network errors — try again next time
    return null;
  }

  // Store in cache
  await browser.storage.local.set({
    [cacheKey]: { css, timestamp: now },
  });

  return css;
}

/**
 * Clears the cache for a specific hostname (forces re-fetch on next load).
 */
async function clearCache(hostname) {
  const cacheKey = `css_cache_${hostname}`;
  await browser.storage.local.remove(cacheKey);
}

/**
 * Returns cache metadata for a hostname: { cached, timestamp, hasCSS }
 */
async function getCacheInfo(hostname) {
  const cacheKey = `css_cache_${hostname}`;
  const result = await browser.storage.local.get(cacheKey);
  const entry = result[cacheKey];
  if (!entry) return { cached: false };
  const age = Date.now() - entry.timestamp;
  const expired = age >= CACHE_DURATION_MS;
  return {
    cached: true,
    expired,
    hasCSS: entry.css !== null,
    timestamp: entry.timestamp,
    ageMinutes: Math.floor(age / 60000),
  };
}

// Listen for messages from content script and popup
browser.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "GET_CSS") {
    return fetchCSS(message.hostname);
  }
  if (message.type === "CLEAR_CACHE") {
    return clearCache(message.hostname);
  }
  if (message.type === "GET_CACHE_INFO") {
    return getCacheInfo(message.hostname);
  }
});
