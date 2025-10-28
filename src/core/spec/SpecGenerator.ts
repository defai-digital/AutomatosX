/**
 * SpecGenerator - AI-powered spec generation from natural language
 *
 * This module provides functionality to:
 * 1. Detect complex tasks that benefit from spec-kit
 * 2. Parse natural language descriptions into structured tasks
 * 3. Generate spec.md, plan.md, and tasks.md automatically
 * 4. Infer dependencies between tasks
 */

import { BaseProvider } from '@/providers/base-provider.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * Complexity indicators for task detection
 */
const COMPLEXITY_INDICATORS = {
  multiStep: /\band\b.*\band\b|,.*,.*,/i,
  sequential: /after|before|then|first|next|finally/i,
  dependencies: /depend|require|need|prerequisite/i,
  multiComponent: /database.*api|api.*test|backend.*frontend|server.*client/i,
  projectLevel: /complete|entire|full|comprehensive|build.*feature|implement.*system/i,
  phases: /phase|stage|step \d+|part \d+/i,
  multiple: /multiple|several|various|many/i,
};

/**
 * Agent keywords for automatic agent selection
 */
const AGENT_KEYWORDS: Record<string, string[]> = {
  backend: ['database', 'api', 'rest', 'graphql', 'server', 'backend', 'service', 'microservice'],
  frontend: ['ui', 'frontend', 'react', 'vue', 'angular', 'component', 'page', 'view'],
  security: ['security', 'auth', 'authentication', 'authorization', 'jwt', 'oauth', 'audit', 'vulnerability'],
  quality: ['test', 'testing', 'unit test', 'integration test', 'e2e', 'qa', 'quality'],
  devops: ['deploy', 'deployment', 'ci/cd', 'docker', 'kubernetes', 'infrastructure', 'pipeline'],
  data: ['data', 'analytics', 'etl', 'pipeline', 'warehouse', 'processing'],
  mobile: ['mobile', 'ios', 'android', 'app', 'flutter', 'react native'],
};

/**
 * Parsed task from natural language
 */
export interface ParsedTask {
  id: string;
  description: string;
  agent: string;
  dependencies: string[];
  priority: number;
  labels?: string[];
}

/**
 * Generated spec structure
 */
export interface GeneratedSpec {
  title: string;
  overview: string;
  goals: string[];
  successCriteria: string[];
  tasks: ParsedTask[];
  plan: {
    architecture: string;
    approach: string;
    phases: string[];
  };
}

/**
 * Complexity analysis result
 */
export interface ComplexityAnalysis {
  isComplex: boolean;
  score: number;
  indicators: string[];
  recommendation: string;
}

/**
 * SpecGenerator class
 */
export class SpecGenerator {
  private provider: BaseProvider;

  constructor(provider: BaseProvider) {
    this.provider = provider;
  }

  /**
   * Analyze task complexity
   */
  analyzeComplexity(task: string): ComplexityAnalysis {
    const indicators: string[] = [];
    let score = 0;

    // Check each complexity indicator
    if (COMPLEXITY_INDICATORS.multiStep.test(task)) {
      indicators.push('Multiple steps detected (e.g., "A, B, and C")');
      score += 2;
    }

    if (COMPLEXITY_INDICATORS.sequential.test(task)) {
      indicators.push('Sequential workflow detected (e.g., "first...then")');
      score += 2;
    }

    if (COMPLEXITY_INDICATORS.dependencies.test(task)) {
      indicators.push('Explicit dependencies mentioned');
      score += 2;
    }

    if (COMPLEXITY_INDICATORS.multiComponent.test(task)) {
      indicators.push('Multiple technical components');
      score += 2;
    }

    if (COMPLEXITY_INDICATORS.projectLevel.test(task)) {
      indicators.push('Project-level scope');
      score += 3;
    }

    if (COMPLEXITY_INDICATORS.phases.test(task)) {
      indicators.push('Multiple phases/stages');
      score += 2;
    }

    if (COMPLEXITY_INDICATORS.multiple.test(task)) {
      indicators.push('Multiple items indicated');
      score += 1;
    }

    // Comma count
    const commaCount = (task.match(/,/g) || []).length;
    if (commaCount >= 2) {
      indicators.push(`${commaCount + 1} items separated by commas`);
      score += commaCount;
    }

    const isComplex = score >= 3;
    const recommendation = isComplex
      ? 'This task would benefit from spec-kit orchestration for better dependency management and parallel execution.'
      : 'This task is suitable for direct execution with ax run.';

    return {
      isComplex,
      score,
      indicators,
      recommendation,
    };
  }

