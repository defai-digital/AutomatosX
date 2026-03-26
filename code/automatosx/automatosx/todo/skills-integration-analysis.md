# 分析與建議：AutomatosX Skills 與 CLI-Anything 整合

日期：2026-03-25

---

## 現況分析

### AutomatosX 目前的能力邊界

ax 目前透過 provider CLI（Claude、Gemini 等）與使用者互動，能力範圍主要限於：
- 程式碼生成與修改
- Workflow 執行
- Agent 路由與委派
- 內建 5 個 Abilities 的指導規則

**缺口**：ax Agent 無法操控外部桌面軟體，也沒有機制繼承社群已累積的大量 skills。

---

## 機會評估

### 機會一：社群 Skills 整合

**潛在價值**：高
**實作難度**：中

社群已有 5,400+ skills（ClawHub、GitHub 開源倉庫），涵蓋：
- 程式碼審查、PR 建立、CI/CD
- 資料分析、文件生成
- 各種工具的操作指南

ax 支援社群 skills 等於**免費繼承大量已驗證的能力**，而不需要自己從零開發。

**風險**：
- 社群 skills 品質參差不齊（OpenClaw 社群研究發現 ~10.8% 含惡意內容）
- 需要審核機制

### 機會二：CLI-Anything 整合

**潛在價值**：極高
**實作難度**：中高

CLI-Anything 讓 ax Agent 能操控：
- 圖像編輯（GIMP、Inkscape）
- 3D 渲染（Blender）
- 文件處理（LibreOffice）
- 影片剪輯（Kdenlive、Shotcut）
- 直播（OBS Studio）
- 音訊處理（Audacity）
- 本地 LLM（Ollama）

這些是目前 ax 完全無法觸及的領域。

### 機會三：自我擴充機制

**潛在價值**：極高（長期）
**實作難度**：高

結合 `ability_inject` 的語義匹配 + CLI-Hub 目錄探索，ax 可以實現：
- Agent 自主發現能力缺口
- 自動從 CLI-Hub 安裝對應工具
- 無縫擴充而不需人工介入

---

## 建議優先順序

### 短期（可快速驗證）

1. **Skills 載入機制**
   - 支援從本地目錄（`.ax/skills/`）載入 `SKILL.md`
   - 透過 MCP server 將 skills 暴露為工具
   - 讓 ax CLI 支援 `/skill-name` 呼叫

2. **CLI-Anything 試驗**
   - 先整合 1-2 個 CLI-Anything 套件（建議從 Ollama 開始，因為跟 AI 最相關）
   - 驗證 ax Agent 是否能透過 skill 正確呼叫

### 中期（架構整合）

3. **Skills 倉庫管理**
   - `ax skill install <name>`：從社群倉庫安裝 skill
   - `ax skill list`：列出已安裝的 skills
   - 安全審核流程（防止惡意 skills）

4. **Ability ↔ Skill 橋接**
   - 當 `ability_inject` 找不到內建 ability 時，fallback 到 skills 目錄搜尋
   - 統一語義搜尋介面

### 長期（自我擴充）

5. **CLI-Hub 自動探索**
   - Agent 可呼叫 CLI-Hub 目錄
   - 根據任務描述自動安裝所需 CLI-Anything 套件
   - 執行後回饋到 `feedback-loop` ability，累積品質資料

---

## 風險與注意事項

| 風險 | 說明 | 緩解方式 |
|---|---|---|
| 惡意 Skills | 社群 skills 可能含惡意指令 | 建立允許清單 / 審核機制 |
| 依賴爆炸 | CLI-Anything 需安裝各種桌面軟體 | 按需安裝，不預先打包 |
| 版本相容性 | Skills 標準仍在演進 | 鎖定特定版本，定期更新 |
| 能力過度擴張 | Agent 能做的事太多，難以治理 | 結合 `guard_check` 機制控管 |

---

## 結論

AutomatosX 的架構（shared-runtime + MCP + workflow）已具備整合 skills 生態的基礎。Skills 整合不需要重寫核心，主要是：
1. 在 MCP server 新增 skills 探索與載入邏輯
2. 在 `ability_inject` 加入 skills 的 fallback 路徑
3. 在 CLI 新增 skills 管理指令

CLI-Anything 整合則是更大的機會——讓 ax 從「AI 開發工具」演進成「能操控機器上任何軟體的自主 Agent 平台」。
