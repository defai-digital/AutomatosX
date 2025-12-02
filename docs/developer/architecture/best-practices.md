# AutomatosX Best Practices Guide

**Version**: 6.3.8
**Last Updated**: 2025-10-31
**Target Audience**: Claude Code users, CLI users, developers

---

## 🎯 Core Philosophy

**AutomatosX is designed for intelligent collaboration, not just command execution.**

The most powerful way to use AutomatosX is to **let Claude Code think and plan**, then **let specialized agents execute**. This collaborative approach combines Claude Code's reasoning with agent expertise.

---

## 🚀 Quick Decision Guide

### When to Use Natural Language Collaboration (Recommended 80%)

**Use**: `"please work with ax agent to..."`

✅ **Best For**:
- Complex, multi-step tasks
- Tasks requiring project context analysis
- Tasks needing coordination between multiple agents
- Tasks where you want Claude Code to plan the approach
- Tasks that might need iteration or error handling
- When you're not sure which agent is best

❌ **Not Ideal For**:
- Simple, single-step tasks with clear requirements
- Quick prototypes where speed matters most
- When you've already analyzed and just need execution

### When to Use Slash Commands (Express 20%)

**Use**: `/ax-agent <name>, <task>`

✅ **Best For**:
- Simple, well-defined single tasks
- Quick code generation or review
- When you know exactly which agent to use
- Rapid prototyping and experimentation

❌ **Not Ideal For**:
- Complex multi-step workflows
- Tasks requiring project context
- Tasks needing coordination
- When you're exploring solutions

---

## 📖 Natural Language Collaboration Patterns

### Pattern 1: Analysis & Implementation

**Scenario**: You want to implement a feature but need analysis first.

```
✅ Good: "please work with ax agent to analyze our authentication
         system and implement JWT token refresh"

Why it works:
- Claude Code reads your auth code
- AutomatosX selects the best agent automatically (backend, security)
- Provides full context to agent
- Validates the implementation
```

**vs.**

```
❌ Less Effective: /ax-agent backend, add JWT refresh to auth

Why it's less effective:
- Agent doesn't know your current auth implementation
- No context about your project structure
- No validation of the approach
- System can't select a better agent if needed
```

### Pattern 2: Multi-Agent Coordination

**Scenario**: A task needs multiple specialists.

```
✅ Good: "please work with ax agent to design a secure API authentication system"

Result:
- Claude Code analyzes requirements
- AutomatosX selects appropriate agents (backend, security)
- Agents collaborate on the design
- Claude Code synthesizes the results
```

**vs.**

```
❌ Less Effective:
/ax-agent backend, design API auth
[wait for result]
/ax-agent security, review this design
[wait for result]
[manually combine the feedback]

Why it's less effective:
- Manual coordination required
- No automatic context sharing
- More time-consuming
- Risk of missing important feedback
```

### Pattern 3: Planning & Execution

**Scenario**: Complex feature with multiple steps.

```
✅ Good: "please work with ax agent to refactor our user management module"

What happens:
1. Claude Code analyzes current code
2. Identifies affected components
3. AutomatosX selects relevant agents (backend, frontend, database)
4. Plans refactoring strategy
5. Validates each step
6. Provides unified summary
```

**vs.**

```
❌ Less Effective: /ax-agent backend, refactor user management

Why it's less effective:
- No planning phase
- Misses frontend/database impacts
- No validation of approach
```

### Pattern 4: Problem Solving

**Scenario**: Debugging or investigation.

```
✅ Good: "please work with ax agent to investigate why our
         API response times increased by 300ms"

What happens:
1. Claude Code examines logs, metrics, code
2. Selects appropriate agents (backend, devops)
3. Agents analyze from their perspectives
4. Claude Code synthesizes findings
5. Proposes solutions
```

### Pattern 5: Learning & Exploration

**Scenario**: Understanding unfamiliar code or technology.

```
✅ Good: "please work with ax agent to help me understand
         how our caching layer works and suggest improvements"

Benefits:
- Claude Code provides high-level overview
- Agent provides deep technical analysis
- Combined explanation is more comprehensive
```

---

## 📝 Effective Prompts for Collaboration

### Structure of a Good Collaboration Prompt

```
[Action] with [Agent/Team] to [Goal]
[Optional: Context]
[Optional: Constraints]
[Optional: Success Criteria]
```

### Examples

#### Simple Collaboration
```
✅ "please work with ax agent to add user authentication"
```

#### Detailed Collaboration
```
✅ "please work with ax agent to implement user authentication

Context:
- We're using Express.js with MongoDB
- Need JWT tokens with refresh mechanism
- Must support OAuth2 providers (Google, GitHub)

Requirements:
- Follow our security best practices
- Write comprehensive tests
- Update API documentation"
```

