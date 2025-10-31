# Core Concepts

Understand the fundamental concepts of AutomatosX to build powerful AI agents.

---

## Overview

AutomatosX is built around a few core concepts:

1. **Agents** - AI entities with specific roles and capabilities
2. **Profiles** - YAML configuration files that define agent behavior
3. **Abilities** - Reusable skills that agents can use
4. **Memory** - Persistent storage with FTS5 full-text search
5. **Providers** - AI service backends (Claude, Gemini, Codex)
6. **Workspaces** - Isolated execution environments
7. **Teams** - Organizational groups with shared configuration (v4.10.0+)

---

## Agents

### What is an Agent?

An **agent** is an AI entity configured to perform specific tasks. Each agent has:

- A **role** (assistant, coder, reviewer, etc.)
- A **system prompt** that defines its behavior
- A set of **abilities** it can use
- Access to **memory** for context
- A designated **AI provider** (Claude, Gemini, etc.)

### Agent Characteristics

**Single-Purpose**: Each agent is designed for a specific task

- ✅ `assistant` - General help and conversation
- ✅ `coder` - Code generation and refactoring
- ✅ `reviewer` - Code review and analysis
- ✅ `debugger` - Finding and fixing bugs
- ✅ `writer` - Content creation and editing

**Stateless Execution**: Each run is independent

- Agents don't maintain state between runs
- Use **memory** for persistence
- Each execution starts fresh

**Provider-Backed**: Agents use AI providers for intelligence

- Claude (Anthropic) - Best for reasoning and code (200K context)
- Gemini (Google) - Fast and versatile (2M context)
- OpenAI Codex - Code generation and specialized tasks

---

## Profiles

### What is a Profile?

A **profile** is a YAML file that defines an agent's configuration.

### Profile Structure

```yaml
# .automatosx/agents/backend.yaml
name: backend
version: 1.0.0
description: Backend development specialist

# Model configuration
model:
  provider: claude
  command: claude
  temperature: 0.7
  maxTokens: 4096

# System prompt defines behavior
system: |
  You are a helpful AI assistant. You provide accurate,
  concise answers. Be friendly but professional.

# Abilities the agent can use
abilities:
  - web-search
  - code-analysis
  - file-operations

# Memory configuration
memory:
  enabled: true
  contextSize: 10

# Execution settings
execution:
  timeout: 120000
  retries: 3
  stream: false
```

### Key Components

**Basic Info**:

- `name` - Unique identifier for the agent
- `version` - Profile version (for tracking changes)
- `description` - What the agent does

**Model Settings**:

- `provider` - Which AI service to use
- `name` - Specific model name
- `temperature` - Creativity (0.0-1.0)
- `maxTokens` - Response length limit

**System Prompt**:

- Defines agent's personality and behavior
- Instructions for how to respond
- Guidelines and constraints

**Abilities**:

- List of skills the agent can use
- Loaded from `.automatosx/abilities/`
- Injected into agent's context

**Memory**:

- Whether to use memory system
- How many past interactions to include
- Context window size

---

## Abilities

### What is an Ability?

An **ability** is a reusable skill that agents can use. Abilities are defined in Markdown files.

### Ability Structure

```markdown
# Web Search

Search the web for information using a search API.

## Usage

search(query: string, options?: SearchOptions): SearchResult[]

## Parameters

- `query` (string, required) - Search query
- `options.maxResults` (number, optional) - Max results (default: 10)
- `options.safeSearch` (boolean, optional) - Enable safe search (default: true)

## Returns

Array of search results with:
- `title` - Result title
- `url` - Result URL
- `snippet` - Content preview
- `relevance` - Relevance score (0-1)

## Example

```javascript
// Search for TypeScript documentation
const results = search("TypeScript documentation", {
  maxResults: 5,
  safeSearch: true
});

results.forEach(r => {
  console.log(`${r.title}: ${r.url}`);
});
```

## Error Handling

- `RateLimitError` - Too many requests
- `NetworkError` - Connection failed
- `InvalidQueryError` - Query too short or invalid

## Best Practices

1. Keep queries specific and clear
2. Limit results to what you need
3. Handle errors gracefully
4. Cache results when possible

```

### Why Abilities?

**Reusability**: Define once, use in multiple agents
```yaml
# backend.yaml
abilities:
  - web-search
  - code-analysis

# coder.yaml
abilities:
  - code-analysis
  - file-operations
  - git-operations
```

**Modularity**: Easy to add/remove capabilities

```yaml
# Before
abilities:
  - web-search

# After - add database access
abilities:
  - web-search
  - database-query
```

**Documentation**: Built-in usage examples

