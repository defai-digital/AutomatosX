# PRD：AutomatosX Skills 生態與 CLI-Anything 整合

版本：v0.1（草稿）
日期：2026-03-25
狀態：待審閱

---

## 背景與動機

AutomatosX 目前是一個以 workflow-first 為核心的 Agent 平台，透過 provider CLI 與使用者互動。然而，其能力邊界仍侷限於程式碼操作與 workflow 執行。

開源社群已累積了大量可即用的 **Skills**（5,400+），並有 **CLI-Anything** 這類框架能將任意桌面軟體轉換成 Agent 可控制的工具。若 AutomatosX 能整合這兩個生態，將大幅擴充平台能力，而不需要從零開發。

---

## 目標

1. 讓 ax Agent 能夠使用社群 skills，繼承開源生態的大量能力
2. 讓 ax Agent 能透過 CLI-Anything 操控桌面軟體（GIMP、Blender、LibreOffice 等）
3. 建立長期的自我擴充機制，讓 Agent 在遇到能力缺口時自主尋找並安裝工具

---

## 非目標

- 不重寫現有的 workflow-engine 或 shared-runtime 核心
- 不預先打包所有 CLI-Anything 支援的軟體
- 不支援需要 GUI 的操作（CLI-Anything 已處理此層）

---

## 使用者故事

### US-01：使用社群 Skill

> 身為開發者，我希望能執行 `/fix-issue 123` 這類社群 skill，讓 ax Agent 按照社群最佳實踐自動修復問題，而不需要自己撰寫指令。

**驗收條件**：
- `ax skill install <name>` 可從社群倉庫安裝 skill
- `/skill-name` 可在 ax CLI 中觸發對應 skill
- Skill 的 `SKILL.md` 中定義的指令由 ax Agent 執行

---

### US-02：Agent 自動選擇 Skill

> 身為使用者，我希望描述一個任務後，ax Agent 能自動找到最相關的 skill 並套用，不需要我手動指定。

**驗收條件**：
- `ability_inject` 在找不到內建 ability 時，fallback 搜尋已安裝的 skills
- Agent 能根據語義相似度自動選擇 skill

---

### US-03：透過 CLI-Anything 操控桌面軟體

> 身為內容創作者，我希望描述一個影像處理任務後，ax Agent 能自動呼叫 GIMP 完成，而不需要我手動操作 GIMP。

**驗收條件**：
- ax 可安裝並呼叫 CLI-Anything 生成的 CLI 套件
- Agent 能解析任務描述，對應到正確的 CLI-Anything 工具
- 執行結果回饋到 trace-store

---

### US-04：自主工具探索與安裝

> 身為自動化工程師，我希望 ax Agent 在遇到自己不會的任務時，能自動從 CLI-Hub 找到對應工具並安裝，而不需要人工介入。

**驗收條件**：
- Agent 可呼叫 CLI-Hub 目錄查詢可用工具
- Agent 可自動執行安裝程序（pip install）
- 安裝後的工具立即可用於後續步驟

---

## 功能規格

### F-01：Skills 管理子系統

**新增 CLI 指令**：

```bash
ax skill install <name>     # 從社群倉庫安裝
ax skill install <path>     # 從本地路徑安裝
ax skill list               # 列出已安裝的 skills
ax skill remove <name>      # 移除 skill
ax skill search <keyword>   # 搜尋可用 skills
```

**Skills 目錄結構**：

```
~/.ax/skills/
  <skill-name>/
    SKILL.md
    (其他輔助檔案)

.ax/skills/          (專案層級，優先於全域)
  <skill-name>/
    SKILL.md
```

**Skills 載入邏輯**：
- 啟動時掃描 `~/.ax/skills/` 和 `.ax/skills/`
- 解析 `SKILL.md` 的 YAML frontmatter
- 注冊到 MCP server 作為可用工具

---

### F-02：Ability ↔ Skill 橋接

修改 `ability_inject` 邏輯：

