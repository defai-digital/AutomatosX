# Multi-Agent Orchestration

**Introduced in**: v4.7.0
**Enhanced in**: v4.11.0 (Capability-First Strategy)
**Status**: Stable

---

## Overview

Multi-agent orchestration enables agents to collaborate on complex tasks by delegating subtasks to specialized agents. This creates a coordinated workflow where agents work together, each contributing their expertise.

### Key Features

✅ **Natural Language Delegation**: Agents delegate using simple syntax (7 patterns supported)
✅ **Capability-First Strategy**: Agents evaluate their own abilities before delegating (v4.11.0+)
✅ **Session Management**: Track collaborative work across multiple agents
✅ **Workspace Isolation**: Each agent has its own workspace + shared collaboration space
✅ **Cycle Detection**: Prevents infinite delegation loops
✅ **Depth Limits**: Default max delegation depth: 2 levels

---

## Core Concepts

### Sessions

A **session** groups related work across multiple agents with shared context and goals.

**Session Lifecycle**:
```
Create → Add Agents → Execute Tasks → Complete
```

**Persistence**: Sessions are automatically saved to `.automatosx/sessions/sessions.json`

### Delegation

**Delegation** is when one agent (delegator) assigns a subtask to another agent (delegatee).

**v4.11.0 Capability-First Strategy**:
1. Agent evaluates if it can complete task with its own abilities
2. If capable → Execute directly (preferred)
3. If not capable → Delegate to specialized agent

**Max Depth**: 2 levels by default (prevents over-delegation)

### Workspaces (v5.2+)

**PRD Workspace**: `automatosx/PRD/`
- Shared planning documents
- All agents can read/write
- Persistent across sessions

**Tmp Workspace**: `automatosx/tmp/`
- Temporary working files
- All agents can read/write
- Auto-cleanup after configured days (default: 7)

---

## Natural Language Delegation

Agents can delegate tasks using 7 different syntaxes in their responses.

### Supported Syntaxes

#### 1. @mention Syntax (Most Common)

```typescript
"@frontend Create login UI with validation."
"@backend Implement auth API with JWT tokens."
"@database Design user schema with indexes."
```

**With display names** (v4.9.1+):
```typescript
"@Oliver Deploy to staging environment."  // Oliver → devops agent
"@Barry Build the backend API."           // Barry → backend agent
```

#### 2. Classic Explicit Syntax

```typescript
"DELEGATE TO frontend: Create login UI with validation."
"DELEGATE TO backend: Implement authentication API."
```

#### 3. Polite Request Syntax

```typescript
"Please ask backend to implement the auth API."
"Request frontend: create the dashboard UI."
"Could frontend handle the UI components?"
```

#### 4. Need Expression Syntax

```typescript
"I need frontend to handle the UI components."
"I require backend to set up the database schema."
```

#### 5. Chinese Language Support

```typescript
"請 frontend 建立登入 UI。"
"委派給 backend：實現認證 API。"
```

#### 6. Multi-Line Tasks (v4.9.6+)

```typescript
"@frontend Create login component with:
  - Email/password fields
  - Form validation with error messages
  - Responsive design for mobile devices"
```

#### 7. Multiple Delegations

```typescript
"@frontend Create the header component.
@frontend Create the footer component.
@frontend Create the sidebar menu.

All three UI components delegated to frontend team."
```

### Delegation Parser (v5.0.1)

The delegation parser automatically detects delegation requests and executes them.

**Advanced Filtering** (v5.0.1):
- ✅ Skips quoted examples: `"@frontend Create UI"` (in documentation)
- ✅ Skips numbered lists: `1. "@frontend..."`
- ✅ Skips test code: `it('delegates to frontend', ...)`
- ✅ Skips documentation markers: "Example:", "Supported syntaxes:"

**Performance**: < 2ms per parse (regex-based, no LLM calls)

---

## Agent Configuration

Agents must configure orchestration settings to participate in multi-agent workflows.

### Basic Configuration

```yaml
# .automatosx/agents/backend.yaml
name: backend
team: engineering
displayName: "Barry"
role: Senior Backend Engineer

abilities:
  - backend-development
  - api-design

systemPrompt: |
  You are a senior backend engineer...

# Orchestration configuration (v5.2+)
orchestration:
  maxDelegationDepth: 2           # Max delegation chain depth
```

### Configuration Fields (v5.2+)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `maxDelegationDepth` | number | 2 | Maximum delegation chain depth |

**Note**: `canReadWorkspaces` and `canWriteToShared` removed in v5.2. All agents now have equal access to shared workspaces with path validation.

### Security Model (v5.2+)

**Read Permissions**:
- ✅ Project files: Validated by PathResolver
- ✅ PRD workspace: All agents can read
- ✅ Tmp workspace: All agents can read
- ❌ Arbitrary paths: Blocked by PathResolver

