/**
 * Iterate Auto-Responder
 *
 * Generates appropriate responses for classified AI prompts in iterate mode.
 *
 * **Response Strategy**:
 * - confirmation_prompt → Templated affirmative ("yes", "continue", "proceed")
 * - status_update → No response (no-op)
 * - genuine_question → Pause (no auto-response)
 * - blocking_request → Pause (no auto-response)
 * - error_signal → Recovery logic or pause
 * - completion_signal → Finalize stage
 * - rate_limit_or_context → Switch provider or pause
 *
 * @module core/iterate/iterate-auto-responder
 * @since v6.4.0
 */

import type {
  Classification,
  ClassificationType,
  ResponseTemplate,
  TemplateLibrary
} from '../../types/iterate.js';
import { logger } from '../../shared/logging/logger.js';
import { readFile } from 'fs/promises';
import { load as yamlLoad } from 'js-yaml';
import { existsSync } from 'fs';

/**
 * Context for response generation
 */
export interface ResponseContext {
  /** Original AI message */
  message: string;

  /** Classification result */
  classification: Classification;

  /** Provider name (for provider-specific templates) */
  provider: string;

  /** Variables for template substitution */
  variables?: Record<string, string>;

  /** Current stage ID (if in stage execution) */
  stageId?: string;
}

/**
 * Responder configuration
 */
export interface ResponderConfig {
  /** Path to template library */
  templateLibraryPath: string;

  /** Enable template randomization (avoid detection patterns) */
  randomizeTemplates: boolean;

  /** Enable context-aware variable substitution */
  enableContextVars: boolean;
}

/**
 * Iterate Auto-Responder
 *
 * Generates contextually appropriate responses to AI confirmations and prompts.
 *
 * **Template System**:
 * - Simple templates: "Yes, please proceed."
 * - Contextualized: "Yes, implement {{component_name}} as described."
 * - Randomized: Multiple templates per type to avoid patterns
 * - Provider-specific: Different styles for Claude vs Gemini vs OpenAI
 *
 * **Usage**:
 * ```typescript
 * const responder = new IterateAutoResponder(config);
 * const response = await responder.generateResponse(classification, context);
 *
 * if (response) {
 *   await provider.send(response);
 * }
 * ```
 *
 * @since v6.4.0
 */
export class IterateAutoResponder {
  private config: ResponderConfig;
  private templates?: TemplateLibrary;

  /**
   * Create IterateAutoResponder
   *
   * @param config - Responder configuration
   */
  constructor(config: ResponderConfig) {
    this.config = config;

    logger.debug('IterateAutoResponder created', {
      templateLibraryPath: config.templateLibraryPath,
      randomizeTemplates: config.randomizeTemplates
    });
  }

  /**
   * Generate response for classified AI prompt
   *
   * **Response Strategy**:
   * - confirmation_prompt: Return templated affirmative
   * - status_update: Return null (no response needed)
   * - genuine_question: Return null (pause for user)
   * - blocking_request: Return null (pause for user)
   * - error_signal: Return recovery instruction or null
   * - completion_signal: Return acknowledgment
   * - rate_limit_or_context: Return null (handle via provider switch)
   *
   * @param classification - Classification result
   * @param context - Response context
   * @returns Generated response string, or null if no response needed
   *
   * **Phase 1 (Week 1)**: Skeleton only (returns placeholder)
   * **Phase 3 (Week 3)**: Full implementation with template library
   */
  async generateResponse(
    classification: Classification,
    context: ResponseContext
  ): Promise<string | null> {
    const startTime = Date.now();

    logger.debug('Generating response', {
      type: classification.type,
      provider: context.provider,
      confidence: classification.confidence,
      hasTemplates: !!this.templates
    });

    // Step 1: Check if response is needed for this classification type
    const shouldRespond = this.shouldGenerateResponse(classification.type);
    if (!shouldRespond) {
      logger.debug('No response needed for classification type', {
        type: classification.type
      });
      return null;
    }

    // Step 2: Select appropriate template (randomized if enabled)
    const template = this.selectTemplate(classification.type, context.provider);
    if (!template) {
      logger.warn('No template found for classification type', {
        type: classification.type,
        provider: context.provider
      });
      // Fallback to hardcoded response for confirmation_prompt
      if (classification.type === 'confirmation_prompt') {
        return 'Yes, please proceed.';
      }
      return null;
    }

    logger.debug('Template selected', {
      template: template.template.substring(0, 50),
      priority: template.priority,
      provider: template.provider
    });

    // Step 3: Substitute variables if template has placeholders
    let response = template.template;
    if (this.config.enableContextVars && context.variables) {
      response = this.substituteVariables(response, context.variables);
    }

    // Step 4: Apply provider-specific formatting
    response = this.applyProviderFormatting(response, context.provider);

    // Step 5: Log auto-response for telemetry
    const latency = Date.now() - startTime;
    logger.info('Auto-response generated', {
      type: classification.type,
      provider: context.provider,
      responseLength: response.length,
      latencyMs: latency,
      templatePriority: template.priority,
      hasVariables: !!context.variables
    });

    // Step 6: Return response string
    return response;
  }

