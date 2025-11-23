<h1><img src=".github/assets/axlogo.png" alt="AutomatosX Logo" width="36" /> <span style="font-size: 1.5em;">AutomatosX</span></h1>

*Enterprise-Grade AI Control Plane: Orchestrate Multiple AI CLIs + MCP with Observability, Governance & 80% Cost Savings*

**AutomatosX is the enterprise control plane and orchestrator** that transforms isolated AI coding assistants (Claude Code, Gemini CLI, OpenAI Codex) into a unified, observable, and governable AI workforce platform. Purpose-built for **offline-friendly, compliance-ready, and secure** enterprise environments.

[![npm version](https://img.shields.io/npm/v/@defai.digital/automatosx.svg)](https://www.npmjs.com/package/@defai.digital/automatosx)
[![License](https://img.shields.io/badge/license-Apache--2.0-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-2,423+%20passing-brightgreen.svg)](#)
[![npm](https://img.shields.io/npm/dt/%40defai.digital%2Fautomatosx.svg?label=total%20downloads&color=blue)](https://www.npmjs.com/package/@defai.digital/automatosx)
[![macOS](https://img.shields.io/badge/macOS-26.0-blue.svg)](https://www.apple.com/macos)
[![Windows](https://img.shields.io/badge/Windows-10+-blue.svg)](https://www.microsoft.com/windows)
[![Ubuntu](https://img.shields.io/badge/Ubuntu-24.04-blue.svg)](https://ubuntu.com)

**Status**: ✅ **Production Ready** | v9.2.3 | Enterprise MCP Support | Multi-Provider Orchestration

> 🎯 **Primary Design Goal**: Extend **Claude Code's** capabilities (still the best AI coding tool as of Nov 2025) with multi-agent orchestration, persistent memory, and **80% cost savings** through intelligent multi-provider routing.

> 💰 **Cost Strategy**: Use **CLI subscription plans** (Claude Code Pro $20/mo, Gemini Advanced $20/mo, ChatGPT Plus $20/mo) instead of pay-as-you-go API calls. AutomatosX routes tasks to the best provider, saving **80% compared to API-only usage**.

---

## ⚡ What is AutomatosX?

**AutomatosX is NOT just another AI coding assistant.** It's the **enterprise-grade control plane** that sits above your existing AI tools:

```
┌────────────────────────────────────────────────────────────────┐
│                       AutomatosX                                │
│        Enterprise Control Plane & Orchestrator                 │
│  • Multi-Agent Orchestration • Persistent Memory               │
│  • Policy-Based Routing • Complete Observability               │
│  • MCP Server Management • Workflow Automation                 │
└────────────────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────┼─────────────────────┐
        ↓                     ↓                     ↓
  ┌──────────┐          ┌──────────┐          ┌──────────┐
  │  Claude  │          │  Gemini  │          │ OpenAI   │
  │   Code   │          │   CLI    │          │  Codex   │
  └──────────┘          └──────────┘          └──────────┘
        ↓                     ↓                     ↓
  ┌──────────────────────────────────────────────────────┐
  │              Model Context Protocol (MCP)            │
  │   Filesystem • Git • GitHub • Database • Custom      │
  └──────────────────────────────────────────────────────┘
```

### Key Differentiators

| Feature | AutomatosX | Standalone AI Tools |
|---------|------------|---------------------|
| **Role** | Enterprise control plane & orchestrator | Single-point AI assistants |
| **Observability** | Complete trace logging, metrics, governance | Limited visibility |
| **Compliance** | Offline-friendly, data stays local, audit trails | Cloud-dependent |
| **Cost Optimization** | 80% savings via intelligent routing | Pay-as-you-go only |
| **Multi-Provider** | Claude + Gemini + OpenAI + MCP orchestration | Single provider |
| **Memory** | Persistent SQLite FTS5 (< 1ms search) | Context limited to session |
| **Multi-Agent** | 20 specialized agents with delegation | Single general-purpose agent |
| **Workflow Automation** | Declarative YAML specs with DAG execution | Manual coordination |
| **Enterprise MCP** | Lifecycle management, auto-install, monitoring | Basic MCP support |

---

## 🎯 Primary Use Case: Extend Claude Code While Saving Costs

**As of November 2025, Claude Code remains the best AI coding tool in the market.** AutomatosX is primarily designed to **extend Claude Code's capabilities** while **dramatically reducing costs** through intelligent multi-provider routing.

### The Problem: Claude Code Alone is Expensive

```bash
# Using Claude Code directly for everything
Claude Code Pro: $20/mo subscription
API usage (pay-as-you-go): $150-300/mo for heavy users
Total: $170-320/mo
```

### The Solution: AutomatosX + Multi-Provider CLI Plans

```bash
# Using AutomatosX with CLI subscriptions
Claude Code Pro: $20/mo    # For critical reasoning tasks
Gemini Advanced: $20/mo    # For routine code generation
ChatGPT Plus: $20/mo       # For alternative perspectives
Total: $60/mo with AutomatosX routing

Cost savings: 80% ($250/mo saved for heavy users)
```

### How AutomatosX Saves You Money

1. **Intelligent Task Routing**: Routes complex reasoning to Claude, routine tasks to Gemini
2. **CLI Subscription Mode**: Uses unlimited CLI plans instead of per-token API billing
3. **Memory Deduplication**: Persistent memory eliminates redundant context in prompts
4. **Parallel Execution**: Distributes tasks across providers for faster completion
5. **Workflow Automation**: Reduces manual coordination overhead

**Example Cost Comparison** (100K tokens/day heavy user):

| Approach | Monthly Cost | Notes |
|----------|--------------|-------|
| **Claude API Only** | ~$300/mo | $3 per 1M tokens (input) |
| **Claude Code Pro Only** | $20/mo | But limited to Claude ecosystem |
| **AutomatosX + Multi-CLI** | $60/mo | 3 providers with intelligent routing |
| **Savings** | **$240/mo (80%)** | Plus multi-provider redundancy |

---

## 🏢 Enterprise-Grade Features

### 1. **Offline-Friendly & Compliance-Ready**

Unlike cloud-dependent AI tools, AutomatosX is designed for **air-gapped environments** and **regulated industries**:

- ✅ **100% Local-First**: All data stays on your machine (no cloud dependencies)
- ✅ **Offline Execution**: Works without internet (with local models via Ollama)
- ✅ **Audit Trails**: Complete JSONL trace logging for compliance
- ✅ **Data Sovereignty**: No data leaves your infrastructure
- ✅ **GDPR/HIPAA Ready**: Built for regulated environments

### 2. **Complete Observability & Governance**

Transform your "AI agents" into a **governable AI workforce**:

```bash
# Real-time trace logging
ax providers trace --follow

# Output (JSONL format):
# {"timestamp":"2025-11-23T02:30:15.123Z","event":"execution_start","provider":"claude-code","task":"implement auth"}
# {"timestamp":"2025-11-23T02:30:18.456Z","event":"delegation","from":"product","to":"backend"}
# {"timestamp":"2025-11-23T02:30:25.789Z","event":"execution_complete","provider":"gemini-cli","tokens":1234}

# Metrics dashboard
ax mcp metrics --summary

# Resource monitoring
ax mcp limits --show
```

**Observability Features**:
- ✅ Real-time execution traces (JSONL)
- ✅ Token usage tracking (prevent budget overruns)
- ✅ Provider performance metrics (latency, success rate)
- ✅ Resource limit enforcement (CPU, memory)
- ✅ Delegation chains (who did what)
- ✅ Cost attribution (per-agent, per-task)

### 3. **Secure & Sandboxed**

Enterprise-grade security controls:

- ✅ **Filesystem Sandboxing**: Agents can't access paths outside project directory
- ✅ **Resource Limits**: CPU/memory caps per MCP server
- ✅ **Network Restrictions**: Control which APIs agents can call
- ✅ **Dangerous Operation Detection**: Auto-blocks risky operations
- ✅ **Audit Logging**: Every file access, API call, command execution logged

---

## 🚀 Quick Start: 60 Seconds to Enterprise AI Orchestration

```bash
# 1. Install AutomatosX
npm install -g @defai.digital/automatosx

# 2. Initialize in your project
cd your-project
ax setup

# 3. Configure your AI CLI providers (at least one required)
# Option A: Claude Code (recommended - best reasoning)
claude --version  # Ensure Claude Code CLI is installed

# Option B: Gemini CLI (recommended - best cost efficiency)
gemini --version  # Ensure Gemini CLI is installed

# Option C: OpenAI Codex (fastest execution)
codex --version   # Ensure Codex CLI is installed

# Option D: ax-cli (optional - GLM-first native CLI for Chinese models)
ax-cli --version  # See .ax-cli/README.md for setup

# 4. Use with Claude Code (natural language)
# In Claude Code:
"Please use ax to implement user authentication with multi-provider routing"

# 5. Or use CLI directly
ax run backend "implement user authentication"

# 6. View trace logs
ax providers trace --follow
```

---

## 📋 ax-cli Integration (Optional)

**ax-cli** is a **separate GLM-first CLI** for native integration with Chinese AI models (Zhipu GLM, xAI, etc.). It is **completely optional** and **not required** to use AutomatosX.

### When to Use ax-cli?

- ✅ You want native CLI integration with **Zhipu GLM** (智谱清言)
- ✅ You need **multi-provider CLI** support (GLM, xAI, OpenAI, Anthropic, Ollama)
- ✅ You prefer **CLI-first workflows** over API integrations
- ✅ You want **GLM 4.6** as your primary model (cost-effective for Chinese users)

### ax-cli is NOT Required

AutomatosX works perfectly fine with:
- **Claude Code CLI** (recommended for best reasoning)
- **Gemini CLI** (recommended for cost efficiency)
- **OpenAI Codex CLI** (fastest execution)
- **Direct API access** (if you have API keys)

**ax-cli is an optional enhancement**, not a dependency.

### How to Enable ax-cli (Optional)

```bash
# 1. Install ax-cli separately
npm install -g @defai.digital/ax-cli

# 2. Configure ax-cli
ax-cli setup

# 3. Use with AutomatosX
ax run backend "task" --provider ax-cli
```

**Learn More**: See [.ax-cli/README.md](.ax-cli/README.md) for detailed ax-cli setup.

---

## 🔧 Provider Configuration

AutomatosX is a **multi-provider orchestrator**. Configure your preferred providers in `ax.config.json`:

### Recommended Setup (Claude Code + Gemini CLI)

```json
{
  "providers": {
    "default": "claude-code",
    "claude-code": {
      "enabled": true,
      "priority": 1,
      "useCases": ["complex reasoning", "architecture design", "security audit"]
    },
    "gemini-cli": {
      "enabled": true,
      "priority": 2,
      "useCases": ["code generation", "routine refactoring", "test writing"]
    }
  },
  "router": {
    "enableAutomaticFallback": true,
    "taskRouting": {
      "backend": "gemini-cli",      // Route backend tasks to Gemini (cost-efficient)
      "security": "claude-code",    // Route security to Claude (best reasoning)
      "quality": "gemini-cli"       // Route testing to Gemini (fast)
    }
  }
}
```

### Cost-Saving Strategy

**Use CLI subscription plans instead of pay-as-you-go API:**

| Provider | Subscription | API (Pay-as-you-go) | Savings |
|----------|--------------|---------------------|---------|
| **Claude Code** | $20/mo (Pro) | ~$150-300/mo | **80-93% savings** |
| **Gemini** | $20/mo (Advanced) | ~$100-200/mo | **80-90% savings** |
| **ChatGPT** | $20/mo (Plus) | ~$120-250/mo | **83-92% savings** |

**AutomatosX Strategy**: Use **3 CLI subscriptions ($60/mo)** with intelligent routing instead of **1 API provider ($150-300/mo)**. Save **$90-240/mo** while gaining multi-provider redundancy.

---

## 🎨 Core Features

### 1. Multi-Agent Orchestration

20 specialized agents work together automatically:

```bash
# You: Give high-level goal
ax run product "Build complete user authentication"

# Product agent: Designs system architecture
# → Delegates to @backend: "Implement JWT API"
# → Delegates to @security: "Audit implementation"
# → Delegates to @quality: "Write integration tests"

# AutomatosX: Orchestrates execution, routes to best providers, saves to memory
```

**Available Agents**:
- **Backend** (Bob) - Go/Rust systems, API design
- **Frontend** (Frank) - React/Next.js, UI components
- **Security** (Steve) - Threat modeling, penetration testing
- **Quality** (Queenie) - Test planning, QA
- **DevOps** (Oliver) - CI/CD, Kubernetes
- **Product** (Paris) - Requirements, roadmaps
- **Data** (Daisy) - ETL pipelines, data warehouses
- [... 13 more agents](docs/guides/agents.md)

### 2. Persistent Memory (Context That Never Expires)

```bash
# Day 1: Design
ax run product "Design calculator with add/subtract"
# → Automatically saved to SQLite memory

# Day 7: Implement (context auto-injected!)
ax run backend "Implement the calculator"
# → Memory finds "calculator" design from Day 1
# → Zero context repetition, zero wasted tokens
```

**Memory Features**:
- ✅ **Speed**: < 1ms search with SQLite FTS5
- ✅ **Cost**: $0 (no embedding APIs)
- ✅ **Privacy**: 100% local (data never leaves your machine)
- ✅ **Search**: `ax memory search "calculator"`
- ✅ **Export**: `ax memory export > backup.json`

### 3. Workflow Automation with Spec-Kit

Define complex workflows in YAML, execute with one command:

```yaml
# workflow.ax.yaml
metadata:
  id: user-auth-system
  name: User Authentication System

actors:
  - id: backend
    agent: backend
    description: Implement JWT authentication API
    provider: gemini-cli  # Cost-efficient for implementation

  - id: security
    agent: security
    description: Audit authentication implementation
    provider: claude-code  # Best reasoning for security

  - id: quality
    agent: quality
    description: Generate comprehensive test suite
    provider: gemini-cli  # Fast test generation
```

```bash
# Generate execution plan
ax gen plan workflow.ax.yaml

# Execute workflow
ax run workflow.ax.yaml

# AutomatosX automatically:
#   ✅ Routes tasks to optimal providers (cost + performance)
#   ✅ Executes in parallel (3-5x faster)
#   ✅ Saves to persistent memory (zero context repetition)
#   ✅ Logs all executions (complete observability)
```

### 4. Enterprise MCP Server Management

Production-ready Model Context Protocol orchestration:

```bash
# Start AutomatosX as MCP server for Claude Code
ax mcp server

# Install MCP servers automatically
ax mcp install @modelcontextprotocol/server-filesystem
ax mcp install @modelcontextprotocol/server-github

# Monitor server metrics
ax mcp metrics --summary

# Enforce resource limits
ax mcp limits filesystem-server --memory 512 --cpu 50

# View lifecycle events
ax mcp logs --follow
```

**MCP Features**:
- ✅ Lifecycle management (start/stop/restart/crash detection)
- ✅ Auto-installation (npm/yarn/pnpm support)
- ✅ Configuration hot-reload (no restart needed)
- ✅ Performance monitoring (CPU, memory, latency)
- ✅ Resource enforcement (limits + throttling)
- ✅ Security sandboxing (filesystem, network)

---

## 💰 Cost Optimization Examples

### Example 1: Heavy User (100K tokens/day)

**Before AutomatosX** (Claude API only):
```
100K tokens/day × 30 days = 3M tokens/month
3M input tokens × $3/1M = $9/mo
3M output tokens × $15/1M = $45/mo
Total: $54/mo (just for tokens)
Plus Claude Code Pro: $20/mo
Total: $74/mo minimum (likely much higher with real usage)
```

**After AutomatosX** (Multi-provider CLI subscriptions):
```
Claude Code Pro: $20/mo (for critical reasoning tasks - ~20% usage)
Gemini Advanced: $20/mo (for routine tasks - ~70% usage)
ChatGPT Plus: $20/mo (for alternative perspectives - ~10% usage)
Total: $60/mo with unlimited usage
Savings: $14-240/mo depending on API usage patterns
```

### Example 2: Team of 5 Developers

**Before AutomatosX** (API usage):
```
5 developers × $150/mo average API usage = $750/mo
Plus Claude Code Pro subscriptions: 5 × $20 = $100/mo
Total: $850/mo
```

**After AutomatosX** (Shared infrastructure):
```
Claude Code Pro: 5 × $20 = $100/mo
Gemini Advanced: 5 × $20 = $100/mo
ChatGPT Plus: 5 × $20 = $100/mo
Total: $300/mo with unlimited usage
Savings: $550/mo (65% reduction)
```

### Example 3: Enterprise (50 developers)

**Before AutomatosX** (API usage):
```
50 developers × $200/mo average = $10,000/mo
```

**After AutomatosX** (Managed subscriptions + intelligent routing):
```
CLI subscriptions: 50 × $60 = $3,000/mo
AutomatosX Enterprise Support: $500/mo
Total: $3,500/mo
Savings: $6,500/mo (65% reduction)
Annual savings: $78,000/year
```

---

## 🏆 Why AutomatosX Wins

| Capability | AutomatosX | Claude Code | Gemini CLI | Cursor |
|------------|------------|-------------|------------|--------|
| **Role** | Enterprise control plane | AI coding assistant | AI coding assistant | AI editor |
| **Multi-Provider** | ✅ Claude + Gemini + OpenAI + ax-cli | ⚠️ Claude only | ⚠️ Gemini only | ⚠️ Limited |
| **Cost Optimization** | ✅ 80% savings via routing | ❌ Pay-as-you-go | ❌ Pay-as-you-go | ❌ Pay-as-you-go |
| **Persistent Memory** | ✅ SQLite FTS5 < 1ms | ❌ Session-only | ❌ Session-only | ❌ Session-only |
| **Multi-Agent Teams** | ✅ 20 specialists | ❌ Single agent | ❌ Single agent | ❌ Single agent |
| **Workflow Automation** | ✅ YAML specs + DAG | ❌ | ❌ | ❌ |
| **Observability** | ✅ Complete trace logging | ⚠️ Basic | ⚠️ Basic | ⚠️ Basic |
| **MCP Management** | ✅ Enterprise-grade | ⚠️ Basic | ⚠️ Basic | ❌ |
| **Offline-Friendly** | ✅ 100% local | ⚠️ Hybrid | ⚠️ Hybrid | ⚠️ Cloud |
| **Compliance** | ✅ Audit trails, GDPR-ready | ❌ | ❌ | ❌ |
| **Governance** | ✅ Resource limits, sandboxing | ❌ | ❌ | ❌ |

**Bottom Line**: AutomatosX is the **only platform** that combines enterprise control plane, multi-provider orchestration, persistent memory, workflow automation, and complete observability in one tool.

---

## 🗣️ **Recommended**: Use with Claude Code (Natural Language)

AutomatosX is primarily designed to work with **Claude Code** using natural language. This is the **recommended way** to use AutomatosX:

### Natural Language Examples

```
# In Claude Code
"Please use ax to implement user authentication with JWT.
Route implementation to Gemini for cost efficiency, but use Claude
for security audit. Save everything to memory for future reference."

"Work with ax backend agent to build the API. Use Gemini CLI since
this is routine code generation. Enable iterate mode for autonomous execution."

"Use ax to create a workflow spec for microservices architecture.
Route architecture design to Claude (best reasoning), implementation
to Gemini (cost-efficient), and tests to ChatGPT (fast generation)."
```

### What Happens Behind the Scenes

1. Claude Code invokes `ax run "task" --provider gemini-cli`
2. AutomatosX analyzes task complexity and routes to optimal provider
3. Executes with persistent memory for perfect context
4. Saves results for future tasks
5. Returns to Claude Code with full trace logging

**This natural language interface is how we expect users to work with AutomatosX daily.**

---

## 📚 Real-World Use Cases

### 1. Enterprise Multi-Team Coordination

**Scenario**: 5 teams working on microservices architecture

```bash
# Product team defines requirements
ax run product "Design payment microservice with Stripe integration"
# → Saved to memory, delegates to architecture team

# Architecture team designs system
# → Reads product requirements from memory automatically
ax run architecture "Design payment service architecture"
# → Saved to memory, delegates to backend team

# Backend team implements
# → Reads architecture from memory automatically
ax run backend "Implement payment service"
# → Routes to Gemini CLI (cost-efficient for implementation)

# Security team audits
# → Reads implementation from memory automatically
ax run security "Audit payment service"
# → Routes to Claude Code (best reasoning for security)

# Result: Complete coordination with zero manual context passing
# Cost: 80% savings via multi-provider routing
# Compliance: Complete audit trail in trace logs
```

### 2. Offline Air-Gapped Development

**Scenario**: Government/finance project with strict security requirements

```bash
# Configure for offline mode (no internet required)
export AUTOMATOSX_OFFLINE_MODE=true

# Use local models via Ollama
ax config set providers.ollama.enabled true

# All data stays local
ax run backend "implement encryption module"
# → Uses Ollama locally, no cloud API calls
# → All data in .automatosx/ directory (never leaves machine)
# → Complete audit trail for compliance

# Result: 100% air-gapped AI development
```

### 3. Cost-Conscious Startup

**Scenario**: Small startup with limited budget

```bash
# Configure cost-efficient routing
{
  "router": {
    "taskRouting": {
      "backend": "gemini-cli",     // $20/mo unlimited
      "frontend": "gemini-cli",    // Same subscription
      "security": "claude-code",   // $20/mo for critical tasks
      "quality": "gemini-cli"      // Same subscription
    }
  }
}

# Result: $40/mo total for unlimited usage (Claude + Gemini subscriptions)
# vs $300-500/mo with API-only approach
# Savings: 80-92% monthly cost reduction
```

---

## 📖 Documentation

### Getting Started
- **[3-Minute Quickstart](docs/getting-started/quickstart-3min.md)** - Get productive fast
- [Installation Guide](docs/getting-started/installation.md) - Detailed setup
- [Provider Configuration](docs/providers/overview.md) - Configure AI providers

### Core Features
- **[Multi-Provider Routing](docs/guides/routing.md)** - Cost optimization strategies
- [Persistent Memory](docs/guides/agent-communication.md) - Context management
- [Workflow Automation](docs/guides/spec-kit-guide.md) - YAML specs
- [Enterprise MCP](docs/guides/mcp-management.md) - MCP server orchestration

### Advanced
- [Observability Guide](docs/advanced/observability.md) - Trace logging and metrics
- [Security & Compliance](docs/advanced/security.md) - Sandboxing and governance
- [Cost Optimization](docs/advanced/cost-optimization.md) - Advanced routing strategies
- [Offline Deployment](docs/advanced/offline-deployment.md) - Air-gapped environments

### Reference
- [CLI Commands](docs/reference/cli-commands.md) - Complete CLI reference
- [Agent Directory](docs/guides/agents.md) - All 20 specialized agents
- [Provider Comparison](docs/providers/overview.md) - Provider features and costs
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues

---

## 🚦 Production Readiness

✅ **v9.2.3 Released** - ax-cli SDK Phase 2 integration complete
✅ **v8.5.3 Released** - Enterprise MCP Phase 4 complete
✅ **100% Complete** - All core features production-ready
✅ **2,512+ Tests Passing** - Comprehensive test coverage
✅ **TypeScript Strict Mode** - Type-safe codebase
✅ **Zero Resource Leaks** - Clean shutdown guaranteed
✅ **Cross-Platform** - macOS, Windows, Ubuntu
✅ **Local-First** - No cloud dependencies, 100% private
✅ **Enterprise-Ready** - Observability, governance, compliance

---

## 📦 AutomatosX Editions

### Edition Positioning

**Pro** – For teams that meet OSS license terms or want priority maintenance & support.

**Enterprise** – For larger organizations that need compliance, control, and confidence at scale.

---

### 🔷 AutomatosX Pro

**For startups, SMEs, and teams that want stability and support.**

#### Feature Highlights

**Core Platform**:
- ✅ **Priority email support & maintenance** - Dedicated support channel with SLA
- ✅ **Stable, versioned releases (LTS branches)** - Long-term support for production deployments
- ✅ **License-compliant use in commercial products** - Clear licensing for business use

**Advanced Workflows**:
- ✅ **Advanced workflow templates** - SaaS, RAG, API orchestration, CI/CD flows
- ✅ **Multi-project management** - Switch contexts, share and reuse workflow specs
- ✅ **Custom agent packs** - Create team-specific roles and expertise profiles

**Provider & Configuration**:
- ✅ **Per-project provider profiles** - Different Claude/Gemini/Grok/local configs per project
- ✅ **Local memory encryption** - Secure persistent memory with encryption at rest
- ✅ **Backup & restore** - Export/import workflows and memory for disaster recovery

**Observability & Tooling**:
- ✅ **Run history & basic usage dashboard** - Track execution history per machine
- ✅ **MCP auto-install & hot-reload** - Automatic MCP server management on local machine

**Perfect for**: Startups, consultancies, product teams building AI-powered features

---

### 🏢 AutomatosX Enterprise

**For organizations where "Enterprises don't pay for security. They pay for compliance, convenience, and confidence."**

#### Compliance & Governance

**Audit & Control**:
- ✅ **Centralized control plane (self-hosted)** - Organization-wide management and oversight
- ✅ **Org-wide workflow catalog with approvals** - Governed workflow library with review process
- ✅ **SSO (SAML / OIDC) & granular RBAC** - Enterprise authentication and role-based access
- ✅ **Audit-grade logs** - Complete trail of who ran what, when, with which data
- ✅ **Data retention & deletion policies** - Per-project and per-team data lifecycle management

**Data Protection**:
- ✅ **PII masking / DLP hooks** - Data loss prevention before memory storage
- ✅ **Compliance-ready architecture** - Built for GDPR, HIPAA, SOC2 requirements

#### Convenience & Control

**Infrastructure Management**:
- ✅ **Multi-node agent management** - Manage agents across dev laptops, CI runners, build servers
- ✅ **Central provider routing & failover policies** - Org-wide intelligent routing with automatic failover
- ✅ **Quota & rate limits** - Control usage by team, project, or individual user
- ✅ **Central MCP registry** - Health monitoring, version management, usage tracking

**Observability at Scale**:
- ✅ **Org dashboards** - Real-time visibility into runs, success rates, latency, token usage
- ✅ **OpenTelemetry / SIEM integration** - Export to Prometheus, Splunk, Datadog, etc.
- ✅ **Advanced analytics** - Cost attribution, performance trends, compliance reporting

#### Confidence & Support

**Enterprise Infrastructure**:
- ✅ **Hardened, self-hosted deployment** - Docker and Helm charts for air-gapped environments
- ✅ **HA / backup & disaster recovery** - High availability with automated failover and backup
- ✅ **Multi-region support** - Deploy across geographies for data sovereignty

**Premium Support**:
- ✅ **Enterprise SLA & named technical contact** - Guaranteed response times with dedicated engineer
- ✅ **Onboarding workshops & best-practice playbooks** - Expert guidance for successful adoption
- ✅ **Optional design partnership** - Influence roadmap and get custom features developed

**Perfect for**: Regulated industries (finance, healthcare, government), enterprises with strict compliance requirements, organizations needing centralized AI governance

---

### 🆚 Edition Comparison

| Feature | Open Source | Pro | Enterprise |
|---------|-------------|-----|------------|
| **Core Orchestration** | ✅ Full | ✅ Full | ✅ Full |
| **Multi-Provider Support** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Persistent Memory** | ✅ Yes | ✅ Encrypted | ✅ Encrypted + DLP |
| **MCP Management** | ✅ Local | ✅ Auto-install | ✅ Central registry |
| **Support** | Community | Priority email | Enterprise SLA |
| **LTS Releases** | ❌ No | ✅ Yes | ✅ Yes + backports |
| **Multi-Project** | Manual | ✅ Managed | ✅ Org catalog |
| **Custom Agents** | DIY | ✅ Agent packs | ✅ Org library |
| **Observability** | Local logs | ✅ Dashboard | ✅ SIEM integration |
| **Deployment** | Local only | Local only | ✅ Self-hosted cluster |
| **SSO / RBAC** | ❌ No | ❌ No | ✅ Yes |
| **Audit Logs** | Basic | Basic | ✅ Compliance-grade |
| **Data Governance** | ❌ No | ❌ No | ✅ Full DLP + policies |
| **Pricing** | Free (OSS) | Contact sales | Contact sales |

---

### 📞 Get Started with Pro or Enterprise

**AutomatosX Pro**: Perfect for commercial teams that need stability and support
- Email: sales@defai.digital
- Subject: "AutomatosX Pro - Pricing Inquiry"

**AutomatosX Enterprise**: For organizations requiring compliance and governance at scale
- Email: sales@defai.digital
- Subject: "AutomatosX Enterprise - Compliance Discussion"

**Questions about licensing?** See [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md) for detailed terms.

---

## 💻 Installation

### NPM (Recommended)

```bash
npm install -g @defai.digital/automatosx
ax --version  # v9.2.3
```

### ⚠️ REQUIRED: Initialize Your Project

```bash
cd your-project
ax setup
```

**What `ax setup` does:**
- ✅ Creates `.automatosx/` directory structure
- ✅ Installs all 20 specialized agents
- ✅ Generates `ax.config.json` with optimal defaults
- ✅ Initializes SQLite memory database
- ✅ Sets up trace logging and observability

### Requirements

- **Node.js**: >= 24.0.0
- **At least one AI CLI** (recommended):
  - [Claude Code](https://claude.ai/code) (best reasoning - **recommended**)
  - [Gemini CLI](https://ai.google.dev/gemini-api/docs/cli) (cost-efficient)
  - [OpenAI Codex](https://platform.openai.com/docs/guides/code) (fastest)
  - [ax-cli](.ax-cli/README.md) (optional - GLM-first native CLI)

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
git clone https://github.com/defai-digital/automatosx.git
cd automatosx
npm install
npm run dev -- run backend "test task"
npm test
```

---

## 📄 License

AutomatosX is dual-licensed:

- **Apache License 2.0** - See [LICENSE](LICENSE) for code licensing
- **Commercial License with OpenRAIL-M** - See [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md)

**TL;DR**:
- ✅ FREE for research, academic use, personal projects, startups < $2M revenue
- ❌ Commercial license required for companies ≥ $2M revenue/funding

**Need a commercial license?** Contact us for pricing and distribution:
- Email: <sales@defai.digital>
- Subject: "AutomatosX Commercial License Inquiry"

Copyright 2025 DEFAI Private Limited

---

## 🌟 Star Us on GitHub

If AutomatosX saves you 80% on AI costs and transforms your AI workflow, give us a star! ⭐

[⭐ Star on GitHub](https://github.com/defai-digital/automatosx)

---

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/defai-digital/automatosx/issues)
- **Email**: <support@defai.digital>
- **Commercial Licenses**: <sales@defai.digital>

---

<p align="center">
  Made with ❤️ by <a href="https://defai.digital">DEFAI Digital</a>
</p>
