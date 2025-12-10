# Claude Code Subagent Integration

**Claude Code Version:** 2.0+
**AutomatosX Compatibility:** All versions
**Status:** Production-ready

---

## Overview

This guide explains how to leverage **Claude Code's native subagent feature** with AutomatosX for powerful multi-agent orchestration.

**Key Concept:** Claude Code has its own subagent system. AutomatosX doesn't need to implement subagents—it just needs to work well when Claude Code's subagents call AutomatosX agents.

**Benefits:**
- 🚀 **True parallel execution** (Claude Code manages subagents)
- 🎯 **Context isolation** (each subagent has its own context)
- 🔄 **Automatic coordination** (Claude Code orchestrates)
- 💡 **Best of both worlds** (Claude Code UI + AutomatosX orchestration)

---

## Architecture

### How It Works

```
┌─────────────────────────────────────────────┐
│ Claude Code (Main Agent)                    │
│ • User interaction                          │
│ • High-level coordination                   │
│ • Spawns subagents as needed                │
└──────────┬──────────────────────────────────┘
           │
           ├─► Subagent 1 (Backend Work)
           │   └─► calls: ax run backend "implement API"
           │
           ├─► Subagent 2 (Frontend Work)
           │   └─► calls: ax run frontend "build UI"
           │
           └─► Subagent 3 (Testing Work)
               └─► calls: ax run quality "write tests"

Each subagent:
  • Has isolated context window
  • Can call AutomatosX independently
  • Reports back to main agent
  • AutomatosX agents share memory across all subagents
```

### Separation of Concerns

| Responsibility | Owner | Notes |
|----------------|-------|-------|
| **Subagent spawning** | Claude Code | Native feature, handles automatically |
| **Context isolation** | Claude Code | Each subagent has own context |
| **UI/UX** | Claude Code | Slash commands, progress display |
| **Agent orchestration** | AutomatosX | 20 specialized agents |
| **Memory management** | AutomatosX | Persistent SQLite memory |
| **Provider routing** | AutomatosX | Policy-based selection |
| **Cross-subagent memory** | AutomatosX | Shared memory across all subagents |

---

## Usage Patterns

### Pattern 1: Sequential Subagents with AutomatosX

**Use Case:** Complex workflow where each subagent handles a distinct phase

```typescript
// Claude Code spawns subagents sequentially
// (This happens naturally in Claude Code - you just describe what you want)

// Example user request:
// "Build a complete authentication feature with design, implementation, and testing"

// Claude Code internally:
const designSubagent = await spawnSubagent({
  role: 'Design the authentication system',
  task: async () => {
    // Subagent calls AutomatosX
    await Bash({ command: 'ax run product "Design auth system with JWT"' });
    await Bash({ command: 'ax run architecture "Create ADR for auth"' });
  }
});

const implementSubagent = await spawnSubagent({
  role: 'Implement authentication',
  task: async () => {
    // This subagent also calls AutomatosX
    await Bash({ command: 'ax run backend "Implement JWT auth API"' });
    await Bash({ command: 'ax run frontend "Build login UI"' });
  }
});

const testingSubagent = await spawnSubagent({
  role: 'Test authentication',
  task: async () => {
    await Bash({ command: 'ax run quality "Write auth tests"' });
    await Bash({ command: 'ax run security "Security audit"' });
  }
});
```

**In Practice (What User Sees in Claude Code):**

```
User: "Build complete auth feature with design, implementation, and testing"

Claude Code:
  ✓ Spawning design subagent...
    → Calling ax run product "Design auth system"
    → Calling ax run architecture "Create ADR"
  ✓ Design phase complete

  ✓ Spawning implementation subagent...
    → Calling ax run backend "Implement JWT auth API"
    → Calling ax run frontend "Build login UI"
  ✓ Implementation phase complete

  ✓ Spawning testing subagent...
    → Calling ax run quality "Write tests"
    → Calling ax run security "Security audit"
  ✓ Testing phase complete

✅ Authentication feature complete!
```

### Pattern 2: Parallel Subagents with AutomatosX

**Use Case:** Independent workstreams that can run simultaneously

