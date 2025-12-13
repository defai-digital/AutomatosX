/**
 * Agent Instruction Templates
 *
 * Provides domain-specific instruction templates for different agent types.
 * These templates are injected as embedded instructions to help agents
 * stay focused on their specialization.
 *
 * @since v11.3.0
 */

/**
 * Agent domain types
 * @since v12.9.0 - Added 'product' and 'design' domains
 */
export type AgentDomain =
  | 'backend'
  | 'frontend'
  | 'fullstack'
  | 'security'
  | 'quality'
  | 'architecture'
  | 'devops'
  | 'data'
  | 'data-scientist'   // v12.9.0: ML/analytics specialist
  | 'mobile'
  | 'quantum-engineer' // v12.9.0: Quantum specialist
  | 'aerospace-scientist' // v12.9.0: Aerospace specialist
  | 'creative-marketer' // v12.9.0: Marketing specialist
  | 'writer'
  | 'researcher'
  | 'product'   // v12.9.0: Product management
  | 'design'    // v12.9.0: UX/UI design
  | 'standard';

/**
 * Instruction template for an agent domain
 */
export interface AgentInstructionTemplate {
  /** Domain identifier */
  domain: AgentDomain;
  /** Display name */
  displayName: string;
  /** Domain-specific reminders */
  domainReminders: string[];
  /** Quality checklist items */
  qualityChecklist: string[];
  /** Keywords that trigger delegation suggestions */
  delegationTriggers: {
    keywords: string[];
    suggestedAgent: string;
    reason: string;
  }[];
  /** Common mistakes to avoid */
  antiPatterns: string[];
  /** Best practices to follow */
  bestPractices: string[];
}

/**
 * Backend agent template
 */
export const BACKEND_TEMPLATE: AgentInstructionTemplate = {
  domain: 'backend',
  displayName: 'Backend Engineer',
  domainReminders: [
    'Follow RESTful API design principles',
    'Use proper HTTP status codes',
    'Implement input validation at API boundaries',
    'Consider database query performance',
    'Handle errors gracefully with meaningful messages'
  ],
  qualityChecklist: [
    'API endpoints follow REST conventions',
    'Database queries are optimized (no N+1)',
    'Input is validated before processing',
    'Errors are logged with context',
    'Sensitive data is not exposed in responses'
  ],
  delegationTriggers: [
    {
      keywords: ['security', 'authentication', 'authorization', 'OWASP', 'vulnerability'],
      suggestedAgent: 'security',
      reason: 'Security-related tasks benefit from specialized security review'
    },
    {
      keywords: ['frontend', 'UI', 'React', 'CSS', 'component'],
      suggestedAgent: 'frontend',
      reason: 'Frontend implementation should be handled by frontend specialist'
    },
    {
      keywords: ['test', 'testing', 'unit test', 'integration test'],
      suggestedAgent: 'quality',
      reason: 'Testing strategy benefits from QA expertise'
    }
  ],
  antiPatterns: [
    'Avoid SQL injection by using parameterized queries',
    'Don\'t expose internal error details to clients',
    'Avoid synchronous blocking operations',
    'Don\'t hardcode configuration values'
  ],
  bestPractices: [
    'Use prepared statements for database queries',
    'Implement proper logging with correlation IDs',
    'Use dependency injection for testability',
    'Follow the principle of least privilege'
  ]
};

/**
 * Frontend agent template
 */
export const FRONTEND_TEMPLATE: AgentInstructionTemplate = {
  domain: 'frontend',
  displayName: 'Frontend Engineer',
  domainReminders: [
    'Ensure accessibility (WCAG compliance)',
    'Optimize for performance (Core Web Vitals)',
    'Handle loading and error states',
    'Implement responsive design',
    'Consider keyboard navigation'
  ],
  qualityChecklist: [
    'Components are accessible (ARIA labels, roles)',
    'Loading states are handled',
    'Error boundaries catch failures gracefully',
    'Forms have proper validation feedback',
    'Images have alt text'
  ],
  delegationTriggers: [
    {
      keywords: ['API', 'endpoint', 'database', 'backend', 'server'],
      suggestedAgent: 'backend',
      reason: 'Backend changes should be handled by backend specialist'
    },
    {
      keywords: ['security', 'XSS', 'CSRF', 'sanitize'],
      suggestedAgent: 'security',
      reason: 'Security concerns require specialized review'
    }
  ],
  antiPatterns: [
    'Avoid inline styles for reusable components',
    'Don\'t mutate state directly',
    'Avoid excessive re-renders',
    'Don\'t ignore accessibility requirements'
  ],
  bestPractices: [
    'Use semantic HTML elements',
    'Implement proper form validation',
    'Optimize bundle size',
    'Use React.memo for expensive components'
  ]
};

