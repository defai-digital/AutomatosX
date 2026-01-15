# Multi-Model Discussion Guide

This guide covers how to use AutomatosX's Multi-Model Discussion System to have multiple AI providers collaborate on complex topics through structured dialogue patterns.

## Overview

The Discussion System enables:
- **Multi-provider collaboration**: 2+ AI providers discuss topics together
- **Structured patterns**: Synthesis, voting, critique, debate
- **Consensus building**: Automatic synthesis of diverse perspectives
- **Fault tolerance**: Discussion continues even if one provider fails

## Quick Start

### Using the CLI

```bash
# Quick discussion - simple 2-3 provider consensus
ax discuss quick "What's the best approach for rate limiting in APIs?"

# Full discussion with explicit providers
ax discuss "Compare REST vs GraphQL for mobile apps" \
  --providers claude,gemini,codex \
  --pattern synthesis \
  --rounds 2
```

### Using MCP Tools

```typescript
// Quick discussion via MCP
const result = await ax_discuss_quick({
  topic: "Best practices for error handling",
  providers: ["claude", "gemini"]
});

// Full discussion with pattern
const result = await ax_discuss({
  topic: "Microservices vs Monolith architecture",
  pattern: "debate",
  providers: ["claude", "gemini", "codex"],
  rounds: 2,
  consensus: {
    method: "moderator",
    synthesizer: "claude"
  }
});
```

## Discussion Patterns

### 1. Synthesis Pattern (Default)

Multiple providers discuss freely, then a synthesizer combines insights.

```bash
ax discuss "Design a caching strategy for high-traffic APIs" \
  --pattern synthesis \
  --providers claude,gemini,codex \
  --rounds 2
```

**How it works:**
1. All providers respond to the initial topic
2. Providers see each other's responses and can refine
3. Final synthesis combines key insights

**Best for:** Open-ended questions, brainstorming, design decisions

### 2. Voting Pattern

Providers vote on options, consensus determined by threshold.

```bash
ax discuss "Which framework should we use for the frontend?" \
  --pattern voting \
  --providers claude,gemini,codex,grok \
  --rounds 1 \
  --threshold 0.5
```

**How it works:**
1. Providers analyze options and vote
2. Votes tallied, threshold determines consensus
3. Result includes vote distribution

**Best for:** Binary decisions, framework selection, yes/no questions

### 3. Critique Pattern

One provider proposes, others critique, revision cycle.

```bash
ax discuss "Write a secure authentication flow" \
  --pattern critique \
  --providers claude,gemini,codex \
  --rounds 3
```

**How it works:**
1. Round 1: First provider proposes solution
2. Round 2: Others critique the proposal
3. Round 3: Original proposer revises based on feedback

**Best for:** Code review, security analysis, improving solutions

### 4. Debate Pattern

Structured debate with assigned roles.

```bash
ax discuss "Should startups use microservices?" \
  --pattern debate \
  --providers claude,gemini,codex \
  --rounds 2
```

**How it works:**
1. Roles assigned: proponent, opponent, judge
2. Proponent argues for the position
3. Opponent argues against
4. Judge evaluates arguments and decides

**Best for:** Controversial topics, trade-off analysis, decision justification

## Configuration Options

### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--pattern` | Discussion pattern (synthesis/voting/critique/debate) | synthesis |
| `--providers` | Comma-separated provider list | claude,gemini |
| `--rounds` | Number of discussion rounds | 2 |
| `--context` | Additional context for discussion | - |
| `--threshold` | Voting consensus threshold (0-1) | 0.5 |
| `--timeout` | Max time in milliseconds | 60000 |
| `--format` | Output format (text/json) | text |

### Consensus Methods

| Method | Description |
|--------|-------------|
| `synthesis` | Synthesizer combines all perspectives |
| `voting` | Majority vote with threshold |
| `moderator` | Designated moderator makes final call |
| `unanimous` | All providers must agree |

## Advanced Usage

### Adding Context

Provide additional context to inform the discussion:

```bash
# From file
ax discuss "How can we optimize this code?" \
  --context "$(cat ./src/slow-function.ts)" \
  --pattern critique

# Direct context
ax discuss "Review this API design" \
  --context "POST /users creates users, GET /users/:id retrieves by ID"
```

