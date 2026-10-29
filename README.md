# TermKeeper · 术语守护

> 技术文档双语对照翻译浏览器扩展（Manifest V3）：**专有名词不译、代码不污染、原文永远保留**。

- 版本：`0.2.0`
- 技术栈：原生 JavaScript（无构建步骤）+ Chrome Extension MV3
- 目标语言：英文技术文档 → 简体中文（`zh-Hans`）
- 适用浏览器：Chrome / Edge / 其他 Chromium 内核浏览器

---

## 1. 它解决什么问题

通用机器翻译翻译技术文档时常见三类硬伤，TermKeeper 针对它们做了专门处理：

| 痛点 | 通用翻译表现 | TermKeeper 处理方式 |
| --- | --- | --- |
| 专有名词被误译 | `Spring` → “春天”、`Bean` → “豆子”、`Kafka` → “卡夫卡” | 内置分领域术语表 + 占位符保护，命中词原样输出 |
| 代码/命令被污染 | 代码块、标识符、URL、配置键被一起翻译 | DOM 抽取时跳过 `code/pre/svg/a/button` 等元素，内联节点用占位符回插 |
| 译文丢失上下文 | 逐句翻译，前后术语不一致 | AI 引擎携带页面标题、标题路径上下文；段落级缓存保证同词一致 |

## 2. 核心特性

- **双翻译引擎**
  - `fast` 快速引擎：必应翻译免费通道，零配置即用，自动取凭证、批量合并、超长按句切分。
  - `smart` AI 精修引擎：兼容任意 OpenAI Chat Completions 接口（DeepSeek / OpenAI / Kimi / 通义 / 本地 Ollama 等），理解上下文，术语更准。
- **三种阅读形态**：仅译文 / 原文 + 译文对照 / 仅原文，一键循环切换。
- **16 个技术领域、1001 条内置术语**：通用、前端、Java/JVM、Python、Go、Node、其他后端、数据库、网络、DevOps、云服务、AI/ML、算法、操作系统、安全、移动端。
- **领域自动推断**：站点域名映射 + 标题路径 + 正文指纹投票，也可手动锁定领域。
- **术语策略四种**：保持原文 `keep`、固定译法 `translateAs`、保留并首次加注 `annotate`、禁用错译 `forbid`。
- **个人术语库**：优先级最高，支持增删、导入/导出 JSON，改动即时生效。
- **段落级本地缓存**：IndexedDB 存储，同一页面二次打开几乎零请求；缓存体积可查看、可清空。
- **统计面板**：累计翻译字符、缓存命中、AI 字符消耗、失败次数。
- **快捷键操作**：翻译开关、AI 精修可视区、循环显示模式。
- **隐私友好**：API Key 仅存于本机 `chrome.storage.local`，不上传；免费引擎不携带任何密钥。

## 3. 安装与加载（开发者模式，本地解压加载）

1. 打开浏览器扩展管理页：
   - Chrome：地址栏输入 `chrome://extensions/`
   - Edge：地址栏输入 `edge://extensions/`
2. 打开右上角 **开发者模式 / 开发人员模式**。
3. 点击 **加载已解压的扩展程序**，选择本项目根目录（包含 `manifest.json` 的目录）。
4. 扩展出现在工具栏后，点击图标即可使用。

> 首次使用免费引擎即可直接翻译；若切换到 AI 精修引擎，需先在「设置 → 翻译引擎」填写接口配置。

## 4. 使用方式

### 4.1 弹窗（点击工具栏图标）

- **翻译此网站 / 还原**：开关当前页面翻译状态。
- **显示方式**：仅译文 / 原文 + 译文 / 仅原文。
- **本站自动翻译**：对当前域名持久化开启，下次访问自动翻译。
- **进站时询问**：访问新站点时弹出“是否翻译”提示条。
- 实时展示：翻译状态、进度条、已保护术语数、当前识别领域。

### 4.2 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Alt + T` | 翻译 / 还原当前页面 |
| `Alt + E` | 用 AI 精修当前可视区段落 |
| `Alt + Shift + T` | 循环切换显示模式（对照 → 仅译文 → 仅原文） |

### 4.3 设置页（弹窗底部「设置」或扩展详情页选项页）

四个标签页：