  /**
   * Determine if response should be generated for classification type
   *
   * @param type - Classification type
   * @returns True if response should be generated
   * @private
   */
  private shouldGenerateResponse(type: ClassificationType): boolean {
    // Response strategy:
    // - confirmation_prompt: YES (auto-respond affirmatively)
    // - status_update: NO (no response needed)
    // - genuine_question: NO (pause for user)
    // - blocking_request: NO (pause for user)
    // - error_signal: NO (handled by error recovery logic)
    // - completion_signal: YES (acknowledge completion)
    // - rate_limit_or_context: NO (handled by provider switch)

    return type === 'confirmation_prompt' || type === 'completion_signal';
  }

  /**
   * Load template library from file
   *
   * Templates are YAML files containing response templates for each
   * classification type.
   *
   * @param path - Path to template library YAML file
   *
   * **Phase 1 (Week 1)**: Skeleton only (no-op)
   * **Phase 3 (Week 3)**: Full implementation with YAML loading and validation
   */
  async loadTemplates(path: string): Promise<void> {
    logger.debug('Loading template library', { path });

    // Check if file exists
    if (!existsSync(path)) {
      logger.warn('Template library file not found', { path });
      return;
    }

    try {
      // Read YAML file
      const fileContent = await readFile(path, 'utf-8');
      const parsed = yamlLoad(fileContent) as any;

      // Validate structure
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid template library format: not an object');
      }

      if (!parsed.version || typeof parsed.version !== 'string') {
        throw new Error('Invalid template library: missing version');
      }

      if (!parsed.templates || typeof parsed.templates !== 'object') {
        throw new Error('Invalid template library: missing templates object');
      }

      // Build TemplateLibrary structure
      const templates: Partial<Record<ClassificationType, ResponseTemplate[]>> = {};

      for (const [type, templateArray] of Object.entries(parsed.templates)) {
        if (!Array.isArray(templateArray)) {
          logger.warn('Skipping invalid template array', { type });
          continue;
        }

        // Sort by priority before storing (descending)
        const sortedArray = [...templateArray].sort((a: any, b: any) => {
          const priorityA = typeof a.priority === 'number' ? a.priority : 5;
          const priorityB = typeof b.priority === 'number' ? b.priority : 5;
          return priorityB - priorityA;
        });

        templates[type as ClassificationType] = sortedArray.map((t: any) => ({
          template: t.template || '',
          type: type as ClassificationType,
          priority: typeof t.priority === 'number' ? t.priority : 5,
          provider: t.provider !== undefined ? t.provider : null,
          description: t.description || undefined
        }));
      }

      this.templates = {
        version: parsed.version,
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        templates: templates as Record<ClassificationType, ResponseTemplate[]>,
        metadata: parsed.metadata || (parsed.description ? { description: parsed.description } : undefined)
      };

      logger.info('Template library loaded successfully', {
        version: this.templates.version,
        templateCount: Object.keys(templates).length
      });
    } catch (error) {
      logger.error('Failed to load template library', {
        path,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Update template library (hot-reload capability)
   *
   * @param templates - New template library
   *
   * **Phase 1 (Week 1)**: Skeleton only (no-op)
   * **Phase 3 (Week 3)**: Full implementation with validation
   */
  async updateTemplates(templates: TemplateLibrary): Promise<void> {
    logger.debug('Updating template library', {
      version: templates.version
    });

    // Validate template library structure
    if (!templates.version || typeof templates.version !== 'string') {
      throw new Error('Invalid template library: missing version');
    }

    if (!templates.templates || typeof templates.templates !== 'object') {
      throw new Error('Invalid template library: missing templates object');
    }

    // Replace templates atomically
    this.templates = templates;

    logger.info('Template library updated successfully', {
      version: templates.version,
      templateCount: Object.keys(templates.templates).length
    });
  }

  /**
   * Select template for classification type
   *
   * If randomization enabled, selects random template from available options.
   * Otherwise, selects highest priority template.
   *
   * @param type - Classification type
   * @param provider - Provider name (for provider-specific templates)
   * @returns Selected template, or null if no templates available
   * @private
   *
   * **Phase 1 (Week 1)**: Skeleton only
   * **Phase 3 (Week 3)**: Full template selection logic
   */
  private selectTemplate(
    type: ClassificationType,
    provider: string
  ): ResponseTemplate | null {
    if (!this.templates) {
      return null;
    }

    // Get templates for classification type
    const templatesForType = this.templates.templates[type];
    if (!templatesForType || templatesForType.length === 0) {
      return null;
    }

    // Filter by provider: provider-specific templates OR generic templates (provider: null)
    const providerLower = provider.toLowerCase();
    const matchingTemplates = templatesForType.filter(t => {
      if (t.provider === null) {
        return true; // Generic template, applies to all providers
      }
      return t.provider?.toLowerCase() === providerLower;
    });

    if (matchingTemplates.length === 0) {
      // No matching templates, try generic fallback
      const genericTemplates = templatesForType.filter(t => t.provider === null);
      if (genericTemplates.length === 0) {
        return null;
      }
      return this.selectFromCandidates(genericTemplates);
    }

    return this.selectFromCandidates(matchingTemplates);
  }

  /**
   * Select template from candidate list
   *
   * Uses randomization if enabled, otherwise highest priority.
   *
   * @param candidates - List of candidate templates (already filtered)
   * @returns Selected template
   * @private
   */
  private selectFromCandidates(candidates: ResponseTemplate[]): ResponseTemplate {
    // Ensure we have at least one candidate
    const firstCandidate = candidates[0];
    if (!firstCandidate) {
      throw new Error('selectFromCandidates called with empty array');
    }

    if (candidates.length === 1) {
      return firstCandidate;
    }

    if (this.config.randomizeTemplates) {
      // Weighted random selection based on priority
      const totalPriority = candidates.reduce((sum, t) => sum + t.priority, 0);
      let randomValue = Math.random() * totalPriority;

      for (const template of candidates) {
        randomValue -= template.priority;
        if (randomValue <= 0) {
          return template;
        }
      }

      // Fallback (shouldn't reach here)
      return firstCandidate;
    } else {
      // Select highest priority (templates already sorted by priority during load)
      return firstCandidate;
    }
  }

  /**
   * Substitute variables in template
   *
   * Example:
   * - Template: "Yes, implement {{component_name}} as described."
   * - Variables: { component_name: "UserAuth" }
   * - Result: "Yes, implement UserAuth as described."
   *
   * @param template - Template string with {{variables}}
   * @param variables - Variable values
   * @returns Template with variables substituted
   * @private
   *
   * **Phase 1 (Week 1)**: Skeleton only
   * **Phase 3 (Week 3)**: Full variable substitution
   */
  private substituteVariables(
    template: string,
    variables: Record<string, string>
  ): string {
    // Pattern to match {{variable_name}}
    const variablePattern = /\{\{(\w+)\}\}/g;

    return template.replace(variablePattern, (match, variableName) => {
      const value = variables[variableName];

      if (value !== undefined) {
        return value;
      } else {
        // Variable not found - keep placeholder for now
        // Could also throw error or use empty string
        logger.warn('Variable not found in template', {
          variable: variableName,
          template: template.substring(0, 50)
        });
        return match; // Keep original {{variable}} placeholder
      }
    });
  }

  /**
   * Apply provider-specific formatting
   *
   * Different providers may have different conversational styles:
   * - Claude: Conversational, thoughtful
   * - Gemini: Direct, efficient
   * - OpenAI: Professional, clear
   *
   * @param response - Generated response
   * @param provider - Provider name
   * @returns Formatted response
   * @private
   *
   * **Phase 1 (Week 1)**: Skeleton only (no-op)
   * **Phase 3 (Week 3)**: Provider-specific formatting
   */
  private applyProviderFormatting(
    response: string,
    provider: string
  ): string {
    const providerLower = provider.toLowerCase();

    // Provider-specific formatting is mostly handled by provider-specific templates
    // This method provides minor adjustments if needed

    // For v1, keep minimal formatting
    // Future: Could add provider-specific tone adjustments here

    // Claude: Already conversational from templates
    // Gemini: Already concise from templates
    // OpenAI: Already professional from templates

    // Just return as-is for now - templates handle provider style
    return response;
  }
}
