# Skills 資源清單：取得來源

日期：2026-03-25

---

## 官方來源

| 來源 | 連結 | 說明 |
|---|---|---|
| Anthropic 官方 Skills 倉庫 | https://github.com/anthropics/skills | 103k ⭐，含範本與各類範例，最佳起點 |
| Claude Code 官方文件 | https://code.claude.com/docs/en/skills | Skills 規格與使用說明 |

---

## Claude Code 社群 Skills

| 來源 | 連結 | 數量 | 特色 |
|---|---|---|---|
| alirezarezvani/claude-skills | https://github.com/alirezarezvani/claude-skills | 205+ | 最大個人集合，工程/行銷/C-Level 等 9 領域，含 254 個 CLI Python 工具 |
| travisvn/awesome-claude-skills | https://github.com/travisvn/awesome-claude-skills | 1000+ | 精選，涵蓋測試、文件、安全分析 |
| VoltAgent/awesome-agent-skills | https://github.com/VoltAgent/awesome-agent-skills | 1000+ | 跨平台，相容 Claude Code、Codex、Gemini CLI、Cursor 等 |
| ComposioHQ/awesome-claude-skills | https://github.com/ComposioHQ/awesome-claude-skills | — | 含瀏覽器自動化（Playwright）、Prompt 工程 |
| hesreallyhim/awesome-claude-code | https://github.com/hesreallyhim/awesome-claude-code | — | 綜合生態，含 skills、hooks、plugins |
| BehiSecc/awesome-claude-skills | https://github.com/BehiSecc/awesome-claude-skills | — | 安全導向，含 CodeQL、Semgrep 靜態分析 |

---

## OpenClaw Skills

| 來源 | 連結 | 數量 | 說明 |
|---|---|---|---|
| ClawHub（官方 registry） | https://clawhub.ai/ | **13,729** | OpenClaw 公開 registry，語義搜尋、版本管理、自動審核 |
| openclaw/clawhub（GitHub） | https://github.com/openclaw/clawhub | — | ClawHub 的 GitHub 倉庫 |
| VoltAgent/awesome-openclaw-skills | https://github.com/VoltAgent/awesome-openclaw-skills | **5,211** | 從 13,729 精選，過濾低品質，分 25+ 類別 |

ClawHub 熱門分類：
- Coding Agents & IDEs：1,184 個
- Web & Frontend：919 個
- DevOps & Cloud：393 個
- 瀏覽器自動化：322 個
- Search & Research：345 個

---

## 視覺化目錄

| 來源 | 連結 |
|---|---|
| Awesome Claude Skills 視覺目錄 | https://awesomeclaude.ai/awesome-claude-skills |

---

## 建議使用順序

1. **了解格式** → `anthropics/skills`（官方範本）
2. **最多現成可用** → `alirezarezvani/claude-skills`（205+ 生產就緒）
3. **OpenClaw 生態** → `clawhub.ai`（13,729 個，語義搜尋）
4. **跨平台相容** → `VoltAgent/awesome-agent-skills`（相容 11 個 AI 工具）

---

## 安全注意事項

- ClawHub 研究發現約 **10.8%** 的社群 skills 含惡意內容（3,000+ 樣本統計）
- 建議 AutomatosX 整合時建立允許清單與審核機制
- 優先使用官方或知名倉庫的 skills，避免來源不明的個人倉庫