1. **翻译引擎**：选择引擎、锁定技术领域、配置 AI 接口、测试连通性。
2. **术语表**：添加/管理个人术语；浏览各领域内置词典；导入导出个人术语 JSON。
3. **显示**：自动翻译开关、默认显示形态、强调色、术语保护策略三个开关。
4. **用量与缓存**：统计数据、缓存体积查看、清空缓存、重置统计。

## 5. 翻译引擎配置

### 5.1 快速引擎（fast · 必应免费通道）

- 无需任何配置，默认启用。
- 自动从 `cn.bing.com` / `www.bing.com` 页面解析 `params_AbusePreventionHelper` 凭证与 `IG` 标识，调用 `/ttranslatev3` 接口。
- 多条短文本用 `⟦Sn⟧` 段标记合并为一次请求；超长文本按句子边界切块逐段翻译后拼接。
- 凭证约 50 分钟有效，过期自动刷新；鉴权失败（401/403）自动丢弃并重取。

### 5.2 AI 精修引擎（smart · OpenAI 兼容接口）

必填三项：`API Base URL`、`API Key`、`模型名`；默认温度 `0.2`，单次请求 60 秒超时。

| 服务 | Base URL | 模型名示例 |
| --- | --- | --- |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| 本地 Ollama | `http://127.0.0.1:11434/v1` | `qwen2.5:7b` |

引擎内部固定的系统提示词硬性规则：

1. 技术术语保持原文，不翻译产品名、框架名、协议名、库名（如 Spring、Kafka、REST、JSON、Kubernetes、Redis）。
2. `⟦Tn⟧` 术语占位符必须原样输出，不得翻译、删除、改写或改变数量。
3. `⟦Sn⟧` 段落编号标记必须保留在每段开头，不得删除、合并或调换顺序。
4. 代码标识符、命令、配置键、路径、URL、数学记号一律保持原样。
5. 译文符合中文技术写作习惯，不逐字直译、不口语化、不添加原文没有的解释。
6. 只输出译文本身，不输出前言、说明、注释或代码围栏。

返回结果会经过：段标记数量校验 → 缺失占位符修复 → 禁用词替换兜底 → 中文标点/空白润色。

## 6. 术语保护机制

### 6.1 术语策略

| 策略 | 含义 | 词表示例 |
| --- | --- | --- |
| `keep` | 保持原文，不翻译 | `["Spring", "keep"]` |
| `translateAs` | 固定译法 | `["dependency injection", "translateAs", "依赖注入"]` |
| `annotate` | 保留原文，首次出现时附加注释 | 如 `Bean（受 IoC 容器管理的对象）` |
| `forbid` | 禁止错误译法，兜底替换回正确形式 | 防止把 `Spring` 错译为“春天” |

条目可选第四位表示是否区分大小写（默认区分）。

### 6.2 保护流水线（后台执行）

1. **扫描命中**：在原文中扫描内置词表 + 个人术语 + 专有名词兜底规则，生成命中区间。
2. **打包 pickle**：命中术语替换为 `⟦Tn⟧` 占位符；代码块、链接、内联元素替换为 `⟦In⟧` 占位符后再送引擎。
3. **引擎翻译**：引擎只翻译普通正文，占位符不可见、不可改。
4. **解包 unpickle**：译文按占位符序号回填原文/译文；校验占位符数量，缺失项自动修复。
5. **兜底纠偏**：`forbid` 规则在最终文本上把已知错译替换回正确术语。
6. **中文润色**：统一标点与多余空白。

### 6.3 领域词表结构

```
data/terms/
├── index.json            # 领域索引：id、名称、文件、词条数、指纹词
├── common.json           # 通用技术术语
├── domainsite.json       # 站点域名 → 领域映射表
└── domains/
    ├── frontend.json      # 前端
    ├── backend-jvm.json   # Java / JVM
    ├── backend-py.json    # Python 后端
    ├── backend-go.json    # Go 后端
    ├── backend-node.json  # Node.js
    ├── backend-other.json # Rust / C# / PHP
    ├── db.json            # 数据库
    ├── net.json           # 网络
    ├── devops.json        # 云原生 / 运维
    ├── cloud.json         # 云服务
    ├── ai-ml.json         # AI / ML
    ├── algo.json          # 算法
    ├── os.json            # 操作系统
    ├── security.json      # 安全
    └── mobile.json        # 移动端
```

领域推断优先级：手动锁定 > 站点域名映射命中 > 标题路径 + 正文指纹投票。

## 7. 目录结构与职责

