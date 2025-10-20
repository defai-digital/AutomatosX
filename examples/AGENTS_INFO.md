# AutomatosX Agent Directory

**v5.6.9 Update**: Bob & Frank enhanced with comprehensive language and framework expertise. Total: 13,925 lines of guidance across 11 ability files.
- **Bob**: Multi-language expertise (C++, C, Python, Rust, Go, JS/TS) - 7,079 lines
- **Frank**: Multi-framework expertise (React, Next.js, Swift, Python) - 6,846 lines

**v5.3.6 Update**: Bob & Frank upgraded to depth 1 for specialist consultation. Daisy configuration clarified.

AutomatosX agents have **human-friendly names** to make them easier to remember and use. Each agent has both a technical role name and a memorable display name.

## 💡 How to Use These Agents (Best Practices)

### Recommended: Natural Language Collaboration

Instead of directly commanding agents with slash commands, **let Claude Code coordinate**:

```
✅ BEST: "please work with backend agent to implement user authentication"
✅ BEST: "please discuss with backend and security agents to design our API"
✅ BEST: "please plan with the engineering team to refactor this module"
```

**Why this is better**:
- 🧠 Claude Code analyzes your project first
- 🎯 Provides full context to agents
- ✅ Validates results
- 🔄 Easy to iterate

### Express Method: Slash Commands (for simple tasks only)

```
⚡ EXPRESS: /ax:agent backend, write an email validation function
⚡ EXPRESS: /ax:agent quality, review this code snippet
```

**Use slash commands only when**:
- Task is simple and well-defined
- You know exactly which agent to use
- Speed matters more than planning

📖 **[Complete Best Practices Guide](../docs/BEST-PRACTICES.md)**

---

## 🎯 Agent Classification by Delegation Strategy (v5.3.5)

AutomatosX uses a **tiered delegation architecture** to orchestrate complex workflows while preventing delegation cycles.

### Tier 1: Strategic Coordinators (Depth 3) 🎖️

**Purpose**: Orchestrate complex multi-layer workflows across teams and domains.

| Agent | Display Name | Why Depth 3? | Typical Workflow |
|-------|--------------|--------------|------------------|
| **cto** | Tony | Cross-team technical initiatives | Strategy → Team Coordination → Implementation |
| **devops** | Oliver | Multi-stage deployment pipelines | Planning → Build → Test → Deploy → Monitor |
| **data-scientist** | Dana | End-to-end ML pipelines | Data → Feature → Model → Deploy → Monitor |

**Delegation Pattern**:
- **Layer 1**: Strategic planning and coordination
- **Layer 2**: Team/domain delegation
- **Layer 3**: Specialist execution

**Example Workflow**:
```
Tony (CTO): "Implement microservices architecture"
  └─> Oliver (DevOps): "Set up K8s infrastructure"
       └─> Bob (Backend): "Create service templates"
            └─> Steve (Security): "Review security configs"
```

---

### Tier 2: Tactical Coordinators (Depth 1-2) 🎯

**Purpose**: Coordinate work within their domain, with limited cross-domain delegation.

| Agent | Display Name | Depth | Role | Why This Depth? |
|-------|--------------|-------|------|-----------------|
| **quality** | Queenie | **2** | QA Engineer | Needs to coordinate complex multi-layer testing workflows |
| **product** | Paris | 1 | Product Manager | Delegates to implementers, no sub-delegation needed |
| **fullstack** | Felix | 1 | Full-stack Dev | Handles end-to-end features, occasional specialist help |
| **mobile** | Maya | 1 | Mobile Dev | Mobile-specific work, backend/design delegation |
| **ceo** | Eric | 1 | Business Strategy | Strategic direction, delegates execution |
| **creative-marketer** | Cynthia | 1 | Creative Marketing | Marketing campaigns, content delegation |

**Delegation Pattern**:
- **Depth 2**: Coordinator → Implementer → Specialist
- **Depth 1**: Coordinator → Implementer (no sub-delegation)

**Example Workflow (Depth 2 - Queenie)**:
```
Queenie (Quality): "Comprehensive E2E testing with security audit"
  └─> Bob (Backend): "Implement API tests"
       └─> Steve (Security): "Audit security test coverage"
  └─> Frank (Frontend): "Implement UI tests"
       └─> Debbee (Design): "Validate visual regression"
```

