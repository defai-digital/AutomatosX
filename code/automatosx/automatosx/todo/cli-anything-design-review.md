# CLI-Anything 設計解析

日期：2026-03-25
來源：`/Archived/CLI-Anything/`

---

## 一、整體架構概覽

CLI-Anything 是一個**讓 AI Agent 能操控任何 GUI 軟體**的框架，由三個層次組成：

```
┌─────────────────────────────────────────┐
│           AI Agent（Claude Code 等）     │
└────────────────────┬────────────────────┘
                     │ 讀取 SKILL.md，呼叫 CLI
┌────────────────────▼────────────────────┐
│         CLI 包裝層（Python Click）        │
│  cli-anything-gimp / blender / ...      │
│  • REPL 模式（互動）                     │
│  • --json 旗標（機器可讀輸出）            │
│  • 狀態管理（undo/redo 50層）            │
└────────────────────┬────────────────────┘
                     │ 呼叫真實後端
┌────────────────────▼────────────────────┐
│        真實軟體後端                       │
│  Pillow / bpy / sox / MLT / ffmpeg...   │
└─────────────────────────────────────────┘
```

---

## 二、倉庫結構解析

```
CLI-Anything/
├── registry.json              ← CLI-Hub 目錄，所有已支援軟體的 metadata
├── .claude-plugin/
│   └── marketplace.json       ← Claude Code Plugin 市集定義
├── cli-anything-plugin/       ← Claude Code 的 /cli-anything 指令
│   ├── SKILL.md               ← 觸發自動生成流程的 skill
│   ├── HARNESS.md             ← 完整的方法論規範文件
│   ├── skill_generator.py     ← 自動產生 SKILL.md 的腳本
│   └── templates/             ← Jinja2 模板
├── cli-hub-meta-skill/
│   └── SKILL.md               ← Agent 自主探索 CLI-Hub 目錄的 meta skill
├── skill_generation/          ← SKILL.md 生成的測試與工具
├── <software>/                ← 每個支援的軟體（如 gimp、blender）
│   └── agent-harness/
│       ├── setup.py           ← pip 安裝設定
│       └── cli_anything/
│           └── <software>/
│               ├── <software>_cli.py  ← Click CLI 入口
│               ├── core/              ← 核心邏輯模組
│               ├── skills/
│               │   └── SKILL.md       ← 自動生成，供 Agent 探索
│               ├── utils/
│               │   └── repl_skin.py   ← 統一的 REPL 介面
│               └── tests/             ← 單元測試 + E2E 測試
└── openclaw-skill/            ← OpenClaw 平台的整合
    codex-skill/               ← Codex 平台的整合
    opencode-commands/         ← OpenCode 平台的整合
    qoder-plugin/              ← Qodercli 平台的整合
```

---

## 三、核心設計模式

### 3.1 生成流程（7 個階段）

```
Phase 1: 分析（Analyze）
  → 讀取軟體原始碼，了解架構、資料模型、現有 CLI
  → 產出：<SOFTWARE>.md SOP 文件

Phase 2: 設計（Design）
  → 規劃 CLI 指令群組、狀態模型、輸出格式
  → 產出：架構設計文件

Phase 3: 實作（Implement）
  → 用 Click 框架建構 CLI
  → 必含：REPL 模式、--json 旗標、undo/redo
  → 產出：可執行的 CLI

Phase 4: 測試規劃（Plan Tests）
  → 規劃單元測試 + E2E 測試場景
  → 產出：TEST.md Part 1

Phase 5: 測試實作（Write Tests）
  → test_core.py（合成資料，不依賴外部）
  → test_full_e2e.py（真實檔案、完整流程）
  → 產出：完整測試套件

Phase 6: 測試文件（Document Tests）
  → 執行 pytest，記錄結果
  → 產出：TEST.md Part 2

Phase 6.5: 生成 SKILL.md（Generate Skill）★ 重要
  → skill_generator.py 提取 CLI metadata
  → Jinja2 模板渲染 SKILL.md
  → 存放在 Python 套件內（隨 pip install 一起安裝）
  → 產出：Agent 可探索的 SKILL.md

Phase 7: 發布（Publish）
  → pip install -e . 本地安裝
  → 可選：發布到 PyPI
  → 產出：PATH 可呼叫的 CLI 指令
```

---

### 3.2 SKILL.md 的雙層設計

CLI-Anything 的 SKILL.md 有兩個層次，設計非常精妙：

**第一層：meta-skill（cli-hub-meta-skill/SKILL.md）**
- Agent 用來「探索有哪些工具可用」
- 告訴 Agent 如何讀取 CLI-Hub 目錄（SKILL.txt）
- Agent 可以自主發現、安裝它需要的 CLI

**第二層：per-CLI skill（每個軟體的 skills/SKILL.md）**
- 隨 pip install 一起安裝到系統
- 描述該 CLI 的所有指令群組、用法、範例
- 專門為 AI Agent 優化（含「For AI Agents」專節）