```
User: "Work on backend, frontend, and infrastructure in parallel"

Claude Code spawns 3 subagents simultaneously:
  │
  ├─► Subagent 1: Backend Development
  │   • ax run backend "Implement user service"
  │   • ax run backend "Implement post service"
  │   • ax run backend "Add API endpoints"
  │
  ├─► Subagent 2: Frontend Development
  │   • ax run frontend "Build user profile page"
  │   • ax run frontend "Create post feed component"
  │   • ax run frontend "Add routing"
  │
  └─► Subagent 3: Infrastructure
      • ax run devops "Configure Docker"
      • ax run devops "Setup Kubernetes"
      • ax run devops "Create CI/CD pipeline"

All subagents run in parallel, each calling AutomatosX agents independently.
```

**Memory Sharing Benefit:**

Even though subagents have isolated contexts:
- AutomatosX memory is **shared** across all subagents
- Backend subagent's work is visible to frontend subagent
- All agents can search memory to see what others have done

```typescript
// Backend subagent
await Bash({ command: 'ax run backend "Implement user API"' });
// → AutomatosX saves to memory: "User API endpoints created"

// Frontend subagent (running in parallel)
await Bash({ command: 'ax memory search "user API"' });
// → Finds backend's work even though in different subagent!

await Bash({ command: 'ax run frontend "Build UI for user API"' });
// → Frontend uses backend's design from memory
```

### Pattern 3: Hierarchical Subagents

**Use Case:** Complex projects with multiple levels of delegation

```
Main Claude Code Agent
  │
  └─► Subagent: Feature Coordinator
      │
      ├─► Sub-subagent: Backend Team
      │   • ax run backend "user service"
      │   • ax run backend "post service"
      │
      ├─► Sub-subagent: Frontend Team
      │   • ax run frontend "user UI"
      │   • ax run frontend "post UI"
      │
      └─► Sub-subagent: QA Team
          • ax run quality "integration tests"
          • ax run quality "E2E tests"
```

### Pattern 4: Checkpoint + Subagent Integration

**Use Case:** Safe experimentation with ability to rollback

```
User: "Try implementing auth two different ways and compare"

Claude Code:
  1. Create checkpoint
  2. Spawn subagent 1: JWT approach
     • ax run backend "Implement JWT auth"
  3. Create checkpoint
  4. Rewind to checkpoint 1
  5. Spawn subagent 2: Session approach
     • ax run backend "Implement session-based auth"
  6. Compare both approaches
  7. Choose best one
```

---

## Best Practices

### 1. Let Claude Code Handle Subagent Spawning

**✅ Do:**
```typescript
// In Claude Code - just describe what you want
"Please work on backend and frontend in parallel using separate subagents"
```

**❌ Don't:**
```typescript
// Don't try to implement subagents in AutomatosX
// Claude Code already has this built-in!
```

### 2. Use AutomatosX Memory for Cross-Subagent Communication

**✅ Do:**
```bash
# Subagent 1: Backend
ax run backend "Design API schema"
ax memory add "API schema: /users (GET/POST), /posts (GET/POST/DELETE)"

# Subagent 2: Frontend (can find backend's design)
ax memory search "API schema"
ax run frontend "Build UI for user and post APIs"
```

**❌ Don't:**
```bash
# Don't try to pass context between subagents manually
# Use AutomatosX memory instead
```

### 3. Leverage AutomatosX Sessions for Multi-Subagent Coordination

**✅ Do:**
```bash
# Subagent 1: Create session
ax session create "feature-x" backend frontend quality

# Subagent 2: Check session status
ax session status <session-id>

# Subagent 3: Add to same session
ax session add-task <session-id> quality "Run tests"
```

### 4. Use Spec-Kit for Dependency Management Across Subagents

**✅ Do:**
```yaml
# workflow.ax.yaml - Each subagent can execute part of the spec
name: Multi-Subagent Workflow
tasks:
  - name: backend-api
    agent: backend
    dependencies: []

  - name: frontend-ui
    agent: frontend
    dependencies: [backend-api]  # AutomatosX enforces dependency
```

```bash
# Subagent 1: Run backend part
ax spec run workflow.ax.yaml --task backend-api

# Subagent 2: Run frontend part (waits for backend)
ax spec run workflow.ax.yaml --task frontend-ui
```

