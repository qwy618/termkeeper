// src/terms/ac.ts
var AhoCorasick = class {
  nodes = [newNode()];
  patterns = [];
  built = false;
  /** 每个 pattern 对应的归一化长度（大小写折叠后长度不变，用原文长度） */
  lens = [];
  get size() {
    return this.patterns.length;
  }
  add(pattern) {
    const key = pattern.text.toLowerCase();
    if (!key) return;
    let state = 0;
    for (const ch of key) {
      const nxt = this.nodes[state].next.get(ch);
      if (nxt === void 0) {
        const id = this.nodes.length;
        this.nodes.push(newNode());
        this.nodes[state].next.set(ch, id);
        state = id;
      } else {
        state = nxt;
      }
    }
    this.nodes[state].out.push(this.patterns.length);
    this.patterns.push(pattern);
    this.lens.push(pattern.text.length);
    this.built = false;
  }
  build() {
    const queue = [];
    for (const [, child] of this.nodes[0].next) {
      this.nodes[child].fail = 0;
      queue.push(child);
    }
    while (queue.length) {
      const cur = queue.shift();
      const curNode = this.nodes[cur];
      for (const [ch, child] of curNode.next) {
        let f = curNode.fail;
        while (f !== 0 && !this.nodes[f].next.has(ch)) f = this.nodes[f].fail;
        const candidate = this.nodes[f].next.get(ch);
        this.nodes[child].fail = candidate !== void 0 && candidate !== child ? candidate : 0;
        const failOut = this.nodes[this.nodes[child].fail].out;
        if (failOut.length) this.nodes[child].out = this.nodes[child].out.concat(failOut);
        queue.push(child);
      }
    }
    this.built = true;
    return this;
  }
  /** 线性扫描，返回所有命中（可能重叠） */
  search(haystack) {
    if (!this.built) this.build();
    const hits = [];
    let state = 0;
    for (let i = 0; i < haystack.length; i++) {
      const raw = haystack[i];
      const ch = raw.toLowerCase();
      const c = ch.length > 1 ? ch[0] : ch;
      while (state !== 0 && !this.nodes[state].next.has(c)) state = this.nodes[state].fail;
      const nxt = this.nodes[state].next.get(c);
      state = nxt === void 0 ? 0 : nxt;
      const out = this.nodes[state].out;
      for (let k = 0; k < out.length; k++) {
        const pi = out[k];
        const p = this.patterns[pi];
        if (p.caseSensitive && !this.verifyCase(haystack, i, pi)) continue;
        hits.push({ start: i - this.lens[pi] + 1, end: i + 1, payload: p.payload });
      }
    }
    return hits;
  }
  /** 校验原文在该位置是否与 pattern 大小写完全一致 */
  verifyCase(haystack, endIndex, pi) {
    const text = this.patterns[pi].text;
    const start = endIndex - text.length + 1;
    if (start < 0) return false;
    for (let j = 0; j < text.length; j++) {
      if (haystack[start + j] !== text[j]) return false;
    }
    return true;
  }
};
function newNode() {
  return { next: /* @__PURE__ */ new Map(), fail: 0, out: [] };
}
function arbitrate(hits) {
  if (hits.length <= 1) return hits.slice();
  const sorted = hits.slice().sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    if (a.priority !== b.priority) return b.priority - a.priority;
    return b.end - a.end;
  });
  const picked = [];
  let lastEnd = -1;
  for (const h of sorted) {
    if (h.start >= lastEnd) {
      picked.push(h);
      lastEnd = h.end;
    }
  }
  return picked;
}

