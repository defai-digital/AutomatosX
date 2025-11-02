# GEMINI.md

This file provides guidance to Gemini CLI users for interacting with the AutomatosX platform within this repository.

---

<!-- AutomatosX Integration v6.3.8 - Generated 2025-10-31 -->

# AutomatosX Integration Guide for Gemini CLI

This project uses [AutomatosX](https://github.com/defai.digital/automatosx), an AI agent orchestration platform with persistent memory and multi-agent collaboration. This guide explains how to use AutomatosX effectively within the Gemini CLI environment.

## 1. Quick Start

You can interact with AutomatosX agents using slash commands, which is the recommended method.

### Key Slash Commands

| Command | Description | Example |
|---|---|---|
| `/ax <agent>, <task>` | Execute a task with a specific agent. | `/ax backend, create a REST API for users` |
| `/ax-status` | Check the AutomatosX system status. | `/ax-status` |
| `/ax-list agents` | List all available agents. | `/ax-list agents` |
| `/ax-memory search <query>` | Search conversation history. | `/ax-memory search auth` |

### Natural Language

While slash commands are recommended for clarity, you can also use natural language:
- *"Ask the backend agent to create a REST API for user management."*
- *"Have the quality agent write unit tests for the API."*

## 2. Available Agents

This project is equipped with a suite of specialized agents. Use the right agent for the job.

| Agent | ID | Nickname | Purpose |
|---|---|---|---|
| **Backend** | `backend` | Bob | Go/Rust systems development |
| **Frontend** | `frontend` | Frank | React/Next.js/Swift development |
| **Full-stack** | `fullstack` | Felix | Node.js/TypeScript development |
| **Mobile** | `mobile` | Maya | iOS/Android (Swift/Kotlin/Flutter) |
| **Security** | `security` | Steve | Security auditing and threat modeling |
| **Quality** | `quality` | Queenie | QA and testing |
| **Product** | `product` | Paris | Product management and feature design |
| **Architecture** | `architecture` | Avery | System architecture and ADRs |
| **DevOps** | `devops` | Oliver | CI/CD, infrastructure, and operations |
| **Writer** | `writer` | Wendy | Technical writing and documentation |
| **Data** | `data` | Daisy | Data engineering and ETL pipelines |
| **Design** | `design` | Debbee | UX/UI design |
| **CTO** | `cto` | Tony | Technical strategy |
| **CEO** | `ceo` | Eric | Business leadership |
| **Researcher** | `researcher` | Rodman | Research and analysis |
| **Data Scientist**| `data-scientist`| Dana | Machine learning and data science |
| **Aerospace** | `aerospace-scientist`| Astrid | Aerospace engineering |
| **Quantum** | `quantum-engineer`| Quinn | Quantum computing |
| **Marketing** | `creative-marketer`| Candy | Creative marketing and content |
| **Standards** | `standard` | Stan | Standards and best practices |

To get a real-time list of agents and their capabilities, run:
```bash
ax list agents --format json
```

## 3. Core Concepts

### Persistent Memory
Agents remember past conversations, allowing for context-aware interactions. A design created by the `product` agent can be seamlessly picked up by the `backend` agent for implementation.

**Example:**
1.  `/ax product, design a calculator with add/subtract features`
2.  *(Later)* `/ax backend, implement the calculator API based on the recent design`

### Multi-Agent Collaboration
Agents can delegate tasks to one another. A high-level request to the `product` agent can trigger a chain of events where `backend` implements the feature and `security` audits it.

**Example:**
```
/ax product, build a complete user authentication feature
```
This command will orchestrate multiple agents to fulfill the request.

## 4. Workspace Conventions

To maintain project organization, please adhere to these directory conventions:

- **`automatosx/PRD/`**: For **P**roduct **R**equirement **D**ocuments, architecture designs, and other planning artifacts. These files are tracked by Git.
  - **Example**: `/ax product, save the architecture design to automatosx/PRD/user-auth-design.md`

- **`automatosx/tmp/`**: For temporary files, code drafts, and intermediate outputs. This directory is ignored by Git and is cleaned periodically.
  - **Example**: `/ax backend, put the draft implementation in automatosx/tmp/auth-draft.ts for review`

## 5. Troubleshooting

- **"Agent not found"**: Run `/ax-list agents` to see the correct agent IDs. Agent names are case-sensitive.
- **"Slash command not working"**: Your Gemini CLI commands may be out of sync. Run `ax gemini sync-mcp` in your terminal and restart the Gemini CLI.
- **"Out of memory"**: Clear the memory cache by running `/ax-clear`.

## 6. Full Documentation

For more in-depth information, refer to the complete **[AutomatosX Integration Guide (AX-GUIDE.md)](AX-GUIDE.md)**, which covers:
- Advanced features like parallel execution and resumable runs.
- Detailed configuration options in `automatosx.config.json`.
- In-depth guides for all platform integrations.

---
**Quick Links**
- **GitHub Repository**: https://github.com/defai-digital/automatosx
- **NPM Package**: https://www.npmjs.com/package/@defai.digital/automatosx