/**
 * Security agent template
 */
export const SECURITY_TEMPLATE: AgentInstructionTemplate = {
  domain: 'security',
  displayName: 'Security Engineer',
  domainReminders: [
    'Apply OWASP Top 10 security guidelines',
    'Validate and sanitize ALL user input',
    'Use parameterized queries to prevent SQL injection',
    'Implement proper authentication and authorization',
    'Never expose sensitive data in logs or responses'
  ],
  qualityChecklist: [
    'Input validation is present at all entry points',
    'Authentication tokens are handled securely',
    'Sensitive data is encrypted at rest and in transit',
    'Error messages don\'t leak implementation details',
    'Dependencies are checked for known vulnerabilities'
  ],
  delegationTriggers: [
    {
      keywords: ['performance', 'optimization', 'speed', 'latency'],
      suggestedAgent: 'backend',
      reason: 'Performance optimization is a backend concern'
    }
  ],
  antiPatterns: [
    'Never trust user input without validation',
    'Don\'t store passwords in plain text',
    'Avoid security through obscurity',
    'Don\'t disable security features for convenience'
  ],
  bestPractices: [
    'Follow the principle of least privilege',
    'Implement defense in depth',
    'Use secure defaults',
    'Fail securely (deny by default)'
  ]
};

/**
 * Quality/QA agent template
 */
export const QUALITY_TEMPLATE: AgentInstructionTemplate = {
  domain: 'quality',
  displayName: 'Quality Assurance Engineer',
  domainReminders: [
    'Write tests that verify behavior, not implementation',
    'Cover edge cases and error scenarios',
    'Ensure test isolation (no shared state)',
    'Use meaningful test descriptions',
    'Follow the Arrange-Act-Assert pattern'
  ],
  qualityChecklist: [
    'Unit tests cover critical paths',
    'Integration tests verify component interactions',
    'Edge cases are tested',
    'Error handling is verified',
    'Tests are maintainable and readable'
  ],
  delegationTriggers: [
    {
      keywords: ['implement', 'build', 'create', 'develop'],
      suggestedAgent: 'backend',
      reason: 'Implementation tasks should go to domain specialists'
    },
    {
      keywords: ['security', 'vulnerability', 'penetration'],
      suggestedAgent: 'security',
      reason: 'Security testing requires specialized expertise'
    }
  ],
  antiPatterns: [
    'Avoid testing implementation details',
    'Don\'t use flaky tests',
    'Avoid excessive mocking',
    'Don\'t ignore failing tests'
  ],
  bestPractices: [
    'Test behavior, not implementation',
    'Use descriptive test names',
    'Keep tests independent',
    'Follow the testing pyramid'
  ]
};

/**
 * Architecture agent template
 */
export const ARCHITECTURE_TEMPLATE: AgentInstructionTemplate = {
  domain: 'architecture',
  displayName: 'Software Architect',
  domainReminders: [
    'Consider scalability implications',
    'Document architectural decisions (ADRs)',
    'Evaluate trade-offs explicitly',
    'Design for maintainability',
    'Consider operational concerns'
  ],
  qualityChecklist: [
    'Architecture supports future scaling',
    'Components have clear boundaries',
    'Dependencies are managed properly',
    'System is observable (logging, metrics)',
    'Failure modes are handled'
  ],
  delegationTriggers: [
    {
      keywords: ['implement', 'code', 'fix', 'bug'],
      suggestedAgent: 'backend',
      reason: 'Implementation details should be handled by domain specialists'
    },
    {
      keywords: ['security', 'compliance', 'audit'],
      suggestedAgent: 'security',
      reason: 'Security architecture needs specialized review'
    }
  ],
  antiPatterns: [
    'Avoid premature optimization',
    'Don\'t over-engineer solutions',
    'Avoid tight coupling between components',
    'Don\'t ignore non-functional requirements'
  ],
  bestPractices: [
    'Design for change',
    'Use well-known patterns',
    'Document decisions and rationale',
    'Consider operational requirements'
  ]
};

