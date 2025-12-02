# Agent Templates

**Introduced in**: v5.0.0
**Status**: Stable

---

## Overview

Agent templates provide a quick way to create new agents with pre-configured settings. Instead of manually writing YAML files, you can create fully-functional agents in seconds using interactive prompts or one-line commands.

### Benefits

✅ **Fast Creation**: Create agents in seconds, not minutes
✅ **Consistent Structure**: All agents follow best practices
✅ **Pre-configured Teams**: Auto-assigned to appropriate teams
✅ **Customizable**: Modify templates or create your own
✅ **Beginner-Friendly**: Interactive mode guides you through setup

---

## Quick Start

### Interactive Creation (Recommended for Beginners)

```bash
# Let the CLI guide you through agent creation
ax agent create my-agent --template developer --interactive
```

**Interactive prompts**:
```
? Agent name: backend-api
? Display name: Barry
? Role: Senior Backend Engineer
? Team: engineering
? Description: Backend API development specialist
? Additional abilities (comma-separated): api-design, database-optimization

✓ Agent created successfully: backend-api
  Location: .automatosx/agents/backend-api.yaml
  Team: engineering
  Template: developer

Next steps:
  ax agent show backend-api    # View configuration
  ax run backend-api "test"    # Run your agent
```

### One-Line Creation (For Advanced Users)

```bash
# Create agent with all parameters in one command
ax agent create backend \
  --template developer \
  --display-name "Bob" \
  --role "Senior Backend Engineer" \
  --team engineering \
  --description "Backend API specialist"
```

---

## Available Templates

AutomatosX includes 5 pre-built templates:

### 1. **basic-agent**
- **Team**: core
- **Purpose**: Minimal agent configuration
- **Use Cases**: Simple tasks, prototyping, learning
- **Abilities**: general-knowledge, code-helper

```bash
ax agent create my-agent --template basic-agent --interactive
```

### 2. **developer**
- **Team**: engineering
- **Purpose**: Software development
- **Use Cases**: Code generation, refactoring, debugging
- **Abilities**: code-generation, refactoring, testing, code-review

```bash
ax agent create backend --template developer \
  --display-name "Bob" \
  --role "Backend Engineer"
```

### 3. **analyst**
- **Team**: business
- **Purpose**: Business analysis
- **Use Cases**: Requirements gathering, data analysis, reporting
- **Abilities**: business-analysis, data-interpretation, documentation

```bash
ax agent create ba --template analyst \
  --display-name "Alice" \
  --role "Business Analyst"
```

### 4. **designer**
- **Team**: design
- **Purpose**: UI/UX design
- **Use Cases**: Design reviews, mockups, user experience
- **Abilities**: design-critique, ux-principles, accessibility

```bash
ax agent create ux --template designer \
  --display-name "Diana" \
  --role "UX Designer"
```

### 5. **qa-specialist**
- **Team**: core
- **Purpose**: Quality assurance
- **Use Cases**: Testing, bug reports, quality reviews
- **Abilities**: test-planning, bug-analysis, quality-review

```bash
ax agent create tester --template qa-specialist \
  --display-name "Queenie" \
  --role "QA Engineer"
```

---

## CLI Commands

### List Templates

```bash
# View all available templates
ax agent templates
```

**Output**:
```
Available Agent Templates:

┌───────────────┬────────────┬──────────────────────────────┐
│ Template      │ Team       │ Description                  │
├───────────────┼────────────┼──────────────────────────────┤
│ basic-agent   │ core       │ Minimal agent configuration  │
│ developer     │ engineering│ Software development         │
│ analyst       │ business   │ Business analysis            │
│ designer      │ design     │ UI/UX design                 │
│ qa-specialist │ core       │ Quality assurance            │
└───────────────┴────────────┴──────────────────────────────┘

Use: ax agent create <name> --template <template>
```

### Create from Template

```bash
# Interactive mode
ax agent create <name> --template <template> --interactive

# One-line mode
ax agent create <name> \
  --template <template> \
  --display-name "<name>" \
  --role "<role>" \
  --team <team>

# Force overwrite existing
ax agent create <name> --template <template> --force
```

### View Created Agent

```bash
# Show agent configuration
ax agent show <name>

# Run agent to test
ax run <name> "Test task"
```

---

## Template Structure

Templates are YAML files located in `examples/templates/`.

### Example: Developer Template

