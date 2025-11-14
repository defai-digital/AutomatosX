/**
 * PRDGenerator - Generate Product Requirements Documents from codebase
 *
 * Analyzes codebase to detect features and generates comprehensive PRDs including:
 * - Product vision and goals
 * - Feature specifications with user stories
 * - Technical requirements and constraints
 * - Success metrics and KPIs
 * - Architecture decisions and dependencies
 *
 * @extends SpecKitGenerator
 */

import { SpecKitGenerator } from './SpecKitGenerator.js';
import { FeatureDetector, type DetectedFeature } from './FeatureDetector.js';
import type {
  GenerateOptions,
  AnalysisResult,
} from '../types/speckit.types.js';
import type { ProviderRouterV2 } from '../services/ProviderRouterV2.js';
import type { MemoryService } from '../memory/MemoryService.js';

export interface PRDGenerateOptions extends GenerateOptions {
  /** Focus on specific feature (optional) */
  feature?: string;

  /** Include architecture section */
  includeArchitecture?: boolean;

  /** Include user stories */
  includeUserStories?: boolean;

  /** Include success metrics */
  includeMetrics?: boolean;

  /** Include UI mockups section */
  includeMockups?: boolean;

  /** Target audience for document */
  audience?: 'technical' | 'business' | 'mixed';

  /** PRD template style */
  template?: 'standard' | 'lean' | 'detailed';
}

/**
 * PRDGenerator - Generates Product Requirements Documents
 *
 * Template Method Pattern Implementation:
 * 1. analyze() - Detect features using FeatureDetector
 * 2. detect() - Filter and prioritize features
 * 3. generateContent() - Generate PRD using AI with feature context
 * 4. format() - Apply PRD structure and formatting (from base)
 * 5. validate() - Ensure completeness and quality (from base)
 * 6. save() - Write to file (from base)
 */
export class PRDGenerator extends SpecKitGenerator<PRDGenerateOptions> {
  protected readonly generatorName = 'prd';
  private featureDetector: FeatureDetector;

  constructor(
    providerRouter: ProviderRouterV2,
    memoryService: MemoryService
  ) {
    super(providerRouter, memoryService);

    // Create FeatureDetector with bound searchCode method
    this.featureDetector = new FeatureDetector(
      this.searchCode.bind(this)
    );
  }

  /**
   * Step 1: Analyze codebase to detect features
   */
  protected async analyze(options: PRDGenerateOptions): Promise<AnalysisResult> {
    this.log(options, 'Detecting features...');

    let features: DetectedFeature[];

    if (options.feature) {
      // Detect specific feature
      const feature = await this.featureDetector.detect(options.feature);
      features = feature ? [feature] : [];
    } else {
      // Detect all features
      features = await this.featureDetector.detectAll();
    }

    this.log(options, `Detected ${features.length} features`);

    // Build analysis result
    const files = new Set<string>();
    const dependencies = new Set<string>();

    for (const feature of features) {
      feature.files.forEach(f => files.add(f));
      feature.dependencies.forEach(d => dependencies.add(d));
    }

    return {
      files: Array.from(files).map(path => ({
        path,
        language: this.inferLanguage(path),
        lines: 0,
        symbols: [],
        imports: [],
        exports: [],
      })),
      patterns: features.map(f => ({
        type: 'feature' as const,
        name: f.name,
        description: f.description,
        locations: f.files.map(file => ({
          file,
          line: 1,
          context: f.category,
        })),
        confidence: f.confidence,
        examples: [],
      })),
      stats: {
        totalFiles: files.size,
        totalLines: 0,
        languages: {},
      },
      dependencies: Array.from(dependencies).map(name => ({
        name,
        version: 'unknown',
        type: 'npm',
        usageCount: 1,
      })),
      architecture: [],
    };
  }

  /**
   * Step 2: Filter and prioritize detected features
   */
  protected async detect(
    analysis: AnalysisResult,
    options: PRDGenerateOptions
  ): Promise<DetectedFeature[]> {
    this.log(options, 'Filtering features...');

    // Extract features from patterns
    const features: DetectedFeature[] = analysis.patterns.map(p => ({
      name: p.name,
      type: 'core' as const,
      category: this.inferCategory(p.description),
      files: p.locations.map(l => l.file),
      endpoints: [],
      components: [],
      dependencies: [],
      description: p.description,
      userStories: [],
      acceptance: [],
      confidence: p.confidence,
    }));

    // Filter by confidence threshold
    const filtered = features.filter(f => f.confidence > 0.5);

    // Sort by confidence (highest first)
    filtered.sort((a, b) => b.confidence - a.confidence);

    this.log(options, `Filtered to ${filtered.length} high-confidence features`);

    return filtered;
  }