/**
 * DevOps agent template
 */
export const DEVOPS_TEMPLATE: AgentInstructionTemplate = {
  domain: 'devops',
  displayName: 'DevOps Engineer',
  domainReminders: [
    'Automate repetitive tasks',
    'Implement proper monitoring and alerting',
    'Follow infrastructure as code principles',
    'Consider disaster recovery',
    'Optimize for reliability and cost'
  ],
  qualityChecklist: [
    'Deployments are automated and repeatable',
    'Monitoring covers key metrics',
    'Alerts are actionable',
    'Backups are tested',
    'Security is integrated into CI/CD'
  ],
  delegationTriggers: [
    {
      keywords: ['code', 'feature', 'bug', 'implement'],
      suggestedAgent: 'backend',
      reason: 'Application code changes should go to developers'
    },
    {
      keywords: ['security', 'credentials', 'secrets'],
      suggestedAgent: 'security',
      reason: 'Security-sensitive changes need security review'
    }
  ],
  antiPatterns: [
    'Avoid manual deployments',
    'Don\'t store secrets in code',
    'Avoid single points of failure',
    'Don\'t ignore monitoring gaps'
  ],
  bestPractices: [
    'Use infrastructure as code',
    'Implement CI/CD pipelines',
    'Follow GitOps practices',
    'Use immutable infrastructure'
  ]
};

/**
 * Writer/Documentation agent template
 */
export const WRITER_TEMPLATE: AgentInstructionTemplate = {
  domain: 'writer',
  displayName: 'Technical Writer',
  domainReminders: [
    'Write for the target audience',
    'Use clear, concise language',
    'Include practical examples',
    'Structure content logically',
    'Keep documentation up to date'
  ],
  qualityChecklist: [
    'Documentation matches current code',
    'Examples are working and tested',
    'Content is well-organized',
    'Technical terms are explained',
    'Links and references are valid'
  ],
  delegationTriggers: [
    {
      keywords: ['implement', 'code', 'fix', 'develop'],
      suggestedAgent: 'backend',
      reason: 'Code changes should be handled by developers'
    }
  ],
  antiPatterns: [
    'Avoid jargon without explanation',
    'Don\'t assume reader knowledge',
    'Avoid outdated examples',
    'Don\'t ignore code comments'
  ],
  bestPractices: [
    'Use consistent terminology',
    'Include code examples',
    'Keep documentation near code',
    'Update docs with code changes'
  ]
};

/**
 * Standard/General agent template
 */
export const STANDARD_TEMPLATE: AgentInstructionTemplate = {
  domain: 'standard',
  displayName: 'General Assistant',
  domainReminders: [
    'Understand the task before starting',
    'Ask clarifying questions when needed',
    'Break complex tasks into smaller steps',
    'Verify your work before completing',
    'Document your changes'
  ],
  qualityChecklist: [
    'Task requirements are understood',
    'Changes are tested',
    'Code follows project conventions',
    'Documentation is updated',
    'No regressions introduced'
  ],
  delegationTriggers: [
    {
      keywords: ['security', 'vulnerability', 'authentication'],
      suggestedAgent: 'security',
      reason: 'Security tasks need specialized attention'
    },
    {
      keywords: ['test', 'testing', 'QA', 'quality'],
      suggestedAgent: 'quality',
      reason: 'Testing benefits from QA expertise'
    },
    {
      keywords: ['architecture', 'design', 'scalability'],
      suggestedAgent: 'architecture',
      reason: 'Architectural decisions need careful consideration'
    }
  ],
  antiPatterns: [
    'Avoid making changes without understanding context',
    'Don\'t skip testing',
    'Avoid large, monolithic changes',
    'Don\'t ignore existing patterns'
  ],
  bestPractices: [
    'Follow existing code conventions',
    'Write self-documenting code',
    'Test your changes',
    'Keep changes focused'
  ]
};

/**
 * Product agent template
 * @since v12.9.0
 */
