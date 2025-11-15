/**
 * AutomatosX v8.0.0 - Intent Classifier
 *
 * Classifies natural language input into actionable intents
 * Routes: memory-search, workflow-execute, agent-delegate, chat
 */

import type { ProviderRouterV2 } from '../../services/ProviderRouterV2.js';

/**
 * Intent types for natural language routing
 */
export type IntentType = 'memory-search' | 'workflow-execute' | 'agent-delegate' | 'chat' | 'rephrase' | 'symbol-search' | 'natural-language' | 'workflow-run' | 'agent-query' | 'file-search' | 'hybrid-search' | 'slash-command' | 'unknown';

/**
 * Classification method used
 */
export type ClassificationMethod = 'pattern' | 'llm';

/**
 * Classified intent with confidence and extracted data
 */
export interface Intent {
  type: IntentType;
  confidence: number;  // 0.0 to 1.0
  method: ClassificationMethod;
  extractedData?: {
    query?: string;        // For memory-search
    workflowName?: string; // For workflow-execute
    agentName?: string;    // For agent-delegate
  };
}

/**
 * Intent classification patterns
 */
interface IntentPatterns {
  [key: string]: RegExp[];
}

/**
 * Intent Classifier
 *
 * Uses pattern matching (fast) + LLM fallback (accurate) to classify user intent
 */
export class IntentClassifier {
  private patterns: IntentPatterns;

  constructor(private providerRouter?: ProviderRouterV2) {
    // Initialize pattern library (40+ patterns)
    this.patterns = this.buildPatternLibrary();
  }

  /**
   * Classify user intent from natural language input
   */
  async classify(input: string): Promise<Intent> {
    const normalizedInput = input.toLowerCase().trim();

    // Empty input defaults to chat
    if (!normalizedInput) {
      return {
        type: 'chat',
        confidence: 1.0,
        method: 'pattern'
      };
    }

    // Try pattern matching first (fast path, <100ms)
    const patternIntent = this.classifyWithPatterns(normalizedInput, input);
    if (patternIntent) {
      return patternIntent;
    }

    // No pattern match - use LLM fallback if available (slow path, <5s)
    if (this.providerRouter) {
      try {
        return await this.classifyWithLLM(input);
      } catch (error) {
        // LLM failed, default to chat
        return {
          type: 'chat',
          confidence: 0.5,
          method: 'llm'
        };
      }
    }

    // No LLM available, default to chat
    return {
      type: 'chat',
      confidence: 0.5,
      method: 'pattern'
    };
  }

  /**
   * Classify using pattern matching (fast path)
   */
  private classifyWithPatterns(normalizedInput: string, originalInput: string): Intent | null {
    // Check each intent type
    for (const [intentType, regexes] of Object.entries(this.patterns)) {
      for (const regex of regexes) {
        if (regex.test(normalizedInput)) {
          return {
            type: intentType as IntentType,
            confidence: 0.9,
            method: 'pattern',
            extractedData: this.extractDataForIntent(intentType as IntentType, originalInput)
          };
        }
      }
    }

    return null;
  }

  /**
   * Classify using LLM (slow path, for ambiguous queries)
   */
  private async classifyWithLLM(input: string): Promise<Intent> {
    const prompt = this.buildLLMPrompt(input);

    const response = await this.providerRouter!.route({
      messages: [{ role: 'user', content: prompt }],
      preferredProvider: 'claude',
      model: 'haiku',  // Fast, cheap model
      temperature: 0.1,
      maxTokens: 20
    });

    const intentType = this.parseIntentFromLLM(response.content);

    return {
      type: intentType,
      confidence: 0.7,
      method: 'llm',
      extractedData: this.extractDataForIntent(intentType, input)
    };
  }