```yaml
# examples/templates/developer.yaml
name: {{AGENT_NAME}}
team: engineering
displayName: "{{DISPLAY_NAME | default: Developer}}"
role: {{ROLE | default: Software Developer}}
description: {{DESCRIPTION | default: Software development specialist}}

abilities:
  - {{ABILITIES}}

systemPrompt: |
  You are a {{ROLE | default: software developer}} specializing in:
  - Writing clean, maintainable code
  - Following best practices and design patterns
  - Code review and refactoring
  - Test-driven development

  Always:
  - Write clear, well-documented code
  - Consider edge cases and error handling
  - Follow the team's coding standards
  - Provide explanations for technical decisions

# Orchestration settings (v5.2+)
orchestration:
  maxDelegationDepth: 2
  # canReadWorkspaces and canWriteToShared removed in v5.2
  # All agents have equal access to shared workspaces
```

### Template Variables

Templates support variable substitution:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `{{AGENT_NAME}}` | ✅ | - | Agent identifier (lowercase, no spaces) |
| `{{DISPLAY_NAME}}` | ❌ | "Agent" | Human-readable name |
| `{{ROLE}}` | ❌ | Template-specific | Agent role/title |
| `{{TEAM}}` | ❌ | Template-specific | Team assignment |
| `{{DESCRIPTION}}` | ❌ | Template-specific | Agent description |
| `{{ABILITIES}}` | ❌ | Template-specific | Additional abilities |

### Default Values

Variables can have default values:

```yaml
role: {{ROLE | default: Software Developer}}
# If ROLE not provided, uses "Software Developer"

displayName: "{{DISPLAY_NAME | default: Dev}}"
# If DISPLAY_NAME not provided, uses "Dev"
```

---

## Creating Custom Templates

### Step 1: Create Template File

```bash
# Create custom template
cat > examples/templates/my-template.yaml << 'EOF'
name: {{AGENT_NAME}}
team: {{TEAM | default: core}}
displayName: "{{DISPLAY_NAME | default: My Agent}}"
role: {{ROLE | default: Specialist}}
description: {{DESCRIPTION | default: Custom specialist}}

abilities:
  - {{ABILITIES}}

systemPrompt: |
  You are a {{ROLE}} with expertise in:
  - [Your expertise area]
  - [Your specialty]

  Your approach:
  - [Your methodology]
  - [Your guidelines]

orchestration:
  maxDelegationDepth: 2
  # canWriteToShared removed in v5.2 - all agents share workspaces
EOF
```

### Step 2: Test Template

```bash
# Create agent from custom template
ax agent create test-agent --template my-template --interactive
```

### Step 3: Share Template

```bash
# Add to examples/templates/ directory
cp my-template.yaml examples/templates/

# Template will be available via:
ax agent templates
```

---

## Template Engine

AutomatosX uses a simple template engine for variable substitution.

### Features

1. **Simple Variables**: `{{VARIABLE_NAME}}`
2. **Default Values**: `{{VARIABLE | default: value}}`
3. **Recursive Rendering**: Variables in nested structures
4. **Validation**: Checks for missing required variables

### Example Processing

**Input Template**:
```yaml
name: {{AGENT_NAME}}
role: {{ROLE | default: Developer}}
```

**Variables**:
```javascript
{
  AGENT_NAME: "backend",
  // ROLE not provided
}
```

**Output**:
```yaml
name: backend
role: Developer  # Used default value
```

---

## Best Practices

### 1. **Choose the Right Template**

```bash
# ✅ Good: Match template to purpose
ax agent create backend --template developer      # For code
ax agent create analyst --template analyst        # For business

# ❌ Bad: Wrong template for task
ax agent create backend --template designer       # Mismatched
```

### 2. **Use Meaningful Names**

```bash
# ✅ Good: Descriptive names
ax agent create backend-api --display-name "Barry"
ax agent create frontend-ui --display-name "Fiona"

# ❌ Bad: Generic names
ax agent create agent1 --display-name "Agent"
ax agent create test --display-name "Test"
```

### 3. **Customize for Your Needs**

```bash
# ✅ Good: Add specific abilities
ax agent create ml-ops --template developer \
  --description "MLOps and model deployment" \
  --abilities "ml-modeling,data-processing"

# ❌ Bad: Use template as-is without customization
ax agent create ml-ops --template developer
# Missing ML-specific context
```

### 4. **Use Interactive Mode When Learning**

