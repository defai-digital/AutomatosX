/**
 * Iterate Classifier
 *
 * Classifies AI responses into intent categories to determine whether to auto-respond
 * or pause for user input.
 *
 * **Classification Pipeline**:
 * 1. Pattern Library (< 1ms): Fast regex + keyword matching
 * 2. Contextual Rules (< 5ms): Conversation history analysis
 * 3. Provider Markers (< 1ms): Native AI annotations (e.g., Claude <THOUGHT>)
 * 4. Semantic Scoring (< 50ms): Lightweight ML fallback (optional)
 *
 * **Performance Target**: < 100ms average, < 500ms p99
 *
 * @module core/iterate/iterate-classifier
 * @since v6.4.0
 */

import type {
  Classification,
  ClassificationType,
  ClassificationContext,
  ClassifierConfig,
  ClassificationPattern,
  PatternLibrary
} from '../../types/iterate.js';
import { logger } from '../../shared/logging/logger.js';
import { readFile } from 'fs/promises';
import { load as yamlLoad } from 'js-yaml';
import { existsSync } from 'fs';

/**
 * Iterate Classifier
 *
 * Classifies AI responses using multi-stage pipeline for high accuracy and low latency.
 *
 * **Accuracy Requirements**:
 * - Precision: 95%+ for genuine_question (avoid false auto-responses)
 * - Recall: 90%+ for confirmation_prompt (catch most confirmations)
 *
 * **Usage**:
 * ```typescript
 * const classifier = new IterateClassifier(config);
 * const classification = await classifier.classify(response, context);
 *
 * if (classification.type === 'genuine_question') {
 *   await controller.pause('genuine_question', response);
 * }
 * ```
 *
 * @since v6.4.0
 */
export class IterateClassifier {
  private config: ClassifierConfig;
  private patterns?: PatternLibrary;

  /**
   * Compiled regex patterns (cached for performance)
   * @private
   */
  private compiledPatterns: Map<ClassificationType, RegExp[]> = new Map();

  /**
   * Create IterateClassifier
   *
   * @param config - Classifier configuration
   */
  constructor(config: ClassifierConfig) {
    this.config = config;

    logger.debug('IterateClassifier created', {
      strictness: config.strictness,
      patternLibraryPath: config.patternLibraryPath,
      semanticScoringEnabled: config.enableSemanticScoring
    });
  }