  /**
   * Build pattern library for intent classification
   */
  private buildPatternLibrary(): IntentPatterns {
    return {
      'memory-search': [
        // Find/search patterns
        /\b(find|search|show|get|locate)\b/i,

        // Where patterns
        /\b(where is|where's)\b/i,
        /\b(where)\b.*\b(function|class|method|file)\b/i,

        // Show me patterns
        /\bshow me\b/i,

        // List patterns - FIX: Match "list all API routes"
        /\b(list|display)\b/i,
        /\b(all|every)\b.*\b(files|functions|classes|methods|routes|endpoints|apis?)\b/i,

        // Lookup patterns
        /\blook up\b/i,
        /\blookup\b/i,

        // Grep-like patterns
        /\bgrep\b/i,
        /\brg\b.*\bfor\b/i,

        // Specific code element searches
        /\b(auth|authentication|login|jwt|token|validate)\b/i,
        /\b(api|endpoint|route|controller)\b/i,

        // Decorator/annotation searches - FIX: Handle special characters
        /\b(decorator|annotation|component|injectable)\b/i
      ],

      'workflow-execute': [
        // Run/execute patterns
        /\b(run|execute|start|launch)\b.*\b(workflow|task|job)\b/i,
        /\b(run|execute|start|launch)\b.*\b(audit|scan|test|check)\b/i,

        // Do/perform patterns
        /\b(do|perform)\b.*\b(security|analysis|review|check)\b/i,
        /\b(do|perform)\b.*\b(audit|scan|test)\b/i,

        // Action patterns
        /\bexecute\b.*\b(pipeline|automation)\b/i,
        /\btrigger\b.*\b(workflow|pipeline|job)\b/i,

        // Specific workflow types
        /\b(security|quality|performance)\b.*\b(audit|scan|check)\b/i,
        /\b(ci|cd|cicd)\b.*\b(pipeline|workflow)\b/i,
        /\brun\b.*\b(tests|linter|formatter)\b/i,

        // Start patterns
        /\bstart\b.*\b(deployment|build|compilation)\b/i,
        /\bkick off\b.*\b(workflow|pipeline)\b/i
      ],

      'agent-delegate': [
        // Use/ask agent patterns
        /\b(use|ask|talk to|consult)\b.*\b(agent)\b/i,
        /\b(use|ask|talk to|consult)\b.*\b(backend|frontend|security|testing|quality)agent\b/i,

        // Delegate patterns
        /\bdelegate to\b/i,
        /\bhand off to\b.*\bagent\b/i,

        // Specific agent names
        /\b(backend|frontend|security|testing|quality|documentation|deployment|database|architecture|performance|monitoring)agent\b/i,

        // Agent action patterns
        /\b(backend|frontend|security)\b.*\b(agent|specialist|expert)\b/i,
        /\blet\b.*\bagent\b.*\bhandle\b/i,

        // Switch agent patterns
        /\bswitch to\b.*\bagent\b/i,
        /\bchange to\b.*\bagent\b/i
      ]
    };
  }

  /**
   * Extract data based on intent type
   */
  private extractDataForIntent(intentType: IntentType, input: string): any {
    switch (intentType) {
      case 'memory-search':
        return { query: this.extractSearchQuery(input) };

      case 'workflow-execute':
        return { workflowName: this.extractWorkflowName(input) };

      case 'agent-delegate':
        return { agentName: this.extractAgentName(input) };

      default:
        return {};
    }
  }

  /**
   * Extract search query from memory-search intent
   */
  private extractSearchQuery(input: string): string {
    // Remove common prefixes - but preserve "the", "all", and other meaningful words
    let query = input
      .replace(/^(find|search|show me|get|locate|where is|where's|look up|lookup|grep|list|display)\s+/i, '')
      .replace(/\s+(in|from|within)\s+(the\s+)?(code|codebase|project|repository)$/i, '');

    // Remove standalone trailing noise words
    // FIX: Remove "function", "class", "method", "file" but not meaningful words like "logic", "audit", "scan"
    query = query.replace(/\s+(function|class|method|file|methods|code|implementation|definition|usage)$/i, '');

    return query.trim() || input;
  }

  /**
   * Extract workflow name from workflow-execute intent
   */
  private extractWorkflowName(input: string): string {
    // Remove common prefixes
    let name = input
      .replace(/^(run|execute|start|launch|do|perform|trigger|kick off)\s+(the\s+)?/i, '');

    // Only remove standalone trailing workflow-type words, not meaningful ones
    // FIX: Don't remove "audit" from "security audit"
    // FIX: Don't remove "scan" from "security scan"
    name = name.replace(/\s+(workflow|task|job|pipeline|automation)$/i, '');

    // Handle "security audit" -> keep as "security audit" (tests expect this)
    return name.trim() || input;
  }

  /**
   * Extract agent name from agent-delegate intent
   */
  private extractAgentName(input: string): string {
    // Look for specific agent names (case-insensitive, will be normalized later)
    const agentMatch = input.match(/\b(backend|frontend|security|testing|quality|documentation|deployment|database|architecture|performance|monitoring)agent\b/i);

    if (agentMatch) {
      // Capitalize first letter: "backendagent" -> "BackendAgent"
      const name = agentMatch[0];
      return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    }

    // Fallback: extract after "use" or "ask"
    let name = input
      .replace(/^(use|ask|talk to|consult|delegate to|hand off to|switch to|change to)\s+/i, '')
      .replace(/\s+agent$/i, '');

    // Capitalize first letter
    name = name.trim();
    if (name) {
      return name.charAt(0).toUpperCase() + name.slice(1);
    }

    return name || input;
  }

  /**
   * Build LLM prompt for intent classification
   */
  private buildLLMPrompt(input: string): string {
    return `Classify the user's intent for this AutomatosX command.

User input: "${input}"

AutomatosX is a code intelligence platform with these capabilities:
- memory-search: Search codebase for functions, classes, files, code patterns
- workflow-execute: Run automated workflows like security audits, tests, builds
- agent-delegate: Use specialized AI agents (BackendAgent, SecurityAgent, etc.)
- chat: General conversation or questions

Respond with ONLY the intent type (one word: memory-search, workflow-execute, agent-delegate, or chat).

Intent:`;
  }

  /**
   * Parse intent type from LLM response
   */
  private parseIntentFromLLM(response: string): IntentType {
    const normalized = response.trim().toLowerCase();

    // Extract intent type from response
    if (normalized.includes('memory-search') || normalized.includes('memory_search')) {
      return 'memory-search';
    }
    if (normalized.includes('workflow-execute') || normalized.includes('workflow_execute')) {
      return 'workflow-execute';
    }
    if (normalized.includes('agent-delegate') || normalized.includes('agent_delegate')) {
      return 'agent-delegate';
    }

    // Default to chat
    return 'chat';
  }
}
