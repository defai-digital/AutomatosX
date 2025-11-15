/**
 * TaskRouter.ts
 * Intelligent natural language task parsing and agent routing
 * Phase 7: Agent System Implementation - Day 4
 */

import { AgentRegistry } from './AgentRegistry.js';
import { AgentBase } from './AgentBase.js';
import { Task, AgentType } from '../types/agents.types.js';

export interface ParsedTask {
  originalDescription: string;
  intent: TaskIntent;
  keywords: string[];
  mentionedAgent?: string;
  confidence: number;
}

export type TaskIntent =
  | 'backend-dev'
  | 'frontend-dev'
  | 'api-design'
  | 'database-design'
  | 'security-audit'
  | 'testing'
  | 'devops'
  | 'architecture'
  | 'data-engineering'
  | 'product-management'
  | 'ml-ai'
  | 'mobile-dev'
  | 'performance-opt'
  | 'infrastructure'
  | 'technical-writing'
  | 'research'
  | 'standards'
  | 'leadership'
  | 'unknown';

export class TaskRouter {
  private intentPatterns: Map<TaskIntent, RegExp[]>;
  private intentToAgentType: Map<TaskIntent, string>;

  constructor(private registry: AgentRegistry) {
    this.intentPatterns = this.initializeIntentPatterns();
    this.intentToAgentType = this.initializeIntentMapping();
  }

  /**
   * Parse natural language task description
   */
  parseTask(description: string): ParsedTask {
    const mentionedAgent = this.extractMention(description);
    const intent = this.detectIntent(description);
    const keywords = this.extractKeywords(description);
    const confidence = this.calculateConfidence(description, intent, mentionedAgent);

    return {
      originalDescription: description,
      intent,
      keywords,
      mentionedAgent,
      confidence,
    };
  }

  /**
   * Route task to best agent
   */
  routeToAgent(task: Task): AgentBase | null {
    const parsed = this.parseTask(task.description);

    // If @mention is present, use it (highest priority)
    if (parsed.mentionedAgent) {
      const agent = this.registry.get(parsed.mentionedAgent as any);
      if (agent) {
        return agent;
      }
    }

    // Use intent-based routing
    if (parsed.intent !== 'unknown') {
      const agentType = this.intentToAgentType.get(parsed.intent);
      if (agentType) {
        const agent = this.registry.get(agentType as AgentType);
        if (agent) {
          return agent;
        }
      }
    }

    // Fallback to capability-based matching
    return this.registry.findBestAgent(task);
  }

  /**
   * Extract @mention from description (e.g., "@backend", "@security")
   */
  private extractMention(description: string): string | undefined {
    const mentionPattern = /@(\w+)/;
    const match = description.match(mentionPattern);
    return match ? match[1] : undefined;
  }

  /**
   * Detect user intent from task description
   */
  private detectIntent(description: string): TaskIntent {
    const lowerDesc = description.toLowerCase();

    for (const [intent, patterns] of this.intentPatterns.entries()) {
      for (const pattern of patterns) {
        if (pattern.test(lowerDesc)) {
          return intent;
        }
      }
    }

    return 'unknown';
  }

  /**
   * Extract relevant keywords from description
   */
  private extractKeywords(description: string): string[] {
    const keywords: string[] = [];
    const lowerDesc = description.toLowerCase();

    // Common technical keywords
    const keywordPatterns = [
      'api', 'rest', 'graphql', 'endpoint',
      'database', 'sql', 'schema', 'query',
      'security', 'auth', 'authentication', 'vulnerability',
      'test', 'testing', 'coverage', 'quality',
      'frontend', 'ui', 'component', 'react',
      'backend', 'server', 'service', 'microservice',
      'devops', 'ci/cd', 'deployment', 'docker', 'kubernetes',
      'performance', 'optimize', 'profiling', 'cache',
      'mobile', 'ios', 'android', 'flutter',
      'ml', 'machine learning', 'model', 'ai',
      'document', 'documentation', 'readme',
      'research', 'analysis', 'insights',
      'architecture', 'design', 'pattern',
    ];

    for (const keyword of keywordPatterns) {
      if (lowerDesc.includes(keyword)) {
        keywords.push(keyword);
      }
    }

    return keywords;
  }

  /**
   * Calculate confidence score for routing decision
   */
  private calculateConfidence(description: string, intent: TaskIntent, mentionedAgent?: string): number {
    let confidence = 0;

    // @mention gives highest confidence
    if (mentionedAgent) {
      confidence += 5.0;
    }

    // Intent match adds confidence
    if (intent !== 'unknown') {
      confidence += 2.0;
    }

    // Keywords add confidence
    const keywords = this.extractKeywords(description);
    confidence += keywords.length * 0.5;

    // Normalize to 0-1 range
    return Math.min(confidence / 10, 1.0);
  }

