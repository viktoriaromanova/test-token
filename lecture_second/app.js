const tokenEl = document.getElementById("token");
const reviewEl = document.getElementById("review");
const sentEl = document.getElementById("sent");
const nounEl = document.getElementById("noun");
const errEl = document.getElementById("error");
const spinner = document.getElementById("spinner");
const btnRand = document.getElementById("btn-rand");
const btnSent = document.getElementById("btn-sent");
const btnNoun = document.getElementById("btn-noun");

let reviews = [];
let ready = false;

init();

function init() {
  loadTSV().finally(() => (ready = true));
  btnRand.addEventListener("click", onRandom);
  btnSent.addEventListener("click", onSentiment);
  btnNoun.addEventListener("click", onNouns);
}

async function loadTSV() {
  resetUI();
  try {
    const res = await fetch("reviews_test.tsv", { cache: "no-store" });
    if (!res.ok) throw new Error(`TSV load failed: ${res.status}`);
    const text = await res.text();
    const parsed = Papa.parse(text, {
      header: true,
      delimiter: "\t",
      skipEmptyLines: true
    });
    reviews = (parsed.data || [])
      .map(r => (r.text ?? "").toString().trim())
      .filter(Boolean);
    if (reviews.length === 0) throw new Error("No review texts found in TSV");
  } catch (e) {
    showError(`Failed to load TSV.\n${String(e.message || e)}`);
  }
}

function onRandom() {
  resetUI(false);
  if (!ready || reviews.length === 0) return showError("Data not loaded.");
  const i = Math.floor(Math.random() * reviews.length);
  reviewEl.value = reviews[i];
}

async function onSentiment() {
  resetUI();
  const text = reviewEl.value.trim();
  if (!text) return showError("Please provide review text.");
  const p = `Classify this review as positive, negative, or neutral: ${text}`;
  const out = await callApi(p, text);
  if (!out) return;
  const first = out;
  let emoji = "❓";
  if (first.includes("positive")) emoji = "👍";
  else if (first.includes("negative")) emoji = "👎";
  else if (first.includes("neutral")) emoji = "❓";
  sentEl.textContent = emoji;
}

async function onNouns() {
  resetUI();
  const text = reviewEl.value.trim();
  if (!text) return showError("Please provide review text.");
  const p = `Count the nouns in this review and return only High (>15), Medium (6-15), or Low (<6). ${text}`;
  const out = await callApi(p, text);
  if (!out) return;
  const first = out;
  let badge = "—";
  if (first.includes("high")) badge = "🟢";
  else if (first.includes("medium")) badge = "🟡";
  else if (first.includes("low")) badge = "🔴";
  nounEl.textContent = badge;
}

async function callApi(prompt, originalText) {
  showSpin(true);
  try {
    const url = "https://api-inference.huggingface.co/models/tiiuae/falcon-7b-instruct";
    const headers = { "Content-Type": "application/json" };
    const tk = tokenEl.value.trim();
    if (tk) headers["Authorization"] = `Bearer ${tk}`;

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ inputs: prompt })
    });

    if (!res.ok) {
      const msg = await safeError(res);
      if (res.status === 402) throw new Error("Payment required (402). Provide a valid Hugging Face token or try later.\n" + msg);
      if (res.status === 429) throw new Error("Rate limited (429). Please slow down and try again.\n" + msg);
      throw new Error(`API error ${res.status}.\n` + msg);
    }

    const data = await res.json();
    let text = "";
    if (Array.isArray(data) && data.length && typeof data[0]?.generated_text === "string") {
      text = data[0].generated_text;
    } else if (typeof data === "object" && typeof data.generated_text === "string") {
      text = data.generated_text;
    } else if (data && data.error) {
      throw new Error(String(data.error));
    } else {
      throw new Error("Unexpected API response.");
    }
    const firstLine = String(text).split("\n")[0].toLowerCase().trim();
    return firstLine;
  } catch (e) {
    showError(String(e.message || e));
    return null;
  } finally {
    showSpin(false);
  }
}

async function safeError(res) {
  try {
    const t = await res.text();
    return t.slice(0, 500);
  } catch {
    return "";
  }
}

function resetUI(clearVals = true) {
  errEl.style.display = "none";
  errEl.textContent = "";
  if (clearVals) {
    sentEl.textContent = "—";
    nounEl.textContent = "—";
  }
}

function showError(msg) {
  errEl.textContent = msg;
  errEl.style.display = "block";
}

function showSpin(on) {
  spinner.style.display = on ? "grid" : "none";
}

