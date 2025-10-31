# Agent Communication & Memory System

**Status**: Stable (v4.11.0+)
**Last Updated**: 2025-10-10

---

## Overview

AutomatosX agents communicate through two complementary systems:

1. **Direct Prompt Passing**: Real-time agent-to-agent communication (delegation)
2. **SQLite Memory (FTS5)**: Long-term knowledge base for contextual awareness

This guide explains how both systems work and when to use each.

---

## Communication Architecture

### Three-Layer Communication Model

```
┌─────────────────────────────────────────────────────────┐
│                  Communication Layers                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Direct Prompt Passing (Current Task)                │
│     Purpose: Agent-to-agent delegation                  │
│     Storage: In-memory (ephemeral)                      │
│     Speed:   Instant                                     │
│     Example: "Paris → Sofia: Implement calculator"       │
│                                                          │
│  2. SQLite Memory (Long-Term Knowledge)                 │
│     Purpose: Contextual awareness, learning             │
│     Storage: .automatosx/memory/memory.db               │
│     Speed:   < 1ms search                               │
│     Example: "What did we decide about auth?"           │
│                                                          │
│  3. Workspace Files (Shared Artifacts)                  │
│     Purpose: File-based collaboration                   │
│     Storage: automatosx/PRD/ and automatosx/tmp/       │
│     Speed:   10-50ms I/O                                │
│     Example: Shared code, docs, data                    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Direct Prompt Passing (Delegation)

### How It Works

When one agent delegates to another, the communication happens **in-memory** through direct text passing:

```typescript
// Flow: Paris → Sofia
Paris Response:
  "Here's my calculator specification...
   DELEGATE TO @backend: Implement this in TypeScript"
         ↓
  DelegationParser extracts: {
    toAgent: "backend",
    task: "Implement this in TypeScript"
  }
         ↓
  AgentExecutor creates context for Sofia:
    context.task = "Implement this in TypeScript"
         ↓
  Sofia receives prompt with:
    - Paris's full specification (as context)
    - The delegation task
    - Sofia's own abilities
```

### What Gets Passed

The delegated agent receives:

1. **Task text**: The specific instruction from delegating agent
2. **Full context**: The delegating agent's complete response
3. **Abilities**: The delegated agent's configured skills
4. **Memory**: Relevant past conversations (from SQLite)

### Execution Flow

```typescript
// 1. Primary agent responds with delegation
const parisResponse = `
  # Calculator Specification
  - add(a, b): Returns sum
  - subtract(a, b): Returns difference

  DELEGATE TO @backend: Implement based on spec above
`;

// 2. DelegationParser extracts delegation
const delegation = {
  toAgent: "backend",
  task: "Implement based on spec above"
};

// 3. ContextManager builds Sofia's context
const context = {
  agent: backend,
  task: "Implement based on spec above",
  memory: [/* relevant past work */],
  abilities: [/* Sofia's skills */],
  // ... other context
};

// 4. AgentExecutor runs Sofia
const backendResult = await executor.execute(context);

// 5. Results appended to Paris's response
parisResponse += `
  ## Delegation Results
  ### Sofia's Implementation
  ${backendResult.content}
`;
```

### Communication Properties

| Property | Value |
|----------|-------|
| **Storage** | In-memory (RAM) |
| **Persistence** | No (ephemeral) |
| **Speed** | Instant (no I/O) |
| **Cost** | $0 |
| **Use Case** | Current task delegation |
| **Session tracking** | Yes (metadata in JSON) |

### Example: Multi-Step Delegation

```typescript
// User → Product Manager
User: "Create auth feature"

// PM → Backend + Frontend (parallel delegation)
PM Response:
  "Auth feature plan:
   - JWT tokens
   - OAuth2 integration

   @backend Implement JWT auth API
   @frontend Create login UI"

// Backend receives:
Context {
  task: "Implement JWT auth API",
  memory: [past auth discussions],
  abilities: [api-design, database, security]
}

// Frontend receives:
Context {
  task: "Create login UI",
  memory: [past UI patterns],
  abilities: [react, styling, forms]
}