  /**
   * Initialize intent detection patterns
   */
  private initializeIntentPatterns(): Map<TaskIntent, RegExp[]> {
    return new Map([
      ['backend-dev', [
        /\b(backend|server|api|service|microservice)\b/i,
        /\b(implement|create|build).*(service|api|endpoint)\b/i,
      ]],
      ['frontend-dev', [
        /\b(frontend|ui|component|react|vue|angular)\b/i,
        /\b(build|create|design).*(interface|component|page)\b/i,
      ]],
      ['api-design', [
        /\b(api|rest|graphql|endpoint)\b.*\b(design|create|implement)\b/i,
        /\b(design|create).*(api|rest|graphql)\b/i,
      ]],
      ['database-design', [
        /\b(database|sql|schema|query|table)\b/i,
        /\b(design|create|optimize).*(database|schema|query)\b/i,
      ]],
      ['security-audit', [
        /\b(security|audit|vulnerability|secure|pen test)\b/i,
        /\b(fix|find|check).*(security|vulnerability)\b/i,
      ]],
      ['testing', [
        /\b(test|testing|coverage|quality|qa)\b/i,
        /\b(write|create).*(test|tests)\b/i,
      ]],
      ['devops', [
        /\b(devops|ci\/cd|deployment|docker|kubernetes|k8s)\b/i,
        /\b(deploy|build|pipeline)\b/i,
      ]],
      ['architecture', [
        /\b(architecture|design pattern|system design|adr)\b/i,
        /\b(design|architect).*(system|architecture)\b/i,
      ]],
      ['data-engineering', [
        /\b(data pipeline|etl|data|kafka|spark|airflow)\b/i,
        /\b(process|transform).*(data)\b/i,
      ]],
      ['ml-ai', [
        /\b(machine learning|ml|ai|model|training|neural|tensorflow|pytorch)\b/i,
        /\b(train|build).*(model|ml)\b/i,
      ]],
      ['mobile-dev', [
        /\b(mobile|ios|android|flutter|react native|swift|kotlin)\b/i,
        /\b(build|create).*(mobile|app)\b/i,
      ]],
      ['performance-opt', [
        /\b(performance|optimize|profiling|cache|slow|bottleneck)\b/i,
        /\b(optimize|improve|speed up)\b/i,
      ]],
      ['infrastructure', [
        /\b(infrastructure|cloud|aws|gcp|azure|terraform)\b/i,
        /\b(setup|configure).*(infrastructure|cloud)\b/i,
      ]],
      ['technical-writing', [
        /\b(document|documentation|readme|docs|guide|tutorial)\b/i,
        /\b(write|create).*(documentation|docs|readme)\b/i,
      ]],
      ['research', [
        /\b(research|analysis|investigate|study|analyze)\b/i,
        /\b(research|analyze|investigate)\b/i,
      ]],
      ['standards', [
        /\b(standards|compliance|wcag|gdpr|best practices)\b/i,
        /\b(ensure|check).*(compliance|standards)\b/i,
      ]],
      ['leadership', [
        /\b(strategy|roadmap|vision|leadership|decision)\b/i,
        /\b(define|create).*(strategy|roadmap|vision)\b/i,
      ]],
      ['product-management', [
        /\b(product|prd|requirements|feature|user story)\b/i,
        /\b(define|write).*(requirements|prd|feature)\b/i,
      ]],
    ]);
  }

  /**
   * Map intents to agent types
   */
  private initializeIntentMapping(): Map<TaskIntent, string> {
    return new Map([
      ['backend-dev', 'backend'],
      ['frontend-dev', 'frontend'],
      ['api-design', 'api'],
      ['database-design', 'database'],
      ['security-audit', 'security'],
      ['testing', 'quality'],
      ['devops', 'devops'],
      ['architecture', 'architecture'],
      ['data-engineering', 'data'],
      ['product-management', 'product'],
      ['ml-ai', 'datascience'],
      ['mobile-dev', 'mobile'],
      ['performance-opt', 'performance'],
      ['infrastructure', 'infrastructure'],
      ['technical-writing', 'writer'],
      ['research', 'researcher'],
      ['standards', 'standards'],
      ['leadership', 'cto'],
    ]);
  }

  /**
   * Get routing confidence for a task
   */
  getRoutingConfidence(task: Task): number {
    const parsed = this.parseTask(task.description);
    return parsed.confidence;
  }

  /**
   * Get suggested agents for a task (ordered by confidence)
   */
  getSuggestedAgents(task: Task, limit: number = 3): Array<{ agent: AgentBase; confidence: number }> {
    const suggestions: Array<{ agent: AgentBase; confidence: number }> = [];
    const parsed = this.parseTask(task.description);

    // Get all agents and score them
    const allAgents = this.registry.getAll();
    for (const agent of allAgents) {
      const score = agent.canHandle(task);
      if (score >= 0.3) {
        suggestions.push({ agent, confidence: score });
      }
    }

    // Sort by confidence and return top N
    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }
}
