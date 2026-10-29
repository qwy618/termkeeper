"use strict";
(() => {
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

  // src/popup/popup.ts
  var $ = (sel) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`missing element: ${sel}`);
    return el;
  };
  var tabId;
  var tabHost = "";
  var state = null;
  var settings = { ...DEFAULT_SETTINGS };
  var DOMAIN_NAMES = {
    common: "\u901A\u7528",
    frontend: "\u524D\u7AEF",
    "backend-jvm": "Java / JVM",
    "backend-py": "Python \u540E\u7AEF",
    "backend-go": "Go \u540E\u7AEF",
    "backend-node": "Node.js",
    "backend-other": "Rust / C# / PHP",
    db: "\u6570\u636E\u5E93",
    net: "\u7F51\u7EDC",
    devops: "\u4E91\u539F\u751F / \u8FD0\u7EF4",
    cloud: "\u4E91\u670D\u52A1",
    "ai-ml": "AI / ML",
    algo: "\u7B97\u6CD5",
    os: "\u64CD\u4F5C\u7CFB\u7EDF",
    security: "\u5B89\u5168",
    mobile: "\u79FB\u52A8\u7AEF"
  };
  async function activeTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }
  async function send(type, extra = {}) {
    if (!tabId) return null;
    try {
      return await chrome.tabs.sendMessage(tabId, { type, ...extra });
    } catch {
      return null;
    }
  }
  async function bg(msg) {
    try {
      const r = await chrome.runtime.sendMessage(msg);
      return r?.ok ? r.data : null;
    } catch {
      return null;
    }
  }
  function renderState() {
    const btn = $("#toggle");
    const bar = document.getElementById("s-bar");
    const stateEl = document.getElementById("s-state");
    const countEl = document.getElementById("s-progress");
    const termsEl = document.getElementById("s-terms");
    const domainEl = document.getElementById("s-domain");
    if (!stateEl || !countEl || !termsEl || !domainEl) return;
    const setState = (text, cls = "") => {
      stateEl.textContent = text;
      stateEl.className = `pc-state ${cls}`.trim();
    };
    if (!state) {
      setState("\u4E0D\u53EF\u7528", "err");
      countEl.textContent = "\u2014";
      termsEl.textContent = "\u2014";
      domainEl.textContent = "\u2014";
      domainEl.className = "chip plain";
      if (bar) bar.style.width = "0%";
      return;
    }
    const running = state.active;
    btn.textContent = running ? "\u8FD8\u539F\u539F\u6587" : "\u7FFB\u8BD1\u6B64\u7F51\u7AD9";
    btn.classList.toggle("active", running);
    const total = state.total || 0;
    const done = Math.min(state.done || 0, total || state.done || 0);
    const pct = total ? Math.max(0, Math.min(100, Math.round(done / total * 100))) : 0;
    if (bar) bar.style.width = running ? `${pct}%` : "0%";
    if (running) {
      const finished = total > 0 && done >= total;
      if (state.failed) setState(`\u7FFB\u8BD1\u4E2D \xB7 ${state.failed} \u6BB5\u5931\u8D25`, "warn");
      else if (finished) setState("\u7FFB\u8BD1\u5B8C\u6210", "ok");
      else setState("\u7FFB\u8BD1\u4E2D");
      countEl.textContent = total ? `${done} / ${total} \u6BB5 \xB7 ${pct}%` : "\u51C6\u5907\u4E2D\u2026";
      termsEl.textContent = state.termHits ? `${state.termHits} \u5904\u672F\u8BED\u5DF2\u4FDD\u7559` : "\u6682\u65E0\u672F\u8BED\u547D\u4E2D";
      const dn = state.domain && state.domain !== "auto" ? DOMAIN_NAMES[state.domain] || state.domain : "";
      if (dn) {
        domainEl.textContent = state.domainScore ? `${dn} ${Math.round(state.domainScore * 100)}%` : dn;
        domainEl.className = "chip";
      } else {
        domainEl.textContent = "\u9886\u57DF\u81EA\u52A8";
        domainEl.className = "chip plain";
      }
    } else {
      setState("\u672A\u7FFB\u8BD1");
      countEl.textContent = "\u2014";
      termsEl.textContent = "\u2014";
      domainEl.textContent = "\u9886\u57DF\u81EA\u52A8";
      domainEl.className = "chip plain";
    }
  }
  function showTip(html) {
    const tip = document.getElementById("tip");
    if (tip) tip.innerHTML = html;
  }
  async function refresh() {
    const res = await send("GET_PAGE_STATE");
    state = res?.ok ? res.data : null;
    if (!state) {
      $("#blocked")?.classList.remove("hidden");
      $("#main")?.classList.add("hidden");
    } else {
      $("#blocked")?.classList.add("hidden");
      $("#main")?.classList.remove("hidden");
    }
    renderState();
  }
  function syncSwitches() {
    const site = document.getElementById("site");
    if (site) {
      site.checked = Boolean(tabHost && (settings.enabledHosts || []).includes(tabHost));
      site.disabled = !tabHost;
    }
    const ask = document.getElementById("ask");
    if (ask) ask.checked = settings.askOnSite !== false;
  }
  async function refreshSettings() {
    const s = await bg({ type: "GET_SETTINGS" });
    if (s) settings = s;
    syncSwitches();
  }
  async function init() {
    const tab = await activeTab();
    tabId = tab?.id;
    try {
      tabHost = tab?.url ? new URL(tab.url).host : "";
    } catch {
      tabHost = "";
    }
    const verEl = document.getElementById("ver");
    const v = chrome.runtime.getManifest().version;
    if (verEl) verEl.textContent = `v${v}`;
    const s = await bg({ type: "GET_SETTINGS" });
    if (s) settings = s;
    const dispSel = $("#display");
    dispSel.value = settings.display;
    if (settings.mode === "smart" && !(settings.llm.apiKey && settings.llm.baseUrl && settings.llm.model)) {
      showTip('AI \u7CBE\u4FEE\u5C1A\u672A\u914D\u7F6E\uFF0C\u672C\u6B21\u56DE\u9000\u514D\u8D39\u5F15\u64CE\u3002<a href="#" id="goto-llm">\u53BB\u914D\u7F6E</a>');
    }
    await refresh();
    syncSwitches();
    const timer = window.setInterval(() => {
      if (state?.active) {
        void (async () => {
          const r = await send("GET_PAGE_STATE");
          if (r?.ok) {
            state = r.data;
            renderState();
          }
        })();
      }
    }, 700);
    window.addEventListener("unload", () => window.clearInterval(timer));
    $("#toggle").addEventListener("click", async () => {
      const btn = $("#toggle");
      btn.disabled = true;
      const r = await send("TOGGLE");
      btn.disabled = false;
      if (!r?.ok) {
        showTip("\u65E0\u6CD5\u5728\u5F53\u524D\u9875\u9762\u64CD\u4F5C\uFF0C\u8BF7\u5237\u65B0\u9875\u9762\u540E\u91CD\u8BD5\u3002");
        return;
      }
      state = r.data;
      renderState();
      await refreshSettings();
    });
    const siteBox = document.getElementById("site");
    siteBox?.addEventListener("change", async () => {
      if (!tabHost) return;
      const on = siteBox.checked;
      const hosts = new Set(settings.enabledHosts || []);
      if (on) hosts.add(tabHost);
      else hosts.delete(tabHost);
      settings.enabledHosts = [...hosts];
      await bg({ type: "SET_SETTINGS", patch: { enabledHosts: settings.enabledHosts } });
      if (on && !state?.active) await send("TOGGLE");
      if (!on && state?.active) await send("TOGGLE");
      await refresh();
      await refreshSettings();
    });
    const askBox = document.getElementById("ask");
    askBox?.addEventListener("change", async () => {
      settings.askOnSite = askBox.checked;
      await bg({ type: "SET_SETTINGS", patch: { askOnSite: settings.askOnSite } });
    });
    dispSel.addEventListener("change", async () => {
      settings.display = dispSel.value;
      await bg({ type: "SET_SETTINGS", patch: { display: settings.display } });
      await send("SET_DISPLAY", { display: settings.display });
    });
    document.addEventListener("click", (e) => {
      const t = e.target;
      if (t.id === "goto-llm" || t.id === "openOptions") {
        e.preventDefault();
        void chrome.runtime.openOptionsPage();
        window.close();
      }
    });
  }
  void init();
})();