// Results merged:
PM Response + Backend Result + Frontend Result
```

---

## SQLite Memory System (FTS5)

### Purpose

Memory provides **contextual awareness** by storing and retrieving past conversations, enabling agents to:

- Learn from past work
- Maintain project continuity
- Share knowledge across agents
- Avoid repeating mistakes

### Architecture

```
┌─────────────────────────────────────────────┐
│           SQLite Database                    │
│   .automatosx/memory/memory.db              │
├─────────────────────────────────────────────┤
│                                              │
│  memory_entries Table                       │
│  ├─ id: INTEGER PRIMARY KEY                 │
│  ├─ content: TEXT (conversation)            │
│  ├─ metadata: JSON                          │
│  ├─ created_at: INTEGER                     │
│  ├─ access_count: INTEGER                   │
│  └─ last_accessed_at: INTEGER               │
│                                              │
│  memory_fts Table (FTS5 Virtual)            │
│  ├─ Full-text search index                  │
│  ├─ BM25 ranking algorithm                  │
│  └─ < 1ms search performance                │
│                                              │
└─────────────────────────────────────────────┘
```

### Memory Entry Structure

```typescript
interface MemoryEntry {
  id: number;
  content: string;  // Full conversation
  metadata: {
    type: 'conversation' | 'code' | 'document' | 'task';
    source: 'agent-execution' | 'user-input' | 'delegation';
    agentId: string;
    tags: string[];
    provider: string;
    timestamp: string;
  };
  createdAt: Date;
  accessCount: number;
}
```

### Example Memory Entry

```json
{
  "id": 14,
  "content": "Agent: paris\nTask: Create calculator spec\n\nResponse: # Calculator Spec\n- add(a,b)...",
  "metadata": {
    "type": "conversation",
    "source": "agent-execution",
    "agentId": "paris",
    "tags": ["agent-execution", "paris"],
    "provider": "gemini-cli",
    "timestamp": "2025-10-10T04:59:16.894Z"
  },
  "createdAt": "2025-10-10T04:59:16.894Z",
  "accessCount": 3
}
```

### How Memory is Used

#### 1. Automatic Context Injection

Every agent execution automatically searches memory:

```typescript
// context-manager.ts:196-230
async injectMemory(context, task, limit = 5) {
  // Search memory using FTS5
  const results = await memoryManager.search({
    text: task,      // Search based on current task
    limit: 5         // Top 5 most relevant entries
  });

  // Add to execution context
  context.memory = results;
}
```

#### 2. Memory in Agent Prompt

Memory is automatically injected into the agent's prompt:

```
# Relevant Context from Memory

## Memory 1 (relevance: 85.2%)
Agent: paris
Task: Design authentication system
Response: JWT tokens with OAuth2...

## Memory 2 (relevance: 72.1%)
Agent: bob
Task: Implement auth API
Response: Created /api/auth endpoints...

# Your Abilities
[abilities...]

# Task
Implement user login feature
```

#### 3. Search Performance

FTS5 provides fast keyword-based search:

```typescript
// Search query
await memory.search({
  text: "authentication JWT",
  limit: 10,
  filters: {
    type: 'conversation',
    agentId: 'bob'
  }
});

// Results ranked by relevance (BM25 algorithm)
// Search time: < 1ms
// Cost: $0 (no API calls)
```

### Memory Lifecycle

#### Storage Flow

```
1. Agent executes task
   ↓
2. Response generated
   ↓
3. Save to memory:
   - Content: task + response
   - Metadata: agent, type, tags, timestamp
   ↓
4. FTS5 automatically indexes (via SQLite trigger)
   ↓
5. Available for future searches
```

#### Retrieval Flow

```
1. User provides new task
   ↓
2. ContextManager searches memory
   - Query: Task keywords
   - Limit: 5 entries (default)
   ↓
3. FTS5 returns ranked results
   ↓
4. Results injected into agent prompt
   ↓
5. Agent receives relevant past context
```

### FTS5 Technology

**Full-Text Search 5** (FTS5) is SQLite's built-in search engine:

```sql
-- Create FTS5 index
CREATE VIRTUAL TABLE memory_fts USING fts5(content, metadata);

-- Search example
SELECT * FROM memory_fts
WHERE content MATCH 'authentication JWT tokens'
ORDER BY rank;

-- Automatic indexing via triggers
CREATE TRIGGER memory_fts_insert AFTER INSERT ON memory_entries
BEGIN
  INSERT INTO memory_fts(rowid, content, metadata)
  VALUES (new.id, new.content, new.metadata);