- Clear API documentation
- Parameter specifications
- Error handling guidelines

---

## Memory

### What is Memory?

**Memory** is AutomatosX's persistent storage system using **SQLite FTS5** for fast, local full-text search.

**v4.11.0 Update**: Vector search has been removed. AutomatosX now uses pure FTS5 full-text search for faster performance (< 1ms) and no embedding costs.

### Memory Operations

**Add Memory**: Store information with metadata

```bash
# Add a memory
automatosx memory add "TypeScript is a typed superset of JavaScript" \
  --type knowledge \
  --tags programming,typescript

# Search by tags
automatosx memory list --tags typescript
```

**Text Search**: Fast local full-text search with FTS5

```bash
# Search by text query (< 1ms, all local, no API calls)
automatosx memory search "benefits of static typing"

# Returns relevant memories ranked by FTS5 relevance score
# - "TypeScript is a typed superset of JavaScript"
# - "Static typing catches errors at compile time"
# - "Type systems improve code quality"

# v5.0.1+: Enhanced special character support
automatosx memory search "config.json settings"  # Works!
automatosx memory search "timeout (300ms)"       # Works!
```

### Memory Structure

Each memory entry contains:

```javascript
{
  id: 1,
  content: "TypeScript is a typed superset of JavaScript",
  metadata: {
    type: "knowledge",        // conversation, code, document, task
    tags: ["programming", "typescript"],
    source: "assistant",       // which agent created it
    createdAt: "2025-10-06T...",
    accessedAt: "2025-10-06T...",
    accessCount: 5
  },
  similarity: 0.89  // FTS5 relevance score (when returned from search)
}
```

### Memory in Agent Context

When an agent runs with memory enabled:

1. AutomatosX searches for relevant past interactions
2. Top N most relevant memories are loaded
3. Memories are injected into agent's context
4. Agent uses past knowledge to inform response

Example:

```yaml
# agent profile
memory:
  enabled: true
  contextSize: 10  # Include 10 most relevant memories
```

### Storage Details

- **Database**: SQLite with FTS5 full-text search
- **Location**: `.automatosx/memory/memory.db`
- **Size**: ~2-5MB for 10,000 entries
- **Performance**: < 1ms average query latency
- **Privacy**: 100% local, no external API calls

---

## Providers

### What is a Provider?

A **provider** is an AI service backend that powers agents.

### Supported Providers

**Claude** (Anthropic):

- Best for: Reasoning, code generation, long context
- CLI uses latest available model automatically
- Access: Via `claude` CLI command

**Gemini** (Google):

- Best for: Fast responses, multimodal tasks
- CLI uses latest available model automatically
- Access: Via `gemini` CLI command

**Codex**:

- Best for: Planning and code generation
- CLI uses latest available model automatically
- Access: Via `codex` CLI command

### Provider Configuration

```json
{
  "providers": {
    "claude-code": {
      "enabled": true,
      "priority": 1,      // Try first
      "timeout": 120000,   // 2 minutes
      "command": "claude"
    },
    "gemini-cli": {
      "enabled": true,
      "priority": 2,      // Fallback
      "timeout": 180000,   // 3 minutes
      "command": "gemini"
    }
  }
}
```

### Provider Selection

**Automatic**: Based on priority

```bash
# Uses highest priority enabled provider
automatosx run backend "Hello"
```

**Manual Override**: Specify provider

```bash
# Force use of Gemini
automatosx run backend "Hello" --provider gemini
```

**Fallback**: If provider fails

```
1. Try claude-code (priority 1)
   ↓ (fails)
2. Try gemini-cli (priority 2)
   ↓ (fails)
3. Error: All providers failed
```

---

## Workspaces

### What is a Workspace?

A **workspace** is an isolated directory where an agent can write files.

### Security Model

**Read Access**: Agents can read from:

- ✅ Project root (validated paths)
- ✅ User-specified files
- ❌ System files (blocked)
- ❌ Parent directories via `../` (blocked)

**Write Access** (v5.2+): Agents write to shared workspaces:

- ✅ PRD workspace: `automatosx/PRD/` (planning documents)
- ✅ Tmp workspace: `automatosx/tmp/` (temporary files)
- ❌ Project files (blocked without explicit permission)
- ❌ System files (blocked)

### Workspace Structure (v5.2+)

```
automatosx/
├── PRD/                # Shared planning documents
│   ├── requirements.md
│   ├── architecture.md
│   └── design-specs/
└── tmp/                # Temporary files (auto-cleanup)
    ├── draft-code.ts
    ├── analysis.json
    └── scratch-notes.md
```