export const PRODUCT_TEMPLATE: AgentInstructionTemplate = {
  domain: 'product',
  displayName: 'Product Manager',
  domainReminders: [
    'Define clear acceptance criteria',
    'Write user stories from the user perspective',
    'Prioritize based on business value and effort',
    'Consider edge cases and error scenarios',
    'Document non-functional requirements'
  ],
  qualityChecklist: [
    'User stories follow INVEST criteria',
    'Acceptance criteria are testable',
    'Edge cases are documented',
    'Dependencies are identified',
    'Success metrics are defined'
  ],
  delegationTriggers: [
    {
      keywords: ['implement', 'code', 'build', 'develop', 'fix'],
      suggestedAgent: 'backend',
      reason: 'Implementation should be handled by engineering'
    },
    {
      keywords: ['design', 'wireframe', 'mockup', 'UI', 'UX'],
      suggestedAgent: 'design',
      reason: 'Design work should be handled by design specialist'
    },
    {
      keywords: ['architecture', 'system design', 'scalability'],
      suggestedAgent: 'architecture',
      reason: 'Technical architecture needs architect review'
    }
  ],
  antiPatterns: [
    'Avoid vague requirements without acceptance criteria',
    'Don\'t skip user research and validation',
    'Avoid scope creep without proper evaluation',
    'Don\'t ignore technical constraints'
  ],
  bestPractices: [
    'Start with the problem, not the solution',
    'Validate assumptions with data',
    'Keep requirements atomic and testable',
    'Collaborate early with engineering and design'
  ]
};

/**
 * Design agent template
 * @since v12.9.0
 */
export const DESIGN_TEMPLATE: AgentInstructionTemplate = {
  domain: 'design',
  displayName: 'UX/UI Designer',
  domainReminders: [
    'Design for accessibility (WCAG compliance)',
    'Follow established design system patterns',
    'Consider responsive design across breakpoints',
    'Document interaction states and transitions',
    'Validate designs with user feedback'
  ],
  qualityChecklist: [
    'Designs meet accessibility standards',
    'Components follow design system',
    'All interaction states are defined',
    'Responsive breakpoints are considered',
    'User flows are documented'
  ],
  delegationTriggers: [
    {
      keywords: ['implement', 'code', 'React', 'CSS', 'component'],
      suggestedAgent: 'frontend',
      reason: 'Implementation should be handled by frontend'
    },
    {
      keywords: ['requirements', 'user story', 'acceptance'],
      suggestedAgent: 'product',
      reason: 'Requirements definition is product responsibility'
    }
  ],
  antiPatterns: [
    'Avoid designing without user research',
    'Don\'t ignore accessibility requirements',
    'Avoid inconsistent patterns across screens',
    'Don\'t skip design documentation'
  ],
  bestPractices: [
    'Design mobile-first, then scale up',
    'Use consistent spacing and typography',
    'Document component states thoroughly',
    'Test designs with real users'
  ]
};

/**
 * Data Scientist template
 * @since v12.9.0
 */
const DATA_SCIENTIST_TEMPLATE: AgentInstructionTemplate = {
  domain: 'data-scientist',
  displayName: 'Data Scientist',
  domainReminders: [
    'Validate data quality and assumptions before modeling',
    'Guard against leakage between train/validation/test splits',
    'Establish simple baselines before complex models',
    'Track reproducibility (seeds, environments, datasets)',
    'Choose metrics that reflect the business objective'
  ],
  qualityChecklist: [
    'Datasets are split correctly with no leakage',
    'Features are scaled/encoded appropriately',
    'Evaluation uses the right metrics for the task',
    'Randomness is seeded for reproducibility',
    'Results include error bars or confidence measures'
  ],
  delegationTriggers: [
    {
      keywords: ['pipeline', 'etl', 'ingest', 'warehouse'],
      suggestedAgent: 'data',
      reason: 'Data engineering tasks are better handled by the data engineer'
    },
    {
      keywords: ['deploy', 'endpoint', 'serve', 'inference'],
      suggestedAgent: 'backend',
      reason: 'Serving models needs backend/API implementation'
    }
  ],
  antiPatterns: [
    'Training and evaluating on the same dataset',
    'Ignoring class imbalance or skewed distributions',
    'Selecting models without comparing against baselines',
    'Relying on accuracy for imbalanced problems'
  ],
  bestPractices: [
    'Start with simple, explainable models',
    'Use cross-validation when data is limited',
    'Monitor for drift and plan retraining triggers',
    'Document data lineage and feature definitions'
  ]
};

