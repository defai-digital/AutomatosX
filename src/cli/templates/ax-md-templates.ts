/**
 * ax.md Templates
 *
 * Pre-built templates for different project sizes and needs
 *
 * @since v7.1.0
 */

export interface TemplateContext {
  projectName: string;
  projectDescription?: string;
  agents?: string[];
  testCommand?: string;
  buildCommand?: string;
  deployCommand?: string;
  customSections?: Record<string, string>;
}

/**
 * Generate current date in ISO format
 */
function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0] ?? '';
}

/**
 * Minimal template - bare essentials
 */
export function generateMinimalTemplate(context: TemplateContext): string {
  const { projectName, agents = [], testCommand = 'npm test', buildCommand = 'npm run build' } = context;

  // Generate agent rules
  const agentRules = agents.length > 0
    ? agents.map(agent => `- ${agent.charAt(0).toUpperCase() + agent.slice(1)} → @${agent}`).join('\n')
    : '- Backend → @backend\n- Frontend → @frontend';

  return `# Project Context for AutomatosX

## Agent Rules
${agentRules}

## Commands
- Test: \`${testCommand}\`
- Build: \`${buildCommand}\`
`;
}

/**
 * Standard template - recommended for most projects
 */
export function generateStandardTemplate(context: TemplateContext): string {
  const {
    projectName,
    projectDescription = '[Brief description of your project]',
    agents = ['backend', 'frontend', 'quality', 'security'],
    testCommand = 'npm test',
    buildCommand = 'npm run build',
  } = context;

  // Generate agent delegation rules
  const agentMapping: Record<string, string> = {
    backend: 'Backend/API',
    frontend: 'Frontend/UI',
    fullstack: 'Full-stack features',
    mobile: 'Mobile development',
    devops: 'Infrastructure/deployment',
    security: 'Security audit',
    quality: 'Testing/QA',
    data: 'Database/data engineering',
    architecture: 'Architecture/design'
  };

  const agentRules = agents
    .map(agent => {
      const label = agentMapping[agent] || agent;
      const extraNote = agent === 'security' ? ' (auto-review for auth)' : '';
      return `- ${label} → @${agent}${extraNote}`;
    })
    .join('\n');

  return `# Project Context for AutomatosX

> Last updated: ${getCurrentDate()}

## Project Overview

${projectDescription}

## Agent Delegation Rules

${agentRules}

## Coding Conventions

- Testing framework: [Your testing framework]
- Code style: [Your style guide]
- Always run tests before commit

## Critical Rules

⚠️ Never commit to main directly
⚠️ Security review required for auth code

## Commands

\`\`\`bash
${testCommand}        # Run tests
${buildCommand}   # Build for production
\`\`\`
`;
}

/**
 * Comprehensive template - for larger teams and complex projects
 */
export function generateComprehensiveTemplate(context: TemplateContext): string {
  const {
    projectName,
    projectDescription = '[Brief description of your project]',
    agents = ['backend', 'frontend', 'quality', 'security', 'devops'],
    testCommand = 'npm test',
    buildCommand = 'npm run build',
    deployCommand = 'npm run deploy:staging',
  } = context;

  const date = getCurrentDate();

  return `# Project Context for AutomatosX

> Last updated: ${date}
> Project: ${projectName}

## Project Overview

**Description:** ${projectDescription}

**Architecture:** [Describe your architecture - microservices, monolith, etc.]

**Stack:** [Your technology stack]

**Team:** [Team size and structure]

## Agent Delegation Rules

### Development
- **Backend/API** → @backend
- **Frontend/UI** → @frontend
- **Mobile** → @mobile
- **Infrastructure** → @devops

### Quality Assurance
- **Tests** → @quality
- **Security** → @security (mandatory for: auth, payments, PII)
- **Performance** → @quality

### Documentation
- **API docs** → @writer
- **User guides** → @writer
- **Architecture** → @architecture

## Coding Conventions

### Testing
- Framework: ${testCommand.includes('vitest') ? 'Vitest' : testCommand.includes('jest') ? 'Jest' : '[Your framework]'}
- Coverage: 80% minimum
- Always run tests before pushing

### Code Style
- Formatter: [Your formatter - Prettier, etc.]
- Linter: [Your linter - ESLint, etc.]
- Indent: 2 spaces
- Max line: 100 chars

### Git Workflow
- Branch naming: \`feature/ABC-123-description\`
- Commits: Conventional commits format
- PR: Requires 2 approvals + CI pass

## Critical Guardrails

⚠️ **NEVER:**
- Commit to main/production branches directly
- Skip security review for auth/payment code
- Touch database migrations without approval
- Deploy without running full test suite
- Expose API keys or credentials in code

✅ **ALWAYS:**
- Run \`${testCommand}\` before pushing
- Update API documentation for API changes
- Add logging for error scenarios
- Document breaking changes in CHANGELOG

## Canonical Commands

\`\`\`bash
# Development
npm run dev                 # Start dev server
${testCommand}                    # Run all tests
npm run test:watch         # Watch mode
npm run lint               # Lint code

# Building
${buildCommand}              # Production build

# Deployment
${deployCommand}     # Deploy to staging
\`\`\`

## Performance Targets

- **API Response:** p95 < 200ms
- **Page Load:** LCP < 2.5s
- **Build Time:** < 5min
- **Test Suite:** < 2min

## Security Requirements

- All auth changes reviewed by @security
- API rate limiting configured
- Secrets in environment variables only
- Dependencies scanned weekly

## Useful Links

- [Architecture Docs](docs/architecture/)
- [API Docs](docs/api/)
- [Runbook](docs/runbook.md)
`;
}

/**
 * Get template by name
 */
export function getTemplate(name: 'minimal' | 'standard' | 'comprehensive', context: TemplateContext): string {
  switch (name) {
    case 'minimal':
      return generateMinimalTemplate(context);
    case 'standard':
      return generateStandardTemplate(context);
    case 'comprehensive':
      return generateComprehensiveTemplate(context);
    default:
      return generateStandardTemplate(context);
  }
}

/**
 * Generate ax.config.yml template (optional advanced configuration)
 */
export function generateYamlTemplate(context: TemplateContext): string {
  const { projectName, agents = ['backend', 'frontend', 'quality'] } = context;
  const date = getCurrentDate();

  const agentConfigs = agents.map(agent => {
    const patterns = agent === 'backend'
      ? "['api/*', 'src/services/*', '*.go', '*.rs']"
      : agent === 'frontend'
      ? "['ui/*', 'components/*', '*.tsx', '*.jsx', '*.vue']"
      : "[]";

    const defaultFor = agent === 'backend'
      ? "['implement', 'refactor', 'optimize']"
      : agent === 'frontend'
      ? "['design', 'ui', 'styling']"
      : "[]";

    return `  ${agent}:
    patterns: ${patterns}
    default_for: ${defaultFor}`;
  }).join('\n');

  return `# ax.config.yml - Project-level defaults for AutomatosX

# Default agent assignments by task type
agents:
${agentConfigs}

# Project-specific rules
rules:
  - name: "critical-files"
    pattern: "migrations/*"
    require_approval: true

# Canonical commands (for agent execution)
commands:
  test: "${context.testCommand || 'npm test'}"
  build: "${context.buildCommand || 'npm run build'}"
  lint: "npm run lint"

# Metadata
project:
  name: "${projectName}"
  last_updated: "${date}"
`;
}