  /**
   * Step 3: Generate PRD content using AI
   */
  protected async generateContent(
    features: DetectedFeature[],
    analysis: AnalysisResult,
    options: PRDGenerateOptions
  ): Promise<string> {
    if (features.length === 0) {
      this.log(options, 'No features detected, generating empty PRD');
      return this.generateEmptyPRD(options);
    }

    this.log(options, 'Generating PRD content with AI...');

    // Build AI prompt
    const prompt = this.buildPRDPrompt(features, analysis, options);

    // Call AI provider
    const content = await this.callAI(prompt, {
      provider: options.provider,
      temperature: 0.7,
      maxTokens: 8000,
    });

    return content;
  }

  /**
   * Build AI prompt for PRD generation
   */
  private buildPRDPrompt(
    features: DetectedFeature[],
    analysis: AnalysisResult,
    options: PRDGenerateOptions
  ): string {
    const audience = options.audience || 'mixed';
    const template = options.template || 'standard';

    let prompt = `You are a product manager writing a comprehensive Product Requirements Document (PRD).

**Audience**: ${audience === 'technical' ? 'Software engineers and architects' : audience === 'business' ? 'Business stakeholders and executives' : 'Both technical and business audiences'}

**Template Style**: ${template === 'standard' ? 'Standard PRD with all sections' : template === 'lean' ? 'Lean PRD focused on core requirements' : 'Detailed PRD with comprehensive specifications'}

**Codebase Analysis**:
- Total Files: ${analysis.stats.totalFiles}
- Features Detected: ${features.length}
- Dependencies: ${analysis.dependencies.map(d => d.name).join(', ')}

**Detected Features**:

`;

    // Add feature details
    for (const feature of features) {
      prompt += `### ${feature.name} (${feature.category}, confidence: ${(feature.confidence * 100).toFixed(0)}%)

**Type**: ${feature.type}
**Description**: ${feature.description}
**Files**: ${feature.files.slice(0, 5).join(', ')}${feature.files.length > 5 ? ` (+${feature.files.length - 5} more)` : ''}
**Dependencies**: ${feature.dependencies.join(', ') || 'None'}

`;

      if (options.includeUserStories && feature.userStories.length > 0) {
        prompt += `**User Stories**:\n`;
        feature.userStories.forEach(story => {
          prompt += `- ${story}\n`;
        });
        prompt += '\n';
      }

      if (feature.acceptance.length > 0) {
        prompt += `**Acceptance Criteria**:\n`;
        feature.acceptance.forEach(criterion => {
          prompt += `- ${criterion}\n`;
        });
        prompt += '\n';
      }

      if (feature.endpoints && feature.endpoints.length > 0) {
        prompt += `**API Endpoints**:\n`;
        feature.endpoints.forEach(ep => {
          prompt += `- ${ep.method} ${ep.path}\n`;
        });
        prompt += '\n';
      }

      if (feature.components && feature.components.length > 0) {
        prompt += `**UI Components**:\n`;
        feature.components.forEach(comp => {
          prompt += `- ${comp.name} (${comp.type})\n`;
        });
        prompt += '\n';
      }

      prompt += '---\n\n';
    }

    // Add generation instructions
    prompt += `
**Generate a comprehensive PRD with the following structure**:

# Product Requirements Document

## 1. Product Vision
- What problem does this solve?
- Who are the target users?
- What is the value proposition?

## 2. Goals and Objectives
- Business goals
- User goals
- Technical goals

## 3. Features and Requirements

For each major feature:
- Feature name and description
- User stories (As a [user], I want to [action], so that [benefit])
- Acceptance criteria (measurable success criteria)
- Priority (P0/P1/P2/P3)
- Complexity estimate (low/medium/high)
${options.includeArchitecture ? '- Technical architecture and dependencies' : ''}

## 4. User Experience
- User flows and journeys
- Key interactions
${options.includeMockups ? '- UI mockup descriptions' : ''}

## 5. Technical Requirements
- Architecture overview
- Technology stack
- Integration points
- Data models
- Security considerations
- Performance requirements

${options.includeMetrics ? `## 6. Success Metrics
- KPIs to track
- Target values
- Measurement methods` : ''}

## ${options.includeMetrics ? '7' : '6'}. Dependencies and Risks
- External dependencies
- Technical risks
- Mitigation strategies

## ${options.includeMetrics ? '8' : '7'}. Timeline and Milestones
- Development phases
- Key milestones
- Release criteria

---

**Important**:
- Use specific details from the detected features above
- Be concrete and actionable
- Focus on ${audience === 'technical' ? 'technical implementation details' : audience === 'business' ? 'business value and user impact' : 'both technical and business perspectives'}
- Use markdown formatting
- Include realistic estimates based on detected complexity
${options.includeUserStories ? '- Expand on the user stories provided' : ''}
${!options.includeUserStories ? '- Generate user stories for each feature' : ''}
`;

    return prompt;
  }

