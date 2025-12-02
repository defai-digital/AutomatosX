# AutomatosX Examples

This directory contains example agents, abilities, and usage patterns to help you get started with AutomatosX.

## Directory Structure

```
examples/
├── agents/           # Example agent profiles (YAML)
├── abilities/        # Example ability definitions (Markdown)
├── use-cases/        # Complete usage scenarios
└── README.md         # This file
```

## Quick Start

### 1. Using Example Agents

Copy an example agent to your project:

```bash
# Copy all example agents
cp -r examples/agents/* .automatosx/agents/

# Or copy a specific agent
cp examples/agents/backend.yaml .automatosx/agents/

# Test the agent
automatosx run backend "Hello, introduce yourself"
```

### 2. Using Example Abilities

Copy example abilities to your project:

```bash
# Copy all abilities
cp -r examples/abilities/* .automatosx/abilities/

# Or copy specific abilities
cp examples/abilities/code-review.md .automatosx/abilities/
cp examples/abilities/debugging.md .automatosx/abilities/
```

### 3. Customizing Agents

Edit agent profiles to customize behavior:

```bash
# Edit agent profile
vim .automatosx/agents/backend.yaml

# Customize:
# - name: Unique identifier
# - description: Agent's purpose
# - model: AI model to use
# - temperature: Creativity level (0.0-1.0)
# - abilities: List of abilities to enable
# - systemPrompt: Detailed instructions
```

## Agent Names

**AutomatosX agents have human-friendly names!** 🎉

Instead of remembering technical roles, you can use memorable names:

- 👨‍💻 **Bob** - Backend Engineer
- 👨‍💻 **Frank** - Frontend Developer
- 🔒 **Steve** - Security Engineer
- 🎨 **Debbee** - UX/UI Designer
- 📊 **Daisy** - Data Scientist

See [AGENTS_INFO.md](./AGENTS_INFO.md) for the complete directory.

## Available Agents

### backend.yaml - Bob

**Purpose**: Backend development specialist for API and server-side tasks

**Best for**:

- API design and implementation
- Database modeling
- Server-side logic

**Example**:

```bash
# Using role name
automatosx run backend "Create a REST API endpoint for user management"

# Using display name (easier to remember!)
automatosx run Bob "Create a REST API endpoint for user management"
```

### quality.yaml - Queenie

**Purpose**: Quality assurance and code review

**Best for**:

- Code review and analysis
- Debugging and testing
- Quality assurance

**Example**:

```bash
automatosx run backend "Create a React component for user authentication"
```

### quality.yaml

**Purpose**: Code review and quality analysis

**Best for**:

- Reviewing pull requests
- Finding bugs and issues
- Suggesting improvements

**Example**:

```bash
automatosx run quality "Review the code in src/components/Auth.tsx"
```

### debugger.yaml

**Purpose**: Debugging and troubleshooting

**Best for**:

- Analyzing error messages
- Finding root causes
- Suggesting fixes

**Example**:

```bash
automatosx run debugger "Help me debug this error: TypeError: Cannot read property 'name' of undefined"
```

### writer.yaml

**Purpose**: Technical writing and documentation

**Best for**:

- Writing documentation
- Creating tutorials
- Explaining concepts

**Example**:

```bash
automatosx run writer "Write API documentation for the User authentication module"
```

## Available Abilities

### Code-Related

- **code-generation.md**: Generate new code from requirements
- **code-review.md**: Review code for quality and issues
- **refactoring.md**: Improve existing code structure
- **debugging.md**: Debug and fix code issues
- **testing.md**: Write and improve tests

### Analysis

- **error-analysis.md**: Analyze error messages and logs
- **performance-analysis.md**: Identify performance bottlenecks
- **security-audit.md**: Check for security vulnerabilities

### Documentation

- **documentation.md**: Write technical documentation
- **technical-writing.md**: Create technical content
- **content-creation.md**: Generate articles and guides

### Problem Solving

- **problem-solving.md**: Break down and solve problems
- **task-planning.md**: Plan and organize tasks
- **troubleshooting.md**: Diagnose and fix issues
- **best-practices.md**: Apply industry best practices

## Usage Patterns

### Pattern 1: Interactive Development

```bash
# Start with planning
automatosx chat backend
> "I need to build a REST API for user management"

# Generate code
automatosx run backend "Create Express.js routes for user CRUD operations"

# Review code
automatosx run quality "Review the user routes I just created"

# Debug issues
automatosx run debugger "The POST /users endpoint returns 500 error"
```

### Pattern 2: Code Review Workflow

```bash
# Review specific file
automatosx run quality "Review src/api/users.ts"

# Review entire directory
automatosx run quality "Review all files in src/api/"

# Security audit
automatosx run quality "Check src/api/auth.ts for security issues" \
  --abilities security-audit
```