  /**
   * Classify AI response into intent category
   *
   * **Classification Pipeline**:
   * 1. Fast pattern matching (< 1ms)
   * 2. Contextual rules (< 5ms)
   * 3. Provider markers (< 1ms)
   * 4. Semantic scoring (< 50ms, optional)
   *
   * @param message - AI response message to classify
   * @param context - Classification context (conversation history, metadata)
   * @returns Classification result with type, confidence, and method
   *
   * **Phase 1 (Week 1)**: Skeleton only (returns placeholder)
   * **Phase 2 (Week 2)**: Full implementation with pattern library
   */
  async classify(
    message: string,
    context: ClassificationContext
  ): Promise<Classification> {
    const startTime = Date.now();

    logger.debug('Classifying message', {
      messageLength: message.length,
      recentMessagesCount: context.recentMessages.length,
      provider: context.provider
    });

    let result: { type: ClassificationType; confidence: number; pattern?: string } | null = null;
    let method: Classification['method'] = 'pattern_library';
    let reason = '';

    // Stage 1: Fast pattern matching (< 1ms target)
    result = this.classifyWithPatterns(message);
    if (result && result.confidence >= 0.85) {
      method = 'pattern_library';
      reason = `Pattern match: ${result.pattern?.substring(0, 50) || 'matched'}`;
      logger.debug('High-confidence pattern match, early exit', { type: result.type, confidence: result.confidence });
    } else {
      const patternResult = result; // Save for later

      // Stage 2: Contextual rules (< 5ms target)
      result = this.classifyWithContext(message, context);
      if (result && result.confidence >= 0.8) {
        method = 'contextual_rules';
        reason = 'Contextual analysis';
        logger.debug('High-confidence contextual match', { type: result.type, confidence: result.confidence });
      } else {
        const contextResult = result;

        // Stage 3: Provider-specific markers (< 1ms target)
        result = this.checkProviderMarkers(message, context.provider);
        if (result && result.confidence >= 0.8) {
          method = 'provider_markers';
          reason = `Provider marker detected (${context.provider})`;
          logger.debug('Provider marker match', { type: result.type, confidence: result.confidence });
        } else {
          // Use best result from stages 1-3
          const candidates = [patternResult, contextResult, result].filter(r => r !== null);

          if (candidates.length > 0) {
            // Pick highest confidence
            result = candidates.reduce((best, current) =>
              current!.confidence > best!.confidence ? current : best
            );
            method = 'pattern_library'; // Default to pattern
            reason = 'Best match from multiple stages';
          } else {
            // Stage 4: Semantic scoring fallback (if enabled)
            if (this.config.enableSemanticScoring) {
              result = await this.classifyWithSemanticScoring(message, context);
              method = 'semantic_scoring';
              reason = 'Semantic similarity';
            } else {
              // Absolute fallback: default to status_update with low confidence
              result = { type: 'status_update', confidence: 0.3 };
              method = 'fallback'; // Explicitly mark as fallback (not semantic)
              reason = 'No matches found, using default';
            }
          }
        }
      }
    }

    const latency = Date.now() - startTime;

    const classification: Classification = {
      type: result.type,
      confidence: result.confidence,
      method,
      reason,
      timestamp: new Date().toISOString(),
      context: {
        latencyMs: latency,
        // Store the original message for context window lookups
        // This is used by getRecentMessages() in the controller
        message: message
      }
    };

    logger.info('Classification complete', {
      type: classification.type,
      confidence: classification.confidence,
      method: classification.method,
      latencyMs: latency
    });

    return classification;
  }