**Example Workflow (Depth 1 - Paris)**:
```
Paris (Product): "Build user authentication feature"
  └─> Bob (Backend): "Implement auth API"  [Stops here]
  └─> Frank (Frontend): "Implement login UI"  [Stops here]
```

---

### Tier 3: Pure Implementers (Depth 0) ⚙️

**Purpose**: Execute work directly with deep domain expertise, no delegation capability.

| Agent | Display Name | Role | Why Depth 0? |
|-------|--------------|------|--------------|
| **backend** | Bob | Backend Engineer | Focus on backend execution, cross-domain via coordinators |
| **frontend** | Frank | Frontend Engineer | Focus on frontend execution |
| **data** | Daisy | Data Engineer | Focus on data pipeline execution |
| **design** | Debbee | UX/UI Designer | Focus on design execution |
| **security** | Steve | Security Engineer | Focus on security assessment |
| **writer** | Wendy | Technical Writer | Focus on documentation |
| **researcher** | Rodman | Researcher | Focus on research, recommend handoff |

**Why No Delegation?**:
- ✅ Prevents delegation cycles
- ✅ Clearer responsibility boundaries
- ✅ Cross-domain needs handled by coordinators
- ✅ Focus on execution excellence

**Example Workflow**:
```
Bob (Backend): "Optimize database queries"
  [Executes directly - no delegation]
```

---

## 📊 Quick Reference: Agent Distribution

### By Team and Depth

| Team | Depth 3 | Depth 2 | Depth 1 | Depth 0 |
|------|---------|---------|---------|---------|
| **Engineering** | Oliver, Dana | - | Felix, Maya, **Bob**, **Frank** | - |
| **Core/Quality** | - | **Queenie** | - | - |
| **Business** | - | - | Paris, Eric | - |
| **Content** | - | - | - | Debbee, Wendy |
| **Data** | Dana | - | - | Daisy |
| **Security** | - | - | - | Steve |
| **Research** | - | - | - | Rodman |
| **Marketing** | - | - | Cynthia | - |

### Total: 16 Agents

- **3 Strategic Coordinators** (Depth 3): Tony, Oliver, Dana
- **6 Tactical Coordinators** (Depth 1-2): Queenie (2), Paris, Felix, Maya, Eric, Cynthia
- **2 Tactical Implementers** (Depth 1): Bob, Frank ⭐ NEW in v5.3.6
- **5 Pure Implementers** (Depth 0): Daisy, Debbee, Steve, Wendy, Rodman

---

## 🚀 How Delegation Works

### Understanding Delegation Depth

**Delegation Depth** controls how many layers of work coordination an agent can orchestrate:

- **Depth 0**: Do it yourself, no delegation
- **Depth 1**: Can delegate to others, but they can't delegate further
- **Depth 2**: Can delegate to others, who can then delegate to specialists
- **Depth 3**: Can orchestrate complex multi-layer workflows across multiple teams

### Delegation Flow Examples

#### Example 1: Strategic Initiative (Depth 3)
```
Tony (CTO): "Implement microservices architecture"
  └─> Oliver (DevOps): "Set up K8s infrastructure"      [Layer 1]
       └─> Bob (Backend): "Create service templates"    [Layer 2]
            └─> Steve (Security): "Review configs"      [Layer 3]
```

#### Example 2: Quality Workflow (Depth 2)
```
Queenie (Quality): "Comprehensive E2E testing with security audit"
  └─> Bob (Backend): "Implement API tests"             [Layer 1]
       └─> Steve (Security): "Audit security coverage"  [Layer 2]
  └─> Frank (Frontend): "Implement UI tests"           [Layer 1]
       └─> Debbee (Design): "Validate visual"          [Layer 2]
```

#### Example 3: Tactical Coordination (Depth 1)
```
Paris (Product): "Build user authentication feature"
  └─> Bob (Backend): "Implement auth API"              [Layer 1]
      [Stops here - Bob cannot delegate further]
  └─> Frank (Frontend): "Implement login UI"           [Layer 1]
      [Stops here - Frank cannot delegate further]
```

#### Example 4: Pure Implementation (Depth 0)
```
Bob (Backend): "Optimize database queries"
  [Executes directly - no delegation allowed]
```

---

## 🎯 Agent Selection Guide

### Choose by Task Complexity

**Strategic/Multi-team Tasks** → Tony, Oliver, Dana (Depth 3)
- Cross-team initiatives
- Multi-phase deployments
- Complex ML pipelines

**Domain Coordination** → Queenie, Paris, Felix, Maya, Eric (Depth 1-2)
- Quality assurance workflows
- Feature planning
- Mobile app development
- Product strategy

