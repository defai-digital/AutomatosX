# AutomatosX Agent Directory

This document provides a comprehensive overview of the specialized AI agents available in the AutomatosX system. These agents are designed to collaborate on complex software engineering and business tasks, each with a unique role, set of skills, and a human-friendly name.

## 🤖 Quick Reference: All Agents

There are a total of 20 agents in the AutomatosX ecosystem, organized into specialized teams.

| Name | Agent ID | Role | Team |
|---|---|---|---|
| **Tony** | `cto` | Chief Technology Officer | Business/Leadership |
| **Eric** | `ceo` | Chief Executive Officer | Business/Leadership |
| **Paris** | `product` | Product Manager | Business/Leadership |
| **Candy** | `creative-marketer`| Creative Marketing Strategist | Marketing |
| **Oliver** | `devops` | DevOps Engineer | Engineering |
| **Dana** | `data-scientist` | Data Scientist | Data / Engineering |
| **Felix** | `fullstack` | Full-stack Developer | Engineering |
| **Maya** | `mobile` | Mobile Developer | Engineering |
| **Bob** | `backend` | Backend Engineer | Engineering |
| **Frank** | `frontend` | Frontend Engineer | Engineering |
| **Avery** | `architecture` | Senior Software Architect | Engineering |
| **Quinn** | `quantum-engineer` | Quantum Systems Engineer | Engineering |
| **Astrid** | `aerospace-scientist`| Aerospace Mission Scientist | Engineering |
| **Steve** | `security` | Security Engineer | Engineering |
| **Queenie** | `quality` | QA Engineer | Core/Quality |
| **Stan** | `standard` | Software Standards Expert | Core/Quality |
| **Daisy** | `data` | Data Engineer | Data |
| **Debbee** | `design` | UX/UI Designer | Design/Content |
| **Wendy** | `writer` | Technical Writer | Design/Content |
| **Rodman** | `researcher` | Researcher | Research |

---

## 💡 How to Use Agents

### Recommended: Natural Language Collaboration

For best results, collaborate with agents using natural language. This allows the system to analyze your project, provide context, and validate results.

```
✅ BEST: "please work with the backend agent to implement user authentication"
✅ BEST: "please discuss with the backend and security agents to design our API"
✅ BEST: "please plan with the engineering team to refactor this module"
```

### Express Method: Direct Commands

For simple, well-defined tasks, you can use direct commands.

```bash
# Use the agent's role name
ax run backend "Design a RESTful API for user management"

# Or use their human-friendly display name
ax run Bob "Design a RESTful API for user management"
```

📖 **[See the Complete Best Practices Guide](../docs/BEST-PRACTICES.md)**

---

## 🎯 Detailed Agent Directory

Agents are organized into teams, each with a specific provider configuration to optimize performance and reliability.

### 💻 Engineering Team

- **Primary Provider**: 🟢 Codex (OpenAI)
- **Fallback Chain**: Codex → Gemini → Claude
- **Why**: Optimized for code generation, testing, and implementation.

| Name | Agent ID | Expertise | Best For |
|---|---|---|---|
| **Oliver** | `devops` | Infrastructure as code, CI/CD, K8s | Complex multi-stage deployments |
| **Dana** | `data-scientist` | ML modeling, statistical analysis | End-to-end ML pipelines |
| **Felix** | `fullstack` | End-to-end features, API integration | Full-stack features |
| **Maya** | `mobile` | Native iOS/Android, React Native | Mobile app development |
| **Bob** | `backend` | API design, DB modeling, Go, Rust | Backend development, systems programming |
| **Frank** | `frontend` | React, Next.js, Swift, component architecture | Frontend development, iOS/web apps |
| **Avery** | `architecture` | System architecture, ADR management | Architecture governance, technical debt |
| **Quinn** | `quantum-engineer` | Quantum algorithms, Qiskit/Cirq | Quantum computing projects |
| **Astrid** | `aerospace-scientist` | Orbital mechanics, mission analysis | Aerospace projects |
| **Steve** | `security` | Security reviews, threat modeling | Security audits and code reviews |

### 🎯 Core/Quality Team

- **Primary Provider**: 🟢 Codex (OpenAI)
- **Fallback Chain**: Codex → Gemini → Claude
- **Why**: Optimized for code review, quality assurance, and detailed analysis.

| Name | Agent ID | Expertise | Best For |
|---|---|---|---|
| **Queenie** | `quality` | QA, debugging, testing | Multi-layer QA workflows, test coordination |
| **Stan** | `standard` | SOLID, design patterns, clean code | Code reviews, architecture validation |

### 💾 Data Team

- **Primary Provider**: 🟢 Codex (OpenAI)
- **Fallback Chain**: Codex → Gemini → Claude
- **Why**: Optimized for data processing and ML tasks.