  /**
   * Load pattern library from file
   *
   * Patterns are YAML files containing regex patterns and keywords for each
   * classification type.
   *
   * @param path - Path to pattern library YAML file
   *
   * **Phase 1 (Week 1)**: Skeleton only (no-op)
   * **Phase 2 (Week 2)**: Full implementation with YAML loading and validation
   */
  async loadPatterns(path: string): Promise<void> {
    logger.debug('Loading pattern library', { path });

    // Check if file exists
    if (!existsSync(path)) {
      logger.warn('Pattern library file not found', { path });
      return;
    }

    try {
      // Read YAML file
      const fileContent = await readFile(path, 'utf-8');
      const parsed = yamlLoad(fileContent) as any;

      // Validate structure
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid pattern library format: not an object');
      }

      if (!parsed.version || typeof parsed.version !== 'string') {
        throw new Error('Invalid pattern library: missing version');
      }

      if (!parsed.patterns || typeof parsed.patterns !== 'object') {
        throw new Error('Invalid pattern library: missing patterns object');
      }

      // Build PatternLibrary structure
      const patterns: Partial<Record<ClassificationType, ClassificationPattern[]>> = {};

      for (const [type, patternArray] of Object.entries(parsed.patterns)) {
        if (!Array.isArray(patternArray)) {
          logger.warn('Skipping invalid pattern array', { type });
          continue;
        }

        // Sort by priority before converting to ClassificationPattern (descending)
        const sortedArray = [...patternArray].sort((a: any, b: any) => {
          const priorityA = typeof a.priority === 'number' ? a.priority : 5;
          const priorityB = typeof b.priority === 'number' ? b.priority : 5;
          return priorityB - priorityA;
        });

        patterns[type as ClassificationType] = sortedArray.map((p: any) => ({
          pattern: p.pattern || '',
          type: type as ClassificationType,
          confidence: typeof p.confidence === 'number' ? p.confidence : 0.8,
          description: p.description || undefined,
          provider: p.provider || null
        }));
      }

      this.patterns = {
        version: parsed.version,
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        patterns: patterns as Record<ClassificationType, ClassificationPattern[]>,
        metadata: parsed.metadata || (parsed.description ? { description: parsed.description } : undefined)
      };

      // Compile patterns
      this.compilePatterns();

      logger.info('Pattern library loaded successfully', {
        version: this.patterns.version,
        patternCount: Object.keys(patterns).length
      });
    } catch (error) {
      logger.error('Failed to load pattern library', {
        path,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Update pattern library (hot-reload capability)
   *
   * @param patterns - New pattern library
   *
   * **Phase 1 (Week 1)**: Skeleton only (no-op)
   * **Phase 2 (Week 2)**: Full implementation with validation and compilation
   */
  async updatePatterns(patterns: PatternLibrary): Promise<void> {
    logger.debug('Updating pattern library', {
      version: patterns.version
    });

    // Validate pattern library structure
    if (!patterns.version || typeof patterns.version !== 'string') {
      throw new Error('Invalid pattern library: missing version');
    }

    if (!patterns.patterns || typeof patterns.patterns !== 'object') {
      throw new Error('Invalid pattern library: missing patterns object');
    }

    // Replace patterns atomically
    this.patterns = patterns;

    // Recompile all patterns
    this.compilePatterns();

    logger.info('Pattern library updated successfully', {
      version: patterns.version,
      patternCount: Object.keys(patterns.patterns).length
    });
  }

  /**
   * Get classifier accuracy statistics
   *
   * Requires ground truth labels for comparison.
   *
   * @returns Accuracy stats (precision, recall, F1)
   *
   * **Phase 1 (Week 1)**: Returns placeholder
   * **Phase 2 (Week 2)**: Real stats from classification history
   */
  getAccuracyStats(): {
    precision: number;
    recall: number;
    f1: number;
    totalClassifications: number;
  } {
    // TODO (Week 2): Return real stats
    return {
      precision: 0.0,
      recall: 0.0,
      f1: 0.0,
      totalClassifications: 0
    };
  }

  /**
   * Classify using pattern library (fast path)
   *
   * @param message - Message to classify
   * @returns Classification type and confidence, or null if no match
   * @private
   *
   * **Phase 1 (Week 1)**: Skeleton only
   * **Phase 2 (Week 2)**: Full pattern matching implementation
   */
  /**
   * Default priority order for classification types
   * genuine_question has highest priority to avoid false auto-responses
   * @private
   */
  private static readonly DEFAULT_PRIORITY_ORDER: ClassificationType[] = [
    'genuine_question',
    'blocking_request',
    'rate_limit_or_context',
    'error_signal',
    'completion_signal',
    'confirmation_prompt',
    'status_update'
  ];

  private classifyWithPatterns(
    message: string
  ): { type: ClassificationType; confidence: number; pattern?: string } | null {
    if (!this.patterns || this.compiledPatterns.size === 0) {
      return null;
    }

    // Use configured priority order or fall back to default
    // This allows users to customize which classification types take precedence
    const priorityOrder = this.config.classificationPriorityOrder
      ?? IterateClassifier.DEFAULT_PRIORITY_ORDER;

    // Try each classification type in priority order
    for (const type of priorityOrder) {
      const patterns = this.compiledPatterns.get(type);
      if (!patterns || patterns.length === 0) {
        continue;
      }

      // Get the original pattern metadata for confidence scores
      const patternMetadata = this.patterns.patterns[type];
      if (!patternMetadata) {
        continue;
      }

      // Test each pattern
      for (let i = 0; i < patterns.length; i++) {
        const regex = patterns[i];
        const metadata = patternMetadata[i];

        if (regex && regex.test(message)) {
          const confidence = metadata?.confidence || 0.8;

          logger.debug('Pattern match found', {
            type,
            pattern: metadata?.pattern?.substring(0, 50),
            confidence
          });

          return {
            type,
            confidence,
            pattern: metadata?.pattern
          };
        }
      }
    }

    return null;
  }

  /**
   * Apply contextual rules based on conversation history
   *
   * @param message - Message to classify
   * @param context - Classification context
   * @returns Classification type and confidence, or null if inconclusive
   * @private
   *
   * **Phase 1 (Week 1)**: Skeleton only
   * **Phase 2 (Week 2)**: Full contextual analysis
   */
  private classifyWithContext(
    message: string,
    context: ClassificationContext
  ): { type: ClassificationType; confidence: number } | null {
    // Rule 1: Check for recent tool calls
    // If many tool calls happened recently, this is likely a status update
    if (context.recentToolCalls && context.recentToolCalls.length > 3) {
      if (message.toLowerCase().includes('completed') ||
          message.toLowerCase().includes('finished') ||
          message.toLowerCase().includes('done')) {
        return { type: 'status_update', confidence: 0.75 };
      }
    }

    // Rule 2: Check for TODO list changes
    // If TODO list changed, likely a status update
    if (context.todoListChanges) {
      return { type: 'status_update', confidence: 0.7 };
    }

    // Rule 3: Detect question patterns after status updates
    // If last message was assistant status update and this has question mark
    if (context.recentMessages.length > 0) {
      const lastMessage = context.recentMessages[context.recentMessages.length - 1];

      if (lastMessage && lastMessage.role === 'assistant' && message.includes('?')) {
        // Question mark after status update is likely genuine question
        const questionWords = ['which', 'what', 'how', 'should', 'would', 'could', 'prefer'];
        if (questionWords.some(word => message.toLowerCase().includes(word))) {
          return { type: 'genuine_question', confidence: 0.8 };
        }
      }
    }

    // Rule 4: Check message length and complexity
    // Very short messages are often confirmations
    if (message.length < 50 && message.includes('?')) {
      const confirmationPhrases = ['proceed', 'continue', 'ready', 'go ahead'];
      if (confirmationPhrases.some(phrase => message.toLowerCase().includes(phrase))) {
        return { type: 'confirmation_prompt', confidence: 0.7 };
      }
    }

    return null;
  }

  /**
   * Check for provider-specific markers
   *
   * Example:
   * - Claude: <THOUGHT> sections indicate self-reflection
   * - OpenAI: Function call metadata
   * - Gemini: Structured output markers
   *
   * @param message - Message to check
   * @param provider - Provider name
   * @returns Classification type and confidence, or null if no markers found
   * @private
   *
   * **Phase 1 (Week 1)**: Skeleton only
   * **Phase 2 (Week 2)**: Provider-specific marker detection
   */
  private checkProviderMarkers(
    message: string,
    provider: string
  ): { type: ClassificationType; confidence: number } | null {
    const providerLower = provider.toLowerCase();

    // Claude-specific markers
    if (providerLower.includes('claude')) {
      // <thinking> tags indicate self-reflection (status update)
      // Check for various formats: <thinking>, </thinking>, <THINKING>, etc.
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes('<thinking>') || lowerMessage.includes('</thinking>') ||
          lowerMessage.includes('<thought>') || lowerMessage.includes('</thought>')) {
        return { type: 'status_update', confidence: 0.85 };
      }

      // Claude's "Let me break this..." pattern for planning
      if (message.includes('Let me break this') || message.includes('I\'ll break this')) {
        return { type: 'status_update', confidence: 0.8 };
      }

      // Claude asking for clarification
      if (message.includes('Could you clarify') || message.includes('Which approach would you prefer')) {
        return { type: 'genuine_question', confidence: 0.9 };
      }
    }

    // Gemini-specific markers
    if (providerLower.includes('gemini')) {
      // Gemini's structured output format
      if (message.match(/```\w+\n[\s\S]*?```/)) {
        // Code blocks often indicate status updates (showing implementation)
        return { type: 'status_update', confidence: 0.75 };
      }
    }

    // OpenAI/Codex-specific markers
    if (providerLower.includes('openai') || providerLower.includes('codex')) {
      // OpenAI completion signals
      if (message.includes('Task completed successfully') ||
          message.includes('Implementation finished')) {
        return { type: 'completion_signal', confidence: 0.85 };
      }
    }

    return null;
  }

  /**
   * Classify using semantic scoring (ML-based fallback)
   *
   * Uses local embeddings for lightweight classification when pattern
   * matching is inconclusive.
   *
   * @param message - Message to classify
   * @param context - Classification context
   * @returns Classification type and confidence
   * @private
   *
   * **Phase 1 (Week 1)**: Skeleton only (not implemented)
   * **Phase 2 (Week 2)**: Optional - may defer to later phase
   */
  private async classifyWithSemanticScoring(
    message: string,
    context: ClassificationContext
  ): Promise<{ type: ClassificationType; confidence: number }> {
    // TODO (Week 2 or later): Implement semantic scoring
    // 1. Generate embedding for message
    // 2. Compare with cached classification embeddings
    // 3. Return most similar classification with confidence
    // 4. Cache result for future lookups

    // Fallback: default to status_update with low confidence
    return {
      type: 'status_update',
      confidence: 0.3
    };
  }

  /**
   * Pattern validation errors collected during loading
   * @private
   */
  private patternValidationErrors: Array<{ pattern: string; type: string; error: string }> = [];

  /**
   * Compile regex pattern from string with validation
   *
   * @param patternStr - Pattern string
   * @param classificationType - Type this pattern belongs to (for error reporting)
   * @returns Compiled RegExp, or null if invalid
   * @private
   */
  private compilePattern(patternStr: string, classificationType?: string): RegExp | null {
    // Validate pattern is non-empty
    if (!patternStr || patternStr.trim() === '') {
      const errorMsg = 'Pattern is empty or whitespace-only';
      logger.warn('Invalid pattern: empty', {
        type: classificationType,
        error: errorMsg
      });
      this.patternValidationErrors.push({
        pattern: patternStr || '(empty)',
        type: classificationType || 'unknown',
        error: errorMsg
      });
      return null;
    }

    try {
      return new RegExp(patternStr, 'i'); // Case-insensitive
    } catch (error) {
      const errorMsg = (error as Error).message;
      logger.warn('Failed to compile pattern - invalid regex syntax', {
        pattern: patternStr.substring(0, 100),
        type: classificationType,
        error: errorMsg
      });
      this.patternValidationErrors.push({
        pattern: patternStr.substring(0, 100),
        type: classificationType || 'unknown',
        error: errorMsg
      });
      return null;
    }
  }

  /**
   * Get pattern validation errors from last load operation
   *
   * @returns Array of validation errors with pattern, type, and error message
   */
  getPatternValidationErrors(): Array<{ pattern: string; type: string; error: string }> {
    return [...this.patternValidationErrors];
  }

  /**
   * Check if there are any pattern validation errors
   *
   * @returns True if there are validation errors
   */
  hasPatternValidationErrors(): boolean {
    return this.patternValidationErrors.length > 0;
  }

  /**
   * Compile all patterns from pattern library
   *
   * Compiles regex patterns and caches them for fast matching.
   * Patterns are sorted by priority (higher priority first).
   * Invalid patterns are tracked in patternValidationErrors for reporting.
   *
   * @private
   */
  private compilePatterns(): void {
    if (!this.patterns) {
      return;
    }

    this.compiledPatterns.clear();
    // Clear previous validation errors before compiling
    this.patternValidationErrors = [];

    let totalCompiled = 0;
    let totalFailed = 0;

    for (const [type, patterns] of Object.entries(this.patterns.patterns)) {
      const classificationType = type as ClassificationType;

      if (!Array.isArray(patterns) || patterns.length === 0) {
        continue;
      }

      // Patterns are already sorted by priority during loading
      // No need to sort again here

      // Compile each pattern with type context for error reporting
      const compiled: RegExp[] = [];
      for (const p of patterns) {
        const regex = this.compilePattern(p.pattern, classificationType);
        if (regex !== null) {
          compiled.push(regex);
          totalCompiled++;
        } else {
          totalFailed++;
        }
      }

      if (compiled.length > 0) {
        this.compiledPatterns.set(classificationType, compiled);
      }
    }

    // Log summary with validation status
    if (totalFailed > 0) {
      logger.warn('Pattern compilation completed with errors', {
        types: this.compiledPatterns.size,
        totalCompiled,
        totalFailed,
        errors: this.patternValidationErrors.map(e => ({
          type: e.type,
          pattern: e.pattern.substring(0, 50),
          error: e.error
        }))
      });
    } else {
      logger.debug('Patterns compiled successfully', {
        types: this.compiledPatterns.size,
        totalPatterns: totalCompiled
      });
    }
  }
}