END;
```

**Features**:
- ✅ Keyword matching with ranking (BM25)
- ✅ Boolean operators (AND, OR, NOT)
- ✅ Phrase search ("exact phrase")
- ✅ Prefix matching (auth*)
- ✅ < 1ms search time
- ✅ No external dependencies
- ✅ Zero API costs

**Performance Comparison**:

| Method | Search Time | Bundle Size | API Costs |
|--------|-------------|-------------|-----------|
| **FTS5 (v4.11.0+)** | < 1ms | 0 MB | $0 |
| Vector (v3.x) | 45ms | +300 MB | $0.0001/1K tokens |

---

## When to Use Each System

### Use Direct Prompt Passing For:

✅ **Current task delegation**
```typescript
"@frontend Create login UI based on this spec"
```

✅ **Real-time collaboration**
```typescript
"@backend Implement API, then @frontend integrate it"
```

✅ **Passing specifications**
```typescript
"Here's the design: [spec]
 @coder Implement this design"
```

### Use Memory System For:

✅ **Learning from past work**
```typescript
Memory: "Last time we used JWT for auth"
Agent: "I'll use JWT tokens again for consistency"
```

✅ **Project continuity**
```typescript
Week 1: Design saved to memory
Week 2: Agent auto-recalls design
```

✅ **Cross-agent knowledge sharing**
```typescript
Paris designs → Memory
Bob implements → Reads Paris's design from memory
```

✅ **Avoiding repeated mistakes**
```typescript
Memory: "Bug: forgot input validation"
Agent: "I'll add input validation this time"
```

### Use Workspaces For:

✅ **File-based collaboration**
```typescript
Backend writes: api-spec.md
Frontend reads: api-spec.md
```

✅ **Shared artifacts**
```typescript
Code files, documentation, data files
```

---

## Real-World Examples

### Example 1: Continuity Across Days

```
Day 1:
  User → Paris: "Design auth system"
  Paris creates design
  → Saved to memory automatically

Day 2:
  User → Bob: "Implement auth"
  Memory search finds Paris's design
  Bob receives: "Relevant Context: Paris's auth design..."
  Bob implements based on design
  ✅ Seamless continuity without user re-explaining
```

### Example 2: Multi-Agent Collaboration

```
Week 1: Paris (Product) defines requirements
        → Memory: "Auth must support SSO"

Week 2: Bob (Backend) implements
        → Memory finds: Paris's requirements
        → Bob builds SSO support

Week 3: Steve (Security) audits
        → Memory finds: Paris's reqs + Bob's implementation
        → Steve verifies SSO security

Week 4: Wendy (Docs) writes documentation
        → Memory finds: All previous work
        → Wendy creates comprehensive docs
```

### Example 3: Learning from Bugs

```
Past execution (saved to memory):
  "Bug found: JWT tokens expired after 1 hour, too short.
   Fixed: Changed to 24 hours."

Current execution:
  Task: "Implement auth for new feature"
  Memory search finds: Bug about JWT expiration
  Agent: "I'll set JWT expiration to 24 hours to avoid the
         previous expiration issue."
```

---

## Memory Management

### CLI Commands

```bash
# Search memory
ax memory search "authentication"
ax memory search "bug fix" --limit 10
ax memory search "design" --type conversation

# List entries
ax memory list
ax memory list --agent paris
ax memory list --from 2025-10-01

# Statistics
ax memory stats
# Output:
#   Total: 13 entries
#   Size: 45 KB
#   Types: conversation (11), code (2)

# Export/Import
ax memory export backup.json
ax memory import backup.json
ax memory export --type conversation team-knowledge.json

# Clear
ax memory clear --older-than 30
ax memory clear --type experiment
ax memory clear --agent old-agent
```

### Configuration

```json
{
  "memory": {
    "enabled": true,
    "dbPath": ".automatosx/memory/memory.db",
    "maxEntries": 10000,
    "autoCleanup": true,
    "cleanupDays": 30,
    "trackAccess": true,
    "defaultSearchLimit": 5
  }
}
```

### Best Practices

#### 1. **Regular Cleanup**
```bash
# Monthly maintenance
ax memory export backup-$(date +%Y%m).json
ax memory clear --older-than 90
```

#### 2. **Selective Storage**
```bash
# Skip memory for one-off tasks
ax run agent "one-off task" --skip-memory
```

#### 3. **Privacy Management**
```bash
# Clear sensitive conversations
ax memory list --tags sensitive
ax memory clear --type sensitive-data
```

#### 4. **Knowledge Sharing**
```bash
# Export team knowledge
ax memory export --type conversation team-knowledge.json

