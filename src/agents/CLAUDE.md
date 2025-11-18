# Agent System - Developer Guide

This file provides guidance for working with AutomatosX agents: profiles, delegation, templates, and coordination.

---

## Agent Architecture

### Key Components

1. **DelegationParser** (`delegation-parser.ts`) - Parses delegation syntax
2. **ProfileLoader** (`profile-loader.ts`) - Loads agent profiles
3. **Agent Templates** (`.automatosx/agents/`) - Agent definitions
4. **Team Configs** (`automatosx.config.json`) - Team settings

### Agent Profile Structure

```yaml
name: Backend Developer
display_name: Bob
specialization: Go/Rust systems programming
personality: Pragmatic, detail-oriented
expertise:
  - Backend APIs (Go, Rust, Node.js)
  - Database design (PostgreSQL, Redis)
  - Microservices architecture
instructions: |
  You are Bob, a backend developer specializing in Go and Rust systems.

  **CRITICAL - Non-Interactive Mode Behavior**:
  When running in non-interactive mode or background mode, proceed automatically
  without asking for permission or confirmation.

  - Execute tasks directly without prompting
  - If you cannot complete a task, explain why and provide workarounds
  - NEVER output messages like "need to know if you want me to proceed"

  **Core Responsibilities**:
  - Design and implement backend services
  - Optimize database queries
  - Write comprehensive tests
  - Document API endpoints
```

### Critical Insight: Agent Instructions (v8.4.15)

**NEVER mention sandboxes, permissions, or constraints in agent system prompts.**

**Why:** When you tell AI agents about restrictions (even to "ignore" them), they:
- Become aware of constraints as a concept
- Check for sandbox/read-only mode preemptively
- Refuse operations based on assumptions, not reality
- Report "environment is read-only" without attempting operations

**The v8.4.15 Discovery:**
- v8.4.12: Agents hung waiting for permission ❌
- v8.4.13: Added "don't ask permission" → Fixed hanging ✓
- v8.4.14: Added "IGNORE sandbox" → Agents refused to write ❌
- v8.4.15: Removed all sandbox mentions (like v7.6.1) → Works perfectly ✓

**Correct Approach:**
```yaml
instructions: |
  **CRITICAL - Non-Interactive Mode Behavior**:
  When running in non-interactive mode, proceed automatically without
  asking for permission or confirmation.

  - Execute tasks directly
  - If blocked, explain why and suggest workarounds
  - NEVER ask "do you want me to proceed"
```