**Write Permissions**:
- ✅ PRD workspace: All agents (with path validation)
- ✅ Tmp workspace: All agents (with path validation)
- ❌ Path traversal: Blocked (../, absolute paths, empty paths)
- ❌ Base directory: Blocked (., ./)

---

## CLI Commands

### Create Session

```bash
# Create new collaborative session
ax session create "Build authentication system" backend

# With custom name
ax session create "Build auth" backend --name "auth-project"

# With timeout
ax session create "Complex task" coordinator --timeout 1800000
```

### List Sessions

```bash
# All sessions
ax session list

# Active sessions only
ax session list --status active

# JSON format
ax session list --format json
```

### Add Agents to Session

```bash
# Add frontend to existing session
ax session add session-abc123 frontend

# Add multiple agents
ax session add session-abc123 database
ax session add session-abc123 devops
```

### Complete Session

```bash
# Mark as successfully completed
ax session complete session-abc123

# Mark as failed with reason
ax session complete session-abc123 --failed \
  --reason "Backend service timeout"
```

### Show Session Details

```bash
ax session show session-abc123
```

**Output**:
```
Session: session-abc123
Task: Build authentication system
Status: active
Created: 2025-10-09 14:30:00

Agents (3):
  • backend (primary) - Active
  • frontend - Active
  • database - Completed

Workspace: automatosx/PRD/ (shared)

Delegation Chain:
  backend -> database (completed)
  backend -> frontend (active)

Duration: 45 minutes
```

---

## Example Workflows

### Example 1: Simple Delegation

**Scenario**: Backend agent delegates UI creation to frontend agent.

**Backend Agent Response**:
```
I'll handle the API implementation and delegate the UI to the frontend team.

@frontend Create a login page with:
  - Email and password input fields
  - Form validation
  - Error message display
  - Responsive design

I'll start implementing the authentication API endpoints.
```

**What Happens**:
1. Delegation parser detects `@frontend` delegation
2. System creates delegation request
3. Frontend agent executes the UI task
4. Results appended to backend agent's response
5. Backend continues with API implementation

### Example 2: Multi-Agent Collaboration

**Scenario**: Coordinator delegates to multiple specialized agents.

**Coordinator Agent Response**:
```
I'll coordinate the implementation across our teams.

@backend Implement REST API with:
  - POST /login endpoint
  - JWT token generation
  - Password hashing with bcrypt

@frontend Create login UI with:
  - Form validation
  - Error handling
  - Loading states

@database Design user table with:
  - Email (unique, indexed)
  - Password hash
  - Created/updated timestamps

@devops Set up CI/CD pipeline for:
  - Automated testing
  - Staging deployment
  - Production deployment

All tasks delegated. I'll monitor progress and coordinate integration.
```

**Delegation Flow**:
```
coordinator
├── backend (API)
├── frontend (UI)
├── database (Schema)
└── devops (CI/CD)
```

### Example 3: Nested Delegation

**Scenario**: Backend delegates to database, which delegates to migrations specialist.

**Backend Agent** (Depth 0):
```
@database Design and implement the user authentication schema.
```

**Database Agent** (Depth 1):
```
I'll design the schema and delegate migrations to our specialist.

Schema designed:
- users table (id, email, password_hash, created_at)
- sessions table (id, user_id, token, expires_at)

@migrations Create migration files for the auth schema.
```

**Migrations Agent** (Depth 2):
```
Created migration files:
- 001_create_users_table.sql
- 002_create_sessions_table.sql
- 003_add_indexes.sql
```

**Max Depth Reached**: Migrations agent cannot delegate further (depth limit: 2).

---

## Capability-First Strategy (v4.11.0+)

### Overview

The capability-first strategy encourages agents to use their own abilities before delegating.

### How It Works

1. **Task Received**: Agent receives a task
2. **Self-Evaluation**: Agent checks if it has required abilities
3. **Decision**:
   - ✅ **Can do**: Execute task directly with own abilities
   - ❌ **Cannot do**: Delegate to specialized agent

### Benefits

✅ **Fewer Delegations**: Agents are more self-sufficient
✅ **Faster Execution**: No delegation overhead for simple tasks
✅ **Better Resource Usage**: Reduces unnecessary agent calls
✅ **Clearer Responsibilities**: Agents know their capabilities

### Example

**Before v4.11.0** (Over-delegation):
```
backend: "I need to write API code."
→ Delegates to code-writer agent
→ Code-writer does simple task backend could do
```

**After v4.11.0** (Capability-first):
```
backend: "I have code-generation ability. I can write this API code myself."
→ Executes directly
→ Only delegates truly specialized tasks (e.g., complex algorithms to specialist)
```

---

## Best Practices

### 1. **Design Clear Responsibilities**