**Direct Implementation** → Bob, Frank, Daisy, Debbee, Steve, Wendy, Rodman (Depth 0)
- Backend development
- Frontend development
- Data engineering
- Design work
- Security audits
- Documentation
- Research

### Choose by Domain

| Domain | Implementation | Coordination | Strategy |
|--------|---------------|--------------|----------|
| **Backend** | Bob (0) | Felix (1) | Tony (3) |
| **Frontend** | Frank (0) | Felix (1) | Tony (3) |
| **Quality** | - | **Queenie (2)** | Tony (3) |
| **Infrastructure** | - | - | Oliver (3) |
| **Data Science** | Daisy (0) | - | Dana (3) |
| **Product** | - | Paris (1) | Eric (1) |
| **Design** | Debbee (0) | - | - |
| **Security** | Steve (0) | - | Tony (3) |
| **Mobile** | - | Maya (1) | Tony (3) |

---

## 📋 Detailed Agent Directory

### 💻 Engineering Team

**Provider**: 🟣 Claude (claude-code) primary, 🟢 OpenAI fallback

#### Strategic Coordinators (Depth 3)

| Name | Agent | Expertise | Best For | Delegation Capability |
|------|-------|-----------|----------|-----------------------|
| **Oliver** | devops | Infrastructure as code, CI/CD, K8s | Complex multi-stage deployments | 3 layers (Planning → Build → Deploy) |
| **Dana** | data-scientist | ML modeling, statistical analysis | End-to-end ML pipelines | 3 layers (Data → Train → Deploy) |

#### Tactical Coordinators (Depth 1)

| Name | Agent | Expertise | Best For | Delegation Capability |
|------|-------|-----------|----------|-----------------------|
| **Felix** | fullstack | End-to-end features, API integration | Full-stack features | 1 layer (can delegate to specialists) |
| **Maya** | mobile | Native iOS/Android, React Native | Mobile app development | 1 layer (can delegate to backend/design) |

#### Tactical Implementers (Depth 1) ⭐ NEW in v5.3.6

| Name | Agent | Expertise | Best For | Delegation Capability |
|------|-------|-----------|----------|-----------------------|
| **Bob** | backend | API design, database modeling, caching, **multi-language expertise** (C++, C, Python, Rust, Go, JS/TS) ⭐ v5.6.9 | Backend development, systems programming | 1 layer (can consult security, design, quality) |
| **Frank** | frontend | **Multi-framework expertise** (React, Next.js, Swift, Python), component architecture, state mgmt ⭐ v5.6.9 | Frontend development, iOS/web apps | 1 layer (can consult design, security, quality) |

**Bob's Language Expertise (v5.6.9)**:
- **C++**: Modern C++17/20 patterns, RAII, smart pointers, move semantics, STL algorithms
- **C**: Pure C99/C11/C17, manual memory management, string safety, system-level programming
- **Python**: Pythonic idioms, type hints, async/await, FastAPI, Django
- **Rust**: Ownership system, borrowing, lifetimes, fearless concurrency
- **Go**: Goroutines, channels, idiomatic error handling, microservices
- **JavaScript/TypeScript**: Strict TypeScript, async patterns, Node.js backend, Express/Fastify
- **Systems Programming**: Cache-friendly data structures, SIMD, lock-free algorithms

**Frank's Framework Expertise (v5.6.9)**:
- **React**: Modern hooks (useState, useEffect, useContext, useReducer, useMemo, useCallback), React 18+ concurrent rendering, performance optimization
- **Next.js**: App Router (Next.js 13+), Server Components vs Client Components, SSR/SSG/ISR, API routes, edge runtime
- **Swift/SwiftUI**: Declarative UI, state management (@State, @Binding, @ObservedObject, @StateObject, @EnvironmentObject), Combine framework
- **Swift/UIKit**: MVC/MVVM patterns, Auto Layout, programmatic UI, UITableView/UICollectionView
- **Python**: Frontend tooling, data processing (pandas, numpy), build automation, API integration, pytest

#### Pure Implementers (Depth 0)

| Name | Agent | Expertise | Best For | Delegation Capability |
|------|-------|-----------|----------|-----------------------|
| **Steve** | security | **SOLE OWNER** of security-audit | Security reviews, threat modeling | None (executes directly) |

---

### 🎯 Quality Team

**Provider**: 🟢 OpenAI (codex) primary, 🔵 Gemini fallback