# Share with team
git add team-knowledge.json
git commit -m "Share project knowledge"
```

---

## Performance Characteristics

### Memory System

```
Database size: ~10 MB (1000 entries)
Search time: < 1ms
RAM usage: ~20 MB
Concurrent readers: Unlimited (WAL mode)
API costs: $0
```

### Direct Prompt Passing

```
Latency: ~0ms (in-memory)
Storage: RAM only
Persistence: No
Overhead: Negligible
```

### Workspace Files

```
I/O latency: 10-50ms
Storage: Disk
Persistence: Yes
Overhead: File system
```

---

## Common Patterns

### Pattern 1: Design → Implementation

```typescript
// Design phase
User → Architect: "Design payment system"
Architect creates design → Saved to memory

// Implementation phase (next day)
User → Developer: "Implement payment system"
Memory: Finds architect's design automatically
Developer: "Based on the design from [date]..."
```

### Pattern 2: Code Review with History

```typescript
// Implementation
Developer implements feature → Saved to memory

// Review
User → Reviewer: "Review payment feature"
Memory: Finds developer's implementation
Reviewer: "I reviewed the implementation and found..."
```

### Pattern 3: Documentation from History

```typescript
// Multiple executions over time
Week 1-4: Various agents work on features
All work saved to memory (designs, code, decisions)

// Documentation phase
User → Writer: "Document the auth system"
Memory search: Finds all auth-related work
Writer: Creates comprehensive docs from memory
```

---

## Troubleshooting

### Issue: Memory Not Found

```bash
# Check if memory exists
ax memory stats

# Verify search query
ax memory search "your-query" --limit 20

# Check filters
ax memory list --agent <agent-name>
```

### Issue: Irrelevant Memory Results

```bash
# More specific search
ax memory search "exact phrase" --type conversation

# Filter by agent
ax memory search "query" --agent specific-agent

# Filter by date
ax memory search "query" --from 2025-10-01
```

### Issue: Memory Growing Too Large

```bash
# Check size
ax memory stats

# Clean old entries
ax memory clear --older-than 60

# Reduce max entries in config
{
  "memory": {
    "maxEntries": 5000  // Reduced from 10000
  }
}
```

---

## Migration from v3.x

### Vector Search → FTS5

**v3.x** (Vector embeddings):
```typescript
// Required embedding provider
const memory = new MemoryManager({
  dbPath: 'memory.db',
  embeddingProvider: openaiEmbeddings // Required
});

// Search with embeddings
await memory.search({
  embedding: [0.234, 0.567, ...],  // Required
  limit: 10
});
```

**v4.11.0+** (FTS5):
```typescript
// No embedding provider needed
const memory = await MemoryManager.create({
  dbPath: 'memory.db'
  // embeddingProvider: optional (for Plus version)
});

// Search with keywords
await memory.search({
  text: "authentication JWT",  // Keywords only
  limit: 10
});
```

### Benefits of FTS5

- ✅ 62x faster (45ms → <1ms)
- ✅ 87% smaller bundle (340MB → 46MB)
- ✅ Zero API costs
- ✅ Simpler setup (no API keys)
- ✅ Offline capable

---

## Summary

### Communication Systems

| System | Purpose | Storage | Speed | Cost |
|--------|---------|---------|-------|------|
| **Direct Prompts** | Current delegation | RAM | Instant | $0 |
| **Memory (FTS5)** | Long-term knowledge | SQLite | <1ms | $0 |
| **Workspaces** | File artifacts | Disk | 10-50ms | $0 |

### Key Takeaways

1. **Direct prompts** = Current task communication (ephemeral)
2. **Memory** = Project knowledge base (persistent)
3. **Workspaces** = Shared files (persistent)

### When to Use What

- **Delegation**: Use direct prompts
- **Learning**: Use memory
- **File sharing**: Use workspaces
- **All three**: Use together for maximum power

---

## Next Steps

- **[Multi-Agent Orchestration](./multi-agent-orchestration.md)** - Learn delegation patterns
- **[Memory Management Tutorial](../tutorials/memory-management.md)** - Hands-on memory usage
- **[CLI Commands Reference](../reference/cli-commands.md)** - All memory commands

---

**Last Updated**: 2025-10-10 | **Version**: 4.11.0+