### Custom Roles (Debate Pattern)

```bash
ax discuss "React vs Vue for our project" \
  --pattern debate \
  --providers claude,gemini,codex \
  --roles '{"claude": "proponent", "gemini": "opponent", "codex": "judge"}'
```

### JSON Output for Programmatic Use

```bash
ax discuss "Best testing strategy" --format json | jq .synthesis
```

Output structure:
```json
{
  "success": true,
  "pattern": "synthesis",
  "rounds": [{
    "roundNumber": 1,
    "responses": [
      {"provider": "claude", "content": "..."},
      {"provider": "gemini", "content": "..."}
    ]
  }],
  "synthesis": "Combined insights from all providers...",
  "participatingProviders": ["claude", "gemini"],
  "failedProviders": [],
  "totalDurationMs": 3500
}
```

## Workflows with Discuss Steps

Discussion can be embedded in workflows:

```yaml
workflowId: code-review-consensus
version: "1.0.0"
name: Multi-Model Code Review
steps:
  - stepId: discuss-improvements
    type: discuss
    name: Discuss Code Improvements
    config:
      pattern: critique
      providers:
        - claude
        - gemini
        - codex
      prompt: |
        Review this code and suggest improvements:
        ${input.code}
      rounds: 3
      consensus:
        method: synthesis
        synthesizer: claude
        includeDissent: true
```

## Error Handling

### Provider Failures

The discussion continues if providers fail:

```
Discussion Results
==================
Topic: Best database for time-series data

Participating: claude, gemini
Failed: codex (timeout)

Synthesis: [synthesis based on 2/3 providers]
```

### Minimum Provider Requirement

At least 2 providers must participate:

```bash
ax discuss "Topic" --providers claude
# Error: Discussion requires at least 2 providers
```

## Best Practices

1. **Choose appropriate patterns:**
   - Use `synthesis` for open-ended exploration
   - Use `voting` for clear decisions
   - Use `critique` for solution refinement
   - Use `debate` for trade-off analysis

2. **Set reasonable timeouts:**
   - Quick decisions: 30-60 seconds
   - Complex topics: 2-5 minutes

3. **Use 3+ providers for better consensus:**
   - Odd numbers work best for voting
   - More perspectives improve synthesis quality

4. **Provide clear context:**
   - Include relevant code or specs
   - State constraints and requirements

5. **Use rounds appropriately:**
   - Simple topics: 1-2 rounds
   - Complex analysis: 3+ rounds
   - Critique pattern: minimum 3 rounds recommended

## Troubleshooting

### Discussion Times Out

```bash
# Increase timeout
ax discuss "Complex topic" --timeout 120000  # 2 minutes
```

### Providers Not Available

```bash
# Check provider status
ax doctor

# Use only available providers
ax discuss "Topic" --providers $(ax doctor --json | jq -r '.available | join(",")')
```

### No Consensus Reached (Voting)

```bash
# Lower threshold
ax discuss "Topic" --pattern voting --threshold 0.4

# Or switch to synthesis
ax discuss "Topic" --pattern synthesis
```

## Examples

### Architecture Decision

```bash
ax discuss "Should we use event sourcing for our order system?" \
  --pattern debate \
  --providers claude,gemini,codex \
  --context "We have 10k orders/day, need audit trail, considering CQRS"
```

### Security Review

```bash
ax discuss "Review this authentication flow for vulnerabilities" \
  --pattern critique \
  --providers claude,gemini \
  --context "$(cat ./src/auth/login.ts)" \
  --rounds 3
```

### Technology Selection

```bash
ax discuss "PostgreSQL vs MongoDB for our e-commerce platform" \
  --pattern voting \
  --providers claude,gemini,codex,grok \
  --context "Flexible product catalog, ACID for orders, 100k products"
```

## Related

- [Workflows Guide](./building-software.md) - Using discuss steps in workflows
- [Agent Guide](./improving-apps.md) - Combining agents with discussions
- [CLI Reference](../reference/) - Full CLI documentation
