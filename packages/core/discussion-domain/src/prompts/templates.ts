/**
 * Prompt Templates for Multi-Model Discussions
 *
 * Templates for various discussion patterns and consensus mechanisms.
 * Uses {{variable}} syntax for interpolation.
 */

import type { DebateRole } from '@defai.digital/contracts';
import { PROVIDER_STRENGTHS } from '@defai.digital/contracts';

// ============================================================================
// Provider System Prompts
// ============================================================================

/**
 * Get provider-specific system prompt highlighting its strengths
 */
export function getProviderSystemPrompt(providerId: string): string {
  const strengths = PROVIDER_STRENGTHS[providerId] || [];
  const strengthsList = strengths.length > 0
    ? `Your key strengths include: ${strengths.join(', ')}.`
    : '';

  const providerDescriptions: Record<string, string> = {
    claude: 'You are Claude, known for nuanced reasoning, careful analysis, and ethical consideration.',
    glm: 'You are GLM, known for agentic coding (73.8% SWE-bench), practical execution, and cost efficiency.',
    qwen: 'You are Qwen, known for OCR (75% accuracy), multilingual understanding (29 languages), and mathematical reasoning.',
    gemini: 'You are Gemini, known for extensive research capabilities, long-context understanding, and real-time information.',
    codex: 'You are Codex, known for code generation and OpenAI ecosystem integration.',
    grok: 'You are Grok, known for real-time information and social media context.',
  };

  const description = providerDescriptions[providerId] || `You are ${providerId}, an AI assistant.`;

  return `${description} ${strengthsList}

When participating in multi-model discussions:
- Provide your unique perspective based on your strengths
- Be concise but thorough
- Acknowledge other viewpoints when responding to them
- Focus on adding value that other models might miss`;
}

// ============================================================================
// Round-Robin Pattern Templates
// ============================================================================

export const ROUND_ROBIN_INITIAL = `You are participating in a multi-model discussion about the following topic:

{{topic}}

{{context}}

Provide your perspective on this topic. Focus on:
- Key insights from your area of expertise
- Practical considerations
- Potential challenges or risks

Be thorough but concise.`;

export const ROUND_ROBIN_FOLLOWUP = `You are participating in a multi-model discussion. Here is the conversation so far:

## Original Topic
{{topic}}

## Previous Responses
{{previousResponses}}

Now provide your response. You should:
1. Build on the insights shared so far
2. Add new perspectives the previous models might have missed
3. Respectfully note any disagreements with reasoning
4. Synthesize ideas where possible

Be thorough but concise.`;

// ============================================================================
// Synthesis Pattern Templates
// ============================================================================

export const SYNTHESIS_INITIAL = `You are participating in a multi-model discussion about:

{{topic}}

{{context}}

Provide your unique perspective based on your strengths. Focus on:
- Insights specific to your expertise
- Key considerations others might overlook
- Concrete recommendations

This response will be combined with perspectives from other AI models.`;

export const SYNTHESIS_CROSS_DISCUSS = `You are participating in a multi-model discussion.

## Original Topic
{{topic}}

## Perspectives from Other Models
{{otherPerspectives}}

Now respond:
1. What insights do you agree with? Why?
2. What do you respectfully disagree with? Explain your reasoning.
3. What important points were missed?
4. How can these perspectives be combined effectively?`;

export const SYNTHESIS_FINAL = `You are synthesizing a multi-model discussion into a final answer.

## Original Topic
{{topic}}

## Initial Perspectives
{{initialPerspectives}}

## Cross-Discussion Responses
{{crossDiscussion}}

## Your Task
Create a comprehensive synthesis that:

1. **Areas of Agreement**: What do all models agree on?
2. **Key Disagreements**: Where do perspectives differ and why?
3. **Unique Insights**: What did each model contribute uniquely?
4. **Synthesis**: Combine the best insights into unified recommendations
5. **Conclusion**: Provide a clear, actionable answer to the original topic

Be thorough, balanced, and actionable.`;

// ============================================================================
// Debate Pattern Templates
// ============================================================================

export const DEBATE_PROPONENT = `You are arguing FOR the following position in a structured debate:

## Topic
{{topic}}

{{context}}

## Your Role: PROPONENT
You must argue in favor of the topic/proposal. Present your strongest arguments:
- Evidence and reasoning supporting the position
- Benefits and advantages
- Counters to potential objections
- Real-world examples if applicable

Be persuasive but intellectually honest.`;

export const DEBATE_OPPONENT = `You are arguing AGAINST the following position in a structured debate:

## Topic
{{topic}}

{{context}}

## Proponent's Arguments
{{proponentArguments}}

## Your Role: OPPONENT
You must argue against the topic/proposal. Present your strongest counter-arguments:
- Evidence and reasoning opposing the position
- Risks, drawbacks, and challenges
- Weaknesses in the proponent's arguments
- Alternative approaches

Be persuasive but intellectually honest.`;

export const DEBATE_REBUTTAL = `This is the rebuttal round of the debate.

## Topic
{{topic}}

## Previous Arguments
### Proponent
{{proponentArguments}}

### Opponent
{{opponentArguments}}

## Your Role: {{role}}
Provide your rebuttal:
1. Address the strongest points from the other side
2. Strengthen your original arguments
3. Identify any common ground
4. Make your closing argument`;

