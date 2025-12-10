/**
 * Prompt Composer - Assembles cognitive prompts from modular components
 *
 * v13.0.0: Composes final agent prompts by layering:
 * 1. Persona (existing systemPrompt content)
 * 2. Reasoning Scaffold (PROVER or LITE)
 * 3. Role Checklist (domain-specific verification)
 * 4. Output Contract (structured response format)
 * 5. Uncertainty Protocol (ask vs. proceed guidance)
 *
 * This modular approach allows:
 * - Consistent cognitive framework across all agents
 * - Role-specific customizations
 * - Easy updates to individual components
 */

import type {
  CognitiveFrameworkConfig,
  ComposedPrompt,
  PromptCompositionOptions,
  RepoContext,
} from '../../types/cognitive.js';

import { getScaffoldTemplate, recommendScaffold } from './reasoning-scaffolds.js';
import { getChecklistTemplate, applyChecklistOverrides } from './role-checklists.js';
import { getContractTemplate, recommendContract } from './output-contracts.js';
import { getProtocolTemplate } from './uncertainty-protocol.js';

/**
 * Estimate token count (rough approximation: ~4 chars per token)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Clean the persona section by removing old "thinking patterns" that are
 * now handled by the cognitive framework
 */
function cleanPersonaSection(basePrompt: string): string {
  // Remove old-style thinking patterns sections that are now in the framework
  let cleaned = basePrompt;

  // Remove "Your thinking patterns:" sections
  cleaned = cleaned.replace(
    /Your thinking patterns:[\s\S]*?(?=\n\n|\n##|\n\*\*[A-Z]|$)/gi,
    ''
  );

  // Remove "Thinking patterns:" sections
  cleaned = cleaned.replace(
    /Thinking patterns:[\s\S]*?(?=\n\n|\n##|\n\*\*[A-Z]|$)/gi,
    ''
  );

  // Remove "## Thinking Patterns" sections
  cleaned = cleaned.replace(
    /## Thinking Patterns[\s\S]*?(?=\n##|$)/gi,
    ''
  );

  // Remove duplicate "Communication style:" lines (common issue in existing prompts)
  const lines = cleaned.split('\n');
  const seenCommunicationStyle = new Set<string>();
  const dedupedLines = lines.filter(line => {
    if (line.trim().startsWith('Communication style:')) {
      const key = line.trim();
      if (seenCommunicationStyle.has(key)) {
        return false;
      }
      seenCommunicationStyle.add(key);
    }
    return true;
  });
  cleaned = dedupedLines.join('\n');

  // Clean up excessive whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}

/**
 * Format repository context for prompt injection
 */
function formatRepoContext(context: RepoContext): string {
  const lines: string[] = ['**Repository Context**'];

  if (context.packageManager) {
    lines.push(`- Package manager: ${context.packageManager}`);
  }
  if (context.moduleSystem) {
    lines.push(`- Module system: ${context.moduleSystem}`);
  }
  if (context.testFramework) {
    lines.push(`- Test framework: ${context.testFramework}`);
  }
  if (context.tempDir) {
    lines.push(`- Temp directory: ${context.tempDir}`);
  }
  if (context.rules && context.rules.length > 0) {
    lines.push('- Additional rules:');
    for (const rule of context.rules) {
      lines.push(`  - ${rule}`);
    }
  }

  return lines.join('\n');
}

/**
 * Compose a complete prompt from modular components
 */
export function composePrompt(options: PromptCompositionOptions): ComposedPrompt {
  const { basePrompt, config, additionalContext, repoContext } = options;

  const sections: string[] = [];

  // 1. Persona Layer (cleaned)
  const personaSection = cleanPersonaSection(basePrompt);
  if (personaSection) {
    sections.push(personaSection);
  }

  // 2. Repository Context (if provided)
  if (repoContext) {
    sections.push(formatRepoContext(repoContext));
  }

  // 3. Additional Context (if provided)
  if (additionalContext) {
    sections.push(additionalContext);
  }

  // 4. Reasoning Scaffold
  const scaffoldTemplate = getScaffoldTemplate(config.scaffold);
  sections.push(scaffoldTemplate);

  // 5. Role Checklist
  if (config.checklist !== 'none') {
    let checklistTemplate = getChecklistTemplate(config.checklist);

    // Apply overrides if specified
    if (config.checklistOverrides) {
      checklistTemplate = applyChecklistOverrides(config.checklist, config.checklistOverrides);
    }

    // Add custom checklist items if specified
    if (config.customChecklist && config.customChecklist.length > 0) {
      const customSection = `\n**Custom Checks**\n${config.customChecklist.map(item => `- [ ] ${item}`).join('\n')}\n`;
      checklistTemplate = checklistTemplate.replace(
        /Mark items as \[x\]/,
        customSection + '\nMark items as [x]'
      );
    }

    sections.push(checklistTemplate);
  }

  // 6. Output Contract
  const contractTemplate = getContractTemplate(config.outputContract);
  sections.push(contractTemplate);

  // 7. Uncertainty Protocol
  const protocolTemplate = getProtocolTemplate(config.uncertaintyMode);
  sections.push(protocolTemplate);

  // Compose final prompt
  const fullText = sections.join('\n\n---\n\n');

  return {
    text: fullText,
    components: {
      persona: !!personaSection,
      scaffold: config.scaffold,
      checklist: config.checklist,
      outputContract: config.outputContract,
      uncertainty: config.uncertaintyMode,
    },
    estimatedTokens: estimateTokens(fullText),
  };
}

/**
 * Compose a prompt with smart defaults based on task
 */
export function composeSmartPrompt(
  basePrompt: string,
  taskDescription: string,
  roleHint?: string
): ComposedPrompt {
  // Recommend scaffold and contract based on task
  const recommendedScaffold = recommendScaffold(taskDescription);
  const recommendedContract = recommendContract(taskDescription);

  // Infer checklist from role hint or task content
  let checklist: CognitiveFrameworkConfig['checklist'] = 'none';
  if (roleHint) {
    const lowerRole = roleHint.toLowerCase();
    if (lowerRole.includes('backend') || lowerRole.includes('api') || lowerRole.includes('server')) {
      checklist = 'backend';
    } else if (lowerRole.includes('frontend') || lowerRole.includes('ui') || lowerRole.includes('react')) {
      checklist = 'frontend';
    } else if (lowerRole.includes('security') || lowerRole.includes('audit')) {
      checklist = 'security';
    } else if (lowerRole.includes('quality') || lowerRole.includes('test') || lowerRole.includes('qa')) {
      checklist = 'quality';
    } else if (lowerRole.includes('architect') || lowerRole.includes('design')) {
      checklist = 'architecture';
    } else if (lowerRole.includes('devops') || lowerRole.includes('infra') || lowerRole.includes('deploy')) {
      checklist = 'devops';
    } else if (lowerRole.includes('data') || lowerRole.includes('pipeline') || lowerRole.includes('etl')) {
      checklist = 'data';
    } else if (lowerRole.includes('product') || lowerRole.includes('pm')) {
      checklist = 'product';
    }
  }

  const config: CognitiveFrameworkConfig = {
    scaffold: recommendedScaffold,
    checklist,
    outputContract: recommendedContract,
    uncertaintyMode: 'balanced',
  };

  return composePrompt({
    basePrompt,
    config,
  });
}

/**
 * Default AutomatosX repository context
 */
export const AUTOMATOSX_REPO_CONTEXT: RepoContext = {
  packageManager: 'pnpm',
  moduleSystem: 'ESM (strict, with .js extensions)',
  testFramework: 'Vitest',
  tempDir: 'automatosx/tmp/',
  rules: [
    'Use explicit .js extensions in imports',
    'Store temporary files in automatosx/tmp/',
    'Store PRD files in automatosx/PRD/',
    'Follow existing patterns in codebase',
  ],
};

/**
 * Compose a prompt with AutomatosX defaults
 */
export function composeAutomatosXPrompt(
  basePrompt: string,
  config: CognitiveFrameworkConfig
): ComposedPrompt {
  return composePrompt({
    basePrompt,
    config,
    repoContext: AUTOMATOSX_REPO_CONTEXT,
  });
}

/**
 * Validate a cognitive framework configuration
 */
export function validateConfig(config: Partial<CognitiveFrameworkConfig>): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!config.scaffold) {
    errors.push('scaffold is required');
  } else if (!['prover', 'lite'].includes(config.scaffold)) {
    errors.push(`Invalid scaffold: ${config.scaffold}. Must be 'prover' or 'lite'`);
  }

  if (!config.checklist) {
    warnings.push('No checklist specified, will use "none"');
  }

  if (!config.outputContract) {
    warnings.push('No output contract specified, will use "standard"');
  }

  if (!config.uncertaintyMode) {
    warnings.push('No uncertainty mode specified, will use "balanced"');
  }

  // Check for potentially conflicting settings
  if (config.scaffold === 'lite' && config.outputContract === 'detailed') {
    warnings.push('Using LITE scaffold with DETAILED output contract may be inconsistent');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export const PromptComposer = {
  compose: composePrompt,
  composeSmart: composeSmartPrompt,
  composeAutomatosX: composeAutomatosXPrompt,
  cleanPersona: cleanPersonaSection,
  validateConfig,
  AUTOMATOSX_CONTEXT: AUTOMATOSX_REPO_CONTEXT,
};

export default PromptComposer;
