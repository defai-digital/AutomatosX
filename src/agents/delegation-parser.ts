/**
 * Delegation Parser - Natural language delegation parsing
 *
 * Parses natural language delegation requests from agent responses.
 * Supports multiple syntaxes for flexibility while maintaining precision.
 *
 * @module agents/delegation-parser
 * @since v4.7.2
 */

import { logger } from '../utils/logger.js';
import type { ProfileLoader } from './profile-loader.js';

/**
 * Parsed delegation instruction
 */
export interface ParsedDelegation {
  /** Target agent name */
  toAgent: string;

  /** Task description */
  task: string;

  /** Original matched text (for debugging) */
  originalText?: string;
}

/**
 * Delegation Parser
 *
 * Extracts delegation requests from agent response text using multiple patterns.
 * Supports both agent names and display names (e.g., @oliver or @devops).
 *
 * Supported syntaxes:
 * 1. `DELEGATE TO frontend: Create login UI` (explicit, backward-compatible)
 * 2. `@frontend Create login UI` (concise)
 * 3. `@frontend: Create login UI` (with colon separator)
 * 4. `Please ask frontend to create login UI` (polite request)
 * 5. `I need frontend to handle auth` (need expression)
 * 6. `請 frontend 建立登入 UI` (Chinese support)
 * 7. `委派給 backend：實現 API` (Chinese formal)
 *
 * Performance: < 1ms per parse (regex-based, no LLM calls)
 */
export class DelegationParser {
  private profileLoader?: ProfileLoader;

  /**
   * Create delegation parser with optional ProfileLoader for display name resolution
   *
   * @param profileLoader - Optional ProfileLoader for resolving display names to agent names
   */
  constructor(profileLoader?: ProfileLoader) {
    this.profileLoader = profileLoader;
  }