export const DEBATE_JUDGE = `You are the impartial judge in a structured debate.

## Topic
{{topic}}

## Proponent's Arguments
{{proponentArguments}}

## Opponent's Arguments
{{opponentArguments}}

## Rebuttals
### Proponent's Rebuttal
{{proponentRebuttal}}

### Opponent's Rebuttal
{{opponentRebuttal}}

## Your Task as Judge
Evaluate this debate fairly:

1. **Argument Strength**: Analyze the quality of arguments on both sides
2. **Evidence Quality**: Assess the evidence and reasoning presented
3. **Rebuttal Effectiveness**: How well did each side address counter-arguments?
4. **Winner Declaration**: Who presented the stronger case and why?
5. **Key Takeaways**: What should the audience learn from this debate?
6. **Nuanced Conclusion**: Provide a balanced final assessment

Be fair, thorough, and educational.`;

// ============================================================================
// Critique Pattern Templates
// ============================================================================

export const CRITIQUE_PROPOSAL = `You are proposing an approach to the following challenge:

{{topic}}

{{context}}

Present your proposal:
1. **Problem Analysis**: What are the key challenges?
2. **Proposed Solution**: Your recommended approach
3. **Implementation Plan**: How to execute the solution
4. **Expected Outcomes**: What results to expect
5. **Potential Risks**: What could go wrong?

Be specific and actionable.`;

export const CRITIQUE_REVIEW = `You are reviewing a proposal from another AI model.

## Original Challenge
{{topic}}

## Proposal Being Reviewed
{{proposal}}

Provide a thorough critique:
1. **Strengths**: What works well in this proposal?
2. **Weaknesses**: What are the gaps or problems?
3. **Risks**: What risks were underestimated or missed?
4. **Suggestions**: Specific improvements to consider
5. **Alternative Approaches**: Other ways to tackle this

Be constructive and specific.`;

export const CRITIQUE_REVISION = `You are revising your proposal based on critiques from other models.

## Original Challenge
{{topic}}

## Your Original Proposal
{{originalProposal}}

## Critiques Received
{{critiques}}

Revise your proposal:
1. Acknowledge valid criticisms
2. Address the weaknesses identified
3. Incorporate useful suggestions
4. Explain what you kept and why
5. Present the improved proposal

Show how feedback improved the solution.`;

// ============================================================================
// Voting Pattern Templates
// ============================================================================

export const VOTING_EVALUATE = `You are evaluating options for the following decision:

## Decision to Make
{{topic}}

## Options to Evaluate
{{options}}

{{context}}

For each option, analyze:
1. **Pros**: Benefits and advantages
2. **Cons**: Drawbacks and risks
3. **Fit**: How well it addresses the need

Then cast your vote:
- **Your Vote**: [Option name]
- **Confidence**: [0-100]%
- **Reasoning**: Why this option is best`;

export const VOTING_TALLY = `A voting process has concluded. Summarize the results:

## Decision Topic
{{topic}}

## Options
{{options}}

## Votes Cast
{{votes}}

Provide:
1. **Winner**: The option with the most support
2. **Vote Breakdown**: How each option performed
3. **Consensus Level**: How much agreement was there?
4. **Key Factors**: What drove the votes?
5. **Recommendation**: Final recommendation based on the vote`;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Interpolate template with variables
 */
export function interpolate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value || '');
  }
  // Remove any remaining unmatched variables
  result = result.replace(/\{\{[^}]+\}\}/g, '');
  return result.trim();
}

/**
 * Format previous responses for inclusion in prompts
 */
export function formatPreviousResponses(
  responses: { provider: string; content: string; role?: DebateRole | undefined }[]
): string {
  return responses
    .map(r => {
      const roleLabel = r.role ? ` (${r.role})` : '';
      return `### ${r.provider}${roleLabel}\n${r.content}`;
    })
    .join('\n\n');
}

/**
 * Format voting options for prompts
 */
export function formatVotingOptions(options: string[]): string {
  return options.map((opt, i) => `${i + 1}. ${opt}`).join('\n');
}

/**
 * Format votes for tally prompt
 */
export function formatVotes(
  votes: { provider: string; choice: string; confidence: number; reasoning?: string | undefined }[]
): string {
  return votes
    .map(v => {
      const reasoning = v.reasoning ? `\n   Reasoning: ${v.reasoning}` : '';
      return `- **${v.provider}**: ${v.choice} (${Math.round(v.confidence * 100)}% confidence)${reasoning}`;
    })
    .join('\n');
}

/**
 * Get role-specific prompt modifier
 */
export function getRolePromptModifier(role: DebateRole): string {
  const modifiers: Record<DebateRole, string> = {
    proponent: 'Argue in favor of the position.',
    opponent: 'Argue against the position.',
    judge: 'Evaluate the debate impartially.',
    moderator: 'Facilitate the discussion and ensure all voices are heard.',
    neutral: 'Provide a balanced, objective perspective.',
  };
  return modifiers[role] || '';
}