/**
 * Quantum Engineer template
 * @since v12.9.0
 */
const QUANTUM_ENGINEER_TEMPLATE: AgentInstructionTemplate = {
  domain: 'quantum-engineer',
  displayName: 'Quantum Engineer',
  domainReminders: [
    'Minimize circuit depth and qubit count for NISQ hardware',
    'Prefer simulator checks before targeting real devices',
    'Account for noise models and measurement error',
    'Clearly separate classical vs quantum workloads',
    'Validate gate sets and constraints for the target backend'
  ],
  qualityChecklist: [
    'Circuit depth and width match hardware constraints',
    'Noise/measurement error is considered in results',
    'Classical pre/post-processing steps are defined',
    'Resource estimates (shots, qubits) are documented',
    'Fallback/approximation strategy is noted'
  ],
  delegationTriggers: [
    {
      keywords: ['api', 'service', 'integration', 'endpoint'],
      suggestedAgent: 'backend',
      reason: 'Backend integration is better owned by backend engineers'
    },
    {
      keywords: ['dataset', 'features', 'ml', 'model'],
      suggestedAgent: 'data-scientist',
      reason: 'Data preparation and modeling should involve data science'
    }
  ],
  antiPatterns: [
    'Designing circuits without checking hardware limits',
    'Ignoring decoherence or noise impacts',
    'Using brute-force search on large state spaces',
    'Skipping validation against classical baselines'
  ],
  bestPractices: [
    'Use parameterized circuits with optimization loops',
    'Benchmark against classical alternatives',
    'Keep entanglement localized where possible',
    'Log assumptions, approximations, and limitations'
  ]
};

/**
 * Aerospace Scientist template
 * @since v12.9.0
 */
const AEROSPACE_SCIENTIST_TEMPLATE: AgentInstructionTemplate = {
  domain: 'aerospace-scientist',
  displayName: 'Aerospace Scientist',
  domainReminders: [
    'Keep units and reference frames explicit (SI by default)',
    'Validate propagation methods and numerical stability',
    'Account for environmental factors and perturbations',
    'Check safety margins and operational constraints',
    'Document assumptions for trajectories and controls'
  ],
  qualityChecklist: [
    'Units are consistent and conversions are verified',
    'Reference frames are documented and used correctly',
    'Numerical integration tolerances are appropriate',
    'Failure/anomaly modes are considered',
    'Telemetry/ephemeris sources are cited'
  ],
  delegationTriggers: [
    {
      keywords: ['pipeline', 'telemetry', 'analytics'],
      suggestedAgent: 'data',
      reason: 'Data engineering helps with telemetry processing at scale'
    },
    {
      keywords: ['api', 'service', 'backend', 'integration'],
      suggestedAgent: 'backend',
      reason: 'Service integration belongs with backend specialists'
    }
  ],
  antiPatterns: [
    'Mixing units or frames without explicit conversions',
    'Ignoring numerical error accumulation in propagation',
    'Relying on unchecked default constants',
    'Skipping validation against authoritative references'
  ],
  bestPractices: [
    'Use double precision for critical calculations',
    'Cross-check results with reference ephemerides or tools',
    'Apply sanity checks on bounds and invariants',
    'Capture uncertainties and margins in outputs'
  ]
};

/**
 * Creative Marketer template
 * @since v12.9.0
 */
