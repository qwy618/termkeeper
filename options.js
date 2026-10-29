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

  // src/options/options.ts
  var $ = (sel) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`missing: ${sel}`);
    return el;
  };
  var DOMAIN_NAMES = {
    common: "\u901A\u7528\u6280\u672F",
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
  var STRATEGY_LABEL = {
    keep: "\u4FDD\u6301\u539F\u6587",
    translateAs: "\u56FA\u5B9A\u8BD1\u6CD5",
    annotate: "\u4FDD\u7559+\u52A0\u6CE8",
    forbid: "\u7981\u7528\u8BD1\u6CD5"
  };
  var settings = { ...DEFAULT_SETTINGS };
  async function bg(msg) {
    try {
      const r = await chrome.runtime.sendMessage(msg);
      return r?.ok ? r.data : null;
    } catch {
      return null;
    }
  }
  function toast(elId, text, ok = true) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = text;
    el.className = `msg ${ok ? "ok" : "err"}`;
    if (ok) {
      window.setTimeout(() => {
        if (el.textContent === text) {
          el.textContent = "";
          el.className = "msg";
        }
      }, 2600);
    }
  }
  async function save(patch) {
    const next = await bg({ type: "SET_SETTINGS", patch });
    if (next) settings = next;
  }
  function initTabs() {
    for (const tab of Array.from(document.querySelectorAll(".tab"))) {
      tab.addEventListener("click", () => {
        for (const t of Array.from(document.querySelectorAll(".tab"))) t.classList.remove("active");
        for (const p of Array.from(document.querySelectorAll(".panel"))) p.classList.remove("active");
        tab.classList.add("active");
        document.getElementById(`panel-${tab.dataset.tab}`)?.classList.add("active");
      });
    }
  }
  function initEngine() {
    const mode = $("#opt-mode");
    const baseUrl = $("#opt-baseurl");
    const apiKey = $("#opt-apikey");
    const model = $("#opt-model");
    mode.value = settings.mode;
    baseUrl.value = settings.llm.baseUrl;
    apiKey.value = settings.llm.apiKey;
    model.value = settings.llm.model;
    mode.addEventListener("change", () => void save({ mode: mode.value }));
    const persistLlm = () => {
      void save({
        llm: {
          ...settings.llm,
          baseUrl: baseUrl.value.trim(),
          apiKey: apiKey.value.trim(),
          model: model.value.trim()
        }
      });
    };
    for (const el of [baseUrl, apiKey, model]) {
      el.addEventListener("change", persistLlm);
      el.addEventListener("blur", persistLlm);
    }
    const probe = async (m) => {
      const out = $("#probe-result");
      out.textContent = "\u6D4B\u8BD5\u4E2D\u2026";
      out.className = "probe-result";
      persistLlm();
      await new Promise((r2) => setTimeout(r2, 120));
      const r = await bg({ type: "PROBE_ENGINE", mode: m });
      if (!r) {
        out.textContent = "\u6D4B\u8BD5\u5931\u8D25\uFF1A\u540E\u53F0\u65E0\u54CD\u5E94";
        out.className = "probe-result err";
        return;
      }
      out.textContent = r.message;
      out.className = `probe-result ${r.ok ? "ok" : "err"}`;
    };
    $("#btn-probe-fast").addEventListener("click", () => void probe("fast"));
    $("#btn-probe-smart").addEventListener("click", () => void probe("smart"));
  }
  async function initDomainLock() {
    const sel = $("#opt-domain");
    sel.value = settings.domainLock || "auto";
    sel.addEventListener(
      "change",
      () => void save({ domainLock: sel.value })
    );
    const idx = await bg({ type: "LIST_DOMAINS" });
    if (!idx?.domains?.length) return;
    for (const d of idx.domains) {
      if (d.id === "common") continue;
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = `${DOMAIN_NAMES[d.id] || d.id} \xB7 ${d.count} \u6761`;
      sel.appendChild(opt);
    }
    sel.value = settings.domainLock || "auto";
  }
  function initDisplay() {
    const disp = $("#opt-display");
    const accent = $("#opt-accent");
    const guard = $("#opt-guard");
    const annotate = $("#opt-annotate");
    const forbid = $("#opt-forbid");
    const auto = $("#opt-auto");
    disp.value = settings.display;
    accent.value = settings.accentColor || "#5b6cf9";
    guard.checked = settings.properNounGuard;
    annotate.checked = settings.annotateFirst;
    forbid.checked = settings.forbidReplace;
    auto.checked = settings.autoTranslate;
    auto.addEventListener("change", () => void save({ autoTranslate: auto.checked }));
    disp.addEventListener("change", () => void save({ display: disp.value }));
    accent.addEventListener("input", () => void save({ accentColor: accent.value }));
    guard.addEventListener("change", () => void save({ properNounGuard: guard.checked }));
    annotate.addEventListener("change", () => void save({ annotateFirst: annotate.checked }));
    forbid.addEventListener("change", () => void save({ forbidReplace: forbid.checked }));
  }
  function strategyTag(s) {
    const cls = s === "keep" ? "keep" : s === "annotate" ? "annotate" : "";
    return `<span class="tag ${cls}">${STRATEGY_LABEL[s] || s}</span>`;
  }
  async function renderUserTerms() {
    const list = await bg({ type: "GET_TERMS" }) || [];
    const tbody = $("#user-terms");
    const empty = $("#user-terms-empty");
    const count = $("#user-term-count");
    count.textContent = String(list.length);
    empty.style.display = list.length ? "none" : "block";
    tbody.innerHTML = list.map(
      (e) => `<tr>
        <td><code>${escapeHtml(e.term || "")}</code></td>
        <td>${strategyTag(e.strategy)}</td>
        <td>${e.target ? escapeHtml(e.target) : "\u2014"}</td>
        <td>${e.caseSensitive ? "\u662F" : "\u5426"}</td>
        <td><button class="del" data-del="${encodeURIComponent(e.term || "")}" title="\u5220\u9664">\xD7</button></td>
      </tr>`
    ).join("");
    for (const btn of Array.from(tbody.querySelectorAll("[data-del]"))) {
      btn.addEventListener("click", async () => {
        const term = decodeURIComponent(btn.dataset.del || "");
        await bg({ type: "DELETE_TERM", term });
        await renderUserTerms();
        toast("term-msg", `\u5DF2\u5220\u9664\u300C${term}\u300D`);
      });
    }
  }
  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function initTermForm() {
    const input = $("#term-input");
    const strategy = $("#term-strategy");
    const target = $("#term-target");
    const cs = $("#term-cs");
    strategy.addEventListener("change", () => {
      const needTarget = strategy.value !== "keep";
      target.style.opacity = needTarget ? "1" : "0.5";
      target.placeholder = needTarget ? "\u4E2D\u6587\uFF08\u56FA\u5B9A\u8BD1\u6CD5/\u6CE8\u91CA\u5185\u5BB9\uFF09" : "\uFF08\u4FDD\u6301\u539F\u6587\u65E0\u9700\u586B\u5199\uFF09";
    });
    $("#btn-add-term").addEventListener("click", async () => {
      const term = input.value.trim();
      if (!term) {
        toast("term-msg", "\u8BF7\u5148\u586B\u5199\u672F\u8BED", false);
        return;
      }
      if (strategy.value !== "keep" && !target.value.trim()) {
        toast("term-msg", "\u8BE5\u7B56\u7565\u9700\u8981\u586B\u5199\u4E2D\u6587\u5185\u5BB9", false);
        return;
      }
      const entry = {
        term,
        strategy: strategy.value,
        target: target.value.trim() || void 0,
        caseSensitive: cs.checked,
        matchMode: /\s/.test(term) ? "phrase" : "wholeWord",
        domain: "common",
        priority: 1e3,
        source: "user"
      };
      await bg({ type: "UPSERT_TERM", entry });
      input.value = "";
      target.value = "";
      await renderUserTerms();
      toast("term-msg", `\u5DF2\u6DFB\u52A0\u300C${term}\u300D\uFF0C\u4E4B\u540E\u7684\u7FFB\u8BD1\u4F1A\u7ACB\u5373\u751F\u6548`);
    });
  }
  function initImportExport() {
    const file = $("#file-import");
    $("#btn-import").addEventListener("click", () => file.click());
    file.addEventListener("change", async () => {
      const f = file.files?.[0];
      if (!f) return;
      try {
        const text = await f.text();
        const n = await bg({ type: "IMPORT_TERMS", json: text });
        await renderUserTerms();
        toast("term-msg", `\u5BFC\u5165\u5B8C\u6210\uFF0C\u5F53\u524D\u5171 ${n ?? "?"} \u6761\u4E2A\u4EBA\u672F\u8BED`);
      } catch (e) {
        toast("term-msg", `\u5BFC\u5165\u5931\u8D25\uFF1A${String(e)}`, false);
      } finally {
        file.value = "";
      }
    });
    $("#btn-export").addEventListener("click", async () => {
      const list = await bg({ type: "EXPORT_TERMS" });
      if (!list) return;
      const blob = new Blob([JSON.stringify(list, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `termkeeper-terms-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
  async function initBuiltin() {
    const sel = $("#builtin-domain");
    const idx = await bg({ type: "LIST_DOMAINS" });
    sel.innerHTML = "";
    const domains = idx?.domains?.length ? idx.domains : Object.keys(DOMAIN_NAMES).map((id) => ({ id, name: DOMAIN_NAMES[id], file: "", count: 0, fingerprints: [] }));
    for (const d of domains) {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = `${DOMAIN_NAMES[d.id] || d.id}\uFF08${d.count}\uFF09`;
      sel.appendChild(opt);
    }
    const tbody = $("#builtin-terms");
    const load = async () => {
      const list = await bg({ type: "GET_BUILTIN_TERMS", domain: sel.value }) || [];
      if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="3" class="empty">\u8BE5\u57DF\u6682\u65E0\u8BCD\u6761</td></tr>`;
        return;
      }
      tbody.innerHTML = list.slice(0, 800).map(
        (e) => `<tr>
          <td><code>${escapeHtml(e.term)}</code></td>
          <td>${strategyTag(e.strategy)}</td>
          <td>${e.target ? escapeHtml(e.target) : "\u2014"}</td>
        </tr>`
      ).join("");
    };
    sel.addEventListener("change", () => void load());
    await load();
  }
  async function renderStats() {
    const s = await bg({ type: "GET_STATS" }) || null;
    if (!s) return;
    $("#st-chars").textContent = s.chars.toLocaleString();
    $("#st-cache").textContent = s.cacheHits.toLocaleString();
    $("#st-llm").textContent = s.llmChars.toLocaleString();
    $("#st-fail").textContent = s.failures.toLocaleString();
  }
  function initUsage() {
    $("#btn-cache-info").addEventListener("click", async () => {
      const info = await bg({ type: "CACHE_SIZE" });
      const el = $("#cache-info");
      if (!info) return;
      el.textContent = ` \u5F53\u524D ${info.count.toLocaleString()} \u6761\uFF0C\u7EA6 ${(info.bytes / 1024).toFixed(0)} KB\u3002`;
    });
    $("#btn-clear-cache").addEventListener("click", async () => {
      await bg({ type: "CLEAR_CACHE" });
      const el = $("#cache-info");
      if (el) el.textContent = " \u7F13\u5B58\u5DF2\u6E05\u7A7A\u3002";
    });
    $("#btn-reset-stats").addEventListener("click", async () => {
      await bg({ type: "RESET_STATS" });
      await renderStats();
    });
  }
  async function init() {
    const s = await bg({ type: "GET_SETTINGS" });
    if (s) settings = s;
    initTabs();
    initEngine();
    initDisplay();
    initTermForm();
    initImportExport();
    initUsage();
    await Promise.all([renderUserTerms(), initBuiltin(), renderStats(), initDomainLock()]);
  }
  void init();
})();