```
1. 先搜尋內建 BUILTIN_ABILITIES
2. 再搜尋 ability_register 的自訂 abilities
3. 若語義分數均低於閾值，搜尋已安裝的 skills
4. 回傳最相關的結果（ability 或 skill 統一格式）
```

新增 MCP 工具：
- `skill_list`：列出已安裝的 skills
- `skill_inject`：根據任務描述注入最相關的 skill 內容

---

### F-03：CLI-Anything 整合

**安裝方式**：

```bash
ax cliany install <software>    # e.g., ax cliany install gimp
ax cliany list                  # 列出已安裝的 CLI-Anything 套件
ax cliany search <keyword>      # 搜尋 CLI-Hub 目錄
```

**執行方式**：
- CLI-Anything 套件安裝後，其 `SKILL.md` 自動納入 skills 子系統
- Agent 透過統一的 skills 介面呼叫，無需感知底層是 CLI-Anything

**整合點**：
- `packages/shared-runtime/src/` 新增 `cli-anything-service.ts`
- 負責 CLI-Hub 目錄查詢、pip 安裝、SKILL.md 解析

---

### F-04：自我擴充機制（進階）

新增 MCP 工具 `tool_discover`：

```typescript
// 輸入：任務描述
// 流程：
// 1. ability_inject 語義匹配（內建 + 自訂）
// 2. skill_inject 語義匹配（已安裝 skills）
// 3. CLI-Hub 線上查詢（需網路）
// 4. 若找到匹配，詢問使用者是否安裝
// 5. 安裝後立即可用
```

---

### F-05：安全機制

- **允許清單**：管理員可設定允許的 skills 來源（倉庫 URL 白名單）
- **沙箱執行**：skills 的 shell 指令透過現有 `guard_check` 機制審核
- **簽名驗證**：支援 skill 作者的 GPG 簽名驗證（長期）

---

## 技術架構

```
ax CLI
  ├── ax skill *          → SkillManagerService
  ├── ax cliany *         → CliAnythingService
  └── /skill-name         → SkillDispatcher

MCP Server
  ├── skill_list
  ├── skill_inject
  └── tool_discover

shared-runtime
  ├── SkillManagerService     (新增)
  │   ├── 掃描 skills 目錄
  │   ├── 解析 SKILL.md
  │   └── 語義索引（複用 state-store semantic）
  ├── CliAnythingService      (新增)
  │   ├── CLI-Hub 目錄查詢
  │   ├── pip 安裝管理
  │   └── SKILL.md 橋接
  └── ability_inject          (修改，加入 skill fallback)

state-store
  └── skills namespace        (新增，儲存 skill metadata)
```

---

## 依賴項目

- CLI-Anything：`pip install cli_anything_<software>`
- CLI-Hub 目錄：`https://hkuds.github.io/CLI-Anything/SKILL.txt`
- 社群 Skills 倉庫：待定（建議參考 ClawHub、GitHub awesome-skills）

---

## 成功指標

| 指標 | 目標值 |
|---|---|
| Skill 安裝成功率 | > 95% |
| ability_inject + skill fallback 相關性 | > 80%（人工評分） |
| CLI-Anything 工具呼叫成功率 | > 90% |
| 自我擴充（tool_discover）採用率 | > 50%（使用者接受安裝建議） |

---

## 里程碑

| 階段 | 內容 | 預計 |
|---|---|---|
| M1 | Skills 管理子系統（F-01）+ CLI `/skill` 指令 | 待排期 |
| M2 | Ability ↔ Skill 橋接（F-02）| 待排期 |
| M3 | CLI-Anything 整合（F-03）| 待排期 |
| M4 | 自我擴充機制（F-04）+ 安全機制（F-05）| 待排期 |

---

## 開放問題

1. Skills 社群倉庫的首選來源？（建議先支援 GitHub URL 安裝）
2. CLI-Anything 的授權模式是否與 AutomatosX 相容？（MIT，應無問題）
3. 自我擴充機制是否需要使用者明確授權每次安裝？
4. Skills 的 `context: fork` 執行模式在 ax 架構中如何對應到 delegate step？

---

*本 PRD 為草稿，待明日審閱後確認優先順序與里程碑時程。*