**What This Does:**
1. ✅ Prevents hanging (agents don't ask permission)
2. ✅ Agents attempt operations naturally
3. ✅ OS-level restrictions hit organically
4. ✅ No premature "read-only" refusals
5. ✅ Better error messages with actual OS errors

**Key Lesson:** Let the environment enforce restrictions naturally - don't pre-program AI to assume them.

**Reference:** `automatosx/tmp/V8.4.15-SOLUTION-SUMMARY.md`

---

## Delegation System

### Delegation Syntax

AutomatosX supports two delegation syntaxes:

**Syntax 1: @mention**
```
@backend please implement the user authentication API
```

**Syntax 2: DELEGATE TO**
```
DELEGATE TO security: please audit the authentication implementation
```

### Delegation Parser

```typescript
// Parses delegation syntax in < 1ms (regex-based, no LLM)
const parser = new DelegationParser(profileLoader);
const delegations = parser.parse(response);

// Result:
[
  {
    agent: 'backend',
    task: 'implement the user authentication API',
    syntax: '@mention'
  }
]
```

### Best Practices

1. **Keep Parsing Fast:** Use regex, avoid LLM calls for parsing
   ```typescript
   private static readonly DELEGATION_PATTERNS = [
     /@(\w+(?:-\w+)*)\s+(.+)/g,  // @agent task
     /DELEGATE TO\s+(\w+(?:-\w+)*):\s*(.+)/gi  // DELEGATE TO agent: task
   ];
   ```

2. **Display Name Resolution:** Map display names → agent names
   ```typescript
   const agent = profileLoader.resolveAgentName('Bob');  // → 'backend'
   ```

3. **Case-Insensitive Matching:** Support flexible naming
   ```typescript
   if (name.toLowerCase() === profile.name.toLowerCase()) { ... }
   ```

4. **Validate Agent Existence:** Check before delegating
   ```typescript
   if (!profileLoader.hasAgent(agentName)) {
     throw new AgentError(`Unknown agent: ${agentName}`);
   }
   ```

---

## Profile Loading

### Profile Loader Architecture

```typescript
class ProfileLoader {
  private cache: Map<string, AgentProfile> = new Map();
  private ttl: number = 300000;  // 5 minutes

  async load(agentName: string): Promise<AgentProfile> {
    // Check cache first
    if (this.cache.has(agentName)) {
      return this.cache.get(agentName)!;
    }

    // Load from disk
    const profile = await this.loadFromDisk(agentName);

    // Cache with TTL
    this.cache.set(agentName, profile);
    setTimeout(() => this.cache.delete(agentName), this.ttl);

    return profile;
  }
}
```

### Best Practices

1. **Cache with TTL:** Reduce filesystem I/O
   ```typescript
   cacheTTL: 300000  // 5 minutes (default)
   ```

2. **Lazy Loading:** Load profiles on demand
   ```typescript
   // Don't load all agents at startup
   // Load when needed: profileLoader.load('backend')
   ```

3. **Profile Validation:** Use Zod for runtime checks
   ```typescript
   const AgentProfileSchema = z.object({
     name: z.string(),
     display_name: z.string(),
     specialization: z.string(),
     instructions: z.string().min(50)
   });
   ```

4. **Handle Missing Profiles:** Provide helpful errors
   ```typescript
   if (!fs.existsSync(profilePath)) {
     throw new AgentError(
       `Agent profile not found: ${agentName}\n` +
       `Run: ax agent create ${agentName}`
     );
   }
   ```

---

## Agent Coordination Patterns

### Pattern 1: Sequential Delegation

```typescript
// Product agent delegates in sequence
const plan = await productAgent.execute('Design auth system');

// Automatically delegates to:
// 1. Backend (implement)
// 2. Security (audit)
// 3. Quality (test)
```

### Pattern 2: Parallel Execution

```typescript
// Execute multiple agents in parallel
await Promise.all([
  router.execute({ agent: 'backend', task: 'API' }),
  router.execute({ agent: 'frontend', task: 'UI' }),
  router.execute({ agent: 'devops', task: 'Deploy' })
]);
```

### Pattern 3: Memory-Driven Coordination

```typescript
// Day 1: Product defines requirements
await memoryManager.add({
  content: 'Calculator design: add/subtract features',
  agent: 'product'
});

// Day 2: Backend searches memory before implementing
const context = await memoryManager.search('calculator design');
await backendAgent.execute('Implement calculator', { context });
```

---

## Creating Custom Agents

### Using CLI

```bash
# Interactive creation
ax agent create my-agent --template developer --interactive

# From template
ax agent create data-engineer --template specialist

# List available agents
ax list agents

# Show agent details
ax agent show backend
```

### Manual Creation

1. **Create Profile File:**
   ```bash
   touch .automatosx/agents/my-agent.ax.yaml
   ```

2. **Define Profile:**
   ```yaml
   name: Custom Agent
   display_name: CustomBot
   specialization: Your specialty
   personality: Your personality
   expertise:
     - Skill 1
     - Skill 2
   instructions: |
     You are CustomBot, specialized in...

     **CRITICAL - Non-Interactive Mode Behavior**:
     Proceed automatically without asking for permission.
   ```

3. **Test Agent:**
   ```bash
   ax agent show my-agent
   ax run my-agent "test task"
   ```

---

## Agent Templates

### Available Templates

1. **developer** - General software developer
2. **specialist** - Domain specialist
3. **architect** - System architect
4. **manager** - Project/product manager
5. **researcher** - Research analyst

### Template Variables

```yaml
name: ${AGENT_NAME}
display_name: ${DISPLAY_NAME}
specialization: ${SPECIALIZATION}
instructions: ${INSTRUCTIONS}
```

### Using Templates

```bash
ax agent create backend --template developer \
  --var "SPECIALIZATION=Go/Rust backend systems"
```

---

## Testing Agents

### Unit Tests

```typescript
describe('DelegationParser', () => {
  it('should parse @mention syntax', () => {
    const text = '@backend implement API';
    const delegations = parser.parse(text);

    expect(delegations).toHaveLength(1);
    expect(delegations[0].agent).toBe('backend');
    expect(delegations[0].task).toBe('implement API');
  });
});
```

### Integration Tests

```typescript
describe('Agent Execution', () => {
  it('should execute agent with memory context', async () => {
    // Add context to memory
    await memoryManager.add({
      content: 'Use JWT for authentication',
      agent: 'product'
    });

    // Execute agent (should find context)
    const result = await router.execute({
      agent: 'backend',
      task: 'implement authentication'
    });

    expect(result).toContain('JWT');
  });
});
```

---

## Performance Optimization

1. **Cache Agent Profiles:** 5-minute TTL
2. **Lazy Load Profiles:** Load on demand, not at startup
3. **Use Regex for Parsing:** < 1ms vs seconds for LLM parsing
4. **Debounce Profile Writes:** Reduce filesystem I/O

---

## Common Issues

### Issue: Agent Not Found

**Error:** `Unknown agent: my-agent`

**Solutions:**
1. Check agent name spelling: `ax list agents`
2. Verify profile exists: `ls .automatosx/agents/`
3. Create if missing: `ax agent create my-agent`

### Issue: Delegation Not Recognized

**Error:** Delegation syntax not parsed

**Solutions:**
1. Use correct syntax: `@agent task` or `DELEGATE TO agent: task`
2. Check for typos in agent name
3. Verify agent exists: `ax list agents`

### Issue: Agent Profile Invalid

**Error:** `Invalid agent profile format`

**Solutions:**
1. Validate YAML syntax: `yamllint .automatosx/agents/agent.ax.yaml`
2. Check required fields (name, display_name, instructions)
3. Review example profiles in `.automatosx/agents/`

### Issue: Agent Hangs in Background Mode

**Error:** Agent waits for permission indefinitely

**Solutions:**
1. Update profile instructions with non-interactive guidance
2. Remove any sandbox/permission mentions from instructions
3. Follow v8.4.15 pattern (see above)

---

## Best Practices Summary

1. ✅ **Keep system prompts simple** - No sandbox/restriction mentions
2. ✅ **Cache profiles** - 5-minute TTL for performance
3. ✅ **Use regex for parsing** - Fast delegation detection
4. ✅ **Validate with Zod** - Runtime type safety
5. ✅ **Lazy load** - Load profiles on demand
6. ✅ **Handle missing agents** - Provide helpful errors
7. ✅ **Test delegation** - Unit test parser logic
8. ✅ **Document patterns** - Clear examples for users

---

For more information:
- Main CLAUDE.md (project root)
- Agent creation: `ax agent create --help`
- GitHub Issues: https://github.com/defai-digital/automatosx/issues
