# PRD: Multi-Model Discussion System

**Version**: 1.0.0
**Status**: Draft
**Author**: AutomatosX Team
**Date**: 2025-12-24

---

## Executive Summary

Users value AutomatosX for its ability to orchestrate multiple AI models. The key differentiator they want is **multi-model discussions** - where different LLM providers (Claude, Gemini, Codex, Qwen, GLM, Grok) can debate, discuss, and reach consensus on ideas. This leverages the unique cognitive strengths of each model to produce better outcomes than any single model alone.

---

## Problem Statement

### User Feedback

> "We use ax because ax can let AI agents discuss and conclude an idea. We want to make use of the advantage and edge of different LLM models. We want more agents to discuss."

### Current Limitations

1. **Single-Model Execution**: Workflows currently execute on one provider per step
2. **No Discussion Patterns**: No built-in way for models to debate or critique each other
3. **No Consensus Mechanisms**: No way to synthesize outputs from multiple models
4. **No Provider Affinity**: Agents can't specify preferred providers based on task type

### Opportunity

Each LLM has unique strengths:

| Provider | Strengths | Best For |
|----------|-----------|----------|
| **Claude** | Nuanced reasoning, safety, ethics, long-form writing | Code review, architecture, documentation, synthesis |
| **Gemini** | Multimodal, long context (1M+), research | Research, analysis, visual tasks, large codebases |
| **Codex** | Code generation, OpenAI ecosystem, broad knowledge | Implementation, debugging, refactoring |
| **Qwen** | **Best-in-class OCR (75% accuracy = GPT-4o)**, **29 language support**, translation, math (Qwen2.5-Math), coding (Qwen2.5-Coder), visual agent, 128K context | Document processing, OCR tasks, multilingual translation, math problems, cross-lingual content |
| **GLM** | **Agentic coding (73.8% SWE-bench)**, complex reasoning (42.8% HLE), tool use, UI generation, **1/7th cost of Claude** | Multi-step coding, terminal tasks, web browsing, cost-sensitive workloads |
| **Grok** | Real-time info, directness, Twitter/X data | Current events, social analysis, fact-checking |

### Provider Comparison Matrix

```
                 Reasoning  Code   Agents  Writing  Speed  Cost   Multilingual  OCR    Tool-Use
Claude           ★★★★★     ★★★★   ★★★★    ★★★★★    ★★★    ★★     ★★★          ★★★    ★★★★
Gemini           ★★★★      ★★★    ★★★     ★★★★     ★★★★   ★★★    ★★★          ★★★    ★★★
Codex            ★★★       ★★★★★  ★★★     ★★★      ★★★    ★★★    ★★           ★★     ★★★
Qwen             ★★★★      ★★★★   ★★★★    ★★★      ★★★★   ★★★★   ★★★★★        ★★★★★  ★★★★
GLM              ★★★★      ★★★★★  ★★★★★   ★★★      ★★★★★  ★★★★★  ★★★★★        ★★★    ★★★★★
Grok             ★★★       ★★★    ★★★     ★★★      ★★★★   ★★★    ★            ★★     ★★★
```

### GLM-4.7 Highlights (Source: [z.ai/blog/glm-4.7](https://z.ai/blog/glm-4.7))