```
TermKeeper/
├── manifest.json        # MV3 清单：权限、内容脚本、快捷键、弹窗与选项页
├── background.js        # Service Worker：引擎抽象、术语仲裁、占位符打包/解包、
│                        # 领域推断、IndexedDB 缓存、统计、消息中枢
├── content.js           # 内容脚本：DOM 区块抽取、跳过规则、三种显示形态渲染、
│                        # 进度条/询问条、导航增量处理、转发快捷键消息
├── content.css          # 注入页面的译文样式（对照排版、错误态、进度条等）
├── popup.html / .js / .css   # 工具栏弹窗：开关、显示方式、站点级开关、进度
├── options.html / .js / .css  # 设置页：引擎、术语表、显示、用量缓存
├── data/terms/          # 内置术语数据（见 6.3）
└── icons/               # 16 / 32 / 48 / 128 尺寸图标
```

### 7.1 运行时数据流

```
网页 DOM
  └─ content.js 抽取文本区块（跳过代码/链接/可编辑区域，内联节点占位）
       └─ chrome.runtime.sendMessage(TRANSLATE)
            └─ background.js
                 ├─ 装载/命中术语表 → pickle 占位符
                 ├─ 查 IndexedDB 缓存（key = 文本+引擎+术语版本）
                 ├─ 未命中 → 调用 fast / smart 引擎
                 ├─ unpickle 回填 + forbid 纠偏 + 中文润色
                 └─ 写缓存、累加统计
       └─ content.js 按显示形态渲染（仅译文 / 对照 / 仅原文）
```

### 7.2 内容脚本跳过规则（不翻译的元素）

- 硬跳过标签：`CODE`、`PRE`、`SVG`、`IMG`、`MATH`、`A`、`BUTTON`、`ABBR`、`SUP`、`SUB`、`CITE`、`TIME`、`MARK`、`BR`、`HR` 等。
- 带 `data-tk-skip` 属性、`translate="no"` 属性、已被扩展处理过（`.tk-trans`）、`contenteditable` 的元素。
- `display:none`、`visibility:hidden`、`opacity:0` 的隐藏节点。
- 透明内联标签（`EM/STRONG/B/I/U/SPAN/SMALL/S/DEL/INS/LABEL/FONT`）会被穿透继续抽取文本。

## 8. 权限说明

`manifest.json` 声明：

- `storage`：保存设置、个人术语、统计数据。
- `tabs`：定位当前活动标签页、向其转发指令。
- `host_permissions`：必应翻译域名（免费引擎取凭证与请求）。
- `optional_host_permissions`：`https://*/*`，全站翻译能力按需授权，不强制开通。

## 9. 本地存储

| 存储位置 | 内容 |
| --- | --- |
| `chrome.storage.local` | 全局设置、个人术语表、使用统计 |
| IndexedDB（扩展私有库） | 段落译文缓存，按 `文本哈希 + 引擎标识 + 术语表版本` 建键；超容量自动回收（上限约 5 万条） |

## 10. 开发说明

- **无构建**：源码即产物，修改 `.js` / `.html` / `.css` 后在扩展管理页点击「刷新」即可生效。
- 源码注释中保留了 TypeScript 模块路径痕迹（如 `src/background/translator.ts`、`src/engines/smart/openai.ts`），当前为打包后的原生 JS 实现，便于对照模块职责。
- **新增术语**：直接编辑对应领域 JSON 的 `terms` 数组，或通过设置页「个人术语」添加；个人术语优先级高于内置词表。
- **新增领域**：在 `domains/` 新建 JSON（含 `domain`、`version`、`fingerprints`、`terms`），并在 `index.json` 注册条目、按需在 `domainsite.json` 补充域名映射。
- **新增引擎**：在 `background.js` 中实现 `id / label / supportsContext / healthCheck() / translate(texts, opts)` 接口，并在 `createEngine()` 中接入。

## 11. 已知限制

- 免费引擎不携带上下文，跨段术语一致性主要依赖术语表与缓存；追求质量请使用 AI 精修引擎。
- 单条超长文本会按句切分，极端情况下句间语气可能略有断裂。
- 浏览器内置页面（`chrome://`、扩展商店等）无法注入内容脚本，弹窗会提示不支持。
- AI 接口需自备 API Key 并自行承担调用费用；密钥不出本机。

## 12. 许可

当前仓库未指定开源许可证，默认保留全部权利；如需开源请补充 `LICENSE` 文件。