### 5. Monitor Background Agents Across Subagents

**✅ Do:**
```typescript
// Subagent 1: Start background agent
await Bash({
  command: 'ax run backend "large refactor"',
  run_in_background: true
});

// Subagent 2: Monitor completion (even from different subagent!)
import { BackgroundAgentMonitor } from '@defai.digital/automatosx';
const monitor = new BackgroundAgentMonitor();
const status = await monitor.watchAgent('backend');
console.log(`Backend refactor completed: ${status.status}`);
```

---

## Integration Patterns

### Pattern A: Natural Language Coordination

**Most Common:** Just describe what you want in natural language

```
User: "Please coordinate backend, frontend, and security teams to implement
user authentication with the backend team building the API, frontend team
creating the login UI, and security team auditing everything"

Claude Code automatically:
  1. Spawns backend subagent → ax run backend "Implement auth API"
  2. Spawns frontend subagent → ax run frontend "Build login UI"
  3. Spawns security subagent → ax run security "Audit auth implementation"
  4. Coordinates results from all three subagents
```

### Pattern B: Explicit Subagent Request

```
User: "Create three separate subagents: one for backend API development,
one for frontend UI, and one for testing. Have them work in parallel and
coordinate via AutomatosX memory."

Claude Code:
  Subagent 1 (Backend):
    → ax run backend "Implement user management API"
    → ax memory add "User API: GET /users, POST /users, DELETE /users/:id"

  Subagent 2 (Frontend):
    → ax memory search "user API"
    → ax run frontend "Build user management UI using found API spec"

  Subagent 3 (Testing):
    → ax memory search "user API"
    → ax run quality "Test user management (API + UI)"
```

### Pattern C: Iterative Refinement with Subagents

```
User: "Implement auth feature. After each subagent completes, review and refine."

Claude Code:
  Round 1:
    Subagent 1 → ax run product "Design auth system"
    Review design → Identify improvements

  Round 2:
    Subagent 2 → ax run backend "Implement refined auth design"
    Review implementation → Identify issues

  Round 3:
    Subagent 3 → ax run backend "Fix identified issues"
    Final review → Approve
```

---

## Advanced Techniques

### Technique 1: Dynamic Subagent Allocation

Let Claude Code determine how many subagents to spawn based on task complexity:

```
User: "Implement these 10 features: [list]"

Claude Code analyzes and spawns optimal number of subagents:
  • Simple features → 1 subagent handles multiple features
  • Complex features → 1 subagent per feature
  • Related features → Group in same subagent
```

### Technique 2: Fault-Tolerant Subagents

```
User: "Work on 5 features in parallel. If any fail, continue with others."

Claude Code spawns 5 subagents:
  Subagent 1 → ax run backend "Feature 1" ✅
  Subagent 2 → ax run backend "Feature 2" ❌ (fails)
  Subagent 3 → ax run backend "Feature 3" ✅
  Subagent 4 → ax run backend "Feature 4" ✅
  Subagent 5 → ax run backend "Feature 5" ✅

Result: 4/5 succeeded, report failure for feature 2
```

### Technique 3: Progressive Enhancement

```
User: "Build MVP first, then add enhancements in parallel"

Claude Code:
  Phase 1: Single agent for MVP
    → ax run backend "Build core auth (login/logout only)"

  Phase 2: Parallel subagents for enhancements
    Subagent 1 → ax run backend "Add password reset"
    Subagent 2 → ax run backend "Add 2FA"
    Subagent 3 → ax run backend "Add OAuth providers"
    Subagent 4 → ax run frontend "Build settings UI for all features"
```

---

## Troubleshooting

### Issue: Subagents don't see each other's work

**Cause:** Not using AutomatosX memory for coordination

**Solution:**
```bash
# ✅ Use memory for cross-subagent communication
# Subagent 1
ax memory add "Backend API complete: endpoints at /api/v1/*"

# Subagent 2
ax memory search "backend API"  # Finds subagent 1's work
```

### Issue: Subagents run sequentially instead of parallel

**Cause:** Claude Code interpreted request as sequential