GLM-4.7 stands out with:
- **73.8% on SWE-bench** (+5.8% vs GLM-4.6) - competitive with top models
- **66.7% on SWE-bench Multilingual** (+12.9%) - excellent for diverse codebases
- **42.8% on HLE (Humanity's Last Exam)** (+12.4%) - strong complex reasoning
- **41% on Terminal Bench 2.0** (+16.5%) - excellent for agentic terminal tasks
- **τ²-Bench and BrowseComp** - superior tool use and web browsing
- **Three Thinking Modes**: Interleaved, Preserved, Turn-level - maintains consistency in multi-turn conversations
- **Cost**: ~1/7th the price of Claude with 3x usage quota

### Qwen2.5 Highlights (Sources: [Qwen Blog](https://qwenlm.github.io/blog/qwen2.5-vl/), [HuggingFace](https://arxiv.org/abs/2412.15115))

Qwen2.5-VL stands out with:
- **75% OCR accuracy** - matches GPT-4o, outperforms Mistral-OCR (72.2%)
- **29 language support** - best-in-class multilingual (Chinese, Japanese, Korean, Arabic, etc.)
- **Superior translation** - accurately identifies and translates across Asian languages
- **128K context window** - process entire documents maintaining coherence
- **Visual agent** - computer use and phone use capabilities
- **Specialized models**: Qwen2.5-Math, Qwen2.5-Coder for domain excellence
- **Document understanding** - extracts pricing, product details, structured data

**Key Differentiators:**
- **GLM**: Best value - top-tier agentic coding at lowest cost, excellent for multi-step tasks and tool use
- **Qwen**: Best for OCR, translation, multilingual content, and mathematical reasoning
- **Claude**: Best reasoning depth, ideal for synthesis and complex analysis
- **Gemini**: Best for research with long context window (1M+ tokens)
- **Codex**: Best for pure code generation and OpenAI ecosystem integration
- **Grok**: Best for current events and real-time information

When multiple models discuss:
- They catch each other's mistakes
- Offer diverse perspectives
- Challenge assumptions
- Build on each other's ideas
- Reach more robust conclusions

---

## Goals

### Primary Goals

1. **Enable Multi-Model Discussions**: Allow multiple LLM providers to discuss/debate a topic
2. **Leverage Model Diversity**: Route tasks to providers based on their strengths
3. **Synthesize Consensus**: Combine outputs into unified conclusions
4. **Simple User Experience**: Easy-to-use workflows and CLI commands

### Success Metrics

| Metric | Target |
|--------|--------|
| User satisfaction with multi-model outputs | > 85% |
| Adoption of discussion workflows | > 40% of power users |
| Consensus quality score (user rated) | > 4/5 |
| Performance overhead vs single-model | < 3x latency |

---

## Proposed Solution

### 1. New Workflow Step Type: `discuss`

Add a new step type for multi-model discussions:

```yaml
steps:
  - stepId: debate-architecture
    type: discuss
    name: Architecture Debate
    config:
      # Discussion configuration
      pattern: round-robin  # or: debate, critique, synthesis, voting
      rounds: 3

      # Provider selection
      providers:
        - claude    # Strong reasoning
        - gemini    # Research capability
        - codex     # Code expertise

      # Discussion prompt
      prompt: |
        Discuss the best architecture for this system:
        {{input}}

        Consider: scalability, maintainability, cost, complexity.

      # Consensus configuration
      consensus:
        method: synthesis   # or: voting, moderator
        moderator: claude   # For moderator method
```

### 2. Discussion Patterns

#### Pattern 1: Round Robin
Each provider responds in turn, building on previous responses.

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Claude  │───▶│ Gemini  │───▶│  Codex  │───▶│ Claude  │───▶ ...
│ (1st)   │    │ (2nd)   │    │ (3rd)   │    │ (4th)   │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
```

**Use Case**: Brainstorming, idea exploration, collaborative writing

#### Pattern 2: Debate
Two or more models argue different positions.

```
       ┌─────────────────────────────────────┐
       │            Topic/Question            │
       └──────────────┬──────────────────────┘
                      │
         ┌────────────┼────────────┐
         ▼            ▼            ▼
    ┌─────────┐  ┌─────────┐  ┌─────────┐
    │ Claude  │  │ Gemini  │  │  Codex  │
    │  PRO    │  │ NEUTRAL │  │  CON    │
    └────┬────┘  └────┬────┘  └────┬────┘
         │            │            │
         └────────────┼────────────┘
                      ▼
              ┌─────────────┐
              │  Synthesis  │
              └─────────────┘
```

**Use Case**: Decision making, pros/cons analysis, architecture choices

#### Pattern 3: Critique
One model proposes, others critique, original model refines.

```
┌─────────┐         ┌─────────┐
│ Claude  │────────▶│ Proposal│
│ (Author)│         └────┬────┘
└─────────┘              │
                         ▼
              ┌──────────────────┐
              │    Critiques     │
              │ ┌──────┐ ┌─────┐ │
              │ │Gemini│ │Codex│ │
              │ └──────┘ └─────┘ │
              └────────┬─────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Claude Refines  │
              └─────────────────┘
```

**Use Case**: Code review, document review, quality improvement

#### Pattern 4: Voting
Each model votes on options with confidence scores.

```
         ┌────────────────────────────────┐
         │         Options A, B, C         │
         └───────────────┬────────────────┘
                         │
    ┌────────────────────┼────────────────────┐
    ▼                    ▼                    ▼
┌─────────┐        ┌─────────┐         ┌─────────┐
│ Claude  │        │ Gemini  │         │  Codex  │
│ Vote: A │        │ Vote: A │         │ Vote: B │
│ Conf:0.8│        │ Conf:0.9│         │ Conf:0.6│
└─────────┘        └─────────┘         └─────────┘
                         │
                         ▼
              ┌──────────────────┐
              │ Winner: A (67%)  │
              │ Weighted: A (72%)│
              └──────────────────┘
```

**Use Case**: Decision selection, best approach, democratic consensus

#### Pattern 5: Synthesis
Models discuss, then one synthesizes all perspectives.

```
    ┌─────────┐  ┌─────────┐  ┌─────────┐
    │ Claude  │  │ Gemini  │  │  Codex  │
    │Perspective│ │Perspective│ │Perspective│
    └────┬────┘  └────┬────┘  └────┬────┘
         │            │            │
         └────────────┼────────────┘
                      ▼
              ┌─────────────┐
              │ Synthesizer │
              │  (Claude)   │
              └─────────────┘
                      │
                      ▼
              ┌─────────────┐
              │  Unified    │
              │  Response   │
              └─────────────┘
```

**Use Case**: Complex decisions, comprehensive analysis, final recommendations

### 3. Provider Affinity for Agents

Allow agents to specify preferred providers:

```json
{
  "agentId": "security-auditor",
  "providerAffinity": {
    "preferred": ["claude", "gemini"],
    "taskMapping": {
      "code-review": "claude",
      "research": "gemini",
      "implementation": "codex"
    },
    "fallback": "claude"
  }
}
```

### 4. New CLI Commands

```bash
# Start a multi-model discussion
ax discuss "What's the best architecture for a real-time chat system?"

# With specific providers
ax discuss --providers claude,gemini,codex "Compare REST vs GraphQL"

# With pattern
ax discuss --pattern debate --rounds 3 "Monolith vs Microservices"

# With voting
ax discuss --pattern voting --options "REST,GraphQL,gRPC" "Best API style for mobile app"
```

### 5. New Workflow Templates

#### `multi-model-discussion` Template

```yaml
workflowId: multi-model-discussion
version: "1.0.0"
name: Multi-Model Discussion
description: Multiple LLM providers discuss and reach consensus

steps:
  - stepId: gather-perspectives
    type: parallel
    name: Gather Perspectives
    config:
      steps:
        - stepId: claude-perspective
          type: prompt
          config:
            provider: claude
            prompt: "Provide your perspective on: {{input}}"
        - stepId: gemini-perspective
          type: prompt
          config:
            provider: gemini
            prompt: "Provide your perspective on: {{input}}"
        - stepId: codex-perspective
          type: prompt
          config:
            provider: codex
            prompt: "Provide your perspective on: {{input}}"

  - stepId: synthesize
    type: prompt
    name: Synthesize Perspectives
    dependencies: [gather-perspectives]
    config:
      provider: claude
      prompt: |
        You are synthesizing multiple AI perspectives on a topic.

        Claude's perspective:
        {{steps.claude-perspective.output}}

        Gemini's perspective:
        {{steps.gemini-perspective.output}}

        Codex's perspective:
        {{steps.codex-perspective.output}}

        Create a unified response that:
        1. Identifies areas of agreement
        2. Notes important disagreements
        3. Synthesizes the best insights from each
        4. Provides a clear conclusion
```

#### `adversarial-debate` Template

```yaml
workflowId: adversarial-debate
version: "1.0.0"
name: Adversarial Debate
description: Models argue opposing positions to find truth

steps:
  - stepId: opening-statements
    type: parallel
    config:
      steps:
        - stepId: proponent
          type: prompt
          config:
            provider: claude
            prompt: "Argue strongly FOR: {{input}}"
        - stepId: opponent
          type: prompt
          config:
            provider: gemini
            prompt: "Argue strongly AGAINST: {{input}}"

  - stepId: rebuttals
    type: parallel
    dependencies: [opening-statements]
    config:
      steps:
        - stepId: pro-rebuttal
          type: prompt
          config:
            provider: claude
            prompt: |
              Respond to this criticism:
              {{steps.opponent.output}}

              Strengthen your position FOR: {{input}}
        - stepId: con-rebuttal
          type: prompt
          config:
            provider: gemini
            prompt: |
              Respond to this argument:
              {{steps.proponent.output}}

              Strengthen your position AGAINST: {{input}}

  - stepId: judge
    type: prompt
    dependencies: [rebuttals]
    config:
      provider: codex
      prompt: |
        You are an impartial judge. Evaluate this debate:

        ## FOR Position
        Opening: {{steps.proponent.output}}
        Rebuttal: {{steps.pro-rebuttal.output}}

        ## AGAINST Position
        Opening: {{steps.opponent.output}}
        Rebuttal: {{steps.con-rebuttal.output}}

        Provide:
        1. Strongest arguments from each side
        2. Logical fallacies or weak points
        3. Your verdict with reasoning
        4. Nuanced conclusion
```

### 6. Schema Changes

#### New `DiscussStepConfig` Schema

```typescript
export const DiscussStepConfigSchema = z.object({
  /** Discussion pattern */
  pattern: z.enum([
    'round-robin',
    'debate',
    'critique',
    'voting',
    'synthesis'
  ]),

  /** Number of discussion rounds */
  rounds: z.number().int().min(1).max(10).default(3),

  /** Providers to include */
  providers: z.array(z.string()).min(2).max(6),

  /** Discussion prompt */
  prompt: z.string().min(1).max(10000),

  /** Consensus configuration */
  consensus: z.object({
    method: z.enum(['synthesis', 'voting', 'moderator']),
    moderator: z.string().optional(),
    threshold: z.number().min(0).max(1).optional(),
  }),

  /** Provider-specific prompts */
  providerPrompts: z.record(z.string(), z.string()).optional(),

  /** Role assignments (for debate pattern) */
  roles: z.record(z.string(), z.string()).optional(),
});
```

#### Provider Affinity in Agent Schema

```typescript
export const ProviderAffinitySchema = z.object({
  /** Preferred providers in order */
  preferred: z.array(z.string()).max(6).optional(),

  /** Task type to provider mapping */
  taskMapping: z.record(z.string(), z.string()).optional(),

  /** Fallback provider */
  fallback: z.string().optional(),
});
```

---

## Implementation Plan

### Phase 1: Foundation (Week 1-2)

1. **Schema Changes**
   - Add `DiscussStepConfigSchema` to contracts
   - Add `ProviderAffinitySchema` to agent contracts
   - Add `provider` field to step config

2. **Core Domain**
   - Create `discussion-domain` package
   - Implement discussion patterns
   - Add provider routing logic

### Phase 2: Workflow Integration (Week 3-4)

3. **Workflow Engine**
   - Add `discuss` step type handler
   - Implement parallel provider execution
   - Add consensus synthesis

4. **Workflow Templates**
   - Create `multi-model-discussion` template
   - Create `adversarial-debate` template
   - Create `critique-refine` template

### Phase 3: CLI & MCP (Week 5-6)

5. **CLI Commands**
   - Add `ax discuss` command
   - Add provider flags
   - Add pattern selection

6. **MCP Tools**
   - Add `ax_discuss` tool
   - Add `ax_discussion_status` tool
   - Update agent tools with provider affinity

### Phase 4: Polish & Launch (Week 7-8)

7. **Testing**
   - Contract tests for new schemas
   - Integration tests for discussion patterns
   - E2E tests for workflows

8. **Documentation**
   - Update README with discussion features
   - Create discussion patterns guide
   - Add examples

---

## Technical Considerations

### Parallelism

- Execute provider calls in parallel where possible
- Use `Promise.allSettled` for graceful degradation
- Handle provider failures without failing entire discussion

### Latency

- Discussion workflows will be slower than single-model
- Mitigate with streaming where supported
- Consider async/background execution for long discussions

### Cost

- Multi-model discussions cost more (multiple API calls)
- Provide cost estimates before execution
- Allow users to limit rounds/providers

### Provider Availability

- Handle provider outages gracefully
- Fall back to available providers
- Warn users about degraded discussions

---

## User Experience

### Example Session

```bash
$ ax discuss "Should we use TypeScript or JavaScript for this project?"

Starting multi-model discussion with: claude, gemini, codex
Pattern: round-robin | Rounds: 3

━━━ Round 1 ━━━

📘 Claude:
TypeScript offers significant advantages for large codebases...

📗 Gemini:
Building on Claude's points, I'd add that TypeScript's type inference...

📙 Codex:
From a practical standpoint, the migration path from JavaScript...

━━━ Round 2 ━━━
...

━━━ Synthesis ━━━

All models agree on these key points:
1. TypeScript is better for large teams and codebases
2. JavaScript is faster for prototyping and small projects
3. The learning curve is minimal for experienced JS developers

Recommendation: Use TypeScript for this project because...
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Provider API costs | High costs for multi-model | Budget limits, round caps |
| Inconsistent outputs | Confusing results | Strong synthesis prompts |
| Latency | Poor UX | Streaming, async options |
| Provider outages | Failed discussions | Graceful degradation |
| Conflicting advice | User confusion | Clear consensus mechanisms |

---

## Success Criteria

1. Users can run multi-model discussions via CLI and workflows
2. At least 3 discussion patterns implemented (round-robin, debate, synthesis)
3. Provider affinity working in agent profiles
4. 90%+ test coverage on new code
5. Performance within 3x single-model latency
6. Documentation complete with examples

---

## Open Questions

1. Should we support streaming for discussion steps?
2. How do we handle very long discussions (token limits)?
3. Should users be able to save/resume discussions?
4. How do we visualize discussion history?
5. Should we add a "discussion memory" for context across rounds?

---

## Appendix A: Provider Strength Matrix (Detailed)

| Capability | Claude | Gemini | Codex | Qwen | GLM | Grok |
|------------|--------|--------|-------|------|-----|------|
| Reasoning | +++++ | ++++ | +++ | ++++ | ++++ | +++ |
| Code | ++++ | +++ | +++++ | ++++ | +++++ | +++ |
| Agentic Tasks | ++++ | +++ | +++ | ++++ | +++++ | +++ |
| Tool Use | ++++ | +++ | +++ | ++++ | +++++ | +++ |
| Research | ++++ | +++++ | +++ | +++ | +++ | ++++ |
| Writing | +++++ | ++++ | +++ | +++ | +++ | +++ |
| Math | ++++ | ++++ | +++ | +++++ | ++++ | +++ |
| **OCR** | +++ | +++ | ++ | +++++ | +++ | ++ |
| **Translation** | +++ | +++ | ++ | +++++ | ++++ | ++ |
| **Multilingual** | +++ | +++ | ++ | +++++ | +++++ | + |
| Speed | +++ | ++++ | +++ | ++++ | +++++ | ++++ |
| Cost | ++ | +++ | +++ | ++++ | +++++ | +++ |
| Real-time | ++ | ++++ | ++ | ++ | +++ | +++++ |
| UI/Visual Gen | +++ | ++++ | +++ | ++++ | ++++ | ++ |
| Long Context | ++++ | +++++ | +++ | ++++ | ++++ | +++ |
| Visual Agent | +++ | ++++ | +++ | +++++ | ++++ | ++ |

## Appendix B: Recommended Provider Combinations

| Use Case | Recommended Providers | Rationale |
|----------|----------------------|-----------|
| **Architecture Discussion** | Claude + GLM + Gemini | Claude for depth, GLM for agentic execution, Gemini for research |
| **Code Review** | Claude + GLM + Codex | Claude for review, GLM for SWE tasks, Codex for implementation |
| **Cost-Optimized** | GLM + Qwen + Grok | All cost-effective with good coverage |
| **Chinese Content** | GLM + Qwen + Gemini | Best Chinese language support |
| **Multilingual/Translation** | Qwen + GLM + Gemini | Qwen 29-language OCR + GLM Chinese + Gemini research |
| **Document Processing** | Qwen + Claude + Gemini | Qwen OCR + Claude analysis + Gemini long context |
| **Research Heavy** | Gemini + Claude + Grok | Long context + reasoning + real-time |
| **Math/Algorithms** | Qwen + Claude + GLM | Qwen math + Claude reasoning + GLM verification |
| **Full Coverage** | Claude + GLM + Qwen + Gemini | Maximum diversity (4 providers) |
| **Fast Iteration** | GLM + Qwen | Both fast and cost-effective |

## Appendix C: Default Provider Configurations

```yaml
# Recommended defaults for different patterns
defaults:
  synthesis:
    providers: [claude, glm, gemini]
    synthesizer: claude

  debate:
    providers: [claude, glm, codex]
    roles:
      claude: proponent
      glm: opponent
      codex: judge

  critique:
    providers: [glm, claude, gemini]
    author: glm  # Fast initial draft
    critics: [claude, gemini]

  voting:
    providers: [claude, glm, gemini, codex]

  round-robin:
    providers: [claude, glm, gemini]
```

---

*This PRD is a living document and will be updated as we gather more feedback and refine the implementation.*