// src/terms/rules.ts
var PRIORITY = {
  user: 1e3,
  learned: 800,
  domain: 500,
  common: 300,
  rule: 100
};
function ruleEntry(term, note) {
  return {
    term,
    strategy: "keep",
    caseSensitive: true,
    matchMode: "wholeWord",
    domain: "common",
    priority: PRIORITY.rule,
    source: "builtin-rule",
    note
  };
}
var UPPER_EXCEPTIONS = /* @__PURE__ */ new Set(["A", "I", "OK", "NO", "TV", "US", "PM", "AM", "VS", "ID", "OH"]);
var KNOWN_EXT = "json|jsonc|json5|ya?ml|toml|xml|html?|xhtml|css|scss|sass|less|js|mjs|cjs|ts|mts|tsx|jsx|vue|svelte|py|pyi|java|kt|kts|scala|go|rs|rb|php|swift|m|mm|c|cc|cpp|cxx|h|hpp|cs|fs|sh|bash|zsh|bat|ps1|cmd|md|mdx|txt|rst|tex|ini|conf|cfg|env|lock|properties|gradle|sql|proto|graphql|gql|tf|tfvars|dockerfile|jar|war|ear|class|dll|so|dylib|exe|msi|deb|rpm|apk|ipa|zip|tar|gz|tgz|bz2|xz|7z|rar|png|jpe?g|gif|svg|webp|avif|ico|bmp|tiff?|mp3|wav|flac|mp4|webm|mov|avi|mkv|pdf|docx?|xlsx?|pptx?|csv|tsv|log|db|sqlite";
var TLD = "com|org|net|io|dev|cn|edu|gov|co|ai|app|sh|me|xyz|tech|cloud|so|gg|tv|info|biz";
var SENTENCE_START = /(^|[.!?:;]\s*|\n\s*)$/;
var NOT_PROPER_PREFIX = /* @__PURE__ */ new Set([
  "the",
  "a",
  "an",
  "of",
  "in",
  "on",
  "at",
  "for",
  "to",
  "with",
  "by",
  "from",
  "and",
  "or",
  "but",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "this",
  "that",
  "these",
  "those",
  "your",
  "our",
  "its",
  "his",
  "her",
  "their",
  "my",
  "as",
  "if",
  "when",
  "while",
  "than",
  "into",
  "onto",
  "over",
  "under",
  "about",
  "via",
  "per",
  "not",
  "no",
  "any",
  "all",
  "each"
]);
var COMMON_WORDS = new Set(`the be to of and a in that have i it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is are was were been being has had did does doing will would should could may might must shall can need able also such very more much many few less least own same other another each every both either neither
data code file value name type string number boolean object array list map set key item element node tree graph index pointer reference memory stack heap queue hash table field method function class interface module package import export default public private protected static final const let var new delete return break continue try catch finally throw throws error exception warning note example usage result results return returns parameter parameters argument arguments option options default behavior behaviour config configuration settings environment version release build test tests debug log logs info request response server client user users system process thread lock cache buffer stream socket port host path url uri api sdk cli gui ui ux
about above after again against all am an and any are as at be because been before being below between both but by can cannot could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other ought our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why with would you your yours yourself yourselves
add allow apply build call change check click close create define delete display edit enable error expect fail find follow get give handle help include install keep know let load look make open parse pass perform provide read register remove render require reset return run save select send set show start stop support take try turn update use validate view wait write
available current default different direct easy empty exact expected false final first following full general given global good great hard important initial large last late left legal little local long low main major minor modern multiple natural necessary new next normal obvious old online open original other overall past perfect plain poor popular possible potential powerful practical previous primary private probable public quick quiet rare raw real recent regular relative relevant remaining right rough round running safe second separate serious several short similar simple single small smart social soft solid special specific stable standard strong sub sudden suitable sure technical temporary thin third tight tiny top total true typical unable unique unknown unusual upper urban useful usual valid various visual warm weak weekly whole wide wrong
`.split(/\s+/).filter(Boolean));
var GENERIC_DOC_WORDS = new Set(
  `access overview configuration database usage example examples introduction features
   requirements installation quickstart guide tutorial summary appendix chapter section
   contents navigation table row column cell dialog modal panel form layout theme template
   message breadcrumb sidebar pagination tooltip placeholder snippet boilerplate
   troubleshooting faq changelog release notes migration upgrade compatibility`.split(/\s+/).filter(Boolean)
);
function tokenFrequency(text) {
  const freq = /* @__PURE__ */ new Map();
  const re = /[A-Za-z][A-Za-z0-9'’-]*/g;
  let m;
  while (m = re.exec(text)) {
    const w = m[0].toLowerCase();
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  return freq;
}
function scanRules(text, opts) {
  const hits = [];
  const push = (start, end, note) => {
    const raw = text.slice(start, end);
    hits.push({ start, end, entry: ruleEntry(raw, note) });
  };
  if (opts.identifiers !== false) {
    for (const m of text.matchAll(/(?<![A-Za-z0-9_])[A-Z][A-Z0-9]{1,5}(?![A-Za-z0-9_])/g)) {
      const w = m[0];
      if (UPPER_EXCEPTIONS.has(w)) continue;
      push(m.index, m.index + w.length, "\u7F29\u7565\u8BCD");
    }
    for (const m of text.matchAll(/(?<![A-Za-z0-9_$])[a-z]+[A-Z][A-Za-z0-9$]*(?![A-Za-z0-9_])/g)) {
      const w = m[0];
      if (w.length < 4) continue;
      push(m.index, m.index + w.length, "\u9A7C\u5CF0\u6807\u8BC6\u7B26");
    }
    for (const m of text.matchAll(/(?<![A-Za-z0-9_$])[A-Z][a-z]+[A-Z][A-Za-z0-9$]*(?![A-Za-z0-9_])/g)) {
      const w = m[0];
      push(m.index, m.index + w.length, "\u9A7C\u5CF0\u6807\u8BC6\u7B26");
    }
    for (const m of text.matchAll(/(?<![\w.$])[a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*){2,}(?![\w$])/g)) {
      push(m.index, m.index + m[0].length, "\u70B9\u94FE\u6807\u8BC6\u7B26");
    }
    for (const m of text.matchAll(/(?<![A-Za-z0-9_])[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+(?![A-Za-z0-9_])/g)) {
      push(m.index, m.index + m[0].length, "\u4E0B\u5212\u7EBF\u6807\u8BC6\u7B26");
    }
    for (const m of text.matchAll(/(?<![A-Za-z0-9.])v?\d+(?:\.\d+){1,3}(?:-[A-Za-z0-9.]+)?(?![A-Za-z0-9.])/g)) {
      push(m.index, m.index + m[0].length, "\u7248\u672C\u53F7");
    }
    for (const m of text.matchAll(new RegExp(`(?<![\\w./-])[\\w.-]+\\.(?:${KNOWN_EXT})(?![\\w])`, "gi"))) {
      push(m.index, m.index + m[0].length, "\u6587\u4EF6\u540D");
    }
    for (const m of text.matchAll(/(?<![\w/])\/(?:[\w.-]+\/)+[\w.-]*(?![\w])/g)) {
      push(m.index, m.index + m[0].length, "\u8DEF\u5F84");
    }
    for (const m of text.matchAll(/(?<![\w-])--?[A-Za-z][\w-]*(?![\w-])/g)) {
      push(m.index, m.index + m[0].length, "\u547D\u4EE4\u884C\u53C2\u6570");
    }
    for (const m of text.matchAll(/https?:\/\/[^\s<>"'）)】]+/g)) {
      push(m.index, m.index + m[0].length, "URL");
    }
    for (const m of text.matchAll(new RegExp(`(?<![\\w.-])(?:[a-z0-9][a-z0-9-]*\\.)+(?:${TLD})(?![\\w.-])`, "gi"))) {
      push(m.index, m.index + m[0].length, "\u57DF\u540D");
    }
    for (const m of text.matchAll(/(?<![A-Za-z0-9_])O\([^()]{1,24}\)(?![\w])/g)) {
      push(m.index, m.index + m[0].length, "\u590D\u6742\u5EA6\u8BB0\u53F7");
    }
    for (const m of text.matchAll(/(?<![A-Za-z0-9_])0x[0-9A-Fa-f]+(?![A-Za-z0-9_])/g)) {
      push(m.index, m.index + m[0].length, "\u5341\u516D\u8FDB\u5236");
    }
    for (const m of text.matchAll(/(?<![A-Za-z0-9_])[1-9]\d{0,5}\s?(?:KB|MB|GB|TB|ms|µs|ns|px|em|rem)(?![A-Za-z0-9_])/g)) {
      push(m.index, m.index + m[0].length, "\u6570\u503C\u5355\u4F4D");
    }
  }
  if (opts.properNounGuard) {
    const freq = tokenFrequency(text);
    const re = /[A-Za-z][A-Za-z0-9'’-]*/g;
    let m;
    while (m = re.exec(text)) {
      const w = m[0];
      const start = m.index;
      if (!/^[A-Z][a-z]/.test(w)) continue;
      if (w.length < 4) continue;
      const lower = w.toLowerCase();
      if (COMMON_WORDS.has(lower)) continue;
      if (GENERIC_DOC_WORDS.has(lower)) continue;
      const before = text.slice(Math.max(0, start - 60), start);
      if (SENTENCE_START.test(before) && (freq.get(lower) || 0) < 2) continue;
      const prevMatch = before.match(/([A-Za-z][A-Za-z0-9'’-]*)\s+$/);
      if (prevMatch && NOT_PROPER_PREFIX.has(prevMatch[1].toLowerCase())) {
        if ((freq.get(lower) || 0) < 2) continue;
      }
      push(start, start + w.length, "\u4E13\u6709\u540D\u8BCD");
    }
  }
  return hits;
}

// src/shared/util.ts
function groupByPayload(items, payloadOf) {
  const groups = /* @__PURE__ */ new Map();
  for (const it of items) {
    const key = payloadOf(it);
    const g = groups.get(key);
    if (g) g.push(it);
    else groups.set(key, [it]);
  }
  return { uniq: [...groups.values()].map((g) => g[0]), groups };
}
async function pool(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
function isAsciiWordChar(ch) {
  return /[A-Za-z0-9_]/.test(ch);
}
function looksUntranslated(src, out) {
  const s = (src || "").trim();
  const o = (out || "").trim();
  if (!o) return false;
  if (!/[A-Za-z]{4,}/.test(s)) return false;
  if (o === s) return true;
  return !/[\u3400-\u4dbf\u4e00-\u9fff]/.test(o);
}
var CJK = "\\u3400-\\u4dbf\\u4e00-\\u9fff\\u3000-\\u303f\\uff01-\\uff60\\uffe0-\\uffe6";
function polishCJK(s) {
  return s.replace(new RegExp(`([${CJK}])[ \\t\\u00a0]+(?=[${CJK}])`, "g"), "$1").replace(new RegExp(`[ \\t\\u00a0]{2,}(?=[${CJK}])`, "g"), " ").replace(/[ \t\u00a0]+$/gm, "").trim();
}

// src/terms/matcher.ts
function pluralSuffix(term) {
  if (!/^[A-Za-z][A-Za-z0-9._-]{2,}$/.test(term)) return null;
  return /(s|x|z|ch|sh)$/i.test(term) ? "es" : "s";
}
var TermMatcher = class {
  ac = new AhoCorasick();
  regexEntries = [];
  count = 0;
  get size() {
    return this.count;
  }
  setEntries(entries) {
    this.ac = new AhoCorasick();
    this.regexEntries = [];
    this.count = entries.length;
    for (const e of entries) {
      if (e.matchMode === "regex") {
        this.regexEntries.push(e);
        continue;
      }
      if (e.matchMode === "phrase") {
        const variants = /* @__PURE__ */ new Set([
          e.term,
          e.term.replace(/\s+/g, "-"),
          e.term.replace(/\s+/g, " ")
        ]);
        for (const v of variants) {
          this.ac.add({ text: v, caseSensitive: e.caseSensitive, payload: e });
        }
      } else {
        this.ac.add({ text: e.term, caseSensitive: e.caseSensitive, payload: e });
        const suffix = e.strategy === "keep" ? pluralSuffix(e.term) : null;
        if (suffix) {
          this.ac.add({ text: e.term + suffix, caseSensitive: e.caseSensitive, payload: e });
        }
      }
    }
    this.ac.build();
  }
  /** 返回按位置升序、互不重叠的最终命中 */
  match(text, ruleOpts) {
    const ranked = [];
    const spans = protectedSpans(text);
    const blocked = (s, e) => spans.some(([ps, pe]) => s < pe && e > ps);
    for (const h of this.ac.search(text)) {
      if (blocked(h.start, h.end)) continue;
      if (!this.acceptBoundary(text, h, h.payload)) continue;
      ranked.push({ start: h.start, end: h.end, priority: h.payload.priority, entry: h.payload });
    }
    for (const e of this.regexEntries) {
      let re;
      try {
        re = new RegExp(e.term, e.caseSensitive ? "g" : "gi");
      } catch {
        continue;
      }
      for (const m of text.matchAll(re)) {
        if (!m[0]) continue;
        if (blocked(m.index, m.index + m[0].length)) continue;
        ranked.push({ start: m.index, end: m.index + m[0].length, priority: e.priority, entry: e });
      }
    }
    for (const h of scanRules(text, ruleOpts)) {
      if (blocked(h.start, h.end)) continue;
      ranked.push({ start: h.start, end: h.end, priority: h.entry.priority, entry: h.entry });
    }
    const picked = arbitrate(ranked);
    return picked.map((p) => ({ start: p.start, end: p.end, entry: p.entry }));
  }
  /** wholeWord 模式需要校验词边界，避免 Bean 命中 BeanFactory */
  acceptBoundary(text, h, entry) {
    if (entry.matchMode === "regex" || entry.matchMode === "phrase") return true;
    const deny = DENY_AFTER[entry.term.toLowerCase()];
    if (deny) {
      const rest = text.slice(h.end, h.end + 14);
      if (deny.test(rest)) return false;
    }
    const before = h.start > 0 ? text[h.start - 1] : "";
    const after = h.end < text.length ? text[h.end] : "";
    if (before && isAsciiWordChar(before) && before !== "_") return false;
    if (after && isAsciiWordChar(after) && after !== "_") return false;
    return true;
  }
};
var INLINE_TOKEN_RE = /⟦[^⟧\n]{0,16}⟧|［[^］\n]{0,16}］|\[\[\s*\w{1,6}\s*\]\]/g;
function protectedSpans(text) {
  const spans = [];
  for (const m of text.matchAll(INLINE_TOKEN_RE)) {
    spans.push([m.index, m.index + m[0].length]);
  }
  return spans;
}
var DENY_AFTER = {
  go: /^\s+(to|for|home|back|ahead|through|over|up|down|out|in|on|away|off|with|further|beyond|around|by)\b/i,
  express: /^\s+(your|yourself|an?\b|the\b|that|this|concern|interest|gratitude|thanks|opinion|feeling|sympathy|regret)/i,
  pod: /^\s+(of|cast|like)\b/i,
  token: /^\s+(gesture|effort|amount|black)\b/i,
  stack: /^\s+(of|up)\b/i,
  queue: /^\s+(up|for)\b/i,
  heap: /^\s+(of|on)\b/i
};

// src/terms/store.ts
var BASE = chrome.runtime.getURL("");
var VERSION_KEY = "termTableVersion";
var USER_KEY = "userTerms";
var indexCache = null;
var siteMapCache = null;
var domainCache = /* @__PURE__ */ new Map();
function termDefaultCaseSensitive(term) {
  return /[A-Z]/.test(term);
}
function tupleToEntry(t, domain, source) {
  const [term, strategy, target, cs] = t;
  return {
    term,
    strategy,
    target,
    caseSensitive: cs ?? termDefaultCaseSensitive(term),
    matchMode: /\s/.test(term) ? "phrase" : "wholeWord",
    domain,
    priority: source === "builtin-domain" ? PRIORITY.domain : PRIORITY.common,
    source
  };
}
async function fetchJson(rel) {
  try {
    const res = await fetch(`${BASE}${rel}`, { cache: "no-cache" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
async function loadIndex() {
  if (indexCache) return indexCache;
  const idx = await fetchJson("data/terms/index.json");
  indexCache = idx ?? { version: 0, domains: [] };
  return indexCache;
}
async function loadSiteMap() {
  if (siteMapCache) return siteMapCache;
  const m = await fetchJson("data/terms/domainsite.json");
  siteMapCache = m?.map ?? {};
  return siteMapCache;
}
async function loadDomainFile(id) {
  const cached = domainCache.get(id);
  if (cached) return cached;
  const file = await fetchJson(`data/terms/domains/${id}.json`);
  if (!file) return null;
  const entries = (file.terms || []).map((t) => tupleToEntry(t, id, "builtin-domain"));
  const rec = { version: file.version || 1, entries };
  domainCache.set(id, rec);
  return rec;
}
async function loadCommon() {
  const file = await fetchJson("data/terms/common.json");
  if (!file) return [];
  return (file.terms || []).map((t) => tupleToEntry(t, "common", "builtin-common"));
}
async function getTermTableVersion() {
  const raw = await chrome.storage.local.get(VERSION_KEY);
  return raw[VERSION_KEY] ?? 1;
}
async function bumpTermTableVersion() {
  const cur = await getTermTableVersion();
  const next = cur + 1;
  await chrome.storage.local.set({ [VERSION_KEY]: next });
  return next;
}
async function getUserTerms() {
  const raw = await chrome.storage.local.get(USER_KEY);
  const list = raw[USER_KEY] || [];
  return list.map((e) => ({ ...e, source: e.source || "user" }));
}
async function replaceUserTerms(list) {
  await chrome.storage.local.set({ [USER_KEY]: list });
}
async function upsertUserTerm(entry) {
  const list = await getUserTerms();
  const idx = list.findIndex((e) => e.term.toLowerCase() === entry.term.toLowerCase());
  const normalized = { ...entry, source: "user", priority: PRIORITY.user };
  if (idx >= 0) list[idx] = normalized;
  else list.push(normalized);
  await replaceUserTerms(list);
  await bumpTermTableVersion();
  return list;
}
async function deleteUserTerm(term) {
  const list = await getUserTerms();
  const next = list.filter((e) => e.term.toLowerCase() !== term.toLowerCase());
  await replaceUserTerms(next);
  await bumpTermTableVersion();
  return next;
}
var TermService = class {
  matcher = new TermMatcher();
  loadedKey = "";
  loading = null;
  get current() {
    return this.matcher;
  }
  get entryCount() {
    return this.matcher.size;
  }
  /** 确保已加载指定域；key 未变则直接复用 */
  async ensure(domains, version) {
    const key = `${domains.slice().sort().join(",")}|${version}`;
    if (key === this.loadedKey) return;
    if (this.loading) await this.loading;
    this.loading = (async () => {
      const common = await loadCommon();
      const domainEntries = [];
      for (const d of domains) {
        const f = await loadDomainFile(d);
        if (f) domainEntries.push(...f.entries);
      }
      const user = await getUserTerms();
      const learned = user.filter((e) => e.source === "learned");
      const all = [...user, ...learned, ...domainEntries, ...common];
      const map = /* @__PURE__ */ new Map();
      for (const e of all) {
        const k = `${e.domain}|${e.term.toLowerCase()}|${e.strategy}`;
        const prev = map.get(k);
        if (!prev || e.priority > prev.priority) map.set(k, e);
      }
      this.matcher.setEntries([...map.values()]);
      this.loadedKey = key;
    })();
    try {
      await this.loading;
    } finally {
      this.loading = null;
    }
  }
  /** 术语表变更后强制重建 */
  invalidate() {
    this.loadedKey = "";
  }
};
var termService = new TermService();

// src/terms/pickler.ts
var OPEN = "\u27E6";
var CLOSE = "\u27E7";
var TOKEN_RE = /[⟦\[［]\s*T\s*(\d+)\s*[⟧\]］]/g;
function tokenOf(id) {
  return `${OPEN}T${id}${CLOSE}`;
}
function pickle(text, hits, startId = 1) {
  const tokens = /* @__PURE__ */ new Map();
  const forbids = [];
  const byText = /* @__PURE__ */ new Map();
  let nextId = startId;
  const parts = [];
  let cursor = 0;
  for (const h of hits) {
    if (h.start < cursor) continue;
    const raw = text.slice(h.start, h.end);
    const entry = h.entry;
    parts.push(text.slice(cursor, h.start));
    if (entry.strategy === "forbid") {
      if (entry.target) forbids.push({ wrong: entry.target, right: raw });
      parts.push(raw);
    } else {
      const reuseKey = `${entry.strategy}|${entry.term}|${entry.target ?? ""}|${raw}`;
      let id = byText.get(reuseKey);
      if (id === void 0) {
        id = nextId++;
        byText.set(reuseKey, id);
        tokens.set(id, { ...entry, term: raw });
      }
      parts.push(tokenOf(id));
    }
    cursor = h.end;
  }
  parts.push(text.slice(cursor));
  return { pickled: parts.join(""), tokens, forbids, nextId };
}
function unpickle(translated, tokens) {
  const annotated = /* @__PURE__ */ new Set();
  return translated.replace(TOKEN_RE, (_all, idStr) => {
    const id = Number(idStr);
    const entry = tokens.get(id);
    if (!entry) return _all;
    switch (entry.strategy) {
      case "translateAs":
        return entry.target || entry.term;
      case "annotate": {
        if (annotated.has(id)) return entry.term;
        annotated.add(id);
        return entry.target ? `${entry.term}\uFF08${entry.target}\uFF09` : entry.term;
      }
      case "keep":
      default:
        return entry.term;
    }
  });
}
function validateTokens(translated, tokens) {
  const seen = /* @__PURE__ */ new Set();
  for (const m of translated.matchAll(TOKEN_RE)) seen.add(Number(m[1]));
  const missing = [];
  for (const id of tokens.keys()) {
    if (!seen.has(id)) missing.push(id);
  }
  const extra = [];
  for (const id of seen) {
    if (!tokens.has(id)) extra.push(id);
  }
  return { ok: missing.length === 0 && extra.length === 0, missing, extra };
}
function repairMissing(translated, missing, tokens) {
  if (!missing.length) return translated;
  const tail = missing.slice().sort((a, b) => a - b).map((id) => {
    const e = tokens.get(id);
    if (!e) return "";
    return e.strategy === "translateAs" ? e.target || e.term : e.term;
  }).filter(Boolean).join("\u3001");
  return tail ? `${translated}\uFF08${tail}\uFF09` : translated;
}
function applyForbids(translated, forbids) {
  if (!forbids.length) return translated;
  let out = translated;
  for (const f of forbids) {
    if (!f.wrong) continue;
    out = out.split(f.wrong).join(f.right);
  }
  return out;
}

// src/terms/infer.ts
var URL_HINTS = [
  [/\/api\/|reference|docs?\/api/i, "backend-jvm"],
  [/\/css|\/html|\/dom/i, "frontend"],
  [/\/database|\/sql|\/query/i, "db"],
  [/\/network|\/protocol/i, "net"],
  [/\/deploy|\/ops|\/ci/i, "devops"]
];
function countFingerprints(sample, fps) {
  if (!sample || !fps.length) return 0;
  const lower = sample.toLowerCase();
  let n = 0;
  for (const fp of fps) {
    if (!fp) continue;
    const f = fp.toLowerCase();
    let idx = lower.indexOf(f);
    let hits = 0;
    while (idx !== -1 && hits < 5) {
      const b = idx > 0 ? lower[idx - 1] : "";
      const a = idx + f.length < lower.length ? lower[idx + f.length] : "";
      if (!/[a-z0-9]/.test(b) && !/[a-z0-9]/.test(a)) hits++;
      idx = lower.indexOf(f, idx + 1);
    }
    n += hits;
  }
  return n;
}
function inferDomain(ctx, sample, titlePath, index, siteMap) {
  const domainFps = /* @__PURE__ */ new Map();
  for (const d of index.domains) domainFps.set(d.id, d.fingerprints);
  let siteDomain = null;
  const host = ctx.host.toLowerCase();
  if (siteMap[host]) {
    siteDomain = siteMap[host];
  } else {
    const parts = host.split(".");
    for (let i = 1; i < parts.length - 1; i++) {
      const suffix = parts.slice(i).join(".");
      if (siteMap[suffix]) {
        siteDomain = siteMap[suffix];
        break;
      }
    }
  }
  const scored = [];
  for (const [domain, fps] of domainFps) {
    if (!fps.length) continue;
    const domainSignal = siteDomain === domain ? 1 : 0;
    const titleHits = countFingerprints(titlePath, fps);
    const titleSignal = Math.min(1, titleHits / 2);
    const sampleHits = countFingerprints(sample, fps);
    const sampleSignal = Math.min(1, sampleHits / 4);
    let urlSignal = 0;
    for (const [re, d] of URL_HINTS) {
      if (d === domain && re.test(ctx.url)) {
        urlSignal = 0.5;
        break;
      }
    }
    const score = 0.4 * domainSignal + 0.25 * titleSignal + 0.25 * sampleSignal + 0.1 * urlSignal;
    if (score > 0) scored.push({ domain, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  if (!top || top.score < 0.2) {
    return { primary: null, primaryScore: top?.score ?? 0, load: [], scores: scored };
  }
  const load = [top.domain];
  for (const s of scored.slice(1)) {
    if (load.length >= 3) break;
    if (s.score > top.score * 0.6 && s.score > 0.2) load.push(s.domain);
  }
  return { primary: top.domain, primaryScore: top.score, load, scores: scored };
}

// src/storage/cache.ts
var DB_NAME = "termkeeper";
var DB_VERSION = 1;
var STORE = "translations";
var dbPromise = null;
function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "key" });
        os.createIndex("ts", "ts");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
function tx(db, mode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}
function makeCacheKey(text, engine, termVersion) {
  let h1 = 2166136261;
  let h2 = 5381;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 16777619);
    h2 = Math.imul(h2, 33) + c | 0;
  }
  const a = (h1 >>> 0).toString(36);
  const b = (h2 >>> 0).toString(36);
  return `${a}${b}|${engine}|v${termVersion}|${text.length}`;
}
async function cacheGetMany(keys) {
  const out = /* @__PURE__ */ new Map();
  if (!keys.length) return out;
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      const store = tx(db, "readonly");
      let left = keys.length;
      for (const key of keys) {
        const req = store.get(key);
        req.onsuccess = () => {
          const rec = req.result;
          if (rec) out.set(key, rec);
          if (--left === 0) resolve();
        };
        req.onerror = () => {
          if (--left === 0) resolve();
        };
      }
    });
  } catch {
  }
  return out;
}
async function cacheSet(rec) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const req = tx(db, "readwrite").put({ ...rec, ts: Date.now(), hits: 0 });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
  }
}
async function cacheClear() {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const req = tx(db, "readwrite").clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
  }
}
async function cacheInfo() {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const req = tx(db, "readonly").getAll();
      req.onsuccess = () => {
        const rows = req.result;
        const bytes = rows.reduce((n, r) => n + (r.source?.length || 0) + (r.target?.length || 0), 0);
        resolve({ count: rows.length, bytes });
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return { count: 0, bytes: 0 };
  }
}
async function cacheEvict(max = 5e4) {
  try {
    const db = await openDb();
    const info = await cacheInfo();
    if (info.count <= max) return;
    const need = Math.floor(max * 0.2);
    await new Promise((resolve, reject) => {
      const store = tx(db, "readwrite");
      const req = store.index("ts").openCursor();
      let deleted = 0;
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor || deleted >= need) return resolve();
        cursor.delete();
        deleted++;
        cursor.continue();
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
  }
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
var EMPTY_STATS = { chars: 0, requests: 0, cacheHits: 0, failures: 0, llmChars: 0 };

// src/storage/stats.ts
var KEY = "stats";
async function getStats() {
  const raw = await chrome.storage.local.get(KEY);
  return { ...EMPTY_STATS, ...raw[KEY] || {} };
}
async function bumpStats(patch) {
  const cur = await getStats();
  const next = { ...cur };
  for (const k of Object.keys(patch)) {
    next[k] = (next[k] || 0) + (patch[k] || 0);
  }
  await chrome.storage.local.set({ [KEY]: next });
}
async function resetStats() {
  await chrome.storage.local.set({ [KEY]: { ...EMPTY_STATS } });
}

// src/engines/types.ts
var BatchSplitError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "BatchSplitError";
  }
};
var SEG_OPEN = "\u27E6S";
var SEG_CLOSE = "\u27E7";
function markSegments(texts) {
  return texts.map((t, i) => `${SEG_OPEN}${i + 1}${SEG_CLOSE} ${t}`).join("\n\n");
}
var SEG_RE = /[⟦\[［]\s*S\s*(\d+)\s*[⟧\]］]/g;
function splitSegments(translated, expected) {
  const matches = [...translated.matchAll(SEG_RE)];
  if (matches.length !== expected) {
    throw new BatchSplitError(`\u6BB5\u6807\u8BB0\u6570\u91CF\u4E0D\u7B26\uFF1A\u671F\u671B ${expected}\uFF0C\u5B9E\u9645 ${matches.length}`);
  }
  const out = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const start = m.index + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : translated.length;
    if (Number(m[1]) !== i + 1) {
      throw new BatchSplitError(`\u6BB5\u53F7\u4E71\u5E8F\uFF1A\u7B2C ${i + 1} \u4F4D\u662F ${m[1]}`);
    }
    out.push(translated.slice(start, end).trim());
  }
  return out;
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

// src/engines/fast/bing.ts
var HOSTS = ["https://cn.bing.com", "https://www.bing.com"];
var TOKEN_TTL = 50 * 60 * 1e3;
var MAX_CHARS = 1600;
function detectSourceLang(text) {
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  const cjk = (text.match(/[\u3400-\u4dbf\u4e00-\u9fff]/g) || []).length;
  if (cjk > 0) return "auto-detect";
  if (latin >= 2) return "en";
  return "auto-detect";
}
var BingEngine = class {
  id = "bing";
  label = "\u5FC5\u5E94\u7FFB\u8BD1\uFF08\u514D\u8D39\uFF09";
  supportsContext = false;
  /** 最近一次请求的耗时拆分（ms）：token 取凭证 vs 翻译请求本身 */
  lastTiming = { token: 0, post: 0 };
  bundle = null;
  refreshing = null;
  async healthCheck() {
    try {
      await this.ensureToken();
      return true;
    } catch {
      return false;
    }
  }
  async ensureToken(force = false) {
    if (!force && this.bundle && Date.now() < this.bundle.expiry) return this.bundle;
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      let lastErr = null;
      for (const host of HOSTS) {
        try {
          const res = await fetch(`${host}/translator`, {
            headers: { Accept: "text/html" },
            credentials: "omit"
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const html = await res.text();
          const m = /params_AbusePreventionHelper\s*=\s*\[(\d+),"([^"]+)",(\d+)\]/.exec(html);
          const ig = /IG:"([A-F0-9]{16,})"/.exec(html);
          if (!m || !ig) throw new Error("\u672A\u627E\u5230 token/IG");
          const bundle = {
            key: m[1],
            token: m[2],
            ig: ig[1],
            host,
            expiry: Date.now() + TOKEN_TTL
          };
          this.bundle = bundle;
          log.info("bing token ok via", host);
          return bundle;
        } catch (e) {
          lastErr = e;
          log.warn("bing token fail", host, String(e));
        }
      }
      throw new Error(`\u65E0\u6CD5\u83B7\u53D6\u5FC5\u5E94\u7FFB\u8BD1\u51ED\u8BC1\uFF1A${String(lastErr)}`);
    })();
    try {
      return await this.refreshing;
    } finally {
      this.refreshing = null;
    }
  }
  async postOnce(text, targetLang) {
    const tToken = Date.now();
    const b = await this.ensureToken();
    const tokenMs = Date.now() - tToken;
    const body = new URLSearchParams({
      fromLang: detectSourceLang(text),
      to: targetLang,
      text,
      token: b.token,
      key: b.key
    });
    const url = `${b.host}/ttranslatev3?isVertical=1&IG=${b.ig}&IID=translator.5026.1`;
    const tPost = Date.now();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      credentials: "omit"
    });
    this.lastTiming = { token: tokenMs, post: Date.now() - tPost };
    if (res.status === 401 || res.status === 403) {
      this.bundle = null;
      throw new Error(`\u5FC5\u5E94\u9274\u6743\u5931\u8D25 ${res.status}`);
    }
    if (!res.ok) throw new Error(`\u5FC5\u5E94\u8FD4\u56DE HTTP ${res.status}`);
    const data = await res.json();
    const text2 = data?.[0]?.translations?.[0]?.text;
    if (typeof text2 !== "string") throw new Error("\u5FC5\u5E94\u8FD4\u56DE\u7ED3\u6784\u5F02\u5E38");
    return text2;
  }
  async translate(texts, opts) {
    if (!texts.length) return [];
    const [head, ...rest] = texts;
    if (texts.length === 1) {
      if (head.length > MAX_CHARS) return [await this.translateLong(head, opts)];
      return [await this.postOnce(head, opts.targetLang)];
    }
    const total = texts.reduce((n, t) => n + t.length + 12, 0);
    if (total > MAX_CHARS) {
      const out = [];
      for (const t of texts) out.push(await this.translateLong(t, opts));
      return out;
    }
    const payload = markSegments(texts);
    try {
      const merged = await this.postOnce(payload, opts.targetLang);
      return splitSegments(merged, texts.length);
    } catch (e) {
      if (e instanceof BatchSplitError) {
        log.warn("\u6279\u91CF\u6BB5\u6807\u8BB0\u5931\u8D25\uFF0C\u964D\u7EA7\u9010\u6761", e.message);
        const out = [];
        for (const t of texts) out.push(await this.postOnce(t, opts.targetLang));
        return out;
      }
      throw e;
    }
  }
  /** 超长文本按句子切分，逐块翻译后拼接 */
  async translateLong(text, opts) {
    if (text.length <= MAX_CHARS) return this.postOnce(text, opts.targetLang);
    const chunks = [];
    let buf = "";
    for (const sentence of text.split(/(?<=[.!?。！？])\s+/)) {
      if ((buf + sentence).length > MAX_CHARS) {
        if (buf) chunks.push(buf);
        buf = sentence;
      } else {
        buf += (buf ? " " : "") + sentence;
      }
    }
    if (buf) chunks.push(buf);
    const out = [];
    for (const c of chunks) out.push(await this.postOnce(c, opts.targetLang));
    return out.join("");
  }
};

// src/engines/smart/openai.ts
var SYSTEM_PROMPT = `\u4F60\u662F\u4E13\u4E1A\u7684\u6280\u672F\u6587\u6863\u8BD1\u8005\uFF0C\u8BFB\u8005\u662F\u4E2D\u6587\u5F00\u53D1\u8005\u3002\u8BF7\u628A\u7528\u6237\u63D0\u4F9B\u7684\u82F1\u6587\u6280\u672F\u6587\u6863\u7247\u6BB5\u8BD1\u4E3A\u7B80\u4F53\u4E2D\u6587\u3002

\u786C\u6027\u89C4\u5219\uFF1A
1. \u6280\u672F\u672F\u8BED\u4FDD\u6301\u539F\u6587\uFF0C\u4E0D\u7FFB\u8BD1\u4EA7\u54C1\u540D\u3001\u6846\u67B6\u540D\u3001\u534F\u8BAE\u540D\u3001\u5E93\u540D\uFF08\u4F8B\u5982\uFF1ASpring\u3001Kafka\u3001REST\u3001JSON\u3001Kubernetes\u3001Redis\uFF09\u3002
2. \u88AB \u27E6Tn\u27E7 \u5305\u88F9\u7684\u5185\u5BB9\u662F\u53D7\u4FDD\u62A4\u7684\u672F\u8BED\u5360\u4F4D\u7B26\uFF0C\u5FC5\u987B\u539F\u6837\u8F93\u51FA\uFF0C\u4E0D\u5F97\u7FFB\u8BD1\u3001\u5220\u9664\u3001\u6539\u5199\u6216\u6539\u53D8\u6570\u91CF\u3002
3. \u27E6Sn\u27E7 \u662F\u6BB5\u843D\u7F16\u53F7\u6807\u8BB0\uFF0C\u5FC5\u987B\u539F\u6837\u4FDD\u7559\u5728\u6BCF\u6BB5\u5F00\u5934\uFF0C\u4E0D\u5F97\u5220\u9664\u3001\u5408\u5E76\u6216\u8C03\u6362\u987A\u5E8F\u3002
4. \u4EE3\u7801\u6807\u8BC6\u7B26\u3001\u547D\u4EE4\u3001\u914D\u7F6E\u952E\u3001\u8DEF\u5F84\u3001URL\u3001\u6570\u5B66\u8BB0\u53F7\u4E00\u5F8B\u4FDD\u6301\u539F\u6837\u3002
5. \u8BD1\u6587\u7B26\u5408\u4E2D\u6587\u6280\u672F\u5199\u4F5C\u4E60\u60EF\uFF1A\u4E0D\u8981\u9010\u5B57\u76F4\u8BD1\uFF0C\u4E0D\u8981\u53E3\u8BED\u5316\uFF0C\u4E0D\u8981\u6DFB\u52A0\u539F\u6587\u6CA1\u6709\u7684\u89E3\u91CA\u3002
6. \u53EA\u8F93\u51FA\u8BD1\u6587\u672C\u8EAB\uFF0C\u4E0D\u8981\u4EFB\u4F55\u524D\u8A00\u3001\u8BF4\u660E\u3001\u6CE8\u91CA\u6216\u4EE3\u7801\u5757\u56F4\u680F\u3002`;
function normalizeEndpoint(baseUrl) {
  let b = (baseUrl || "").trim().replace(/\/+$/, "");
  if (!b) throw new Error("\u672A\u914D\u7F6E API Base URL");
  if (/\/chat\/completions$/.test(b)) return b;
  if (/\/v\d+$/.test(b)) return `${b}/chat/completions`;
  return `${b}/v1/chat/completions`;
}
var OpenAiEngine = class {
  id = "smart";
  label = "AI \u7CBE\u4FEE";
  supportsContext = true;
  cfg;
  pageCtx;
  constructor(cfg, pageCtx) {
    this.cfg = cfg;
    this.pageCtx = pageCtx ?? null;
  }
  async healthCheck() {
    try {
      const out = await this.request("Reply with the single word: ok", 8);
      return out.length > 0;
    } catch {
      return false;
    }
  }
  async request(userContent, maxTokens = 2048) {
    const endpoint = normalizeEndpoint(this.cfg.baseUrl);
    if (!this.cfg.model) throw new Error("\u672A\u914D\u7F6E\u6A21\u578B\u540D");
    if (!this.cfg.apiKey) throw new Error("\u672A\u914D\u7F6E API Key");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6e4);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.cfg.apiKey}`
        },
        body: JSON.stringify({
          model: this.cfg.model,
          temperature: this.cfg.temperature ?? 0.2,
          max_tokens: maxTokens,
          stream: false,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userContent }
          ]
        }),
        signal: ctrl.signal
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`LLM HTTP ${res.status} ${detail.slice(0, 160)}`);
      }
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text !== "string") throw new Error("LLM \u8FD4\u56DE\u7ED3\u6784\u5F02\u5E38");
      return stripFence(text);
    } finally {
      clearTimeout(timer);
    }
  }
  async translate(texts, opts) {
    if (!texts.length) return [];
    const header = [];
    if (this.pageCtx) {
      header.push(`[\u9875\u9762] ${this.pageCtx.title} (${this.pageCtx.host})`);
    }
    if (opts.context) header.push(`[\u6807\u9898\u8DEF\u5F84] ${opts.context}`);
    const body = texts.length === 1 && texts[0].length < 200 ? texts[0] : markSegments(texts);
    const userContent = [...header, "", body].filter(Boolean).join("\n");
    const out = await this.request(userContent, Math.min(4096, 400 + texts.length * 400));
    if (texts.length === 1) {
      return [out.replace(/^[⟦\[［]\s*S\s*1\s*[⟧\]］]\s*/, "").trim()];
    }
    try {
      return splitSegments(out, texts.length);
    } catch (e) {
      if (e instanceof BatchSplitError) {
        throw new Error(`AI \u8F93\u51FA\u6BB5\u6807\u8BB0\u4E0D\u5B8C\u6574\uFF08${e.message}\uFF09`);
      }
      throw e;
    }
  }
};
function stripFence(s) {
  let t = s.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```[a-zA-Z]*\s*/, "").replace(/```\s*$/, "");
  }
  t = t.replace(/^(好的|当然|以下是|这是)[^\n]{0,40}[:：]\s*/, "");
  return t.trim();
}

// src/background/translator.ts
var bing = null;
function bingEngine() {
  if (!bing) bing = new BingEngine();
  return bing;
}
function createEngine(mode, settings, ctx) {
  if (mode === "smart") {
    return new OpenAiEngine(settings.llm, ctx);
  }
  return bingEngine();
}
function engineIdOf(mode, settings) {
  if (mode === "smart") return `smart:${settings.llm.model || "unknown"}`;
  return "bing";
}
function llmReady(settings) {
  return Boolean(settings.llm.baseUrl && settings.llm.apiKey && settings.llm.model);
}
async function resolveDomain(opts, settings) {
  if (settings.domainLock !== "auto") {
    return { domain: settings.domainLock, primary: settings.domainLock, score: 1, load: [settings.domainLock] };
  }
  if (opts.domain !== "auto") {
    return { domain: opts.domain, primary: opts.domain, score: 1, load: [opts.domain] };
  }
  const [index, siteMap] = await Promise.all([loadIndex(), loadSiteMap()]);
  const r = inferDomain(opts.ctx, opts.sample || "", opts.titlePath || "", index, siteMap);
  return { domain: r.primary ?? "auto", primary: r.primary, score: r.primaryScore, load: r.load };
}
function packBatches(items, maxChars, maxCount) {
  const batches = [];
  let cur = [];
  let chars = 0;
  for (const it of items) {
    if (cur.length && (cur.length >= maxCount || chars + it.pickled.length > maxChars)) {
      batches.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(it);
    chars += it.pickled.length + 12;
  }
  if (cur.length) batches.push(cur);
  return batches;
}
async function translateItems(items, opts) {
  const settings = opts.settings;
  const mode = opts.mode === "smart" && !llmReady(settings) ? "fast" : opts.mode;
  const engine = createEngine(mode, settings, opts.ctx);
  const engineId = engineIdOf(mode, settings);
  const tStart = Date.now();
  const resolved = await resolveDomain(
    { domain: opts.domain, ctx: opts.ctx, sample: opts.sample, titlePath: opts.titlePath },
    settings
  );
  const tDomain = Date.now();
  const termVersion = await getTermTableVersion();
  const domainsToLoad = resolved.load.length ? resolved.load : [];
  await termService.ensure(domainsToLoad, termVersion);
  const matcher = termService.current;
  const tTerms = Date.now();
  const results = /* @__PURE__ */ new Map();
  const pending = [];
  let termHitsTotal = 0;
  let cacheHits = 0;
  const keyOf = /* @__PURE__ */ new Map();
  for (const item of items) keyOf.set(item.id, makeCacheKey(item.payload, engineId, termVersion));
  const cached = await cacheGetMany([...keyOf.values()]);
  const tCache = Date.now();
  for (const item of items) {
    const key = keyOf.get(item.id);
    const hit = cached.get(key);
    if (hit) {
      results.set(item.id, {
        id: item.id,
        translated: hit.target,
        engine: hit.engine,
        fromCache: true
      });
      cacheHits++;
      continue;
    }
    const rawHits = matcher.match(item.payload, { properNounGuard: settings.properNounGuard });
    const hits = settings.annotateFirst ? rawHits : rawHits.map(
      (h) => h.entry.strategy === "annotate" ? { ...h, entry: { ...h.entry, strategy: "keep" } } : h
    );
    termHitsTotal += hits.length;
    const p = pickle(item.payload, hits);
    pending.push({
      item,
      pickled: p.pickled,
      tokens: p.tokens,
      forbids: p.forbids,
      termHits: hits.length
    });
  }
  if (cacheHits) await bumpStats({ cacheHits });
  const groups = /* @__PURE__ */ new Map();
  let dedupSaved = 0;
  if (pending.length) {
    const { uniq, groups: g2 } = groupByPayload(pending, (p) => p.item.payload);
    for (const [k, v] of g2) groups.set(k, v);
    dedupSaved = pending.length - uniq.length;
    const maxChars = mode === "fast" ? 1500 : 6e3;
    const maxCount = mode === "fast" ? 9 : 6;
    const batches = packBatches(uniq, maxChars, maxCount);
    const concurrency = 4;
    const targetLang = settings.targetLang;
    await pool(batches, concurrency, async (batch) => {
      let outs = null;
      try {
        outs = await engine.translate(
          batch.map((b) => b.pickled),
          { targetLang, context: batch[0].item.headingPath }
        );
        if (outs.length !== batch.length) throw new Error("\u6279\u91CF\u8FD4\u56DE\u6761\u6570\u4E0D\u7B26");
      } catch (e) {
        log.warn("\u6279\u91CF\u5931\u8D25\uFF0C\u964D\u7EA7\u9010\u6761", String(e));
        outs = null;
      }
      if (outs === null) {
        for (const b of batch) {
          try {
            const one = await engine.translate([b.pickled], { targetLang, context: b.item.headingPath });
            finishOne(b, one[0], engine.id, engineId, termVersion, results, false);
          } catch (e) {
            finishOne(b, "", engine.id, engineId, termVersion, results, true, String(e));
          }
        }
        return;
      }
      for (let i = 0; i < batch.length; i++) {
        finishOne(batch[i], outs[i], engine.id, engineId, termVersion, results, false);
      }
    });
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      const r = results.get(g[0].item.id);
      if (!r) continue;
      for (let i = 1; i < g.length; i++) {
        results.set(g[i].item.id, { ...r, id: g[i].item.id });
      }
    }
  }
  const MAX_RETRY = 12;
  let retried = 0;
  if (mode === "fast" && pending.length) {
    const seen = /* @__PURE__ */ new Set();
    const candidates = pending.filter((p) => {
      const r = results.get(p.item.id);
      if (!r || r.error) return false;
      if (p.item.payload.length > 240) return false;
      if (!looksUntranslated(p.item.payload, r.translated)) return false;
      if (seen.has(p.item.payload)) return false;
      seen.add(p.item.payload);
      return true;
    });
    const retry = candidates.slice(0, MAX_RETRY);
    retried = retry.length;
    if (retry.length) {
      const repickle = (p) => {
        const rawHits = matcher.match(p.item.payload, { properNounGuard: false });
        const hits = settings.annotateFirst ? rawHits : rawHits.map(
          (h) => h.entry.strategy === "annotate" ? { ...h, entry: { ...h.entry, strategy: "keep" } } : h
        );
        const np = pickle(p.item.payload, hits);
        return { ...p, pickled: np.pickled, tokens: np.tokens, forbids: np.forbids };
      };
      await pool(retry, 4, async (p) => {
        try {
          const p2 = repickle(p);
          const outs = await engine.translate([p2.pickled], {
            targetLang: settings.targetLang,
            context: p2.item.headingPath
          });
          const out = outs?.[0];
          if (out && out.trim() && out.trim() !== p.item.payload.trim()) {
            finishOne(p2, out, engine.id, engineId, termVersion, results, false);
          }
        } catch (e) {
          log.warn("\u672A\u7FFB\u8BD1\u91CD\u8BD5\u5931\u8D25\uFF0C\u4FDD\u7559\u9996\u6B21\u7ED3\u679C", String(e));
        }
      });
      for (const g of groups.values()) {
        if (g.length < 2) continue;
        const r = results.get(g[0].item.id);
        if (!r) continue;
        for (let i = 1; i < g.length; i++) {
          results.set(g[i].item.id, { ...r, id: g[i].item.id });
        }
      }
    }
  }
  const arr = items.map((it) => results.get(it.id)).filter(Boolean);
  const tEngine = Date.now();
  const failed = arr.filter((r) => r.error).length;
  const chars = items.reduce((n, it) => n + it.payload.length, 0);
  void bumpStats({
    chars,
    requests: pending.length ? 1 : 0,
    failures: failed,
    llmChars: mode === "smart" ? chars : 0
  });
  const bt = engine.lastTiming;
  return {
    results: arr,
    domain: resolved,
    engine: engine.label,
    termHits: termHitsTotal,
    timing: {
      domain: tDomain - tStart,
      terms: tTerms - tDomain,
      cache: tCache - tTerms,
      engine: tEngine - tCache,
      token: bt?.token ?? -1,
      post: bt?.post ?? -1,
      total: tEngine - tStart,
      items: items.length,
      pending: pending.length,
      retried,
      dedupSaved
    }
  };
}
function finishOne(b, translated, engineName, engineId, termVersion, outMap, failed, error) {
  if (failed || !translated) {
    outMap.set(b.item.id, {
      id: b.item.id,
      translated: "",
      engine: engineName,
      fromCache: false,
      error: error || "\u7FFB\u8BD1\u5931\u8D25"
    });
    return;
  }
  const v = validateTokens(translated, b.tokens);
  let text = unpickle(translated, b.tokens);
  if (!v.ok && v.missing.length) {
    text = repairMissing(text, v.missing, b.tokens);
    log.warn("\u5360\u4F4D\u7B26\u7F3A\u5931\uFF0C\u5DF2\u964D\u7EA7\u4FEE\u590D", b.item.id, v.missing);
  }
  text = polishCJK(applyForbids(text, b.forbids));
  outMap.set(b.item.id, {
    id: b.item.id,
    translated: text,
    engine: engineName,
    fromCache: false
  });
  void cacheSet({
    key: makeCacheKey(b.item.payload, engineId, termVersion),
    source: b.item.payload,
    target: text,
    engine: engineName
  });
}

// src/storage/settings.ts
var KEY2 = "settings";
async function getSettings() {
  const raw = await chrome.storage.local.get(KEY2);
  const stored = raw[KEY2];
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
  await chrome.storage.local.set({ [KEY2]: next });
  return next;
}

// src/background/index.ts
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handle(msg).then((data) => sendResponse({ ok: true, data })).catch((e) => {
    log.error("msg failed", msg?.type, e);
    sendResponse({ ok: false, error: String(e?.message || e) });
  });
  return true;
});
async function handle(msg) {
  switch (msg.type) {
    case "PING":
      return "pong";
    case "WARMUP": {
      const settings = await getSettings();
      const engine = createEngine(msg.mode, settings, { url: "", host: "localhost", title: "", lang: "en" });
      void engine.healthCheck();
      return true;
    }
    case "TRANSLATE": {
      const settings = await getSettings();
      const outcome = await translateItems(msg.items, {
        mode: msg.mode,
        ctx: msg.ctx,
        domain: msg.domain,
        sample: msg.sample,
        titlePath: msg.titlePath,
        settings
      });
      return outcome;
    }
    case "GET_SETTINGS":
      return getSettings();
    case "SET_SETTINGS": {
      const next = await setSettings(msg.patch);
      return next;
    }
    case "GET_STATS":
      return getStats();
    case "RESET_STATS":
      await resetStats();
      return true;
    case "CLEAR_CACHE":
      await cacheClear();
      return true;
    case "CACHE_SIZE":
      await cacheEvict();
      return cacheInfo();
    case "GET_TERMS":
      return getUserTerms();
    case "GET_BUILTIN_TERMS": {
      const f = await loadDomainFile(msg.domain);
      return f ? f.entries : [];
    }
    case "UPSERT_TERM": {
      const list = await upsertUserTerm(msg.entry);
      termService.invalidate();
      return list;
    }
    case "DELETE_TERM": {
      const list = await deleteUserTerm(msg.term);
      termService.invalidate();
      return list;
    }
    case "IMPORT_TERMS": {
      const parsed = JSON.parse(msg.json);
      if (!Array.isArray(parsed)) throw new Error("\u5BFC\u5165\u683C\u5F0F\u9519\u8BEF\uFF1A\u5E94\u4E3A\u672F\u8BED\u6570\u7EC4");
      const normalized = parsed.filter((e) => e && typeof e.term === "string" && e.term.trim()).map((e) => ({
        term: e.term.trim(),
        strategy: e.strategy || "keep",
        target: e.target,
        caseSensitive: e.caseSensitive ?? /[A-Z]/.test(e.term),
        matchMode: e.matchMode || (/\s/.test(e.term) ? "phrase" : "wholeWord"),
        domain: e.domain || "common",
        priority: 1e3,
        source: "user",
        note: e.note
      }));
      const cur = await getUserTerms();
      const map = new Map(cur.map((e) => [e.term.toLowerCase(), e]));
      for (const e of normalized) map.set(e.term.toLowerCase(), e);
      await replaceUserTerms([...map.values()]);
      termService.invalidate();
      return [...map.values()].length;
    }
    case "EXPORT_TERMS":
      return getUserTerms();
    case "LIST_DOMAINS": {
      const idx = await loadIndex();
      const version = await getTermTableVersion();
      return { ...idx, termTableVersion: version };
    }
    case "PROBE_ENGINE": {
      const settings = await getSettings();
      if (msg.mode === "smart" && !llmReady(settings)) {
        return { ok: false, message: "\u8BF7\u5148\u5B8C\u6574\u586B\u5199 Base URL / API Key / \u6A21\u578B\u540D" };
      }
      const engine = createEngine(msg.mode, settings, {
        url: "",
        host: "localhost",
        title: "",
        lang: "en"
      });
      const ok = await engine.healthCheck();
      return { ok, message: ok ? `${engine.label} \u53EF\u7528` : `${engine.label} \u4E0D\u53EF\u7528\uFF08\u7F51\u7EDC\u6216\u914D\u7F6E\u95EE\u9898\uFF09` };
    }
    case "RENDER_STATE":
      return true;
    default:
      throw new Error(`\u672A\u77E5\u6D88\u606F\u7C7B\u578B: ${msg.type}`);
  }
}
async function sendToActiveTab(cmd) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) await chrome.tabs.sendMessage(tab.id, cmd);
  } catch (e) {
    log.warn("sendToActiveTab failed", String(e));
  }
}
chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === "toggle-translate") void sendToActiveTab({ type: "TOGGLE" });
  else if (cmd === "refine-viewport") void sendToActiveTab({ type: "REFINE" });
  else if (cmd === "cycle-mode") void sendToActiveTab({ type: "CYCLE_MODE" });
});
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "tk-keepalive") return;
  port.onMessage.addListener(() => {
    try {
      port.postMessage({ type: "PONG", t: Date.now() });
    } catch {
    }
  });
});
chrome.runtime.onInstalled.addListener(async (details) => {
  const v = await getTermTableVersion();
  if (!v) await chrome.storage.local.set({ termTableVersion: 1 });
  if (details.reason === "install") {
    log.info("TermKeeper installed");
  }
});
chrome.runtime.onStartup.addListener(() => {
  void cacheEvict();
});