#### Team Coordination
```
✅ "please work with ax agent to migrate our database
    from PostgreSQL to MongoDB

Considerations:
- Minimize downtime
- Preserve all existing data
- Update all affected services
- Create rollback plan"
```

---

## 🎯 Common Use Cases

### Use Case 1: Feature Development

**Recommended Approach**:

```
Phase 1 - Planning:
"please work with ax agent to design a real-time notification system"

Phase 2 - Implementation:
"please work with ax agent to implement the notification system based on the design"

Phase 3 - Quality:
"please work with ax agent to review and audit the notification implementation"
```

### Use Case 2: Code Review

**Recommended Approach**:

```
✅ "please work with ax agent to review my recent changes
    in src/auth/* and suggest improvements"

Why this works:
- Claude Code reads your changes
- AutomatosX selects the best agent (quality, security)
- Agent reviews with full project context
- Claude Code helps you understand feedback
```

### Use Case 3: Bug Investigation

**Recommended Approach**:

```
✅ "please work with ax agent to investigate this error:
    [paste error message]

    Context: This started after we deployed the caching update"

What happens:
- Claude Code examines recent changes
- Selects appropriate agent (backend, devops)
- Agent analyzes with full context
- Claude Code explains the root cause and solution
```

### Use Case 4: Refactoring

**Recommended Approach**:

```
✅ "please work with ax agent to refactor our payment processing module

Requirements:
- Improve testability
- Reduce coupling
- Maintain existing API contracts
- Add comprehensive tests"
```

### Use Case 5: Learning

**Recommended Approach**:

```
✅ "please work with ax agent to help me understand
    OAuth2 flows and how to implement them securely"

Benefits:
- AutomatosX selects the best agent for the topic
- Agent provides technical depth
- Claude Code provides learning context
- Interactive Q&A possible
```

---

## ⚡ When to Use Slash Commands

### Ideal Scenarios

#### 1. Quick Code Generation
```
✅ /ax-agent backend, write a function to validate email addresses
```

#### 2. Fast Code Review
```
✅ /ax-agent quality, review this function:
   [paste code]
```

#### 3. Simple Queries
```
✅ /ax-agent backend, what's the best way to handle file uploads in Express?
```

#### 4. Rapid Prototyping
```
✅ /ax-agent frontend, create a React component for a user profile card
```

### When to Avoid

❌ **Don't use slash commands when**:
- You need to analyze existing code first
- Multiple agents need to coordinate
- Task requires planning or iteration
- You're not sure which agent is best
- Task has multiple steps

---

## 🔄 Workflow Patterns

### Pattern: Feature Development Cycle

```
1. Design Phase:
   "please work with ax agent to design [feature]"

2. Implementation Phase:
   "please work with ax agent to implement the feature based on the design"

3. Review Phase:
   "please work with ax agent to review the implementation"

4. Security Phase:
   "please work with ax agent to audit the feature for security issues"
```

### Pattern: Bug Fix Cycle

```
1. Investigation:
   "please work with ax agent to investigate [bug description]"

2. Fix Implementation:
   "please work with ax agent to fix the issue"

3. Validation:
   "please work with ax agent to validate the fix and ensure no regressions"
```

### Pattern: Refactoring Cycle

```
1. Analysis:
   "please work with ax agent to analyze [component] for refactoring opportunities"

2. Planning:
   "please plan with ax agent a comprehensive refactoring strategy"

3. Execution:
   "please work with ax agent to implement the refactoring plan"

4. Validation:
   "please work with ax agent to validate the refactoring and ensure no regressions"
```

---

## 💡 Pro Tips

### Tip 1: Let Claude Code Choose the Agent

Instead of:
```
❌ /ax-agent backend, help with this database query
```

Try:
```
✅ "please work with ax agent to optimize this slow database query"
```

Claude Code will:
- Examine the query and schema
- Choose backend or data-scientist agent appropriately
- Provide full context

### Tip 2: Combine Analysis with Execution

Instead of:
```
❌ Step 1: Read the code yourself
❌ Step 2: /ax-agent backend, implement [feature]
```

Try:
```
✅ "please work with ax agent to review our current
    implementation and add [feature]"
```

### Tip 3: Let AutomatosX Coordinate Complex Tasks

Instead of:
```
❌ /ax-agent backend, build a complete auth system
```

Try:
```
✅ "please work with ax agent to design and implement
    a complete authentication system"
```

AutomatosX will automatically select and coordinate the right agents (backend, security, frontend, quality) based on the task requirements.

### Tip 4: Iterate with Context

Natural language collaboration makes iteration easier:

