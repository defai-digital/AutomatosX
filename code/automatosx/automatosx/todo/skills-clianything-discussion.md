# 對話紀錄：Skills、CLI-Anything 與 AutomatosX

日期：2026-03-25

---

## 一、Skills 是什麼？

**問**：在 OpenClaw 看到 skills，為什麼你說 skills 是 Claude Code 的？

**答（修正）**：Skills 不是 Claude Code 專有的。Anthropic 於 2025 年 12 月將 Skills 規格公開為**開放標準**，之後多個工具採用：

- Claude Code
- Claude API / Agent SDK
- OpenAI Codex CLI
- Cursor、Gemini CLI
- **OpenClaw**（有自己的 ClawHub 社群，5,400+ skills）

Skills 的本質：一個 `SKILL.md` 檔案，包含 YAML frontmatter（設定）+ Markdown 指令內容，告訴 AI Agent 如何處理特定任務。

---

## 二、AutomatosX Abilities vs Skills

AutomatosX 有自己的 Abilities 系統，與 Skills 概念相似但層次不同：

| | Community Skills | AutomatosX Abilities |
|---|---|---|
| 目的 | 擴充 Agent 在 CLI 層的互動能力 | 注入指導規則引導 workflow/agent 決策 |
| 觸發 | 人工 `/指令` 或 Claude 自動判斷 | `ability_inject` 語義匹配自動注入 |
| 社群 | 大量開源共享 | 內建 5 個 + 可自訂 `ability_register` |
| 格式 | `SKILL.md` 檔案 | 結構化 metadata + 語義儲存 |

AutomatosX 內建 5 個 Abilities：
- `workflow-first`：優先用 workflow，保持可追蹤性
- `code-review`：程式碼審查指導
- `git-hygiene`：提交規範
- `agent-routing`：Agent 路由規則
- `feedback-loop`：從執行結果學習調整

---

## 三、CLI-Anything 是什麼？

**來源**：香港大學資料智能實驗室（HKUDS），旗下也有 LightRAG（30k ⭐）、nanobot（36k ⭐）等知名專案。

**核心概念**：自動把現有專業桌面應用程式轉換成 Agent 可控制的 CLI 工具。

- 支援：GIMP、Blender、Inkscape、LibreOffice、OBS Studio、Audacity、Kdenlive、Ollama 等 16+ 軟體
- 產出：pip 可安裝的 CLI 套件 + 自動生成 `SKILL.md`
- 後端：真實呼叫軟體（不是模擬）
- 集中目錄：CLI-Hub，Agent 可自主探索與安裝

**支援平台**：Claude Code、OpenClaw、OpenCode、GitHub Copilot CLI、Codex、Goose

---

## 四、三層能力擴充架構（用戶的推論）

```
Layer 3: CLI-Anything
  把任意軟體原始碼 → 自動生成 SKILL.md
  → ax Agent 能控制 GIMP、Blender、LibreOffice 等

Layer 2: 社群 Skills 生態
  ClawHub / 開源社群的 5,400+ skills
  → ax Agent 繼承大量現成能力

Layer 1: AutomatosX 本身
  ax CLI → shared-runtime → MCP → workflow
  目前靠 provider CLI 與使用者互動
```

**用戶的關鍵洞察**：
1. ax 支援社群 Skills → 繼承整個生態的動態能力
2. ax 整合 CLI-Anything → Agent 可從任意軟體原始碼生成 CLI 包裝，讓 Agent 操控該軟體
3. 兩者相加 → ax Agent 能力從「會寫程式」→「能操控機器上任何軟體」

---

## 五、協同效應觀察

AutomatosX 已有 `ability_inject` 語義匹配機制，與 CLI-Anything 的 CLI-Hub Meta-Skill 概念幾乎一致。整合後的理想流程：

```
任務描述
   ↓
ability_inject 語義匹配（找內建 ability）
   ↓（找不到）
CLI-Hub 探索目錄
   ↓
自動安裝對應 CLI-Anything 包裝
   ↓
執行真實軟體完成任務
```

這讓 ax Agent 變成**自我擴充系統**——遇到不會的任務，自己找工具、安裝、執行。
