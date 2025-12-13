# Terminal Mode Guide

**完整的 AutomatosX 原生終端使用教學**

本指南教你如何在終端環境中直接使用 AutomatosX，不依賴 Claude Code 或其他 IDE 整合。

> Note: Examples were captured on AutomatosX v6.3.8. Commands and flags remain valid on v12.x; version banners in sample output will show current values.

---

## 📋 目錄

- [什麼是終端模式？](#什麼是終端模式)
- [安裝與初始化](#安裝與初始化)
- [基本命令](#基本命令)
- [執行 AI 代理](#執行-ai-代理)
- [代理管理](#代理管理)
- [記憶體系統](#記憶體系統)
- [多代理協作](#多代理協作)
- [配置管理](#配置管理)
- [工作區管理](#工作區管理)
- [會話管理](#會話管理)
- [進階用法](#進階用法)
- [常見問題](#常見問題)

---

## 什麼是終端模式？

**終端模式**（Terminal Mode）是指直接在命令列環境中使用 AutomatosX CLI 工具，而不透過 Claude Code 或其他 IDE 整合。

### 兩種使用模式比較

| 特性 | 終端模式 | Claude Code 模式 |
|------|---------|------------------|
| **使用方式** | `ax run Bob "任務"` | `/ax-agent Bob, 任務` |
| **環境** | 任何終端（Bash, Zsh, PowerShell） | Claude Code 內部 |
| **適合場景** | 腳本自動化、CI/CD、獨立使用 | 開發時整合在 Claude Code 工作流程 |
| **互動方式** | 單次執行，返回結果 | 整合在對話中 |
| **配置** | 完全手動控制 | 由 Claude Code 協助 |

**本指南專注於終端模式的完整用法。**

---

## 安裝與初始化

### 1. 安裝 AutomatosX

```bash
# 全域安裝（推薦）
npm install -g @defai.digital/automatosx

# 驗證安裝
ax --version
# 或
automatosx --version
```

**輸出範例**：
```
AutomatosX v6.3.8
AI Agent Orchestration Platform
```

### 2. 初始化專案

在你的專案目錄中初始化：

```bash
# 在當前目錄初始化
ax setup

# 或指定目錄
ax setup ./my-ai-project
```

**這會創建**：
```
.automatosx/
├── agents/          # 代理配置檔案
├── abilities/       # 代理能力定義
├── teams/           # 團隊配置
├── memory/          # SQLite FTS5 記憶體資料庫
├── sessions/        # 會話記錄
├── workspaces/      # 代理工作區
└── logs/            # 系統日誌

ax.config.json   # 專案配置檔案
```

### 3. 設定 AI Provider CLI

AutomatosX 使用外部 CLI 工具來調用 AI Provider：

**Claude CLI**：
```bash
npm install -g @anthropic-ai/claude-code
claude login
```

**Gemini CLI**：
```bash
npm install -g @google/gemini-cli
gemini auth login
```

**Codex CLI (OpenAI)**：
```bash
npm install -g @openai/codex
codex auth login
```

### 4. 驗證系統狀態

```bash
ax status
```

**輸出範例**：
```
╔════════════════════════════════════════╗
║  AutomatosX System Status              ║
╚════════════════════════════════════════╝

✓ Configuration: OK
✓ Memory Database: OK (142 entries)
✓ Providers:
  • claude-code: ✓ Available
  • gemini-cli:  ✓ Available
  • openai:      ✗ Not configured

Agents: 12
Teams: 4
Sessions: 3 active
```

---

## 基本命令

### 命令別名

AutomatosX 支援兩個命令別名：

```bash
automatosx [command]   # 完整命令
ax [command]           # 簡短別名（推薦）
```

**本指南使用 `ax` 別名。**

### 查看幫助

```bash
# 查看所有命令
ax --help

# 查看特定命令幫助
ax run --help
ax agent --help
ax memory --help
```

### 全域選項

```bash
ax --debug [command]   # 啟用除錯日誌
ax --quiet [command]   # 安靜模式（僅輸出結果）
ax --config <path> [command]   # 使用自訂配置檔案
```

---

## 執行 AI 代理

### 基本執行

```bash
# 語法
ax run <agent-name> "<task>"

# 範例
ax run backend "Design a REST API for user authentication"
ax run frontend "Create a login form component with validation"
ax run security "Review the authentication implementation for security issues"
```

**使用友善名稱（Display Name）**：
```bash
# 使用代理的顯示名稱（如果已設定）
ax run Bob "Implement JWT authentication"
ax run Frank "Build the login UI"
ax run Steve "Audit the auth code"
```

### 進階執行選項

```bash
# 不啟用記憶體
ax run backend "Quick question" --no-memory

# 不儲存到記憶體
ax run backend "Test task" --no-save-memory

# 指定輸出格式
ax run backend "Design API" --format json
ax run backend "Design API" --format markdown

# 啟用詳細輸出
ax run backend "Complex task" --verbose

# 指定 Provider
ax run backend "Task" --provider claude-code
ax run backend "Task" --provider gemini-cli
```

### 執行輸出範例

```bash
$ ax run backend "What is TypeScript?"
```

**輸出**：
```
🤖 AutomatosX v6.3.8

Agent: backend (Bob)
Task: What is TypeScript?
Provider: claude-code

─────────────────────────────────────

TypeScript is a strongly typed programming language
that builds on JavaScript. It adds static type
definitions, enabling better tooling, error detection,
and code maintainability at scale.

Key features:
- Static typing with type inference
- Interfaces and generics
- Enhanced IDE support
- Compiles to standard JavaScript

─────────────────────────────────────

✓ Complete (1.8s)
💾 Saved to memory
```

---

## 代理管理

### 列出可用代理

```bash
# 列出所有代理
ax agent list

# 按團隊列出
ax agent list --by-team engineering
ax agent list --by-team core
ax agent list --by-team business
```

**輸出範例**：
```
Available Agents (12):

Engineering Team:
┌──────────┬──────────────────────────┬──────────┬──────────┐
│ Name     │ Display Name             │ Role     │ Provider │
├──────────┼──────────────────────────┼──────────┼──────────┤
│ backend  │ Bob                      │ Backend  │ codex    │
│ frontend │ Frank                    │ Frontend │ codex    │
│ devops   │ Oliver                   │ DevOps   │ codex    │
│ data     │ Daisy                    │ Data Eng │ codex    │
│ security │ Steve                    │ Security │ codex    │
└──────────┴──────────────────────────┴──────────┴──────────┘

Core Team:
┌──────────┬──────────────────────────┬──────────┬──────────┐
│ Name     │ Display Name             │ Role     │ Provider │
├──────────┼──────────────────────────┼──────────┼──────────┤
│ quality  │ Queenie                  │ QA Lead  │ claude   │
└──────────┴──────────────────────────┴──────────┴──────────┘

...
```

### 查看代理詳情

```bash
ax agent show backend
```

**輸出範例**：
```yaml
name: backend
displayName: Bob
team: engineering
role: Senior Backend Engineer
provider: codex
maxTokens: 4096
temperature: 0.2
abilities:
  - backend-development
  - api-design
  - database-modeling
systemPrompt: |
  You are a senior backend engineer specializing in...
```

### 創建新代理

#### 使用模板（推薦）

```bash
# 互動式創建
ax agent create my-backend --template developer --interactive

# 一行創建
ax agent create my-backend \
  --template developer \
  --display-name "Mike" \
  --role "Backend Engineer" \
  --team engineering
```

**可用模板**：
```bash
ax agent templates
```

輸出：
- `basic-agent` - 基礎代理（core 團隊）
- `developer` - 軟體開發（engineering 團隊）
- `analyst` - 業務分析（business 團隊）
- `designer` - UI/UX 設計（design 團隊）
- `qa-specialist` - 品質保證（core 團隊）

#### 手動創建

在 `.automatosx/agents/` 創建 YAML 檔案：

```yaml
# .automatosx/agents/my-agent.yaml
name: my-agent
displayName: "Mike"
team: engineering
role: Senior Backend Engineer
abilities:
  - backend-development
  - api-design
systemPrompt: |
  You are a senior backend engineer...
```

### 刪除代理

```bash
ax agent remove my-agent
```

---

## 記憶體系統

AutomatosX 使用 SQLite FTS5 提供高速全文搜尋記憶體系統（< 1ms 搜尋時間）。

### 搜尋記憶體

```bash
# 基本搜尋
ax memory search "authentication"

# 限制結果數量
ax memory search "API design" --limit 5

# 搜尋特定代理的記憶
ax memory list --agent backend
```

**輸出範例**：
```
🔍 Memory Search Results (3 found)

1. [2025-10-09 14:32] backend
   Task: Design REST API for authentication
   Response: I recommend using JWT tokens with...

2. [2025-10-08 10:15] security
   Task: Review auth implementation
   Response: The implementation looks secure...

3. [2025-10-07 16:45] backend
   Task: Implement password hashing
   Response: Use bcrypt with salt rounds...
```

### 列出記憶體

```bash
# 列出所有記憶
ax memory list

# 按代理過濾
ax memory list --agent backend

# 限制數量
ax memory list --limit 20
```

### 手動新增記憶

```bash
ax memory add "TypeScript is a typed superset of JavaScript" \
  --agent backend \
  --type knowledge
```

### 匯出與匯入

```bash
# 匯出記憶體
ax memory export ./backup.json

# 匯入記憶體
ax memory import ./backup.json

# 匯出特定代理的記憶
ax memory export ./backend-memory.json --agent backend
```

### 記憶體統計

```bash
ax memory stats
```

**輸出範例**：
```
📊 Memory Statistics

Total Entries: 1,201
Database Size: 12.4 MB
Agents with Memories: 8

Top Agents:
  backend: 342 entries
  frontend: 218 entries
  security: 156 entries
  quality: 134 entries

Recent Activity:
  Last 24h: 23 new entries
  Last 7d: 145 new entries
```

### 清除記憶體

```bash
# 清除所有記憶（需要確認）
ax memory clear

# 清除特定代理的記憶
ax memory clear --agent backend
```

---

## 多代理協作

AutomatosX 支援自然語言委派，讓代理之間自動協作。

### 自動委派範例

```bash
ax run product "Build a user dashboard with real-time metrics"
```

**Product 代理的回應可能包含委派**：
```
I've designed the dashboard architecture:

@backend Please implement the REST API endpoints for user metrics
@frontend Please create the React dashboard components
@security Please review the data access security

All specifications are in my workspace.
```

**AutomatosX 自動執行**：
1. ✓ Backend 實作 API → 儲存到工作區
2. ✓ Frontend 建立 UI → 讀取 Backend 的 API 規格
3. ✓ Security 稽核安全性 → 檢視兩者的實作
4. ✓ 結果聚合 → 完整的儀表板交付

### 委派語法

代理可以使用多種語法來委派任務：

```bash
# 1. @mention 語法
@backend Implement the API based on this design

# 2. 顯式委派
DELEGATE TO frontend: Create the login UI

# 3. 禮貌請求
Please ask security to audit this implementation

# 4. 需求表達
I need devops to deploy this to staging

# 5. 中文支援
請 frontend 建立登入介面
```

### 委派配置

在 `ax.config.json` 中配置委派行為：

```json
{
  "orchestration": {
    "delegation": {
      "maxDepth": 2,
      "timeout": 1500000,
      "enableCycleDetection": true
    }
  }
}
```

**參數說明**：
- `maxDepth`: 最大委派深度（防止無限循環）
- `timeout`: 委派超時時間（毫秒）
- `enableCycleDetection`: 啟用循環檢測

---

## 配置管理

### 查看配置

```bash
# 顯示完整配置
ax config show

# 獲取特定值
ax config get execution.defaultTimeout
ax config get providers.claude-code.enabled
ax config get memory.maxEntries
```

### 設定配置

```bash
# 設定單一值
ax config set execution.defaultTimeout 1800000
ax config set memory.maxEntries 20000
ax config set logging.level debug
```

### 重置配置

```bash
# 重置所有配置為預設值
ax config reset

# 重置特定區段
ax config reset providers
ax config reset memory
```

### 配置檔案位置

AutomatosX 按以下優先順序載入配置：

1. `.automatosx/config.json` - 專案特定（由 `ax setup` 創建）
2. `ax.config.json` - 專案根目錄（手動創建）
3. `~/.automatosx/config.json` - 使用者全域
4. 內建預設值 - `src/types/config.ts`

---

## 工作區管理

每個代理都有獨立的工作區來儲存檔案和資料。

### 查看工作區統計

```bash
ax workspace stats
```

**輸出範例**：
```
📁 Workspace Statistics

Total Workspaces: 8
Total Size: 45.2 MB

Agent Workspaces:
┌──────────┬────────┬──────────┐
│ Agent    │ Files  │ Size     │
├──────────┼────────┼──────────┤
│ backend  │ 23     │ 12.4 MB  │
│ frontend │ 18     │ 8.7 MB   │
│ security │ 12     │ 3.2 MB   │
└──────────┴────────┴──────────┘

Session Workspaces: 3 (21.9 MB)

Last Cleanup: 2025-10-09
```

### 清理工作區

```bash
# 清理舊的工作區（7天以上）
ax workspace cleanup

# 清理特定代理的工作區
ax workspace cleanup --agent backend

# 強制清理（不詢問確認）
ax workspace cleanup --force
```

### 工作區位置 (v5.2+)

```
automatosx/
├── PRD/              # 共享規劃文檔
│   ├── requirements.md
│   └── architecture.md
└── tmp/              # 臨時文件（自動清理）
    ├── draft-code.ts
    └── analysis.json
```

---

## 會話管理

會話系統追蹤多代理協作的完整歷程。

### 列出會話

```bash
# 列出所有會話
ax session list

# 只顯示活躍會話
ax session list --active

# 顯示已完成的會話
ax session list --completed
```

**輸出範例**：
```
📋 Active Sessions (2)

Session: abc123de-f456-7890-g123-h4567890ij12
  Started: 2025-10-10 10:30:15
  Root Agent: product
  Delegations: 3 (backend, frontend, security)
  Status: in_progress

Session: xyz789ab-c012-3456-d789-e0123456fg78
  Started: 2025-10-10 09:15:42
  Root Agent: backend
  Delegations: 1 (security)
  Status: completed
```

### 查看會話詳情

```bash
ax session status <session-id>
```

**輸出範例**：
```yaml
sessionId: abc123de-f456-7890-g123-h4567890ij12
status: completed
startedAt: 2025-10-10T10:30:15Z
completedAt: 2025-10-10T10:45:32Z
rootAgent: product

delegationChain:
  - product → backend (completed)
  - backend → security (completed)
  - product → frontend (completed)

workspace: automatosx/PRD/ (shared)

results:
  product: "Dashboard architecture designed..."
  backend: "API endpoints implemented..."
  frontend: "React components created..."
  security: "Security audit passed..."
```

### 手動完成/失敗會話

```bash
# 標記會話為已完成
ax session complete <session-id>

# 標記會話為失敗
ax session fail <session-id> "Reason for failure"
```

---

## 進階用法

### 使用不同的 Provider

```bash
# 強制使用特定 Provider
ax run backend "Task" --provider claude-code
ax run backend "Task" --provider gemini-cli
ax run backend "Task" --provider openai
```

### Provider 優先順序

在 `ax.config.json` 中設定：

```json
{
  "providers": {
    "claude-code": {
      "enabled": true,
      "priority": 3
    },
    "gemini-cli": {
      "enabled": true,
      "priority": 2
    },
    "openai": {
      "enabled": true,
      "priority": 1
    }
  }
}
```

**數字越大，優先級越高。**

### 環境變數

```bash
# 啟用除錯模式
export AUTOMATOSX_DEBUG=true
ax run backend "Task"

# 使用 Mock Providers（測試用）
export AX_MOCK_PROVIDERS=true
ax run backend "Test task"

# 自訂配置路徑
export AUTOMATOSX_CONFIG_PATH=/path/to/config.json
ax run backend "Task"

# 安靜模式
export AUTOMATOSX_QUIET=true
ax run backend "Task"
```

### 腳本整合

AutomatosX 可以輕鬆整合到自動化腳本中：

```bash
#!/bin/bash
# deploy-review.sh

# 1. 讓 Backend 代理實作功能
echo "Implementing feature..."
ax run backend "Implement user authentication API"

# 2. 讓 Security 代理審查
echo "Security review..."
ax run security "Review the authentication implementation"

# 3. 讓 QA 代理測試
echo "Running tests..."
ax run quality "Test the authentication flow"

# 4. 如果一切正常，部署
echo "Deploying..."
ax run devops "Deploy authentication service to production"
```

### CI/CD 整合

```yaml
# .github/workflows/ai-review.yml
name: AI Code Review

on: [pull_request]

jobs:
  ai-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '24'

      - name: Install AutomatosX
        run: npm install -g @defai.digital/automatosx

      - name: Initialize
        run: ax setup

      - name: Run AI Review
        run: |
          ax run quality "Review this pull request for code quality"
          ax run security "Security audit of the changes"
```

### JSON 輸出（用於解析）

```bash
# 獲取 JSON 格式的輸出
ax run backend "Design API" --format json > result.json

# 解析 JSON
cat result.json | jq '.response'
```

---

## 常見問題

### Q: 如何更新 AutomatosX？

```bash
# 使用內建更新命令
ax update

# 或手動更新
npm install -g @defai.digital/automatosx@latest
```

### Q: 命令找不到 `ax` 或 `automatosx`？

```bash
# 重新安裝
npm install -g @defai.digital/automatosx

# 或使用 npx（不需安裝）
npx @defai.digital/automatosx run backend "Task"
```

### Q: Provider 連線失敗？

```bash
# 1. 檢查系統狀態
ax status

# 2. 測試 Provider CLI
claude --version
gemini --version
codex --version

# 3. 重新認證
claude login
gemini auth login
codex auth login
```

### Q: 記憶體搜尋沒有結果？

```bash
# 1. 使用更廣泛的搜尋詞
ax memory search "auth"  # 而不是 "authentication API design"

# 2. 列出所有記憶
ax memory list

# 3. 檢查記憶體統計
ax memory stats
```

### Q: 如何刪除所有資料重新開始？

```bash
# 刪除 .automatosx 目錄
rm -rf .automatosx/

# 重新初始化
ax setup
```

### Q: 代理執行超時？

調整超時設定：

```bash
# 增加預設超時（25分鐘 = 1500000 毫秒）
ax config set execution.defaultTimeout 1500000

# 或在配置檔案中設定
# ax.config.json
{
  "execution": {
    "defaultTimeout": 1500000
  }
}
```

### Q: 如何備份所有資料？

```bash
# 備份整個 .automatosx 目錄
tar -czf automatosx-backup-$(date +%Y%m%d).tar.gz .automatosx/

# 或只備份記憶體
ax memory export ./memory-backup.json
```

### Q: 可以在多個專案中共用配置嗎？

可以！使用使用者全域配置：

```bash
# 在 home 目錄創建全域配置
mkdir -p ~/.automatosx
cp ax.config.json ~/.automatosx/config.json

# 所有專案會繼承這個配置（除非有專案特定配置）
```

---

## 下一步

### 學習更多

- [核心概念](./core-concepts.md) - 理解代理、配置、能力
- [多代理協作](./multi-agent-orchestration.md) - 深入了解代理委派
- [團隊配置](./team-configuration.md) - 組織你的代理團隊
- [記憶體管理教學](../tutorials/memory-management.md) - 進階記憶體操作

### 參考文件

- [CLI 命令完整參考](../reference/cli-commands.md)
- [配置架構](../reference/configuration-schema.md)
- [代理目錄](../../examples/AGENTS_INFO.md)

### 範例專案

查看 `examples/` 目錄中的實際使用案例：
- 完整開發工作流程
- CI/CD 整合範例
- 自動化腳本範例

---

## 需要幫助？

- **文檔**: [docs/](../)
- **GitHub Issues**: [github.com/defai-digital/automatosx/issues](https://github.com/defai-digital/automatosx/issues)
- **FAQ**: [FAQ.md](../../FAQ.md)
- **範例**: `.automatosx/agents/` 和 `.automatosx/abilities/`（執行 `ax setup` 後）

---

**準備好開始使用終端模式了嗎？** 🚀

返回 [README](../../README.md) | 查看 [Claude Code 整合](../../README.md#-built-for-claude-code)