```
First iteration:
"please work with ax agent to implement user login"

[Review results]

Second iteration:
"please work with ax agent to add password reset functionality
 to the login system we just built"

Benefits:
- AutomatosX selects agents with context from previous work
- Claude Code maintains the conversation thread
- More coherent and consistent results
```

### Tip 5: Request Explanations

```
✅ "please work with ax agent to implement caching,
    and explain the trade-offs of different caching strategies"
```

Claude Code + AutomatosX agents provide better explanations than either alone, with the system automatically selecting the most knowledgeable agent for the topic.

---

## 🎓 Learning Path

### For New Users

**Week 1: Start with collaboration**
```
✅ "please work with ax agent to [simple task]"
```
Get comfortable with the collaboration pattern.

**Week 2: Learn agent specializations**
```
✅ "please work with ax agent to [various tasks]"
```
Observe which agents AutomatosX selects for different types of tasks.

**Week 3: Complex task coordination**
```
✅ "please work with ax agent to [complex task requiring multiple skills]"
```
See how AutomatosX coordinates multiple agents automatically.

**Week 4: End-to-end workflows**
```
✅ "please plan with ax agent to [complex feature with multiple phases]"
```
Master complete feature development with automatic agent orchestration.

### For Advanced Users

**Experiment with**:
- Custom agent creation
- Team-based workflows
- Memory system optimization
- Session management for long-running projects

---

## 📊 Comparison Table

| Aspect | Natural Language Collaboration | Slash Commands |
|--------|-------------------------------|----------------|
| **Complexity** | Best for complex tasks | Best for simple tasks |
| **Context** | Full project context | Limited context |
| **Planning** | Claude Code plans approach | Direct execution |
| **Coordination** | Multi-agent automatic | Manual |
| **Iteration** | Easy to iterate | Need new commands |
| **Learning Curve** | Natural, conversational | Need to memorize agents |
| **Speed** | Slower but thorough | Fast execution |
| **Error Handling** | Automatic validation | Manual check needed |
| **Best For** | Production work | Prototyping, experiments |
| **Recommended Use** | 80% of tasks | 20% of tasks |

---

## ✅ Best Practices Summary

### DO ✅

1. **Use natural language collaboration for most tasks**
   - "please work with ax agent to..."
   - "please discuss with agents to..."
   - "please plan together with team to..."

2. **Let Claude Code analyze context first**
   - Claude Code reads your code
   - Understands project structure
   - Provides context to agents

3. **Leverage multi-agent coordination**
   - Complex tasks benefit from multiple perspectives
   - Automatic coordination saves time

4. **Iterate naturally**
   - Build on previous conversations
   - Agents remember context

5. **Request explanations**
   - Ask "why" and "how"
   - Learn as you work

### DON'T ❌

1. **Don't use slash commands for complex tasks**
   - Missing context leads to generic solutions
   - No validation or error handling

2. **Don't manually coordinate agents**
   - Let Claude Code orchestrate
   - Save time and avoid errors

3. **Don't repeat context**
   - Memory system handles this
   - Claude Code provides context automatically

4. **Don't skip the analysis phase**
   - Understanding before acting prevents mistakes
   - Claude Code + Agent analysis is comprehensive

---

## 🚀 Quick Reference

### Collaboration Starters

```bash
# General collaboration (Recommended - let system choose agent)
"please work with ax agent to [task]"

# Planning and strategy
"please plan with ax agent to [complex task]"

# Analysis and investigation
"please analyze with ax agent [specific area or problem]"

# Discussion and exploration
"please discuss with ax agent about [topic or approach]"

# Coordination for complex tasks
"please coordinate with ax agent to [multi-step task]"

# Learning and understanding
"please help me understand [topic] by working with ax agent"
```

### Express Commands (Slash Commands)

```bash
# Simple tasks only
/ax-agent <agent-name>, <simple-task>

# Examples
/ax-agent backend, write a function to [specific task]
/ax-agent quality, review this code snippet
/ax-agent frontend, create a [simple component]
```

---

## 📚 Additional Resources

- [Agent Directory](../examples/AGENTS_INFO.md) - All available agents
- [Team Structure](../CLAUDE.md#team-based-configuration) - How agents are organized
- [Memory System](./guide/memory-system.md) - How context is preserved
- [Multi-Agent Orchestration](./guides/multi-agent-orchestration.md) - Agent coordination

---

## 🤝 Contributing

Have additional best practices to share? Please contribute to this guide!

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

---

**Remember**: AutomatosX is most powerful when you combine **Claude Code's intelligence** with **agent expertise** through **natural language collaboration**.

Think of it as having a conversation with an intelligent coordinator who can summon specialized experts as needed, rather than directly commanding those experts yourself.