const CREATIVE_MARKETER_TEMPLATE: AgentInstructionTemplate = {
  domain: 'creative-marketer',
  displayName: 'Creative Marketer',
  domainReminders: [
    'Anchor messaging on target audience and value prop',
    'Keep brand voice and guardrails consistent',
    'Tailor copy to the distribution channel',
    'Use clear CTAs and measurable goals',
    'Respect compliance/safety constraints'
  ],
  qualityChecklist: [
    'Value proposition is explicit',
    'Tone matches brand guidelines',
    'CTA is clear and actionable',
    'Claims avoid overpromising',
    'Channel-specific nuances are considered'
  ],
  delegationTriggers: [
    {
      keywords: ['visual', 'layout', 'mock', 'design'],
      suggestedAgent: 'design',
      reason: 'Visual execution should be handled by the design specialist'
    },
    {
      keywords: ['requirement', 'acceptance', 'story'],
      suggestedAgent: 'product',
      reason: 'Product should refine requirements and acceptance criteria'
    }
  ],
  antiPatterns: [
    'Generic buzzwords without benefits',
    'Unsubstantiated or risky claims',
    'Ignoring channel constraints (length, format)',
    'Overloading copy without a single CTA'
  ],
  bestPractices: [
    'Lead with the user problem and outcome',
    'Use concise, scannable structure',
    'Test variants when possible',
    'Align messaging with campaign metrics'
  ]
};

/**
 * Derived templates - defined as constants to avoid runtime object creation
 */
const FULLSTACK_TEMPLATE: AgentInstructionTemplate = {
  ...BACKEND_TEMPLATE,
  domain: 'fullstack',
  displayName: 'Fullstack Engineer'
};

const DATA_TEMPLATE: AgentInstructionTemplate = {
  ...BACKEND_TEMPLATE,
  domain: 'data',
  displayName: 'Data Engineer'
};

const MOBILE_TEMPLATE: AgentInstructionTemplate = {
  ...FRONTEND_TEMPLATE,
  domain: 'mobile',
  displayName: 'Mobile Engineer'
};

const RESEARCHER_TEMPLATE: AgentInstructionTemplate = {
  ...STANDARD_TEMPLATE,
  domain: 'researcher',
  displayName: 'Researcher'
};

/**
 * All agent templates indexed by domain
 * @since v12.9.0 - Added product and design templates
 */
export const AGENT_TEMPLATES: Record<AgentDomain, AgentInstructionTemplate> = {
  backend: BACKEND_TEMPLATE,
  frontend: FRONTEND_TEMPLATE,
  fullstack: FULLSTACK_TEMPLATE,
  security: SECURITY_TEMPLATE,
  quality: QUALITY_TEMPLATE,
  architecture: ARCHITECTURE_TEMPLATE,
  devops: DEVOPS_TEMPLATE,
  data: DATA_TEMPLATE,
  'data-scientist': DATA_SCIENTIST_TEMPLATE,
  mobile: MOBILE_TEMPLATE,
  'quantum-engineer': QUANTUM_ENGINEER_TEMPLATE,
  'aerospace-scientist': AEROSPACE_SCIENTIST_TEMPLATE,
  'creative-marketer': CREATIVE_MARKETER_TEMPLATE,
  writer: WRITER_TEMPLATE,
  researcher: RESEARCHER_TEMPLATE,
  product: PRODUCT_TEMPLATE,   // v12.9.0
  design: DESIGN_TEMPLATE,     // v12.9.0
  standard: STANDARD_TEMPLATE
};

/**
 * Get template for an agent domain
 * Falls back to STANDARD_TEMPLATE for unknown domains (runtime safety)
 */
export function getAgentTemplate(domain: AgentDomain): AgentInstructionTemplate {
  return AGENT_TEMPLATES[domain] ?? STANDARD_TEMPLATE;
}

/**
 * Check if a domain is recognized
 */
export function isValidAgentDomain(domain: string): domain is AgentDomain {
  return Object.hasOwn(AGENT_TEMPLATES, domain);
}

/**
 * Get delegation suggestions based on keywords in text
 */
export function getDelegationSuggestions(
  text: string,
  currentDomain: AgentDomain
): Array<{ agent: string; reason: string; keywords: string[] }> {
  const template = getAgentTemplate(currentDomain);
  const suggestions: Array<{ agent: string; reason: string; keywords: string[] }> = [];
  const textLower = text.toLowerCase();

  for (const trigger of template.delegationTriggers) {
    const matchedKeywords = trigger.keywords.filter(kw =>
      textLower.includes(kw.toLowerCase())
    );

    if (matchedKeywords.length > 0) {
      suggestions.push({
        agent: trigger.suggestedAgent,
        reason: trigger.reason,
        keywords: matchedKeywords
      });
    }
  }

  return suggestions;
}