#### Tactical Coordinator (Depth 2) ⭐ NEW in v5.3.5

| Name | Agent | Expertise | Best For | Delegation Capability |
|------|-------|-----------|----------|-----------------------|
| **Queenie** | quality | **SOLE OWNER** of code-review & debugging | Multi-layer QA workflows, test coordination | 2 layers (QA → Implementation → Specialist) |

**Why Depth 2?**: Quality assurance requires coordinating complex workflows where implementers need to delegate to specialists (e.g., Backend implements tests → Security audits security aspects).

---

### 💾 Data Team

**Provider**: 🔵 Gemini (gemini-cli) primary, 🟣 Claude fallback

#### Strategic Coordinator (Depth 3)

| Name | Agent | Expertise | Best For | Delegation Capability |
|------|-------|-----------|----------|-----------------------|
| **Dana** | data-scientist | Statistical analysis, ML modeling | Complete ML pipelines | 3 layers (Data → Feature → Model → Deploy) |

#### Pure Implementer (Depth 0)

| Name | Agent | Expertise | Best For | Delegation Capability |
|------|-------|-----------|----------|-----------------------|
| **Daisy** | data | ETL pipelines, data infrastructure | Data engineering | None (executes directly) |

---

### 🎨 Content Team

**Provider**: Various

#### Pure Implementers (Depth 0)

| Name | Agent | Expertise | Best For | Delegation Capability |
|------|-------|-----------|----------|-----------------------|
| **Debbee** | design | UX research, wireframes, design systems | UX/UI design | None (executes directly) |
| **Wendy** | writer | API docs, ADRs, release notes | Technical writing | None (executes directly) |

---

### 📊 Leadership Team

**Provider**: Various

#### Strategic Coordinator (Depth 3)

| Name | Agent | Expertise | Best For | Delegation Capability |
|------|-------|-----------|----------|-----------------------|
| **Tony** | cto | Architecture governance, tech strategy | Technology roadmap, platform decisions | 3 layers (Strategy → Team → Implementation) |

#### Tactical Coordinators (Depth 1)

| Name | Agent | Expertise | Best For | Delegation Capability |
|------|-------|-----------|----------|-----------------------|
| **Eric** | ceo | Business strategy, market analysis | Strategic decisions, organizational leadership | 1 layer (can delegate execution) |
| **Paris** | product | User research, feature planning | Product strategy, roadmap planning | 1 layer (can delegate to implementers) |

---

### 🔬 Research & Specialist Teams

#### Pure Implementer (Depth 0)

| Name | Agent | Expertise | Best For | Delegation Capability |
|------|-------|-----------|----------|-----------------------|
| **Rodman** | researcher | Idea validation, feasibility analysis | Research reports, literature review | None (recommends handoff) |

#### Tactical Coordinator (Depth 1)

| Name | Agent | Expertise | Best For | Delegation Capability |
|------|-------|-----------|----------|-----------------------|
| **Cynthia** | creative-marketer | GenAI prompting, digital marketing | Marketing campaigns, content creation | 1 layer (can delegate content work) |

---

## 🛡️ Intelligent 3-Layer Fallback System

Each agent uses a **smart fallback strategy** to ensure maximum reliability:

1. **Primary Provider**: Team-optimized AI (🟢 OpenAI / 🟣 Claude / 🔵 Gemini)
2. **Fallback Provider**: Agent-specific backup (configured per agent)
3. **Router Fallback**: Auto-routing through all available providers (priority-based)

**Example**: If an Engineering agent (primary: claude-code) encounters an issue:
- ✅ Try Claude first (primary: `claude-code`)
- ✅ Fall back to OpenAI (configured fallback: `openai`)
- ✅ Try Gemini (router fallback: `gemini-cli`)

This ensures **99.9% uptime** even if one provider has issues!

---

## 📝 Agent Governance Principles (v5.3.5)

### When to Use Each Depth

**Depth 3** - Strategic Coordination
- ✅ Cross-team initiatives
- ✅ Multi-phase complex workflows
- ✅ Strategic technical decisions
- Example: CTO coordinating microservices migration

**Depth 2** - Tactical Multi-layer Coordination
- ✅ Domain-specific complex workflows
- ✅ Requires coordinating specialists
- ✅ Multi-stage quality/testing processes
- Example: QA coordinating comprehensive testing

