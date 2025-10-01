/**
 * app.js — MVP Logger (CORS-safe)
 *
 * Purpose
 * - Send cross-origin POSTs to a Google Apps Script Web App without CORS preflight.
 * - Uses application/x-www-form-urlencoded via URLSearchParams (no custom headers).
 *
 * How it avoids preflight
 * - No custom headers (e.g., no Content-Type: application/json).
 * - Body encoded as form data; method is POST (simple request spec).
 *
 * Requirements
 * - index.html contains:
 *    - <input id="gasUrl"> and <button id="saveUrl">
 *    - <button id="ctaA">, <button id="ctaB">, <button id="heartbeat">
 *    - <div id="status">
 * - Deploy Apps Script Web App as “Anyone” and use the /exec URL.
 *
 * Notes
 * - For higher throughput, consider switching to Sheets API values.append server-side.
 */

const LS_KEY_URL = "gas_url";
const LS_KEY_UID = "uid";

/** Get or create a stable pseudo user id. */
function getUserId() {
  let uid = localStorage.getItem(LS_KEY_UID);
  if (!uid) {
    uid = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
    localStorage.setItem(LS_KEY_UID, uid);
  }
  return uid;
}

/** Read the GAS URL from input or storage; hydrate input if stored. */
function getGasUrl() {
  const input = document.getElementById("gasUrl");
  const entered = (input?.value || "").trim();
  if (entered) return entered;
  const saved = (localStorage.getItem(LS_KEY_URL) || "").trim();
  if (input && saved) input.value = saved;
  return saved;
}

/** Save the GAS URL from input after basic validation. */
function saveGasUrl() {
  const status = document.getElementById("status");
  const url = (document.getElementById("gasUrl")?.value || "").trim();
  if (!url) {
    status.textContent = "Please paste your Apps Script Web App URL (ending with /exec).";
    return;
  }
  try { new URL(url); } catch { status.textContent = "Invalid URL format."; return; }
  localStorage.setItem(LS_KEY_URL, url);
  status.textContent = "Saved Web App URL.";
}

/**
 * Send one event as a CORS simple request (no preflight).
 * Payload fields are flattened into form data.
 * Returns a Promise resolving to raw response text.
 */
async function sendLogSimple(payload) {
  const status = document.getElementById("status");
  const url = getGasUrl();
  if (!url) {
    status.textContent = "Missing Web App URL. Paste it and click Save URL first.";
    return "MISSING_URL";
  }

  const form = new URLSearchParams();
  form.set("event", payload.event || "");
  form.set("variant", payload.variant || "");
  form.set("userId", payload.userId || "");
  form.set("ts", String(payload.ts || Date.now()));
  form.set("meta", JSON.stringify(payload.meta || {}));

  try {
    const res = await fetch(url, {
      method: "POST",
      body: form // application/x-www-form-urlencoded; no headers to avoid preflight
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
    status.textContent = "Logged ✅";
    return text;
  } catch (err) {
    status.textContent = `Log failed: ${String(err)}`;
    return `ERROR: ${String(err)}`;
  }
}

/** Wire UI interactions. */
(function init() {
  const status = document.getElementById("status");
  const saved = localStorage.getItem(LS_KEY_URL);
  if (saved) {
    const input = document.getElementById("gasUrl");
    if (input) input.value = saved;
    status.textContent = "Loaded saved Web App URL.";
  }

  document.getElementById("saveUrl")?.addEventListener("click", saveGasUrl);

  const userId = getUserId();
  const baseMeta = { page: location.pathname, ua: navigator.userAgent };

  document.getElementById("ctaA")?.addEventListener("click", () => {
    sendLogSimple({ event: "cta_click", variant: "A", userId, ts: Date.now(), meta: baseMeta });
  });

  document.getElementById("ctaB")?.addEventListener("click", () => {
    sendLogSimple({ event: "cta_click", variant: "B", userId, ts: Date.now(), meta: baseMeta });
  });

  document.getElementById("heartbeat")?.addEventListener("click", () => {
    sendLogSimple({ event: "heartbeat", userId, ts: Date.now(), meta: baseMeta });
  });
})();