  /**
   * Parse delegation requests from agent response
   *
   * @param response - Agent response text
   * @param fromAgent - Agent name (for logging)
   * @returns Array of parsed delegations
   *
   * @example
   * ```typescript
   * const parser = new DelegationParser(profileLoader);
   * const delegations = await parser.parse(
   *   "I'll handle the backend. @Oliver Create the login UI with validation.",
   *   "backend"
   * );
   * // Returns: [{ toAgent: "devops", task: "Create the login UI with validation." }]
   * // (Oliver is display name for devops agent)
   * ```
   */
  async parse(response: string, fromAgent: string): Promise<ParsedDelegation[]> {
    const delegations: Array<ParsedDelegation & { position: number }> = [];

    // Pattern 1: DELEGATE TO [agent]: [task]
    // Example: "DELEGATE TO frontend: Create login UI"
    // Priority: High (most explicit)
    const pattern1 = /DELEGATE\s+TO\s+([a-zA-Z0-9-_]+)\s*:\s*(.+?)(?=\n\n|(?=\n\s*DELEGATE\s+TO)|(?=\n\s*@[\w-]+)|(?=\n\s*請\s+[\w-]+)|(?=\n\s*委派給)|$)/gis;
    await this.extractMatches(pattern1, response, fromAgent, delegations, 'DELEGATE TO');

    // Pattern 2a: @[agent]: [task]
    // Example: "@frontend: Create login UI"
    // Priority: High (explicit with colon)
    const pattern2a = /@([a-zA-Z0-9-_]+)\s*:\s+(.+?)(?=\n\n|(?=\n\s*DELEGATE\s+TO)|(?=\n\s*@[\w-]+)|(?=\n\s*請\s+[\w-]+)|(?=\n\s*委派給)|$)/gis;
    await this.extractMatches(pattern2a, response, fromAgent, delegations, '@agent:');

    // Pattern 2b: @[agent] [task] (no colon after agent name)
    // Example: "@frontend Create login UI" or "@coder 請檢視程式碼"
    // Priority: Medium (less explicit, may have false positives)
    // Match task until: double newline, next delegation pattern, or end
    // Support both English (uppercase start) and Chinese/other languages
    // Supports multi-line tasks (e.g., bullet points)
    const pattern2b = /@([a-zA-Z0-9-_]+)\s+([A-Z\u4e00-\u9fff\u3400-\u4dbf][\s\S]+?)(?:\n\n|(?=\n\s*DELEGATE\s+TO)|(?=\n\s*@[\w-]+)|(?=\n\s*請\s+[\w-]+)|(?=\n\s*委派給)|$)/gs;
    await this.extractMatches(pattern2b, response, fromAgent, delegations, '@agent');

    // Pattern 3a: Please/Request/Ask [agent] to [task]
    // Example: "Please ask frontend to create login UI"
    // Priority: Medium
    const pattern3a = /(?:please|request|ask)\s+([a-zA-Z0-9-_]+)\s+to\s+(.+?)(?=\n\n|(?=\n\s*DELEGATE\s+TO)|(?=\n\s*@[\w-]+)|(?=\n\s*請\s+[\w-]+)|(?=\n\s*委派給)|(?=\n\s*(?:please|request|ask))|$)/gis;
    await this.extractMatches(pattern3a, response, fromAgent, delegations, 'please/request/ask');

    // Pattern 3b: Please/Request [agent]: [task]
    // Example: "Request frontend: create login UI"
    // Priority: Medium
    const pattern3b = /(?:please|request)\s+([a-zA-Z0-9-_]+)\s*:\s*(.+?)(?=\n\n|(?=\n\s*DELEGATE\s+TO)|(?=\n\s*@[\w-]+)|(?=\n\s*請\s+[\w-]+)|(?=\n\s*委派給)|(?=\n\s*(?:please|request))|$)/gis;
    await this.extractMatches(pattern3b, response, fromAgent, delegations, 'please/request:');

    // Pattern 4: I need/require [agent] to [task]
    // Example: "I need frontend to handle the UI"
    // Priority: Medium
    const pattern4 = /I\s+(?:need|require)\s+([a-zA-Z0-9-_]+)\s+to\s+(.+?)(?=\n\n|(?=\n\s*DELEGATE\s+TO)|(?=\n\s*@[\w-]+)|(?=\n\s*請\s+[\w-]+)|(?=\n\s*委派給)|(?=\n\s*I\s+(?:need|require))|$)/gis;
    await this.extractMatches(pattern4, response, fromAgent, delegations, 'I need/require');

    // Pattern 5a: 請 [agent] [task]
    // Example: "請 frontend 建立登入 UI"
    // Priority: High (Chinese explicit)
    const pattern5a = /請\s+([a-zA-Z0-9-_]+)\s+([^\n@請委派]+?)(?=\n\n|(?=\n\s*DELEGATE\s+TO)|(?=\n\s*@[\w-]+)|(?=\n\s*請\s+[\w-]+)|(?=\n\s*委派給)|$)/gs;
    await this.extractMatches(pattern5a, response, fromAgent, delegations, '請');

    // Pattern 5b: 委派給 [agent]：[task] or 委派給 [agent] [task]
    // Example: "委派給 backend：實現 API"
    // Priority: High (Chinese formal)
    const pattern5b = /委派給\s+([a-zA-Z0-9-_]+)\s*[：:]\s*(.+?)(?=\n\n|(?=\n\s*DELEGATE\s+TO)|(?=\n\s*@[\w-]+)|(?=\n\s*請\s+[\w-]+)|(?=\n\s*委派給)|$)/gs;
    await this.extractMatches(pattern5b, response, fromAgent, delegations, '委派給');

    // Sort by position in text (ascending)
    delegations.sort((a, b) => a.position - b.position);

    // Remove position field before returning
    const result = delegations.map(({ position, ...rest }) => rest);

    logger.info(`Parsed ${delegations.length} delegation(s)`, {
      fromAgent,
      delegations: result.map(d => ({ toAgent: d.toAgent, taskPreview: d.task.substring(0, 50) }))
    });

    return result;
  }

