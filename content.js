"use strict";
(() => {
  // src/shared/util.ts
  function normalizeSpace(s) {
    return s.replace(/[\s\u00a0\u200b-\u200f\ufeff]+/g, " ").trim();
  }
  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // src/content/extract/segment-guard.ts
  var HARD_SKIP = /* @__PURE__ */ new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "TEMPLATE",
    "IFRAME",
    "OBJECT",
    "EMBED",
    "CANVAS",
    "VIDEO",
    "AUDIO",
    "SOURCE",
    "TRACK",
    "MAP",
    "AREA",
    "SELECT",
    "OPTION",
    "OPTGROUP",
    "TEXTAREA",
    "INPUT",
    "PROGRESS",
    "METER"
  ]);
  var INLINE_ATOM = /* @__PURE__ */ new Set([
    "CODE",
    "KBD",
    "SAMP",
    "VAR",
    "PRE",
    "SVG",
    "IMG",
    "MATH",
    "BR",
    "HR",
    "ABBR",
    "SUP",
    "SUB",
    "CITE",
    "TIME",
    "MARK",
    "A",
    "BUTTON"
  ]);
  var TRANSPARENT = /* @__PURE__ */ new Set(["EM", "STRONG", "B", "I", "U", "SPAN", "SMALL", "S", "DEL", "INS", "LABEL", "FONT"]);
  var displayCache = /* @__PURE__ */ new WeakMap();
  function displayOf(el2) {
    const cached = displayCache.get(el2);
    if (cached) return cached;
    let d = "block";
    try {
      d = getComputedStyle(el2).display;
    } catch {
    }
    displayCache.set(el2, d);
    return d;
  }
  function isHardSkipped(el2) {
    if (HARD_SKIP.has(el2.tagName)) return true;
    if (el2.classList.contains("tk-trans")) return true;
    if (el2.hasAttribute("data-tk-skip")) return true;
    if (el2.getAttribute("translate") === "no") return true;
    if (el2.isContentEditable) return true;
    return false;
  }
  function isHidden(el2) {
    const d = displayOf(el2);
    if (d === "none") return true;
    try {
      const cs = getComputedStyle(el2);
      if (cs.visibility === "hidden" || cs.opacity === "0") return true;
    } catch {
    }
    return false;
  }
  function findBlockAncestor(node) {
    let el2 = node.parentElement;
    let depth = 0;
    while (el2 && el2 !== document.documentElement && depth < 40) {
      if (isHardSkipped(el2)) return null;
      const d = displayOf(el2);
      if (d === "none") return null;
      if (d === "inline" || d === "inline-block" || d === "inline-flex" || d === "inline-grid") {
        el2 = el2.parentElement;
        depth++;
        continue;
      }
      return el2;
    }
    return null;
  }
  function serializeBlock(el2) {
    const inlines = [];
    const parts = [];
    const walk = (node) => {
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
          const t = child.textContent || "";
          if (t) parts.push(t);
          continue;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) continue;
        const e = child;
        if (isHardSkipped(e)) continue;
        if (INLINE_ATOM.has(e.tagName)) {
          inlines.push({ html: e.outerHTML, text: e.textContent || "" });
          parts.push(`\u27E6I${inlines.length}\u27E7`);
          continue;
        }
        if (TRANSPARENT.has(e.tagName)) {
          walk(e);
          continue;
        }
        inlines.push({ html: e.outerHTML, text: e.textContent || "" });
        parts.push(`\u27E6I${inlines.length}\u27E7`);
      }
    };
    walk(el2);
    const payload = parts.join("").replace(/[ \t\u00a0]+/g, " ").trim();
    return { payload, inlines, rawLength: payload.replace(/⟦I\d+⟧/g, "").length };
  }
  var LETTER_RE = /[A-Za-z]/;
  var elementIds = /* @__PURE__ */ new WeakMap();
  var elementSeq = 0;
  function stableIdOf(el2) {
    let id = elementIds.get(el2);
    if (!id) {
      elementSeq += 1;
      id = `tk-e${elementSeq}`;
      elementIds.set(el2, id);
    }
    return id;
  }
  function extractUnits(root, skipIds) {
    const groups = /* @__PURE__ */ new Map();
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node2) {
          const parent = node2.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const text = node2.nodeValue;
          if (!text || !text.trim()) return NodeFilter.FILTER_REJECT;
          if (text.length < 2 && !LETTER_RE.test(text)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    let node;
    let guard = 0;
    while ((node = walker.nextNode()) && guard < 2e4) {
      guard++;
      const block = findBlockAncestor(node);
      if (!block) continue;
      if (groups.has(block)) continue;
      if (isHidden(block)) continue;
      groups.set(block, true);
    }
    const units = [];
    const seenText = /* @__PURE__ */ new Set();
    for (const el2 of groups.keys()) {
      const { payload, inlines, rawLength } = serializeBlock(el2);
      const norm = normalizeSpace(payload.replace(/⟦I\d+⟧/g, " "));
      if (norm.length < 2) continue;
      if (!LETTER_RE.test(norm)) continue;
      if (norm.length < 4 && !/[.!?,;:]/.test(norm)) continue;
      if (norm.length > 24 && seenText.has(norm)) continue;
      if (norm.length > 24) seenText.add(norm);
      const id = stableIdOf(el2);
      if (skipIds?.has(id)) continue;
      units.push({ el: el2, id, payload, inlines, rawLength });
    }
    return units;
  }
  function pageTitlePath() {
    const parts = [];
    const hs = document.querySelectorAll("h1, h2, h3");
    for (const h of Array.from(hs).slice(0, 12)) {
      const t = (h.textContent || "").trim().replace(/\s+/g, " ");
      if (t && t.length < 80) parts.push(t);
      if (parts.length >= 4) break;
    }
    return parts.join(" > ");
  }
  function pageSample(limit = 2e3) {
    const body = document.body;
    if (!body) return "";
    const text = (body.innerText || "").replace(/\s+/g, " ");
    return text.slice(0, limit);
  }

  // src/content/render/renderer.ts
  var INLINE_RE = /[⟦\[［]\s*I\s*(\d+)\s*[⟧\]］]/g;
  var rendered = /* @__PURE__ */ new Map();
  var mode = "both";
  var renderLog = [];
  function bumpRenderCount(isNew) {
    try {
      const d = document.documentElement.dataset;
      d.tkRenders = String(Number(d.tkRenders || "0") + 1);
      if (isNew) d.tkRenderNew = String(Number(d.tkRenderNew || "0") + 1);
    } catch {
    }
  }
  function buildHtml(translated, inlines) {
    const escaped = escapeHtml(translated);
    return escaped.replace(INLINE_RE, (_all, n) => {
      const tok = inlines[Number(n) - 1];
      return tok ? tok.html : "";
    });
  }
  function swapIn(entry) {
    const { el: el2, node } = entry;
    if (!entry.origNodes) {
      entry.origNodes = Array.from(el2.childNodes).filter((n) => n !== node);
    }
    if (el2.childNodes.length === 1 && el2.firstChild === node) return;
    el2.replaceChildren(node);
  }
  function restoreOriginal(entry) {
    const saved = entry.origNodes;
    if (!saved) return;
    entry.origNodes = null;
    const { el: el2, node } = entry;
    if (node.parentElement === el2 && el2.childNodes.length === 1) {
      el2.replaceChildren(...saved);
    }
  }
  function place(entry) {
    const { el: el2, node } = entry;
    if (mode === "translated") {
      node.style.display = "";
      swapIn(entry);
      return;
    }
    if (mode === "both") {
      restoreOriginal(entry);
      node.style.display = "";
      if (node.parentElement !== el2) el2.appendChild(node);
      return;
    }
    restoreOriginal(entry);
    node.remove();
  }
  function setDisplayMode(m) {
    mode = m;
    try {
      document.documentElement.dataset.tkMode = m;
    } catch {
    }
    for (const entry of rendered.values()) place(entry);
  }
  function dropStaleNodes(el2, keepId) {
    for (const child of Array.from(el2.children)) {
      if (!child.classList.contains("tk-trans")) continue;
      if (child.dataset.tkId === keepId) continue;
      child.remove();
    }
  }
  function renderUnit(el2, id, translated, inlines, opts) {
    let entry = rendered.get(id);
    bumpRenderCount(!entry);
    if (document.documentElement.dataset.tkDebug === "1") {
      try {
        const rec = `${id}|${el2.tagName}|${el2.childNodes.length}|${entry ? "u" : "n"}|${(el2.textContent || "").replace(/\s+/g, " ").slice(0, 14)}`;
        renderLog.push(rec);
        if (renderLog.length > 40) renderLog.shift();
        document.documentElement.dataset.tkLog = renderLog.join(" ;; ");
      } catch {
      }
    }
    if (!entry) {
      dropStaleNodes(el2, id);
      const node2 = document.createElement("span");
      node2.className = "tk-trans";
      node2.setAttribute("translate", "no");
      node2.setAttribute("lang", "zh-CN");
      node2.dataset.tkId = id;
      if (document.documentElement.dataset.tkDebug === "1" && opts?.src) {
        node2.dataset.tkSrc = opts.src;
      }
      entry = { el: el2, node: node2, origNodes: null };
      rendered.set(id, entry);
    }
    entry.el = el2;
    const { node } = entry;
    if (opts?.error) {
      node.classList.add("tk-error");
      node.innerHTML = escapeHtml(opts.error) + (opts.retry ? ' <span class="tk-retry" data-tk-retry="1">\u91CD\u8BD5</span>' : "");
    } else {
      node.classList.remove("tk-error");
      node.innerHTML = buildHtml(translated, inlines);
    }
    place(entry);
  }
  function isLive(id) {
    const entry = rendered.get(id);
    if (!entry) return false;
    return entry.node.isConnected;
  }
  function removeNode(id) {
    const entry = rendered.get(id);
    if (!entry) return;
    const { el: el2, node } = entry;
    const saved = entry.origNodes;
    entry.origNodes = null;
    if (saved && node.parentElement === el2 && el2.childNodes.length === 1) {
      el2.replaceChildren(...saved);
    } else {
      node.remove();
    }
    rendered.delete(id);
  }
  function removeAll() {
    for (const id of Array.from(rendered.keys())) removeNode(id);
    rendered.clear();
  }
  function countRendered() {
    return rendered.size;
  }

  // src/content/render/progress.ts
  var ID = "tk-progress";
  var el = null;
  var bar = null;
  var label = null;
  var hideTimer = null;
  function ensure() {
    if (el && el.isConnected) return;
    el = document.createElement("div");
    el.id = ID;
    el.setAttribute("translate", "no");
    el.style.cssText = [
      "position:fixed",
      "right:18px",
      "bottom:18px",
      "z-index:2147483000",
      "display:flex",
      "align-items:center",
      "gap:8px",
      "padding:8px 12px",
      "border-radius:999px",
      "background:rgba(28,32,44,0.92)",
      "color:#fff",
      'font:12px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      "box-shadow:0 6px 20px rgba(0,0,0,.18)",
      "pointer-events:none",
      "opacity:0",
      "transition:opacity .18s ease"
    ].join(";");
    const dot = document.createElement("span");
    dot.style.cssText = [
      "width:7px",
      "height:7px",
      "border-radius:50%",
      "background:var(--tk-accent,#5b6cf9)",
      "box-shadow:0 0 0 3px rgba(91,108,249,.22)",
      "animation:tk-pulse 1.1s ease-in-out infinite"
    ].join(";");
    el.appendChild(dot);
    label = document.createElement("span");
    el.appendChild(label);
    const track = document.createElement("span");
    track.style.cssText = "width:56px;height:3px;border-radius:2px;background:rgba(255,255,255,.22);overflow:hidden";
    bar = document.createElement("span");
    bar.style.cssText = "display:block;height:100%;width:0%;background:var(--tk-accent,#5b6cf9);transition:width .2s ease";
    track.appendChild(bar);
    el.appendChild(track);
    document.documentElement.appendChild(el);
    requestAnimationFrame(() => {
      if (el) el.style.opacity = "1";
    });
  }
  function showProgress(done, total) {
    ensure();
    if (hideTimer) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
    const finished = total > 0 && done >= total;
    if (label) {
      label.textContent = !total ? "\u7FFB\u8BD1\u4E2D" : finished ? `\u5DF2\u5B8C\u6210 ${total} \u6BB5` : `\u7FFB\u8BD1\u4E2D ${Math.min(done, total)}/${total}`;
    }
    if (bar && total) bar.style.width = `${Math.min(100, Math.round(done / total * 100))}%`;
    if (el) el.style.opacity = "1";
  }
  function hideProgress() {
    if (!el) return;
    if (bar) bar.style.width = "100%";
    if (hideTimer) window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      if (!el) return;
      el.style.opacity = "0";
      const node = el;
      hideTimer = window.setTimeout(() => {
        node.remove();
        if (el === node) {
          el = null;
          bar = null;
          label = null;
        }
      }, 220);
    }, 260);
  }
  function removeProgress() {
    if (hideTimer) window.clearTimeout(hideTimer);
    hideTimer = null;
    el?.remove();
    el = null;
    bar = null;
    label = null;
  }

  // src/content/render/prompt.ts
  var HOST_ID = "tk-ask-host";
  var host = null;
  var shadow = null;
  var autoTimer = null;
  var CSS = `
:host { all: initial; }
.card {
  position: fixed;
  top: 14px;
  right: 16px;
  transform: translateY(-8px);
  z-index: 2147483001;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px 10px 14px;
  min-width: 0;
  max-width: min(430px, calc(100vw - 32px));
  border-radius: 12px;
  background: #fff;
  color: #1b1f2a;
  box-shadow: 0 2px 6px rgba(16, 24, 40, .08), 0 12px 32px rgba(16, 24, 40, .16);
  border: 1px solid rgba(16, 24, 40, .08);
  font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  opacity: 0;
  animation: tk-ask-in .22s cubic-bezier(.2, .9, .3, 1) forwards;
  box-sizing: border-box;
}
@keyframes tk-ask-in {
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-color-scheme: dark) {
  .card {
    background: #22262f;
    color: #eef1f6;
    border-color: rgba(255, 255, 255, .1);
    box-shadow: 0 2px 6px rgba(0, 0, 0, .3), 0 14px 36px rgba(0, 0, 0, .45);
  }
  .sub { color: #a2aab8; }
  .ghost { color: #c6ccd8; }
  .ghost:hover { background: rgba(255, 255, 255, .08); }
  .close:hover { background: rgba(255, 255, 255, .1); }
  .dot { box-shadow: 0 0 0 3px rgba(91, 108, 249, .28); }
}
.logo {
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--accent, #5b6cf9);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: -.4px;
}
.text { flex: 1 1 auto; min-width: 0; }
.title {
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sub {
  margin-top: 1px;
  font-size: 11.5px;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.actions { flex: none; display: flex; align-items: center; gap: 6px; }
button {
  font: inherit;
  cursor: pointer;
  border-radius: 7px;
  border: 0;
  transition: background .15s, opacity .15s, transform .06s;
}
button:active { transform: scale(.97); }
.primary {
  padding: 6px 12px;
  background: var(--accent, #5b6cf9);
  color: #fff;
  font-weight: 600;
  font-size: 12.5px;
}
.primary:hover { filter: brightness(1.07); }
.ghost {
  padding: 6px 9px;
  background: transparent;
  color: #4b5563;
  font-size: 12.5px;
}
.ghost:hover { background: rgba(16, 24, 40, .06); }
.close {
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  color: #9aa2b1;
  font-size: 15px;
  line-height: 1;
}
.close:hover { background: rgba(16, 24, 40, .06); }
`;
  function showAskBar(handlers, opts = {}) {
    if (host?.isConnected) return;
    host = document.createElement("div");
    host.id = HOST_ID;
    host.setAttribute("translate", "no");
    shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = CSS;
    shadow.appendChild(style);
    const card = document.createElement("div");
    card.className = "card";
    if (opts.accent) card.style.setProperty("--accent", opts.accent);
    const logo = document.createElement("div");
    logo.className = "logo";
    logo.textContent = "T";
    const text = document.createElement("div");
    text.className = "text";
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = "\u8981\u7FFB\u8BD1\u8FD9\u4E2A\u7F51\u7AD9\u5417\uFF1F";
    const sub = document.createElement("div");
    sub.className = "sub";
    sub.textContent = `\u8BD1\u6210${opts.targetName || "\u4E2D\u6587"} \xB7 \u4E13\u4E1A\u672F\u8BED\u4FDD\u6301\u539F\u6587`;
    text.append(title, sub);
    const actions = document.createElement("div");
    actions.className = "actions";
    const yes = document.createElement("button");
    yes.className = "primary";
    yes.textContent = "\u7FFB\u8BD1";
    const no = document.createElement("button");
    no.className = "ghost";
    no.textContent = "\u4E0D\u7FFB\u8BD1";
    const close = document.createElement("button");
    close.className = "close";
    close.setAttribute("aria-label", "\u5173\u95ED");
    close.textContent = "\u2715";
    actions.append(yes, no, close);
    card.append(logo, text, actions);
    shadow.appendChild(card);
    yes.addEventListener("click", () => {
      removeAskBar();
      handlers.onTranslate();
    });
    no.addEventListener("click", () => {
      removeAskBar();
      handlers.onDecline();
    });
    close.addEventListener("click", () => removeAskBar());
    document.documentElement.appendChild(host);
    autoTimer = window.setTimeout(() => removeAskBar(), 12e3);
  }
  function removeAskBar() {
    if (autoTimer !== null) window.clearTimeout(autoTimer);
    autoTimer = null;
    host?.remove();
    host = null;
    shadow = null;
  }

  // src/shared/types.ts
  var DEFAULT_SETTINGS = {
    enabled: false,
    autoTranslate: false,
    mode: "fast",
    targetLang: "zh-Hans",
    // 默认「仅译文」：中英并排会让技术文档页面高度翻倍、阅读视线来回跳，
    // 实测用户更在意"快速看懂"而不是"对照校对"。需要对照时 Alt+Shift+T 切。
    display: "translated",
    properNounGuard: true,
    annotateFirst: false,
    forbidReplace: false,
    disabledHosts: [],
    enabledHosts: [],
    askOnSite: true,
    accentColor: "#5b6cf9",
    domainLock: "auto",
    llm: { baseUrl: "", apiKey: "", model: "", temperature: 0.2 },
    fastEngine: "bing"
  };

  // src/storage/settings.ts
  var KEY = "settings";
  async function getSettings() {
    const raw = await chrome.storage.local.get(KEY);
    const stored = raw[KEY];
    if (!stored) return { ...DEFAULT_SETTINGS };
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      llm: { ...DEFAULT_SETTINGS.llm, ...stored.llm || {} }
    };
  }
  async function setSettings(patch) {
    const cur = await getSettings();
    const next = {
      ...cur,
      ...patch,
      llm: { ...cur.llm, ...patch.llm || {} }
    };
    await chrome.storage.local.set({ [KEY]: next });
    return next;
  }

  // src/shared/logger.ts
  var PREFIX = "[TermKeeper]";
  var verbose = false;
  var log = {
    info: (...a) => console.log(PREFIX, ...a),
    warn: (...a) => console.warn(PREFIX, ...a),
    error: (...a) => console.error(PREFIX, ...a),
    debug: (...a) => {
      if (verbose) console.debug(PREFIX, ...a);
    }
  };

  // src/content/index.ts
  var state = {
    active: false,
    total: 0,
    done: 0,
    failed: 0,
    termHits: 0,
    domain: "auto",
    domainScore: 0,
    engine: "",
    running: false
  };
  var settings = null;
  var queue = [];
  var MAX_INFLIGHT = 10;
  var BATCH_SIZE = 12;
  var inflight = 0;
  var pendingWaves = 0;
  var known = /* @__PURE__ */ new Map();
  var queued = /* @__PURE__ */ new Set();
  var attempted = /* @__PURE__ */ new Set();
  var settled = /* @__PURE__ */ new Set();
  var failedIds = /* @__PURE__ */ new Set();
  var skipped = /* @__PURE__ */ new Set();
  var dedupSavedTotal = 0;
  var unitIndex = /* @__PURE__ */ new Map();
  var mutationObs = null;
  var scanTimer = null;
  var pendingRoots = /* @__PURE__ */ new Set();
  var lastScanAt = 0;
  try {
    const prev = Number(document.documentElement.dataset.tkInject || "0");
    document.documentElement.dataset.tkInject = String(prev + 1);
    document.documentElement.dataset.tkReady = "1";
  } catch {
  }
  var runId = 0;
  function pageCtx() {
    return {
      url: location.href,
      host: location.host,
      title: document.title || "",
      lang: document.documentElement.lang || ""
    };
  }
  async function getSettingsCached() {
    if (!settings) settings = await getSettings();
    return settings;
  }
  async function rememberHost(on) {
    try {
      const cur = await getSettings();
      const hosts = new Set(cur.enabledHosts || []);
      const blocked = new Set(cur.disabledHosts || []);
      const h = location.host;
      if (on) {
        hosts.add(h);
        blocked.delete(h);
      } else {
        hosts.delete(h);
      }
      settings = await setSettings({
        enabledHosts: [...hosts],
        disabledHosts: [...blocked]
      });
    } catch (e) {
      log.warn("\u8BB0\u4F4F\u7AD9\u70B9\u5931\u8D25", String(e));
    }
  }
  async function declineHost() {
    try {
      const cur = await getSettings();
      const blocked = new Set(cur.disabledHosts || []);
      const hosts = new Set(cur.enabledHosts || []);
      blocked.add(location.host);
      hosts.delete(location.host);
      settings = await setSettings({ disabledHosts: [...blocked], enabledHosts: [...hosts] });
    } catch (e) {
      log.warn('\u8BB0\u5F55"\u4E0D\u7FFB\u8BD1"\u5931\u8D25', String(e));
    }
  }
  function keepalivePing() {
    try {
      const port = chrome.runtime.connect({ name: "tk-keepalive" });
      port.postMessage({ type: "PING" });
      setTimeout(() => {
        try {
          port.disconnect();
        } catch {
        }
      }, 1500);
    } catch {
    }
  }
  function selfMutation(fn) {
    try {
      fn();
    } finally {
      mutationObs?.takeRecords();
    }
  }
  async function translateBatch(batch) {
    if (!batch.length) return;
    const myRun = runId;
    const s = await getSettingsCached();
    const items = batch.map((u) => ({ id: u.id, payload: u.payload, headingPath: "" }));
    const tAsked = Date.now();
    let res;
    try {
      keepalivePing();
      res = await chrome.runtime.sendMessage({
        type: "TRANSLATE",
        items,
        mode: s.mode,
        ctx: pageCtx(),
        domain: s.domainLock,
        sample: pageSample(),
        titlePath: pageTitlePath()
      });
    } catch (e) {
      log.error("sendMessage failed", String(e));
      if (myRun !== runId) return;
      selfMutation(() => {
        for (const u of batch) {
          if (!u.el.isConnected) continue;
          renderUnit(u.el, u.id, "", u.inlines, { error: "\u7FFB\u8BD1\u670D\u52A1\u4E0D\u53EF\u7528", retry: true });
        }
      });
      settleBatch(batch.map((u) => u.id), batch.map((u) => u.id));
      return;
    }
    if (myRun !== runId) return;
    if (!res || !res.ok) {
      const err = res && !res.ok ? res.error : "\u672A\u77E5\u9519\u8BEF";
      selfMutation(() => {
        for (const u of batch) {
          if (!u.el.isConnected) continue;
          renderUnit(u.el, u.id, "", u.inlines, { error: `\u7FFB\u8BD1\u5931\u8D25\uFF1A${err}`, retry: true });
        }
      });
      settleBatch(batch.map((u) => u.id), batch.map((u) => u.id));
      return;
    }
    const data = res.data;
    if (data.timing) {
      dedupSavedTotal += Number(data.timing.dedupSaved || 0);
      try {
        document.documentElement.dataset.tkTiming = JSON.stringify({
          ...data.timing,
          rtt: Date.now() - tAsked
        });
      } catch {
      }
    }
    state.domain = data.domain?.domain ?? "auto";
    state.domainScore = data.domain?.score ?? 0;
    state.engine = data.engine || "";
    state.termHits += data.termHits || 0;
    const byId = new Map(batch.map((u) => [u.id, u]));
    const bad = [];
    selfMutation(() => {
      for (const r of data.results) {
        const unit = byId.get(r.id);
        if (!unit) continue;
        if (!unit.el.isConnected) continue;
        if (r.error) {
          renderUnit(unit.el, unit.id, "", unit.inlines, { error: `\u7FFB\u8BD1\u5931\u8D25\uFF1A${r.error}`, retry: true });
          bad.push(r.id);
        } else {
          renderUnit(unit.el, unit.id, r.translated, unit.inlines, { src: unit.payload });
        }
      }
    });
    settleBatch(
      batch.map((u) => u.id),
      bad
    );
    showProgress(progressDone(), progressTotal());
  }
  function settleBatch(ids, failed) {
    for (const id of ids) settled.add(id);
    for (const id of failed) failedIds.add(id);
    state.done = progressDone();
    state.failed = failedIds.size;
    markBusy();
  }
  function progressDone() {
    let n = 0;
    for (const id of settled) if (!failedIds.has(id)) n++;
    return n;
  }
  function progressTotal() {
    return Math.max(attempted.size, settled.size);
  }
  async function flush() {
    if (inflight >= MAX_INFLIGHT) return;
    inflight++;
    try {
      while (queue.length && state.active) {
        const batch = [];
        let chars = 0;
        while (queue.length && batch.length < BATCH_SIZE) {
          const u = queue[0];
          if (batch.length && chars + u.payload.length > 1500) break;
          queue.shift();
          batch.push(u);
          chars += u.payload.length;
        }
        for (const u of batch) queued.delete(u.id);
        await translateBatch(batch);
      }
    } finally {
      inflight--;
    }
    if (!queue.length && inflight === 0 && pendingWaves === 0) {
      state.running = false;
      markBusy();
      hideProgress();
    }
  }
  function kick() {
    while (inflight < MAX_INFLIGHT && queue.length) void flush();
  }
  var kickTimer = null;
  function scheduleKick(delay = 90) {
    if (kickTimer !== null) return;
    kickTimer = window.setTimeout(() => {
      kickTimer = null;
      kick();
    }, delay);
  }
  function indexUnits(units) {
    for (const u of units) {
      unitIndex.set(u.id, u);
      try {
        u.el.dataset.tkUnit = u.id;
      } catch {
      }
    }
  }
  function markBusy() {
    try {
      const d = document.documentElement.dataset;
      d.tkBusy = state.running ? "1" : "0";
      d.tkDone = String(progressDone());
      d.tkTotal = String(progressTotal());
      d.tkSkipped = String(skipped.size);
      d.tkDedup = String(dedupSavedTotal);
    } catch {
    }
  }
  function worthTranslating(payload) {
    const raw = payload.replace(/⟦I\d+⟧/g, "").trim();
    if (raw.length < 2) return false;
    if (!/[A-Za-z]{3,}/.test(raw)) return false;
    const cjk = (raw.match(/[\u3400-\u4dbf\u4e00-\u9fff]/g) || []).length;
    return cjk / raw.length <= 0.5;
  }
  function enqueue(units) {
    let added = false;
    for (const u of units) {
      if (queued.has(u.id)) continue;
      if (!worthTranslating(u.payload)) {
        skipped.add(u.id);
        continue;
      }
      if (known.get(u.id) === u.payload && isLive(u.id)) continue;
      known.set(u.id, u.payload);
      queued.add(u.id);
      attempted.add(u.id);
      queue.push(u);
      added = true;
    }
    if (!added) return;
    state.total = progressTotal();
    state.running = true;
    markBusy();
    scheduleKick();
  }
  function sameOrNested(roots) {
    return roots.filter((el2) => !roots.some((o) => o !== el2 && o.contains(el2)));
  }
  function scheduleScan(roots, delay = 450) {
    for (const r of roots) if (r?.isConnected) pendingRoots.add(r);
    if (!pendingRoots.size || scanTimer !== null) return;
    const wait = Math.max(delay, 700 - (Date.now() - lastScanAt));
    scanTimer = window.setTimeout(() => {
      scanTimer = null;
      const list = Array.from(pendingRoots);
      pendingRoots = /* @__PURE__ */ new Set();
      scanNow(list);
    }, wait);
  }
  function scanNow(roots) {
    if (!state.active) return;
    lastScanAt = Date.now();
    let list = sameOrNested(roots.filter((r) => r.isConnected));
    if (list.some((r) => r === document.body || r === document.documentElement)) list = [document.body];
    if (!list.length) return;
    const skip = new Set(known.keys());
    const fresh = [];
    const seen = /* @__PURE__ */ new Set();
    for (const root of list) {
      for (const u of extractUnits(root, skip)) {
        if (seen.has(u.id)) continue;
        seen.add(u.id);
        fresh.push(u);
      }
    }
    if (!fresh.length) return;
    log.debug("\u52A8\u6001\u65B0\u589E\u5355\u5143", fresh.length);
    indexUnits(fresh);
    enqueue(fresh);
  }
  function setupMutationObserver() {
    if (mutationObs) return;
    mutationObs = new MutationObserver((muts) => {
      const roots = /* @__PURE__ */ new Set();
      for (const m of muts) {
        const target = m.target.nodeType === Node.ELEMENT_NODE ? m.target : m.target.parentElement;
        if (!target) continue;
        if (m.type === "characterData") {
          roots.add(target);
          continue;
        }
        let hasAdded = false;
        for (const n of Array.from(m.addedNodes)) {
          if (n.nodeType === Node.ELEMENT_NODE && n.classList.contains("tk-trans")) continue;
          hasAdded = true;
          break;
        }
        if (!hasAdded) continue;
        roots.add(target === document.documentElement ? document.body : target);
      }
      if (!roots.size) return;
      scheduleScan(Array.from(roots));
    });
    mutationObs.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  var interactionHooked = false;
  function hookInteractions() {
    if (interactionHooked) return;
    interactionHooked = true;
    document.addEventListener(
      "click",
      () => {
        if (state.active) scheduleScan([document.body], 500);
      },
      true
    );
    document.addEventListener("visibilitychange", () => {
      if (state.active && document.visibilityState === "visible") scheduleScan([document.body], 800);
    });
  }
  var routerHooked = false;
  function hookRouter() {
    if (routerHooked) return;
    routerHooked = true;
    const onNav = () => {
      if (state.active) scheduleScan([document.body], 300);
    };
    for (const fn of ["pushState", "replaceState"]) {
      const orig = history[fn];
      history[fn] = function(...args) {
        const r = orig.apply(this, args);
        onNav();
        return r;
      };
    }
    window.addEventListener("popstate", onNav);
    window.addEventListener("hashchange", onNav);
  }
  function applyAccent(s) {
    try {
      document.documentElement.style.setProperty("--tk-accent", s.accentColor || "#5b6cf9");
    } catch {
    }
  }
  function resetCounters() {
    state.total = 0;
    state.done = 0;
    state.failed = 0;
    state.termHits = 0;
    known = /* @__PURE__ */ new Map();
    queued = /* @__PURE__ */ new Set();
    attempted = /* @__PURE__ */ new Set();
    settled = /* @__PURE__ */ new Set();
    failedIds = /* @__PURE__ */ new Set();
    skipped = /* @__PURE__ */ new Set();
    queue = [];
    unitIndex.clear();
  }
  async function start() {
    const s = await getSettingsCached();
    if (s.disabledHosts.includes(location.host)) {
      log.info("\u5F53\u524D\u7AD9\u70B9\u5DF2\u5728\u9ED1\u540D\u5355\u4E2D");
      return;
    }
    if (state.active) return;
    runId++;
    applyAccent(s);
    setDisplayMode(s.display);
    state.active = true;
    document.documentElement.dataset.tkActive = "1";
    resetCounters();
    void chrome.runtime.sendMessage({ type: "WARMUP", mode: s.mode }).catch(() => {
    });
    setupMutationObserver();
    hookInteractions();
    hookRouter();
    const units = extractUnits(document.body);
    log.info("\u627E\u5230\u53EF\u7FFB\u8BD1\u5355\u5143", units.length);
    indexUnits(units);
    if (!units.length) {
      state.running = false;
      markBusy();
      return;
    }
    state.total = units.length;
    const vh = window.innerHeight;
    const inView = [];
    const rest = [];
    for (const u of units) {
      let top = 0;
      let bottom = 0;
      try {
        const r = u.el.getBoundingClientRect();
        top = r.top;
        bottom = r.bottom;
      } catch {
      }
      if (top < vh && bottom > 0) inView.push(u);
      else rest.push(u);
    }
    const FIRST_WAVE_CHARS = 1300;
    let chars = 0;
    let cut = 0;
    for (const u of inView) {
      if (cut > 0 && chars + u.payload.length > FIRST_WAVE_CHARS) break;
      chars += u.payload.length;
      cut++;
    }
    const firstWave = inView.slice(0, cut);
    const laterWaves = [...inView.slice(cut), ...rest];
    try {
      const d = document.documentElement.dataset;
      d.tkUnits = String(units.length);
      d.tkFirstWave = String(firstWave.length);
    } catch {
    }
    if (firstWave.length) {
      enqueue(firstWave);
      if (laterWaves.length) {
        pendingWaves++;
        window.setTimeout(() => {
          pendingWaves--;
          if (state.active) enqueue(laterWaves);
          else markBusy();
        }, 200);
      }
    } else {
      enqueue(laterWaves);
    }
  }
  function stop() {
    runId++;
    state.active = false;
    document.documentElement.dataset.tkActive = "0";
    state.running = false;
    queue = [];
    queued = /* @__PURE__ */ new Set();
    known = /* @__PURE__ */ new Map();
    unitIndex.clear();
    pendingWaves = 0;
    mutationObs?.disconnect();
    mutationObs = null;
    if (scanTimer !== null) window.clearTimeout(scanTimer);
    scanTimer = null;
    pendingRoots = /* @__PURE__ */ new Set();
    removeAll();
    removeProgress();
    resetCounters();
    markBusy();
  }
  var toggling = false;
  async function toggle() {
    if (toggling) return;
    toggling = true;
    removeAskBar();
    try {
      if (state.active) {
        stop();
        await rememberHost(false);
      } else {
        await start();
        await rememberHost(state.active);
      }
    } finally {
      toggling = false;
    }
  }
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    void (async () => {
      switch (msg?.type) {
        case "TOGGLE":
          await toggle();
          sendResponse({ ok: true, data: { ...state } });
          break;
        case "REFINE": {
          settings = await getSettings();
          if (settings.mode !== "smart") {
            settings = { ...settings, mode: "smart" };
          }
          queue = [];
          for (const u of unitIndex.values()) {
            const r = u.el.getBoundingClientRect();
            if (r.top < window.innerHeight && r.bottom > 0) {
              known.delete(u.id);
              queued.add(u.id);
              queue.push(u);
            }
          }
          if (queue.length) {
            state.running = true;
            kick();
          }
          sendResponse({ ok: true, data: { ...state } });
          break;
        }
        case "CYCLE_MODE": {
          const s = await getSettingsCached();
          const order = ["both", "translated", "original"];
          const next = order[(order.indexOf(s.display) + 1) % order.length];
          settings = { ...s, display: next };
          setDisplayMode(next);
          sendResponse({ ok: true, data: { display: next } });
          break;
        }
        case "SET_DISPLAY": {
          const s = await getSettingsCached();
          settings = { ...s, display: msg.display };
          setDisplayMode(msg.display);
          sendResponse({ ok: true });
          break;
        }
        case "RESTART": {
          stop();
          settings = await getSettings();
          await start();
          sendResponse({ ok: true, data: { ...state } });
          break;
        }
        case "GET_PAGE_STATE":
          sendResponse({
            ok: true,
            data: { ...state, rendered: countRendered() }
          });
          break;
        default:
          sendResponse({ ok: false, error: "unknown" });
      }
    })();
    return true;
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.settings) return;
    settings = changes.settings.newValue;
    if (settings) {
      setDisplayMode(settings.display);
      applyAccent(settings);
    }
  });
  void (async () => {
    const s = await getSettingsCached();
    setDisplayMode(s.display);
    applyAccent(s);
    const host2 = location.host;
    const blocked = s.disabledHosts.includes(host2);
    const wanted = !blocked && (s.enabledHosts.includes(host2) || s.autoTranslate);
    if (wanted) {
      window.setTimeout(() => {
        if (!state.active) void start();
      }, 350);
      return;
    }
    if (blocked || !s.askOnSite) return;
    if (s.enabledHosts.includes(host2)) return;
    window.setTimeout(() => void maybeAsk(s), 700);
  })();
  var askedThisPage = false;
  async function maybeAsk(s) {
    if (askedThisPage || state.active) return;
    try {
      const sample = pageSample();
      const latin = (sample.match(/[A-Za-z]/g) || []).length;
      const cjk = (sample.match(/[\u3400-\u4dbf\u4e00-\u9fff]/g) || []).length;
      if (latin < 240) return;
      if (cjk > 0 && cjk / (cjk + latin) > 0.25) return;
      if (document.documentElement.dataset.tkActive === "1") return;
    } catch {
      return;
    }
    askedThisPage = true;
    try {
      document.documentElement.dataset.tkAsked = "1";
    } catch {
    }
    showAskBar(
      {
        onTranslate: () => {
          void (async () => {
            await start();
            await rememberHost(state.active);
          })();
        },
        onDecline: () => {
          void declineHost();
        }
      },
      { targetName: s.targetLang.startsWith("zh") ? "\u4E2D\u6587" : s.targetLang, accent: s.accentColor }
    );
  }
  window.addEventListener("pagehide", () => removeAskBar());
  window.addEventListener("termkeeper:toggle", () => void toggle());
  window.addEventListener("termkeeper:display", (e) => {
    const m = e.detail;
    if (!m) return;
    void (async () => {
      const s = await getSettingsCached();
      settings = { ...s, display: m };
      setDisplayMode(m);
    })();
  });
  window.addEventListener("termkeeper:refine", () => {
    void (async () => {
      settings = await getSettings();
      settings = { ...settings, mode: "smart" };
      queue = [];
      for (const u of unitIndex.values()) {
        const r = u.el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) {
          known.delete(u.id);
          queued.add(u.id);
          queue.push(u);
        }
      }
      if (queue.length) {
        state.running = true;
        kick();
      }
    })();
  });
})();