  /**
   * Generate empty PRD when no features are detected
   */
  private generateEmptyPRD(options: PRDGenerateOptions): string {
    const template = options.template || 'standard';

    return `# Product Requirements Document

## Overview

This PRD template was generated but no features were automatically detected in the codebase.

**Next Steps**:
1. Manually add product vision and goals
2. Define target users and use cases
3. Specify features and requirements
4. Add technical architecture details
5. Define success metrics

## 1. Product Vision

[Describe what problem this product solves and the value it provides]

## 2. Goals and Objectives

**Business Goals**:
- [Goal 1]
- [Goal 2]

**User Goals**:
- [Goal 1]
- [Goal 2]

**Technical Goals**:
- [Goal 1]
- [Goal 2]

## 3. Features and Requirements

### Feature 1: [Feature Name]

**Description**: [What does this feature do?]

**User Stories**:
- As a [user type], I want to [action], so that [benefit]

**Acceptance Criteria**:
- [Criterion 1]
- [Criterion 2]

**Priority**: P0/P1/P2/P3

**Complexity**: Low/Medium/High

${template === 'detailed' ? `
## 4. User Experience

**User Flows**:
[Describe key user journeys]

**Key Interactions**:
[Describe important user interactions]

## 5. Technical Requirements

**Architecture**:
[Describe technical architecture]

**Technology Stack**:
- Frontend: [Technologies]
- Backend: [Technologies]
- Database: [Technologies]

**Security**:
[Security requirements and considerations]

**Performance**:
[Performance requirements and SLAs]

## 6. Success Metrics

**KPIs**:
- [Metric 1]: Target value
- [Metric 2]: Target value

## 7. Dependencies and Risks

**Dependencies**:
- [Dependency 1]
- [Dependency 2]

**Risks**:
- [Risk 1]: Mitigation strategy
- [Risk 2]: Mitigation strategy

## 8. Timeline and Milestones

**Phase 1**: [Timeline]
- [Milestone 1]
- [Milestone 2]

**Phase 2**: [Timeline]
- [Milestone 1]
- [Milestone 2]
` : ''}

---

*Generated by AutomatosX SpecKit PRD Generator*
*Template: ${template}*
*Note: No features were automatically detected. Please fill in the sections above manually.*
`;
  }

  /**
   * Infer programming language from file extension
   */
  private inferLanguage(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      ts: 'typescript',
      js: 'javascript',
      tsx: 'typescript',
      jsx: 'javascript',
      py: 'python',
      go: 'go',
      rs: 'rust',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      cs: 'csharp',
      rb: 'ruby',
      php: 'php',
      swift: 'swift',
      kt: 'kotlin',
    };
    return langMap[ext] || 'unknown';
  }

  /**
   * Infer feature category from description
   */
  private inferCategory(description: string): DetectedFeature['category'] {
    const lower = description.toLowerCase();

    if (lower.includes('auth') || lower.includes('login') || lower.includes('password')) {
      return 'auth';
    }
    if (lower.includes('api') || lower.includes('endpoint') || lower.includes('rest')) {
      return 'api';
    }
    if (lower.includes('ui') || lower.includes('component') || lower.includes('page')) {
      return 'ui';
    }
    if (lower.includes('data') || lower.includes('database') || lower.includes('model')) {
      return 'data';
    }
    if (lower.includes('security') || lower.includes('encryption') || lower.includes('permission')) {
      return 'security';
    }
    if (lower.includes('payment') || lower.includes('billing') || lower.includes('stripe')) {
      return 'payment';
    }
    if (lower.includes('search') || lower.includes('query') || lower.includes('filter')) {
      return 'search';
    }
    if (lower.includes('notification') || lower.includes('email') || lower.includes('alert')) {
      return 'notification';
    }
    if (lower.includes('analytics') || lower.includes('tracking') || lower.includes('metrics')) {
      return 'analytics';
    }

    return 'integration';
  }
}