  /**
   * Extract matches from a regex pattern
   *
   * @private
   */
  private async extractMatches(
    pattern: RegExp,
    response: string,
    fromAgent: string,
    delegations: Array<ParsedDelegation & { position: number }>,
    patternName: string
  ): Promise<void> {
    let match;
    while ((match = pattern.exec(response)) !== null) {
      let toAgent = match[1]?.trim();
      const task = match[2]?.trim();

      // Validate extracted values
      if (!toAgent || !task) {
        continue;
      }

      // Skip if task is too short (likely false positive)
      if (task.length < 5) {
        continue;
      }

      // Skip JSDoc annotations (e.g., @returns, @param)
      if (this.isJSDocAnnotation(response, match.index)) {
        logger.debug('Skipping JSDoc annotation', { toAgent, position: match.index });
        continue;
      }

      // Skip if in code block (between ``` or `)
      if (this.isInCodeBlock(response, match.index)) {
        logger.debug('Skipping code block', { toAgent, position: match.index });
        continue;
      }

      // Skip if in quoted text (e.g., examples in documentation)
      if (this.isInQuotedText(response, match.index)) {
        logger.debug('Skipping quoted text', { toAgent, position: match.index });
        continue;
      }

      // Skip if part of documentation examples
      if (this.isDocumentationExample(response, match.index)) {
        logger.debug('Skipping documentation example', { toAgent, position: match.index });
        continue;
      }

      // Resolve agent name (supports display names like "Oliver" → "devops")
      if (this.profileLoader) {
        try {
          const resolvedName = await this.profileLoader.resolveAgentName(toAgent);
          if (resolvedName !== toAgent) {
            logger.debug('Resolved display name to agent name', {
              displayName: toAgent,
              agentName: resolvedName
            });
            toAgent = resolvedName;
          }
        } catch (error) {
          // Agent not found - skip this delegation
          logger.warn('Agent not found, skipping delegation', {
            agentIdentifier: toAgent,
            fromAgent,
            error: error instanceof Error ? error.message : String(error)
          });
          continue;
        }
      }

      // Skip if delegating to self
      if (toAgent.toLowerCase() === fromAgent.toLowerCase()) {
        logger.warn('Skipping self-delegation', { fromAgent, toAgent });
        continue;
      }

      // Allow multiple delegations to the same agent (removed deduplication)
      delegations.push({
        toAgent,
        task,
        originalText: match[0],
        position: match.index // Track position in text
      });

      logger.debug('Delegation extracted', {
        pattern: patternName,
        fromAgent,
        toAgent,
        taskPreview: task.substring(0, 100),
        originalText: match[0]?.substring(0, 100),
        position: match.index
      });
    }
  }

  /**
   * Validate if a string looks like a valid agent name
   *
   * @private
   */
  private isValidAgentName(name: string): boolean {
    // Agent names should be alphanumeric with hyphens/underscores
    // 3-50 characters
    return /^[a-zA-Z0-9-_]{3,50}$/.test(name);
  }

  /**
   * Check if position is within a JSDoc comment block
   *
   * @private
   */
  private isJSDocAnnotation(text: string, position: number): boolean {
    // Get context before the match (up to 100 chars)
    const before = text.substring(Math.max(0, position - 100), position);

    // Check if preceded by JSDoc comment patterns
    // Common patterns: " * @", "* @", " *@"
    if (/[*\s]+@\w+\s*$/.test(before)) {
      return true;
    }

    // Check if within a JSDoc block (/** ... */)
    const beforeFull = text.substring(0, position);
    const lastJSDocStart = beforeFull.lastIndexOf('/**');
    const lastJSDocEnd = beforeFull.lastIndexOf('*/');

    if (lastJSDocStart > lastJSDocEnd) {
      // Inside JSDoc block
      return true;
    }

    return false;
  }