---

### 3.3 REPL + JSON 雙模式

每個 CLI 都有兩種互動模式：

```bash
# 人類模式（彩色、表格、可讀輸出）
cli-anything-gimp project info -p project.json

# Agent 模式（結構化 JSON）
cli-anything-gimp --json project info -p project.json
```

Agent 模式的設計原則：
- 回傳 JSON，不需解析人類可讀文字
- return code 0 = 成功，非 0 = 失敗
- stderr 輸出錯誤訊息

---

### 3.4 狀態管理設計

每個 CLI 都內建狀態管理：
- **Undo/Redo**：深度複製快照，最多 50 層
- **Project 持久化**：狀態儲存為 JSON 檔案
- **Session 追蹤**：記錄修改歷程

這讓 Agent 可以做複雜的多步驟操作，而不用擔心誤操作無法還原。

---

### 3.5 PEP 420 命名空間套件設計

所有 CLI 都用 `cli_anything.*` 命名空間：

```
cli_anything/          ← 無 __init__.py（命名空間套件）
  gimp/
  blender/
  inkscape/
```

好處：多個 CLI 可在同一個 Python 環境共存，不會衝突。

---

## 四、目前支援的軟體（registry.json）

| 軟體 | 類別 | 後端技術 | 測試數 |
|---|---|---|---|
| GIMP | 圖像編輯 | Pillow | 103 |
| Blender | 3D 建模/渲染 | bpy script generation | 200 |
| Inkscape | 向量圖形 | SVG 操作 | 197 |
| Audacity | 音訊編輯 | sox | 154 |
| LibreOffice | 辦公室套件 | ODF ZIP/XML | 143 |
| OBS Studio | 直播/錄影 | JSON scene collections | 153 |
| Kdenlive | 影片剪輯 | MLT XML | 151 |
| Shotcut | 影片剪輯 | MLT XML + ffmpeg | 144 |
| Zoom | 視訊會議 | — | — |
| ComfyUI | AI 圖像生成 | — | — |
| Mermaid | 圖表 | — | — |
| MuseScore | 樂譜 | — | — |
| Novita | AI API | OpenAI 相容 | — |
| AdGuardHome | 網路管理 | REST API | — |
| AnyGen | 文件生成 | AnyGen API | — |
| Draw.io | 流程圖 | — | — |
| iTerm2 | 終端機 | — | — |
| Krita | 數位繪圖 | — | — |
| Mubu | 知識管理 | — | — |
| NotebookLM | AI 筆記 | — | — |
| Ollama | 本地 LLM | — | — |
| Sketch | UI 設計 | — | — |

---

## 五、平台整合設計

CLI-Anything 為每個平台設計了獨立的整合資料夾：

| 資料夾 | 平台 | 整合方式 |
|---|---|---|
| `cli-anything-plugin/` | Claude Code | `/plugin install cli-anything`，提供 `/cli-anything` 指令 |
| `openclaw-skill/` | OpenClaw | SKILL.md 格式 |
| `codex-skill/` | OpenAI Codex | Skill 格式 |
| `opencode-commands/` | OpenCode | Commands 格式 |
| `qoder-plugin/` | Qodercli | Plugin 格式 |

**統一的核心，各自的整合層**——設計非常乾淨。

---

## 六、對 AutomatosX 的啟示

### 直接可用的部分

1. **SKILL.md 格式已定義好**
   - 每個 pip 安裝的 CLI 都含有 `skills/SKILL.md`
   - ax 只需掃描 Python 環境中已安裝的 `cli_anything.*/skills/SKILL.md`

2. **registry.json 是機器可讀的**
   - `https://hkuds.github.io/CLI-Anything/SKILL.txt` 就是即時目錄
   - ax 可直接讀取，不需維護自己的目錄

3. **cli-hub-meta-skill 模式**
   - 這就是「自我擴充」的實作參考
   - ax 的 Agent 可以先讀這個 meta-skill，再決定安裝什麼

### 需要設計的橋接層

1. **Python 環境掃描**：ax 需要掃描已安裝的 `cli_anything.*` 套件，把 SKILL.md 納入 skills 系統
2. **安裝觸發**：ax 需要在 Agent 判斷需要某工具時，自動執行 `pip install`
3. **JSON 輸出解析**：ax 需要把 CLI 的 `--json` 輸出轉成 ax 的 trace/state 資料

---

## 七、設計亮點總結

1. **「生成後即可用」**：一個指令生成整個 CLI，包含測試和 SKILL.md，馬上能被 Agent 使用
2. **Meta-Skill 的自我擴充**：Agent 不需要人告訴它有什麼工具，自己去目錄找
3. **Namespace 套件隔離**：多個 CLI 共存不衝突，乾淨的擴充設計
4. **雙輸出模式**：同一個工具，人類和 Agent 都能用
5. **狀態管理內建**：undo/redo 讓 Agent 可以安全地試錯