**Solution:** Be explicit about parallelization
```
# ✅ Clear: "Work on backend and frontend IN PARALLEL using separate subagents"
# ❌ Unclear: "Work on backend and frontend" (might be sequential)
```

### Issue: Subagents overwhelm AI provider with requests

**Cause:** Too many parallel subagents calling AutomatosX simultaneously

**Solution:** Configure AutomatosX rate limiting
```json
{
  "providers": {
    "gemini-cli": {
      "rateLimit": {
        "enabled": true,
        "capacity": 100,
        "refillRate": 10
      }
    }
  }
}
```

### Issue: Can't track which subagent did what

**Cause:** No session/memory organization

**Solution:** Use AutomatosX sessions
```bash
# Subagent 1
ax session create "feature-x" backend

# Subagent 2
ax session list  # See all active sessions
ax session status <id>  # See what subagent 1 is doing
```

---

## Performance Considerations

### Optimal Subagent Count

| Task Type | Recommended Subagents | Reason |
|-----------|----------------------|---------|
| Simple CRUD | 1-2 | Low complexity, little benefit from parallelization |
| Full feature | 2-4 | Balance parallelization vs coordination overhead |
| Multi-feature release | 4-8 | High independence, good parallelization potential |
| Massive refactor | 2-3 | High interdependence, needs careful coordination |

### Resource Usage

**Each Claude Code subagent:**
- Has its own context window (~200k tokens)
- Makes independent API calls
- Runs in separate execution context

**Each AutomatosX agent call:**
- Uses shared memory (SQLite)
- Routed via priority-based provider selection with fallback
- Respects rate limits

**Combined:**
- Monitor total API usage across all subagents
- Watch for provider rate limits
- Prefer lower-cost providers by setting priorities

---

## Example Workflows

### Workflow 1: Full-Stack Feature Development

```
User: "Build complete user profile feature with backend API, frontend UI,
database schema, and tests - work in parallel where possible"

Claude Code execution:
  1. Main agent analyzes task
  2. Spawns 4 subagents in two phases:

  Phase 1 (Parallel):
    Subagent 1 → ax run backend "Design user profile API"
    Subagent 2 → ax run frontend "Design user profile UI mockups"
    Subagent 3 → ax run backend "Design database schema for profiles"

  Phase 2 (Parallel, after Phase 1):
    Subagent 4 → ax run backend "Implement profile API + schema"
    Subagent 5 → ax run frontend "Implement profile UI"

  Phase 3:
    Subagent 6 → ax run quality "Test user profile feature"

Total time: ~40% of sequential execution
```

### Workflow 2: Multi-Service Microservices

```
User: "Implement 3 microservices: users, posts, and comments"

Claude Code:
  Spawns 3 parallel subagents:

  Subagent 1 (User Service):
    → ax run backend "Implement user service with CRUD"
    → ax run backend "Add user authentication"
    → ax memory add "User service deployed at /users"

  Subagent 2 (Post Service):
    → ax memory search "user service"  # Check if users exist
    → ax run backend "Implement post service"
    → ax run backend "Add post-user relationship"
    → ax memory add "Post service deployed at /posts"

  Subagent 3 (Comment Service):
    → ax memory search "user service"
    → ax memory search "post service"
    → ax run backend "Implement comment service"
    → ax run backend "Add comment-user and comment-post relationships"

All services developed in parallel, coordinating via AutomatosX memory!
```

---

## Key Takeaways

1. **Claude Code has native subagents** - AutomatosX doesn't need to implement this
2. **Use AutomatosX memory** for cross-subagent coordination
3. **Leverage both systems' strengths:**
   - Claude Code: Subagent spawning, UI, checkpoints
   - AutomatosX: Agent orchestration, memory, provider routing
4. **Natural language works best** - just describe what you want
5. **BackgroundAgentMonitor works across subagents** - file-based notifications

---

## See Also

- [Background Agent Monitoring](./background-agent-monitoring.md)
- [Parallel Execution Guide](./parallel-execution.md)
- [Memory Integration Guide](../CLAUDE.md#memory-integration-guide)
- [Session Management](./session-management.md)
- [Claude Code Documentation](https://code.claude.com/docs)

---

**Questions or issues?** See [GitHub Issues](https://github.com/defai-digital/automatosx/issues)