```yaml
# ✅ Good: Clear, focused role
name: backend
abilities:
  - backend-development
  - api-design

# ❌ Bad: Unclear, overlapping
name: generic-developer
abilities:
  - everything
```

### 2. **Use Appropriate Delegation Depth**

```yaml
# ✅ Good: Reasonable depth for team size
orchestration:
  maxDelegationDepth: 2  # Coordinator → Specialist → Helper

# ❌ Bad: Too deep, creates confusion
orchestration:
  maxDelegationDepth: 5  # Too many levels
```

### 3. **Keep Delegation Chains Short** (v5.2+)

```yaml
# ✅ Good: Limited delegation depth
orchestration:
  maxDelegationDepth: 2  # Prevents over-delegation

# ❌ Bad: Too deep
orchestration:
  maxDelegationDepth: 5  # Causes complexity
```

**Note**: In v5.2+, all agents have equal access to shared workspaces with path validation. No need for permission configuration.

### 4. **Use Display Names for Clarity**

```yaml
# ✅ Good: Memorable display names
name: backend-api
displayName: "Barry"

# ❌ Bad: Generic or missing
name: agent-1
# No displayName
```

### 5. **Leverage Capability-First (v4.11.0+)**

```yaml
# ✅ Good: Agent has relevant abilities
name: backend
abilities:
  - code-generation      # Can write code
  - api-design           # Can design APIs
  - backend-development  # Core capability

# ❌ Bad: Missing abilities, will over-delegate
name: backend
abilities:
  - api-documentation  # Only docs? Will delegate code writing
```

---

## Troubleshooting

### Delegation cycles detected

**Symptom**: Error: "Delegation cycle detected: agent1 -> agent2 -> agent1"

**Cause**: Agents delegating back and forth infinitely.

**Solution**: Review orchestration configuration and agent prompts
```bash
# Check delegation chain
ax session show <session-id>

# Update agent prompts to avoid circular delegation
```

### Max delegation depth exceeded

**Symptom**: Error: "Max delegation depth (2) exceeded"

**Cause**: Too many levels of delegation.

**Solution**: Increase max depth or redesign delegation flow
```yaml
# Increase if needed
orchestration:
  maxDelegationDepth: 3
```

### Agent cannot write to shared workspace

**Symptom**: Error: "Permission denied: cannot write to shared workspace"

**Cause** (v5.1 and earlier): Agent missing `canWriteToShared: true` permission.

**Solution** (v5.2+): No configuration needed. All agents can write to shared workspaces with path validation.

```yaml
# v5.2+: No permission configuration needed
orchestration:
  maxDelegationDepth: 2
```

### False delegation detection (v5.0.0 and earlier)

**Symptom**: Documentation examples trigger actual delegations.

**Solution**: Update to v5.0.1 which includes advanced delegation parser filtering.

```bash
npm install -g @defai.digital/automatosx@5.0.1
```

---

## Performance Considerations

### Session Persistence

- **Auto-save**: 100ms debounced saves to `.automatosx/sessions/sessions.json`
- **Cleanup**: Old sessions (7+ days) auto-cleaned
- **Impact**: Minimal (< 1ms per save)

### Workspace Management

- **Isolation**: Each agent has dedicated workspace directory
- **Cleanup**: Use `ax workspace clean` to remove old files
- **Size limits**: Default 10MB per file, 100 files per workspace

### Delegation Performance

- **Parse Time**: < 2ms per delegation detection
- **Validation**: Cycle detection adds < 1ms
- **Total Overhead**: ~5-10ms per delegation

---

## Advanced Topics

### Custom Orchestration Patterns

**Coordinator Pattern** (v5.2+):
```yaml
name: coordinator
orchestration:
  maxDelegationDepth: 1  # Only coordinate, don't execute
  # All agents can read project files and shared workspaces
```

**Specialist Pattern** (v5.2+):
```yaml
name: algorithm-specialist
orchestration:
  maxDelegationDepth: 0  # Cannot delegate, only execute
```

**Team Lead Pattern** (v5.2+):
```yaml
name: engineering-lead
orchestration:
  maxDelegationDepth: 2  # Can delegate to team members
  # All agents can write to shared workspaces
```

### Session Metadata

Add custom metadata to track sessions:

```typescript
// Programmatic API (for advanced users)
const session = await sessionManager.create({
  task: "Build feature X",
  agents: ["backend", "frontend"],
  metadata: {
    priority: "high",
    deadline: "2025-10-15",
    jiraTicket: "PROJ-123"
  }
});
```

---

## See Also

- [Team Configuration Guide](./team-configuration.md) - Organize agents into teams
- [Agent Templates Guide](./agent-templates.md) - Quick agent creation
- [CLI Commands Reference](../reference/cli-commands.md) - Command details

---

**Last Updated**: 2025-10-09
**Version**: v5.0.1
