Execute an AutomatosX agent with a specific task.

**IMPORTANT**: When user types `/ax-agent <agent>, <task>`, you MUST:

1. Split the input on the FIRST comma
2. Extract agent name (text before comma, trimmed)
3. Extract task (text after comma, trimmed)
4. Execute: `automatosx run <agent> "<task>"`

**Parsing Rules**:

```
Input: /ax-agent backend, explain quantum computing
↓
Agent: "backend"
Task: "explain quantum computing"
↓
Execute: automatosx run backend "explain quantum computing"
```

**Examples**:

User input: `/ax-agent bob, i want you help me write a validation function`
→ Execute: `automatosx run bob "i want you help me write a validation function"`

User input: `/ax-agent backend, explain quantum computing to me`
→ Execute: `automatosx run backend "explain quantum computing to me"`

User input: `/ax-agent backend, create a REST API for user management`
→ Execute: `automatosx run backend "create a REST API for user management"`

User input: `/ax-agent quality, review the changes in src/auth.ts and suggest improvements`
→ Execute: `automatosx run quality "review the changes in src/auth.ts and suggest improvements"`

**Available built-in agents**: backend, frontend, devops, data, security, quality, design, writer, product, ceo, cto, researcher

**Note**: Users can also use custom agent names if they've created them in `.automatosx/agents/`