### Why This Structure?

**Collaboration**: All agents share the same workspace

```bash
# All agents can read/write to PRD
echo "requirements" > automatosx/PRD/requirements.md

# All agents can use tmp for temporary work
echo "draft" > automatosx/tmp/draft.md
```

**Automatic Cleanup**: Tmp files are automatically cleaned up

```bash
# Files older than 7 days are removed automatically
# (configurable via workspace.tmpCleanupDays)
```

**Path Validation**: All writes are validated for security

```bash
# Agents can't escape the workspace
# Path traversal attempts (../) are blocked
# Absolute paths are rejected
```

---

## How It All Works Together

### Example Flow

1. **User Request** (via Claude Code):

   ```
   "Can you help me refactor this code?"
   ```

2. **Claude Code Executes**:

   ```bash
   automatosx run coder "Refactor the login function for better readability"
   ```

3. **AutomatosX**:
   - Loads `coder` profile from `.automatosx/agents/coder.yaml`
   - Loads abilities: `code-analysis`, `file-operations`
   - Searches memory for relevant past code reviews
   - Provides access to shared workspaces: `automatosx/PRD/` and `automatosx/tmp/`

4. **AI Provider** (Claude):
   - Receives system prompt + abilities + memory context + user request
   - Generates refactored code
   - Can write output to shared workspace (with path validation)

5. **AutomatosX**:
   - Returns response to Claude Code
   - Saves interaction to memory
   - Logs execution details

6. **Claude Code**:
   - Displays result to user
   - User can review changes in workspace

### Data Flow

```
User → Claude Code → AutomatosX → AI Provider
                          ↓
                      Memory DB
                          ↓
                      Workspace
                          ↓
                      Logs
```

---

## Best Practices

### Agent Design

**Do**:

- ✅ Create specialized agents for specific tasks
- ✅ Write clear, detailed system prompts
- ✅ Use temperature 0.3-0.7 for focused tasks
- ✅ Enable memory for context-aware responses

**Don't**:

- ❌ Create generic "do everything" agents
- ❌ Use vague system prompts
- ❌ Set temperature too high (> 0.9) for code tasks
- ❌ Disable memory if context matters

### Ability Design

**Do**:

- ✅ Document parameters clearly
- ✅ Provide usage examples
- ✅ Include error handling
- ✅ Keep abilities focused (single responsibility)

**Don't**:

- ❌ Create overlapping abilities
- ❌ Mix multiple concerns in one ability
- ❌ Forget to document edge cases

### Memory Usage

**Do**:

- ✅ Tag memories for easy retrieval
- ✅ Use descriptive content
- ✅ Clean up old memories periodically
- ✅ Export/backup important memories

**Don't**:

- ❌ Store sensitive information
- ❌ Let memory grow unbounded
- ❌ Use special FTS5 operators without sanitization (v5.0.1+ handles this automatically)

---

## Teams (v4.10.0+)

### What is a Team?

A **team** is an organizational group that provides shared configuration for agents. Teams eliminate configuration duplication by centralizing provider settings and shared abilities.

### Built-in Teams

AutomatosX includes 4 built-in teams:

- **core**: Quality assurance specialists (primary: claude)
- **engineering**: Software development teams (primary: codex)
- **business**: Business and product teams (primary: gemini)
- **design**: Design and content teams (primary: gemini)

### Team Benefits

**No Configuration Duplication**:
```yaml
# Before v4.10.0 - Repeat for every agent
provider: codex
temperature: 0.7
maxTokens: 4096

# v4.10.0+ - Inherit from team
team: engineering  # Gets provider + shared abilities automatically
```

**Centralized Management**: Change provider for entire team at once

**Shared Abilities**: Team-wide abilities automatically included in all team agents

### Agent Template System (v5.0.0+)

Create agents quickly using pre-built templates:

```bash
# Interactive creation
ax agent create backend --template developer --interactive

# One-line creation
ax agent create backend \
  --template developer \
  --display-name "Bob" \
  --team engineering

# List templates
ax agent templates
```

**5 Available Templates**: basic-agent, developer, analyst, designer, qa-specialist

---

## Next Steps

- **Quick Start**: [Quick Start Guide](./quick-start.md)
- **Tutorials**: [Creating Your First Agent](../tutorials/first-agent.md)
- **Reference**: [CLI Commands](../reference/cli-commands.md)
- **Advanced**: [Advanced Usage](../tutorials/advanced-usage.md)

---

**Questions?** Check the [Troubleshooting Guide](../troubleshooting/common-issues.md) or [open an issue](https://github.com/defai-digital/automatosx/issues).