| Name | Agent ID | Expertise | Best For |
|---|---|---|---|
| **Dana** | `data-scientist` | Statistical analysis, ML modeling | Complete ML pipelines |
| **Daisy** | `data` | ETL pipelines, data infrastructure | Data engineering tasks |

### 🎨 Design/Content Team

- **Primary Provider**: 🔵 Gemini
- **Fallback Chain**: Gemini → Claude → Codex
- **Why**: Optimized for creative content, UX/UI design, and technical writing.

| Name | Agent ID | Expertise | Best For |
|---|---|---|---|
| **Debbee** | `design` | UX research, wireframes, design systems | UX/UI design |
| **Wendy** | `writer` | API docs, ADRs, release notes | Technical writing |

### 📊 Business/Leadership Team

- **Primary Provider**: 🟣 Claude
- **Fallback Chain**: Claude → Codex → Gemini
- **Why**: Optimized for strategic planning, business analysis, and executive decision-making.

| Name | Agent ID | Expertise | Best For |
|---|---|---|---|
| **Tony** | `cto` | Architecture governance, tech strategy | Technology roadmap, platform decisions |
| **Eric** | `ceo` | Business strategy, market analysis | Strategic decisions, organizational leadership |
| **Paris** | `product` | User research, feature planning | Product strategy, roadmap planning |

### 🔬 Research Team

- **Primary Provider**: 🟠 OpenAI
- **Fallback Chain**: OpenAI → Gemini-CLI → Claude
- **Why**: Optimized for structured research, analysis, and evidence-based decision making.

| Name | Agent ID | Expertise | Best For |
|---|---|---|---|
| **Rodman** | `researcher` | Idea validation, feasibility analysis | Research reports, literature review |

### 📈 Marketing Team

- **Primary Provider**: 🟣 Claude
- **Fallback Chain**: Claude → Codex → Gemini
- **Why**: Aligned with the Business team for strategic collaboration.

| Name | Agent ID | Expertise | Best For |
|---|---|---|---|
| **Candy** | `creative-marketer` | GenAI prompting, digital marketing | Marketing campaigns, content creation |

---

## ⚙️ Advanced Concepts

### Delegation Architecture

AutomatosX uses a tiered **Delegation Depth** model to manage complex workflows and prevent infinite loops.

- **Depth 3 (Strategic Coordinators)**: Orchestrate complex, multi-layer workflows across several teams.
  - *Agents*: Tony (cto), Oliver (devops), Dana (data-scientist)
- **Depth 2 (Tactical Coordinators)**: Coordinate workflows within a domain, where sub-delegation to a specialist is required.
  - *Agent*: Queenie (quality)
- **Depth 1 (Simple Coordinators/Specialists)**: Can delegate simple tasks to implementers but cannot sub-delegate. Most specialists fall here.
  - *Agents*: Paris, Felix, Maya, Eric, Candy, Bob, Frank, Avery, Quinn, Astrid, Stan
- **Depth 0 (Pure Implementers)**: Execute tasks directly with deep expertise and no delegation capabilities.
  - *Agents*: Steve, Daisy, Debbee, Wendy, Rodman

### Provider Configuration and Fallback System

Each team is assigned a primary AI provider optimized for its tasks. To ensure 99.9% uptime, a 3-layer fallback system is in place:
1.  **Primary Provider**: The default, team-optimized provider.
2.  **Fallback Chain**: A pre-configured sequence of alternative providers.
3.  **Router Fallback**: If all else fails, the system auto-routes to any available provider.

### Customizing Agents

You can create new agents or customize existing ones.
```bash
# Create a new agent from a template
ax agent create my-assistant --template assistant --interactive

# Or copy and edit an existing agent's configuration file
cp examples/agents/backend.yaml .automatosx/agents/my-backend.yaml
vim .automatosx/agents/my-backend.yaml
```
To customize, modify the agent's `.yaml` file in your `.automatosx/agents/` directory.

---

## 📄 Recent Updates

**v5.6.27**:
- 🐛 **Bug Fixes**: Critical fixes for `LazyMemoryManager` and `db-connection-pool`.
- 📊 **Code Quality**: Improved from 7/10 to 9/10.
- ✅ **Compatibility**: 100% backward compatible.

**v5.6.21**:
- ✨ **New Agent**: Stan (`standard`) joins the Core/Quality team to focus on software engineering standards (SOLID, design patterns, etc.).
- 🔧 **Enhanced Agent**: Queenie (`quality`) now collaborates with Stan on best practices.

**v6.5.4**:
- ✨ **New Agent**: Avery (`architecture`): Senior Software Architect focusing on system architecture, ADR lifecycle management, and architecture governance.

**v5.6.9**:
- ✨ **New Agents**:
  - Quinn (`quantum-engineer`): Quantum computing.
  - Astrid (`aerospace-scientist`): Aerospace and orbital mechanics.
- 🔧 **Enhanced Agents**: Bob (`backend`) and Frank (`frontend`) received expanded language and framework expertise.