### Pattern 3: Documentation Generation

```bash
# Generate README
automatosx run writer "Create a README.md for this project"

# API documentation
automatosx run writer "Document all API endpoints in src/routes/"

# Code comments
automatosx run backend "Add JSDoc comments to src/utils/helpers.ts"
```

### Pattern 4: Learning and Exploration

```bash
# Understand codebase
automatosx chat backend
> "Explain the architecture of this project"

# Learn specific concepts
automatosx run backend "How does the authentication flow work?"

# Get examples
automatosx run backend "Show me examples of using the memory system"
```

## Creating Custom Agents

### Step 1: Create Profile

```yaml
# .automatosx/agents/my-agent.yaml
name: my-agent
description: Custom agent for specific tasks
model: claude-3-sonnet-20240229
temperature: 0.7
maxTokens: 4096
timeout: 60000

abilities:
  - code-generation
  - debugging
  - best-practices

systemPrompt: |
  You are a specialized assistant for [your specific domain].

  Your key responsibilities:
  1. [Responsibility 1]
  2. [Responsibility 2]
  3. [Responsibility 3]

  Guidelines:
  - Follow [specific style guide]
  - Prioritize [specific aspect]
  - Always [specific behavior]
```

### Step 2: Test Agent

```bash
automatosx run my-agent "Test prompt"
```

### Step 3: Iterate

- Test with various prompts
- Adjust temperature for creativity
- Add/remove abilities as needed
- Refine systemPrompt for better results

## Creating Custom Abilities

### Step 1: Create Ability File

```markdown
<!-- .automatosx/abilities/my-ability.md -->
# My Custom Ability

Brief description of what this ability does.

## Purpose

Detailed explanation of when and why to use this ability.

## Usage Guidelines

1. First step
2. Second step
3. Third step

## Best Practices

- Best practice 1
- Best practice 2

## Examples

### Example 1: [Scenario]
[Detailed example with input and expected output]

### Example 2: [Scenario]
[Another example]

## Common Pitfalls

- Pitfall 1 and how to avoid it
- Pitfall 2 and how to avoid it
```

### Step 2: Reference in Agent

```yaml
# my-agent.yaml
abilities:
  - my-ability
```

### Step 3: Test

```bash
automatosx run my-agent "Use my custom ability to..."
```

## Tips and Best Practices

### Agent Design

1. **Single Responsibility**: Each agent should have a clear, focused purpose
2. **Descriptive Names**: Use names that clearly indicate the agent's role
3. **Specific System Prompts**: Provide detailed instructions for consistent behavior
4. **Appropriate Temperature**:
   - 0.0-0.3: Deterministic, factual tasks
   - 0.4-0.7: Balanced creativity and accuracy
   - 0.8-1.0: Creative, varied outputs

### Ability Design

1. **Clear Purpose**: Each ability should solve a specific problem
2. **Detailed Examples**: Show concrete usage patterns
3. **Best Practices**: Include dos and don'ts
4. **Composable**: Abilities should work well together

### Usage Tips

1. **Start Simple**: Begin with example agents, customize as needed
2. **Iterate Quickly**: Test agents with real tasks, refine based on results
3. **Use Memory**: Let agents remember context across sessions
4. **Combine Abilities**: Mix and match abilities for complex tasks
5. **Debug Mode**: Use `--debug` flag to see what's happening

## Troubleshooting

### Agent Not Found

```bash
# List available agents
automatosx list agents

# Verify agent file exists
ls .automatosx/agents/
```

### Abilities Not Working

```bash
# List available abilities
automatosx list abilities

# Check agent profile includes the ability
cat .automatosx/agents/my-agent.yaml
```

### Unexpected Behavior

1. Check agent's systemPrompt for clarity
2. Adjust temperature (lower = more focused)
3. Enable debug mode: `--debug`
4. Review memory context: `automatosx memory list`

## Real-World Use Cases

See `examples/use-cases/` for complete scenarios:

- Web application development
- API design and implementation
- Code migration and refactoring
- Security audit workflow
- Documentation generation

## Community Examples

Share your agents and abilities:

1. Fork the repository
2. Add your examples to this directory
3. Submit a pull request
4. Include description and usage instructions

## Resources

- [Main Documentation](../README.md)
- [Configuration Guide](../docs/configuration.md)
- [API Reference](../docs/api.md)
- [FAQ](../FAQ.md)
- [Troubleshooting](../TROUBLESHOOTING.md)

---

**Need help?** Open an issue at [GitHub Issues](https://github.com/defai-digital/automatosx/issues) - for bugs, questions, or feature requests (use "enhancement" label for wishlist items).