**Depth 1** - Simple Coordination
- ✅ Single-layer delegation
- ✅ Coordinate within domain
- ✅ No sub-delegation needed
- Example: Product manager delegating to developers

**Depth 0** - Pure Implementation
- ✅ Deep domain expertise
- ✅ Execute directly
- ✅ No delegation complexity
- Example: Backend developer writing APIs

### Adding New Agents

When creating agents, choose depth based on:

- **Scope**: Team-level (3), Domain-level (1-2), Task-level (0)
- **Coordination Need**: Multi-layer (2-3), Single-layer (1), None (0)
- **Decision Authority**: Strategic (3), Tactical (1-2), Implementation (0)

---

## Why Names?

Research shows humans remember names better than roles. Instead of remembering "backend engineer", you can just think "ask Bob".

### Mnemonic Devices

- **Bob** - "Bob the **B**ackend **B**uilder"
- **Frank** - "**F**rank the **F**rontend friend"
- **Felix** - "**F**elix handles **F**ull-stack **F**eatures"
- **Maya** - "**M**aya makes **M**obile apps"
- **Steve** - "**S**teve keeps it **S**ecure"
- **Oliver** - "**O**liver **O**perates servers"
- **Queenie** - "**Q**ueenie ensures **Q**uality"
- **Eric** - "**E**ric's the **E**xecutive"
- **Tony** - "**T**ony leads **T**echnology"
- **Paris** - "**P**aris plans **P**roducts"
- **Daisy** - "**D**aisy manages **D**ata pipelines"
- **Dana** - "**D**ana does **D**ata science"
- **Debbee** - "**D**ebbee **D**esigns beautifully"

---

## Usage Examples

### Using Agent Names

```bash
# Use the agent name from the table above
ax run backend "Design a RESTful API for user management"
ax run frontend "Create a React login component"
ax run security "Review this authentication code"
```

### Using Display Names (Human-Friendly)

```bash
# More memorable! Use the human-friendly display name
ax run Bob "Design a RESTful API for user management"
ax run Frank "Create a React login component"
ax run Felix "Build an end-to-end user registration feature"
ax run Maya "Create a mobile app login screen for iOS and Android"
ax run Steve "Review this authentication code"

# Quality coordination (NEW depth 2 capability)
ax run Queenie "Implement comprehensive E2E tests with security audit"

# Quick help from experts
ax run Eric "Should we prioritize mobile or web?"
ax run Tony "What's our cloud migration strategy?"
ax run Paris "How should we price this feature?"

# Get insights
ax run Daisy "Build an ETL pipeline for user data"
ax run Dana "Analyze our user engagement trends with ML models"
ax run Debbee "Review this dashboard design"
```

---

## Provider Configuration

### Supported AI Providers

| Brand | CLI Tool | Best For |
|-------|----------|----------|
| 🟣 **Claude** | `claude` or `claude-code` | General purpose, coding, analysis, debugging |
| 🟢 **OpenAI** | `codex` | Code generation, planning |
| 🔵 **Gemini** | `gemini` | Creative tasks, multimodal |

### Current Provider Distribution

| AI Provider | Agent Count | Agents |
|-------------|-------------|--------|
| 🔵 **Gemini** (gemini-cli) | 5 | Eric, Paris, Daisy, Dana, Debbee |
| 🟣 **Claude** (claude-code) | 6 | Bob, Frank, Felix, Maya, Oliver, Tony |
| 🟢 **OpenAI** (openai) | 5 | Queenie, Steve, Wendy, Rodman, Cynthia |

---

## Customizing Agents

You can customize any agent or create new ones:

```bash
# Create from template
ax agent create my-assistant --template assistant --interactive

# Or copy an existing agent
cp examples/agents/backend.yaml .automatosx/agents/my-backend.yaml
vim .automatosx/agents/my-backend.yaml
```

Change the `displayName` field to give your agent a memorable name:

```yaml
name: my-backend
displayName: MyBob  # Your custom name!
role: Custom Backend Engineer
maxDelegationDepth: 0  # Choose appropriate depth
```

---

## Next Steps

- Browse `examples/agents/` to see all agent profiles
- Copy agents to `.automatosx/agents/` to use them
- Customize agent personalities and abilities
- Create your own agents with memorable names!

**Pro tip**: You can list all available agents with:

```bash
ax list agents
```

---

**Note**: General-purpose agents (assistant, coder, debugger, reviewer) have been moved to templates (`examples/templates/`) to prevent delegation cycles. Use `ax agent create` to add them when specifically needed for your project.
