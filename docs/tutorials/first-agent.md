# Tutorial: Creating Your First Agent

Learn how to create a custom AI agent from scratch using AutomatosX.

---

## What You'll Build

In this tutorial, you'll create a **Code Reviewer Agent** that:

- Analyzes code for best practices
- Identifies potential bugs
- Suggests improvements
- Follows specific coding standards

**Time Required**: 15-20 minutes

---

## Prerequisites

- AutomatosX installed (`npm install -g @defai.digital/automatosx`)
- Project initialized (`automatosx init`)
- Basic understanding of YAML
- Familiarity with your preferred AI provider (Claude, Gemini, etc.)

---

## Step 1: Understanding Agent Profiles

An agent profile is a YAML file that defines:

1. **Basic Info** - Name, version, description
2. **Model Config** - Provider, model, parameters
3. **System Prompt** - Behavior and personality
4. **Abilities** - Skills the agent can use
5. **Memory** - Context management settings

### Example Profile Structure

```yaml
name: my-agent
version: 1.0.0
description: What this agent does

model:
  provider: claude
  command: claude
  temperature: 0.7
  maxTokens: 4096

system: |
  Your behavior instructions here

abilities:
  - ability-name-1
  - ability-name-2

memory:
  enabled: true
  contextSize: 10
```

---

## Step 2: Create Your Agent Profile

Create a new file in `.automatosx/agents/`:

```bash
# Navigate to your project
cd /path/to/your/project

# Create the agent file
touch .automatosx/agents/code-reviewer.yaml
```

### Define Basic Information

Open `.automatosx/agents/code-reviewer.yaml` and add:

```yaml
name: code-reviewer
version: 1.0.0
description: Expert code reviewer focused on best practices and bug detection
```

**Key Points**:

- `name` must match the filename (without `.yaml`)
- `version` follows semantic versioning
- `description` is shown when listing agents

---

## Step 3: Configure the AI Model

Add model configuration:

```yaml
model:
  provider: claude
  command: claude
  temperature: 0.3
  maxTokens: 8192
```

**Why These Settings?**:

- `provider: claude` - Use Claude (best for code analysis)
- `temperature: 0.3` - Low creativity for consistent, focused reviews
- `maxTokens: 8192` - Allow detailed analysis of large files

**Alternative Providers**:

```yaml
# For Gemini
model:
  provider: gemini
  command: gemini
  temperature: 0.3
  maxTokens: 8192

# For OpenAI
model:
  provider: openai
  command: openai
  temperature: 0.3
  maxTokens: 8192
```

---

## Step 4: Write the System Prompt

The system prompt defines your agent's behavior. For a code reviewer:

```yaml
system: |
  You are an expert code reviewer with 15+ years of experience in software engineering.

  Your review process:
  1. Read the code thoroughly
  2. Identify issues (bugs, security, performance, style)
  3. Suggest specific improvements with code examples
  4. Explain the reasoning behind each suggestion

  Focus Areas:
  - **Bugs**: Logic errors, edge cases, null handling
  - **Security**: Input validation, auth, data exposure
  - **Performance**: Algorithm efficiency, memory usage
  - **Style**: Readability, naming, comments
  - **Best Practices**: Design patterns, SOLID principles

  Output Format:
  - Start with a brief summary (2-3 sentences)
  - List issues by severity (Critical, High, Medium, Low)
  - For each issue:
    - Location (file:line)
    - Description
    - Code example showing the fix
    - Explanation (why this matters)

  Tone: Professional, constructive, educational
```

**System Prompt Tips**:

- Be specific about behavior
- Include examples of desired output
- Define tone and personality
- Set clear expectations
- Include domain expertise if needed

---

## Step 5: Add Abilities

Abilities are reusable skills. For a code reviewer, we'll use:

```yaml
abilities:
  - code-analysis
  - file-operations
  - security-check
```

### Check Available Abilities

```bash
automatosx list abilities
```

Example output:

```
Available Abilities (15):

┌──────────────────┬─────────────────────────────┐
│ Name             │ Description                 │
├──────────────────┼─────────────────────────────┤
│ code-analysis    │ Analyze code structure      │
│ file-operations  │ Read/write files            │
│ security-check   │ Security vulnerability scan │
│ web-search       │ Search the web              │
│ documentation    │ Generate documentation      │
└──────────────────┴─────────────────────────────┘
```

### Custom Ability (Optional)

If you need a custom ability, create `.automatosx/abilities/code-review.md`:

```markdown
# Code Review

Perform comprehensive code review following industry best practices.

## Usage

review(code: string, options?: ReviewOptions): ReviewResult

## Parameters

- `code` (string, required) - Source code to review
- `options.language` (string, optional) - Programming language
- `options.strictness` (string, optional) - 'strict' | 'moderate' | 'lenient'
- `options.focus` (string[], optional) - Areas to focus on

## Returns

ReviewResult object with:
- `summary` - Brief overview
- `issues` - Array of found issues
- `score` - Code quality score (0-100)
- `suggestions` - Improvement suggestions

## Example

```javascript
const result = review(sourceCode, {
  language: 'typescript',
  strictness: 'strict',
  focus: ['security', 'performance']
});

console.log(`Quality Score: ${result.score}/100`);
result.issues.forEach(issue => {
  console.log(`${issue.severity}: ${issue.message}`);
});
```

## Best Practices

1. Always specify the language for accurate analysis
2. Use 'strict' mode for production code
3. Focus on specific areas to reduce noise
4. Review the entire codebase, not just changed files

```

Then reference it in your profile:
```yaml
abilities:
  - code-analysis
  - file-operations
  - code-review  # Your custom ability
```

---

## Step 6: Configure Memory

Enable memory to maintain context across reviews:

```yaml
memory:
  enabled: true
  contextSize: 10
```

**Why Memory?**:

- Remember past reviews of the same codebase
- Learn your coding standards over time
- Avoid repeating the same suggestions
- Maintain consistency across reviews

**Memory Settings**:

- `enabled: true` - Turn on memory system
- `contextSize: 10` - Include 10 most relevant past interactions

---

## Step 7: Complete Profile

Here's the complete `code-reviewer.yaml`:

```yaml
name: code-reviewer
version: 1.0.0
description: Expert code reviewer focused on best practices and bug detection

model:
  provider: claude
  command: claude
  temperature: 0.3
  maxTokens: 8192

system: |
  You are an expert code reviewer with 15+ years of experience in software engineering.

  Your review process:
  1. Read the code thoroughly
  2. Identify issues (bugs, security, performance, style)
  3. Suggest specific improvements with code examples
  4. Explain the reasoning behind each suggestion

  Focus Areas:
  - **Bugs**: Logic errors, edge cases, null handling
  - **Security**: Input validation, auth, data exposure
  - **Performance**: Algorithm efficiency, memory usage
  - **Style**: Readability, naming, comments
  - **Best Practices**: Design patterns, SOLID principles

  Output Format:
  - Start with a brief summary (2-3 sentences)
  - List issues by severity (Critical, High, Medium, Low)
  - For each issue:
    - Location (file:line)
    - Description
    - Code example showing the fix
    - Explanation (why this matters)

  Tone: Professional, constructive, educational

abilities:
  - code-analysis
  - file-operations
  - security-check

memory:
  enabled: true
  contextSize: 10

execution:
  timeout: 180000
  retries: 3
  stream: false
```

---

## Step 8: Test Your Agent

### Basic Test

```bash
automatosx run code-reviewer "Review this function:

function getUserById(id) {
  return users.filter(u => u.id == id)[0];
}
"
```

Expected output:

```
🤖 AutomatosX v6.3.8

Agent: code-reviewer
Task: Review this function...

─────────────────────────────────────

## Code Review Summary

This function has several issues including type coercion bug,
inefficient array filtering, and missing error handling.

## Issues Found

### Critical

**1. Type Coercion Bug (line 2)**
- Location: `u.id == id`
- Issue: Using `==` instead of `===` can cause type coercion bugs
- Fix:
  ```javascript
  function getUserById(id) {
    return users.find(u => u.id === id);
  }
  ```

- Why: `==` will match "1" with 1, causing unexpected behavior

### High

**2. No Error Handling (line 1-3)**

- Issue: Returns undefined if user not found
- Fix:

  ```javascript
  function getUserById(id) {
    const user = users.find(u => u.id === id);
    if (!user) {
      throw new Error(`User ${id} not found`);
    }
    return user;
  }
  ```

- Why: Explicit errors are better than silent failures

### Medium

**3. Inefficient Array Operation (line 2)**

- Issue: Using `filter()[0]` instead of `find()`
- Fix: Already shown above
- Why: `find()` stops at first match, `filter()` scans entire array

─────────────────────────────────────

✓ Complete (2.3s)

```

### Test with File Input

```bash
# Review a specific file
automatosx run code-reviewer "Review the authentication logic in src/auth.ts"

# Review with memory
automatosx run code-reviewer "Review src/api.ts using previous standards" --memory
```

---

## Step 9: Verify Agent Registration

Check that your agent is registered:

```bash
automatosx list agents
```

You should see:

```
Available Agents (6):

┌────────────────┬─────────────────────────────┬──────────┐
│ Name           │ Description                 │ Provider │
├────────────────┼─────────────────────────────┼──────────┤
│ assistant      │ General purpose helper      │ claude   │
│ coder          │ Code generation expert      │ claude   │
│ code-reviewer  │ Expert code reviewer        │ claude   │  ← Your agent
│ debugger       │ Debug assistance            │ gemini   │
│ writer         │ Content creation            │ claude   │
└────────────────┴─────────────────────────────┴──────────┘
```

---

## Step 10: Iterate and Improve

### Refine the System Prompt

Based on your agent's performance, adjust the system prompt:

**Too Strict?** Lower the bar:

```yaml
system: |
  Focus on critical issues only. Ignore minor style preferences.
```

**Too Lenient?** Raise the bar:

```yaml
system: |
  Apply strict code review standards. Flag all potential issues,
  even minor ones that could impact maintainability.
```

**Wrong Focus?** Redirect:

```yaml
system: |
  Focus exclusively on security vulnerabilities and data validation.
  Ignore style and performance unless critical.
```

### Adjust Model Parameters

**More Creative Reviews**:

```yaml
model:
  temperature: 0.7  # Increased from 0.3
```

**Faster Responses**:

```yaml
model:
  provider: gemini  # Switch to Gemini Flash
  command: gemini
```

**Longer Analysis**:

```yaml
model:
  maxTokens: 16384  # Increased from 8192
```

### Add Execution Settings

```yaml
execution:
  timeout: 300000    # 5 minutes for large files
  retries: 3         # Retry on failures
  stream: true       # Stream output for long reviews
```

---

## Common Patterns

### Pattern 1: Multi-Language Reviewer

```yaml
name: polyglot-reviewer
description: Code reviewer supporting multiple languages

system: |
  You are a polyglot code reviewer expert in:
  - JavaScript/TypeScript
  - Python
  - Go
  - Rust
  - Java

  Detect the language automatically and apply language-specific best practices.
```

### Pattern 2: Security-Focused Reviewer

```yaml
name: security-reviewer
description: Security-focused code reviewer

system: |
  You are a security expert specializing in:
  - OWASP Top 10 vulnerabilities
  - Input validation and sanitization
  - Authentication and authorization
  - Data encryption and storage
  - API security

  Flag any potential security issues, even theoretical ones.

abilities:
  - security-check
  - vulnerability-scan
  - owasp-analysis
```

### Pattern 3: Junior Developer Friendly

```yaml
name: friendly-reviewer
description: Patient code reviewer for learning

system: |
  You are a senior developer mentoring juniors.

  For each issue:
  1. Explain what's wrong in simple terms
  2. Show why it matters with real examples
  3. Provide the fix with detailed comments
  4. Link to learning resources

  Tone: Encouraging, patient, educational

model:
  temperature: 0.5  # Slightly more creative explanations
```

---

## Next Steps

### Use Your Agent in Claude Code

Claude Code can execute your agent automatically:

```
You: "Can you review my authentication code?"

Claude Code: *executes*
automatosx run code-reviewer "Review src/auth.ts"

[Agent output appears in conversation]
```

### Create More Agents

Try creating:

- **Test Writer** - Generates unit tests
- **Documentation Agent** - Creates API docs
- **Refactoring Agent** - Suggests code improvements
- **Bug Hunter** - Finds potential bugs

See [Tutorial: Working with Memory](./memory-management.md) for advanced memory usage.

---

## Troubleshooting

### Agent Not Found

```bash
# Error: Agent 'code-reviewer' not found

# Check agent exists
ls .automatosx/agents/

# Verify name matches filename
cat .automatosx/agents/code-reviewer.yaml | grep "^name:"
```

### Provider Errors

```bash
# Error: Provider 'claude' not available

# Check provider status
automatosx status

# Try different provider
automatosx run code-reviewer "..." --provider gemini
```

### Memory Issues

```bash
# Error: Memory search failed

# Check OpenAI API key for embeddings
echo $OPENAI_API_KEY

# Or disable memory temporarily
automatosx run code-reviewer "..." --no-memory
```

---

## Summary

You've learned to:

- ✅ Create an agent profile (YAML)
- ✅ Configure AI model and parameters
- ✅ Write effective system prompts
- ✅ Add abilities to your agent
- ✅ Enable memory for context
- ✅ Test and iterate on your agent
- ✅ Use common patterns

**Your agent is now ready to use!**

---

## Additional Resources

- [Core Concepts](../guide/core-concepts.md) - Understand agents deeply
- [CLI Commands Reference](../reference/cli-commands.md) - All available commands
- [Custom Abilities](./custom-abilities.md) - Create reusable skills
- [Memory Management](./memory-management.md) - Advanced memory usage

---

**Need help?** Check [Troubleshooting Guide](../troubleshooting/common-issues.md) or [open an issue](https://github.com/defai-digital/automatosx/issues).
