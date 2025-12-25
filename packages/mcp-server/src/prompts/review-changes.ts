/**
 * Review Changes Prompt
 *
 * User-controlled prompt template for code review with policy context.
 */

import type { MCPPrompt, MCPPromptMessage, PromptHandler } from '../types.js';
import { getPolicy, listPolicies } from '@defai.digital/guard';

// ============================================================================
// Prompt Definition
// ============================================================================

/**
 * Review changes prompt definition
 */
export const reviewChangesPrompt: MCPPrompt = {
  name: 'review-changes',
  description: 'Generate a code review prompt with governance policy context',
  arguments: [
    {
      name: 'policyId',
      description: 'Governance policy ID to apply (e.g., "bugfix", "rebuild")',
      required: true,
    },
    {
      name: 'changedFiles',
      description: 'Comma-separated list of changed file paths',
      required: true,
    },
    {
      name: 'context',
      description: 'Additional context about the changes',
      required: false,
    },
  ],
};

// ============================================================================
// Prompt Handler
// ============================================================================

/**
 * Handler for review-changes prompt
 */
export const handleReviewChanges: PromptHandler = async (args) => {
  const policyId = args.policyId ?? 'bugfix';
  const changedFiles = args.changedFiles ?? '';
  const context = args.context ?? '';

  const policy = getPolicy(policyId);

  if (policy === undefined) {
    const messages: MCPPromptMessage[] = [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Error: Policy "${policyId}" not found. Available policies: ${listPolicies().join(', ')}`,
        },
      },
    ];
    return { description: 'Policy not found', messages };
  }

  const files = changedFiles.split(',').map((f) => f.trim()).filter(Boolean);

  const promptText = `You are reviewing code changes under the "${policyId}" governance policy.

## Policy Constraints

**Allowed paths:**
${policy.allowedPaths.map((p) => `- ${p}`).join('\n') || '- (no restrictions)'}

**Forbidden paths:**
${policy.forbiddenPaths.map((p) => `- ${p}`).join('\n') || '- (none)'}

**Change radius limit:** ${policy.changeRadiusLimit} files

**Required gates:**
${policy.gates.map((g) => `- ${g}`).join('\n') || '- (none)'}

## Changed Files (${files.length})

${files.map((f) => `- ${f}`).join('\n') || '(no files specified)'}

${context ? `## Additional Context\n\n${context}` : ''}

## Review Instructions

1. Check that all changed files are within allowed paths
2. Verify no forbidden paths are modified
3. Ensure total changes stay within the radius limit (${policy.changeRadiusLimit} files)
4. Note any governance violations or concerns
5. Provide specific feedback on the implementation

Please review these changes and provide your assessment.`;

  const messages: MCPPromptMessage[] = [
    {
      role: 'user',
      content: {
        type: 'text',
        text: promptText,
      },
    },
  ];

  return {
    description: `Code review prompt for ${files.length} files under "${policyId}" policy`,
    messages,
  };
};