  /**
   * Parse natural language into structured tasks using AI
   */
  async parseNaturalLanguage(description: string): Promise<GeneratedSpec> {
    const prompt = `You are an expert software architect. Parse this task description into a structured project specification.

Task: "${description}"

Analyze this task and provide a JSON response with:

1. **title**: A clear, concise project title (e.g., "User Authentication System")
2. **overview**: 2-3 sentence overview of what will be built
3. **goals**: Array of 3-5 specific goals (what will be achieved)
4. **successCriteria**: Array of 3-5 measurable success criteria
5. **tasks**: Array of tasks with:
   - id: Lowercase, colon-separated (e.g., "auth:db", "auth:api")
   - description: Clear, actionable task description
   - agent: Best agent for this task (backend, frontend, security, quality, devops, data, mobile, product, cto)
   - dependencies: Array of task IDs this depends on (empty if no dependencies)
   - priority: 1 (high) to 3 (low)
   - labels: Optional tags (e.g., ["testing", "critical"])
6. **plan**: Object with:
   - architecture: High-level architecture description
   - approach: Implementation approach (2-3 sentences)
   - phases: Array of phase names

**Important Rules:**
- Create 5-15 tasks (not too many, not too few)
- Tasks should follow logical dependencies (e.g., database before API, API before tests)
- Use appropriate agents based on task type
- Ensure tasks are granular but not too small
- Group related tasks with common ID prefix (e.g., "auth:db", "auth:api", "auth:test")

**Agent Selection Guide:**
- backend: Database, API, server-side logic, backend services
- frontend: UI components, pages, client-side logic
- security: Authentication, authorization, security audits, vulnerability scanning
- quality: Testing (unit, integration, e2e), QA, code review
- devops: Deployment, CI/CD, infrastructure, monitoring
- data: Data processing, analytics, ETL, databases (if data-focused)
- mobile: Mobile apps (iOS, Android)
- product: Requirements, planning, user stories (only if needed)

Return ONLY valid JSON, no markdown formatting, no explanation.`;

    const result = await this.provider.execute({
      prompt,
      systemPrompt: 'You are an expert software architect.',
    });

    // Parse AI response
    try {
      // Remove markdown code blocks if present
      let jsonStr = result.content.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      }
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();

      const parsed = JSON.parse(jsonStr) as GeneratedSpec;
      return parsed;
    } catch (error) {
      throw new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Infer best agent for a task based on keywords
   */
  private inferAgent(description: string): string {
    const lowerDesc = description.toLowerCase();

    for (const [agent, keywords] of Object.entries(AGENT_KEYWORDS)) {
      if (keywords.some((keyword) => lowerDesc.includes(keyword))) {
        return agent;
      }
    }

    return 'backend'; // Default fallback
  }

  /**
   * Generate spec.md content
   */
  private generateSpecMd(spec: GeneratedSpec): string {
    const goals = spec.goals.map((g) => `- ${g}`).join('\n');
    const criteria = spec.successCriteria.map((c) => `- ${c}`).join('\n');

    return `# ${spec.title}

**Version:** 1.0.0
**Generated:** ${new Date().toISOString().split('T')[0]}

## Overview

${spec.overview}

## Goals

${goals}

## Success Criteria

${criteria}

## Technical Approach

${spec.plan.approach}

## Architecture

${spec.plan.architecture}
`;
  }

  /**
   * Generate plan.md content
   */
  private generatePlanMd(spec: GeneratedSpec): string {
    const phases = spec.plan.phases.map((p, i) => `${i + 1}. ${p}`).join('\n');

    return `# Technical Plan: ${spec.title}

## Architecture

${spec.plan.architecture}

## Implementation Approach

${spec.plan.approach}

## Phases

${phases}

## Task Breakdown

See tasks.md for detailed task list with dependencies.

## Technology Stack

- **AutomatosX**: Multi-agent orchestration
- **Spec-Kit**: Dependency management and parallel execution

## Execution Strategy

\`\`\`bash
# Validate spec
ax spec validate

# Dry-run to preview execution plan
ax spec run --dry-run

# Execute with parallel mode
ax spec run --parallel
\`\`\`
`;
  }

  /**
   * Generate tasks.md content
   */
  private generateTasksMd(spec: GeneratedSpec): string {
    // Group tasks by phase (prefix)
    const tasksByPhase = new Map<string, ParsedTask[]>();

    for (const task of spec.tasks) {
      const prefix = task.id.split(':')[0] || 'general';
      const phase = prefix.charAt(0).toUpperCase() + prefix.slice(1);

      if (!tasksByPhase.has(phase)) {
        tasksByPhase.set(phase, []);
      }
      tasksByPhase.get(phase)!.push(task);
    }

    let content = `# Tasks: ${spec.title}\n\n`;

    for (const [phase, tasks] of tasksByPhase) {
      content += `## Phase: ${phase}\n\n`;

      for (const task of tasks) {
        const deps = task.dependencies.length > 0 ? ` dep:${task.dependencies.join(',')}` : '';
        const labels = task.labels && task.labels.length > 0 ? ` labels:${task.labels.join(',')}` : '';
        const ops = `ax run ${task.agent} '${task.description}'`;

        content += `- [ ] id:${task.id} ops:"${ops}"${deps}${labels}\n`;
      }

      content += '\n';
    }

    return content;
  }

  /**
   * Generate and save all spec files
   */
  async generate(description: string, workspacePath: string): Promise<GeneratedSpec> {
    // Parse natural language
    const spec = await this.parseNaturalLanguage(description);

    // Create .specify directory if it doesn't exist
    const specifyDir = join(workspacePath, '.specify');
    if (!existsSync(specifyDir)) {
      await mkdir(specifyDir, { recursive: true });
    }

    // Generate file contents
    const specMd = this.generateSpecMd(spec);
    const planMd = this.generatePlanMd(spec);
    const tasksMd = this.generateTasksMd(spec);

    // Write files
    await writeFile(join(specifyDir, 'spec.md'), specMd, 'utf8');
    await writeFile(join(specifyDir, 'plan.md'), planMd, 'utf8');
    await writeFile(join(specifyDir, 'tasks.md'), tasksMd, 'utf8');

    return spec;
  }
}