```bash
# ✅ Good: Interactive for beginners
ax agent create my-first-agent --template basic-agent --interactive

# ✅ Also Good: One-line for automation
ax agent create agent-$ID --template developer \
  --display-name "Agent $ID" --role "Developer"
```

### 5. **Test Before Using in Production**

```bash
# Create agent
ax agent create test-agent --template developer --interactive

# Test with simple task
ax run test-agent "Explain your role"

# Review output
ax agent show test-agent

# Use in production if satisfied
ax run test-agent "Real task"
```

---

## Common Use Cases

### 1. **Quick Prototype**

```bash
# Create a basic agent to test an idea
ax agent create prototype --template basic-agent \
  --display-name "Proto" \
  --role "Prototype Agent" \
  --interactive
```

### 2. **Team Expansion**

```bash
# Add specialized engineers to your team
ax agent create backend-auth --template developer \
  --display-name "Barry" \
  --role "Auth Specialist" \
  --description "Authentication and authorization expert"

ax agent create backend-data --template developer \
  --display-name "Dara" \
  --role "Data Engineer" \
  --description "Database and data pipeline specialist"
```

### 3. **Cross-Functional Team**

```bash
# Create a complete product team
ax agent create pm --template analyst \
  --display-name "Paul" --role "Product Manager"

ax agent create designer --template designer \
  --display-name "Diana" --role "UX Designer"

ax agent create dev --template developer \
  --display-name "Dave" --role "Full-Stack Developer"

ax agent create qa --template qa-specialist \
  --display-name "Queenie" --role "QA Engineer"
```

### 4. **Specialized Workflows**

```bash
# Create agents for specific workflows
ax agent create code-reviewer --template developer \
  --display-name "Rex" \
  --role "Code Reviewer" \
  --description "Focuses on code quality and best practices"

ax agent create bug-hunter --template qa-specialist \
  --display-name "Bugsy" \
  --role "Bug Hunter" \
  --description "Finds and reports bugs efficiently"
```

---

## Migration from Manual Creation

### Before (Manual YAML)

```bash
# Step 1: Create file manually
nano .automatosx/agents/backend.yaml

# Step 2: Write YAML configuration
name: backend
team: engineering
role: Backend Developer
abilities:
  - code-generation
  - backend-development
systemPrompt: |
  You are a backend developer...

# Step 3: Save and test
ax run backend "test"
```

**Time**: 5-10 minutes

### After (Template-Based)

```bash
# One command - 30 seconds
ax agent create backend --template developer \
  --display-name "Bob" \
  --role "Backend Developer" \
  --interactive
```

**Time**: 30 seconds

**Benefit**: 10-20x faster ⚡

---

## Troubleshooting

### Template not found

**Symptoms**: Error: "Template 'xyz' not found"

**Solution**: List available templates
```bash
ax agent templates
```

### Missing required variables

**Symptoms**: Error: "Missing required variable: AGENT_NAME"

**Solution**: Provide all required parameters
```bash
# Missing name
ax agent create --template developer  # ❌ Error

# With name
ax agent create backend --template developer  # ✅ Works
```

### Agent already exists

**Symptoms**: Error: "Agent 'xyz' already exists"

**Solution**: Use --force flag to overwrite
```bash
ax agent create backend --template developer --force
```

### Template rendering errors

**Symptoms**: Malformed YAML output

**Solution**: Check template file syntax
```bash
# Validate template YAML
cat examples/templates/developer.yaml | npx js-yaml
```

---

## Advanced Topics

### Template Inheritance

Create templates that extend other templates:

```yaml
# examples/templates/senior-developer.yaml
extends: developer
name: {{AGENT_NAME}}
role: {{ROLE | default: Senior Developer}}

# Add senior-specific abilities
abilities:
  - architecture-design
  - mentoring
  - technical-leadership
```

### Dynamic Ability Selection

```bash
# Prompt for abilities during creation
ax agent create backend --template developer --interactive

# CLI will ask:
? Additional abilities (comma-separated): api-design,database-optimization
```

### Batch Agent Creation

```bash
# Create multiple agents from script
for role in backend frontend devops; do
  ax agent create $role --template developer \
    --display-name "${role^}" \
    --role "${role^} Engineer"
done
```

---

## See Also

- [Team Configuration Guide](./team-configuration.md) - Team setup
- [CLI Commands Reference](../reference/cli-commands.md) - Command details
- [Core Concepts](./core-concepts.md) - Understanding agents

---

**Last Updated**: 2025-10-09
**Version**: v5.0.1