  /**
   * Check if position is within a code block (between ``` or `)
   *
   * @private
   */
  private isInCodeBlock(text: string, position: number): boolean {
    const before = text.substring(0, position);

    // Check for triple backticks (```) - count should be even if not in block
    const tripleBacktickCount = (before.match(/```/g) || []).length;
    if (tripleBacktickCount % 2 === 1) {
      return true; // Inside ``` code block
    }

    // Check for inline code (`) - more complex due to single backticks
    // Only check if not in triple backtick block
    const lines = before.split('\n');
    const currentLine = lines[lines.length - 1] || '';
    const singleBacktickCount = (currentLine.match(/`/g) || []).length;

    if (singleBacktickCount % 2 === 1) {
      return true; // Inside inline code on current line
    }

    return false;
  }

  /**
   * Check if position is within quoted text (surrounded by " or ')
   * This helps avoid parsing delegation examples in documentation.
   *
   * @private
   */
  private isInQuotedText(text: string, position: number): boolean {
    // Get context before and after the match (up to 200 chars each)
    const before = text.substring(Math.max(0, position - 200), position);
    const after = text.substring(position, Math.min(text.length, position + 200));

    // Check if the match is enclosed in quotes on the same or adjacent lines
    // Look for opening quote in before text
    const lastDoubleQuote = before.lastIndexOf('"');
    const lastSingleQuote = before.lastIndexOf("'");
    const lastNewline = before.lastIndexOf('\n');

    // FIXED (v6.5.13 Bug #128): Treat -1 (not found) as infinity for blank line check
    // If we found a quote after the last newline, check for closing quote
    if (lastDoubleQuote > lastNewline) {
      const closingDoubleQuote = after.indexOf('"');
      const blankLinePos = after.indexOf('\n\n');
      // closingDoubleQuote !== -1 means quote found; blankLinePos === -1 means no blank line (treat as infinity)
      if (closingDoubleQuote !== -1 && (blankLinePos === -1 || closingDoubleQuote < blankLinePos)) {
        return true; // Enclosed in double quotes
      }
    }

    if (lastSingleQuote > lastNewline) {
      const closingSingleQuote = after.indexOf("'");
      const blankLinePos = after.indexOf('\n\n');
      // closingSingleQuote !== -1 means quote found; blankLinePos === -1 means no blank line (treat as infinity)
      if (closingSingleQuote !== -1 && (blankLinePos === -1 || closingSingleQuote < blankLinePos)) {
        return true; // Enclosed in single quotes
      }
    }

    return false;
  }

  /**
   * Check if position is part of documentation examples
   * Detects patterns like:
   * - Lines starting with "Example:", "範例:", "Supported syntaxes:"
   * - Numbered lists with quoted text: 1. "...", 2. "...", etc.
   * - Lines preceded by "// " comments
   * - Test code patterns: it(, test(, describe(, async () =>
   *
   * @private
   */
  private isDocumentationExample(text: string, position: number): boolean {
    // Get context before and after the match
    const before = text.substring(Math.max(0, position - 500), position);  // Increased from 300
    const after = text.substring(position, Math.min(text.length, position + 200));

    // Split into lines for analysis
    const lines = before.split('\n');
    const recentLines = lines.slice(-10); // Last 10 lines including current (increased from 5)

    // Check for example markers in recent lines
    const exampleMarkers = /(?:example|範例|supported syntaxes|syntaxes|patterns?|用法)[:：]/i;
    if (recentLines.some(line => exampleMarkers.test(line))) {
      return true;
    }

    // Check if current line is part of a numbered list (with or without quotes)
    // Pattern: "1. " or "2) " at start of line
    const currentLine = recentLines[recentLines.length - 1] || '';
    if (/^\s*\d+[.)]\s+/.test(currentLine)) {
      // Check if previous lines also have numbering (indicates a list)
      const hasNumberedContext = recentLines.slice(-5).some(line => /^\s*\d+[.)]\s+/.test(line));
      if (hasNumberedContext) {
        return true;
      }
    }

    // Check if preceded by comment markers (// or #)
    if (/^\s*(?:\/\/|#)\s*\d+[.)]\s*/.test(currentLine)) {
      return true;
    }

    // Check for test code patterns in surrounding context
    // Look for: it(, test(, describe(, expect(, async () =>, function()
    const testCodePatterns = /(?:it|test|describe|expect)\s*\(|async\s*\(\)\s*=>|function\s*\(/i;
    if (testCodePatterns.test(before) || testCodePatterns.test(after)) {
      return true;
    }

    // Check if the match is part of a string literal in code
    // Look for patterns like: 'text...@agent...' or "text...@agent..."
    // where the quote starts before the match and ends after it
    // FIXED (v6.5.13 Bug #135): Ensure safe string slicing with bounds checking
    const beforeSlice = before.length > 0 ? before.slice(-Math.min(100, before.length)) : '';
    const afterSlice = after.length > 0 ? after.slice(0, Math.min(100, after.length)) : '';
    const combinedContext = beforeSlice + afterSlice;
    const stringLiteralPattern = /['"`][^'"`]{0,100}@[a-zA-Z0-9-_]+[^'"`]{0,100}['"`]/;
    if (combinedContext.length > 0 && stringLiteralPattern.test(combinedContext)) {
      return true;
    }

    return false;
  }
}
