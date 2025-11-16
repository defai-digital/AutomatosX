/**
 * Agent Delegation Preview
 *
 * Shows what an agent will do before execution
 * to give users confidence and control over delegation.
 *
 * Phase 5 P2: Agent delegation preview
 */

import chalk from 'chalk';

export interface AgentDelegationPreview {
  agent: string;
  displayName: string;
  task: string;
  capabilities: string[];
  expectedActions: ExpectedAction[];
  estimatedDuration: number;
  requiredApprovals?: string[];
  potentialRisks?: string[];
}

export interface ExpectedAction {
  type: 'read' | 'write' | 'execute' | 'delegate' | 'analyze';
  description: string;
  target?: string;
  risk: 'safe' | 'low' | 'medium' | 'high';
}

/**
 * Generate delegation preview
 */
export function generateDelegationPreview(
  agent: string,
  task: string,
  context?: {
    availableFiles?: string[];
    projectType?: string;
    recentActivity?: string[];
  }
): AgentDelegationPreview {
  const agentInfo = getAgentInfo(agent);

  const expectedActions = inferExpectedActions(agent, task, context);
  const estimatedDuration = estimateDuration(agent, task, expectedActions);
  const requiredApprovals = identifyRequiredApprovals(expectedActions);
  const potentialRisks = identifyRisks(expectedActions);

  return {
    agent,
    displayName: agentInfo.displayName,
    task,
    capabilities: agentInfo.capabilities,
    expectedActions,
    estimatedDuration,
    requiredApprovals,
    potentialRisks
  };
}

/**
 * Render delegation preview
 */
export function renderDelegationPreview(preview: AgentDelegationPreview): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.bold.cyan('Agent Delegation Preview'));
  lines.push('');

  // Agent info
  const avatar = getAgentAvatar(preview.agent);
  lines.push(`${avatar} ${chalk.bold.white(preview.displayName)}`);
  lines.push(`   ${chalk.dim('Task:')} ${chalk.white(preview.task)}`);
  lines.push(`   ${chalk.dim('Est. Duration:')} ${chalk.yellow(formatDuration(preview.estimatedDuration))}`);
  lines.push('');

  // Capabilities
  lines.push(chalk.bold.white('Capabilities:'));
  preview.capabilities.forEach(cap => {
    lines.push(`  ${chalk.cyan('•')} ${chalk.white(cap)}`);
  });
  lines.push('');

  // Expected actions
  lines.push(chalk.bold.white('Expected Actions:'));
  preview.expectedActions.forEach((action, idx) => {
    const actionIcon = getActionIcon(action.type);
    const riskIcon = getRiskIcon(action.risk);

    lines.push(`  ${idx + 1}. ${actionIcon} ${chalk.white(action.description)} ${riskIcon}`);

    if (action.target) {
      lines.push(`     ${chalk.dim('Target:')} ${chalk.cyan(action.target)}`);
    }
  });
  lines.push('');

  // Required approvals
  if (preview.requiredApprovals && preview.requiredApprovals.length > 0) {
    lines.push(chalk.bold.yellow('⚠️  Requires Approval:'));
    preview.requiredApprovals.forEach(approval => {
      lines.push(`  ${chalk.yellow('•')} ${chalk.white(approval)}`);
    });
    lines.push('');
  }

  // Potential risks
  if (preview.potentialRisks && preview.potentialRisks.length > 0) {
    lines.push(chalk.bold.red('Potential Risks:'));
    preview.potentialRisks.forEach(risk => {
      lines.push(`  ${chalk.red('•')} ${chalk.white(risk)}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Render inline delegation prompt
 */
export function renderInlineDelegationPrompt(preview: AgentDelegationPreview): string {
  const avatar = getAgentAvatar(preview.agent);
  const displayName = chalk.cyan(preview.displayName);
  const duration = chalk.dim(`(~${formatDuration(preview.estimatedDuration)})`);
  const actions = chalk.dim(`${preview.expectedActions.length} actions`);

  return `${avatar} Delegating to ${displayName} ${duration} - ${actions}`;
}

/**
 * Render delegation confirmation prompt
 */
export function renderDelegationConfirmation(preview: AgentDelegationPreview): string {
  const lines: string[] = [];

  const hasHighRiskActions = preview.expectedActions.some(a => a.risk === 'high');
  const requiresApproval = preview.requiredApprovals && preview.requiredApprovals.length > 0;

  if (hasHighRiskActions || requiresApproval) {
    lines.push('');
    lines.push(chalk.yellow('⚠️  This delegation includes high-risk actions or requires approval.'));

    if (preview.requiredApprovals && preview.requiredApprovals.length > 0) {
      lines.push(chalk.yellow(`   ${preview.requiredApprovals.join(', ')}`));
    }

    lines.push('');
    lines.push(chalk.white('Do you want to proceed?'));
    lines.push(`  ${chalk.green('[Y]')} Yes, proceed`);
    lines.push(`  ${chalk.yellow('[P]')} Preview actions first`);
    lines.push(`  ${chalk.red('[N]')} No, cancel`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Compare multiple agents for a task
 */
export function compareAgentsForTask(
  task: string,
  agents: string[]
): Array<{ agent: string; suitability: number; reason: string; estimatedDuration: number }> {
  const comparisons = agents.map(agent => {
    const preview = generateDelegationPreview(agent, task);
    const suitability = calculateSuitability(agent, task, preview);

    return {
      agent,
      suitability,
      reason: explainSuitability(agent, task, suitability),
      estimatedDuration: preview.estimatedDuration
    };
  });

  // Sort by suitability
  return comparisons.sort((a, b) => b.suitability - a.suitability);
}

/**
 * Render agent comparison
 */
export function renderAgentComparison(
  task: string,
  comparisons: Array<{ agent: string; suitability: number; reason: string; estimatedDuration: number }>
): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.bold.cyan(`Agent Comparison for: "${task}"`));
  lines.push('');

  comparisons.forEach((comp, idx) => {
    const avatar = getAgentAvatar(comp.agent);
    const rank = idx === 0 ? chalk.green('★') : chalk.dim(`${idx + 1}.`);
    const displayName = getAgentInfo(comp.agent).displayName;
    const suitabilityBar = renderSuitabilityBar(comp.suitability);
    const duration = chalk.dim(`(~${formatDuration(comp.estimatedDuration)})`);

    lines.push(`${rank} ${avatar} ${chalk.bold.white(displayName)} ${suitabilityBar} ${duration}`);
    lines.push(`   ${chalk.dim(comp.reason)}`);
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Get agent info
 */
function getAgentInfo(agent: string): { displayName: string; capabilities: string[] } {
  const agentData: Record<string, { displayName: string; capabilities: string[] }> = {
    backend: {
      displayName: 'Bob (Backend)',
      capabilities: ['Go/Rust development', 'API design', 'Database schema', 'Performance optimization']
    },
    frontend: {
      displayName: 'Frank (Frontend)',
      capabilities: ['React/Next.js', 'UI components', 'State management', 'Responsive design']
    },
    security: {
      displayName: 'Steve (Security)',
      capabilities: ['Security audits', 'Threat modeling', 'Vulnerability scanning', 'Auth implementation']
    },
    quality: {
      displayName: 'Queenie (QA)',
      capabilities: ['Test writing', 'Code review', 'Quality gates', 'Bug verification']
    },
    product: {
      displayName: 'Paris (Product)',
      capabilities: ['Feature design', 'User stories', 'Requirements gathering', 'Roadmap planning']
    },
    architecture: {
      displayName: 'Avery (Architecture)',
      capabilities: ['System design', 'ADR creation', 'Tech stack selection', 'Scalability planning']
    },
    fullstack: {
      displayName: 'Felix (Full Stack)',
      capabilities: ['End-to-end features', 'Node.js/TypeScript', 'Database + API + UI', 'Integration']
    },
    mobile: {
      displayName: 'Maya (Mobile)',
      capabilities: ['iOS/Android', 'Swift/Kotlin', 'Flutter', 'Mobile UX']
    },
    devops: {
      displayName: 'Oliver (DevOps)',
      capabilities: ['CI/CD', 'Infrastructure', 'Monitoring', 'Deployment automation']
    }
  };

  return agentData[agent] || { displayName: agent, capabilities: ['General development'] };
}

/**
 * Infer expected actions
 */
function inferExpectedActions(
  agent: string,
  task: string,
  context?: { availableFiles?: string[]; projectType?: string }
): ExpectedAction[] {
  const actions: ExpectedAction[] = [];

  // Infer from task keywords
  const taskLower = task.toLowerCase();

  if (taskLower.includes('implement') || taskLower.includes('create')) {
    actions.push({
      type: 'write',
      description: 'Create new implementation files',
      risk: 'medium'
    });
  }

  if (taskLower.includes('test')) {
    actions.push({
      type: 'write',
      description: 'Write test files',
      risk: 'low'
    });
  }

  if (taskLower.includes('review') || taskLower.includes('audit')) {
    actions.push({
      type: 'read',
      description: 'Read and analyze existing code',
      risk: 'safe'
    });

    actions.push({
      type: 'analyze',
      description: 'Generate analysis report',
      risk: 'safe'
    });
  }

  if (taskLower.includes('fix') || taskLower.includes('debug')) {
    actions.push({
      type: 'read',
      description: 'Identify bug location',
      risk: 'safe'
    });

    actions.push({
      type: 'write',
      description: 'Apply fix to affected files',
      risk: 'medium'
    });
  }

  if (taskLower.includes('deploy') || taskLower.includes('ci')) {
    actions.push({
      type: 'execute',
      description: 'Run deployment scripts',
      target: 'CI/CD pipeline',
      risk: 'high'
    });
  }

  // Agent-specific actions
  if (agent === 'product') {
    actions.push({
      type: 'write',
      description: 'Create specification document',
      risk: 'low'
    });
  }

  if (agent === 'architecture') {
    actions.push({
      type: 'write',
      description: 'Create ADR (Architecture Decision Record)',
      risk: 'low'
    });
  }

  // If no actions inferred, add generic ones
  if (actions.length === 0) {
    actions.push({
      type: 'analyze',
      description: 'Analyze task requirements',
      risk: 'safe'
    });

    actions.push({
      type: 'write',
      description: 'Create task deliverables',
      risk: 'medium'
    });
  }

  return actions;
}

/**
 * Estimate duration in milliseconds
 */
function estimateDuration(agent: string, task: string, actions: ExpectedAction[]): number {
  // Base duration: 30 seconds per action
  let duration = actions.length * 30000;

  // Adjust for complexity
  const taskLower = task.toLowerCase();

  if (taskLower.includes('implement') || taskLower.includes('create')) {
    duration *= 2; // Implementation takes longer
  }

  if (taskLower.includes('review') || taskLower.includes('audit')) {
    duration *= 1.5; // Reviews are thorough
  }

  if (taskLower.includes('fix') || taskLower.includes('debug')) {
    duration *= 1.2; // Debugging adds time
  }

  // Agent-specific multipliers
  if (agent === 'quality') {
    duration *= 1.3; // QA is thorough
  }

  return duration;
}

/**
 * Identify required approvals
 */
function identifyRequiredApprovals(actions: ExpectedAction[]): string[] {
  const approvals: string[] = [];

  const hasHighRisk = actions.some(a => a.risk === 'high');
  const hasWrite = actions.some(a => a.type === 'write');
  const hasExecute = actions.some(a => a.type === 'execute');

  if (hasHighRisk) {
    approvals.push('High-risk action approval');
  }

  if (hasWrite) {
    approvals.push('File modification approval');
  }

  if (hasExecute) {
    approvals.push('Command execution approval');
  }

  return approvals;
}

/**
 * Identify risks
 */
function identifyRisks(actions: ExpectedAction[]): string[] {
  const risks: string[] = [];

  if (actions.some(a => a.type === 'write')) {
    risks.push('Will modify existing files');
  }

  if (actions.some(a => a.type === 'execute')) {
    risks.push('Will execute system commands');
  }

  if (actions.some(a => a.risk === 'high')) {
    risks.push('Includes high-risk operations');
  }

  return risks;
}

/**
 * Calculate suitability score (0-1)
 */
function calculateSuitability(agent: string, task: string, preview: AgentDelegationPreview): number {
  let score = 0.5; // Base score

  const taskLower = task.toLowerCase();
  const agentCapabilities = preview.capabilities.map(c => c.toLowerCase()).join(' ');

  // Check capability alignment
  const taskWords = taskLower.split(/\s+/);
  const matchingWords = taskWords.filter(word => agentCapabilities.includes(word));

  score += (matchingWords.length / taskWords.length) * 0.3;

  // Agent-specific matching
  if (agent === 'backend' && (taskLower.includes('api') || taskLower.includes('server'))) {
    score += 0.2;
  }

  if (agent === 'frontend' && (taskLower.includes('ui') || taskLower.includes('component'))) {
    score += 0.2;
  }

  if (agent === 'security' && (taskLower.includes('security') || taskLower.includes('auth'))) {
    score += 0.2;
  }

  if (agent === 'quality' && (taskLower.includes('test') || taskLower.includes('review'))) {
    score += 0.2;
  }

  return Math.min(score, 1);
}

/**
 * Explain suitability
 */
function explainSuitability(agent: string, task: string, score: number): string {
  if (score >= 0.8) {
    return 'Excellent match for this task';
  } else if (score >= 0.6) {
    return 'Good fit, has relevant capabilities';
  } else if (score >= 0.4) {
    return 'Capable, but not specialized for this task';
  } else {
    return 'Can help, but other agents may be better suited';
  }
}

/**
 * Render suitability bar
 */
function renderSuitabilityBar(suitability: number): string {
  const percentage = Math.round(suitability * 100);
  const filled = Math.round((suitability * 10));
  const empty = 10 - filled;

  const color = suitability >= 0.7 ? chalk.green : suitability >= 0.4 ? chalk.yellow : chalk.red;

  return color('█'.repeat(filled)) + chalk.dim('░'.repeat(empty)) + chalk.dim(` ${percentage}%`);
}

/**
 * Get action icon
 */
function getActionIcon(type: ExpectedAction['type']): string {
  const icons = {
    read: '📖',
    write: '✍️',
    execute: '⚡',
    delegate: '👤',
    analyze: '🔍'
  };
  return icons[type];
}

/**
 * Get risk icon
 */
function getRiskIcon(risk: ExpectedAction['risk']): string {
  const icons = {
    safe: chalk.green('✓'),
    low: chalk.blue('ℹ'),
    medium: chalk.yellow('⚠'),
    high: chalk.red('⚠️')
  };
  return icons[risk];
}

/**
 * Get agent avatar
 */
function getAgentAvatar(agent: string): string {
  const avatars: Record<string, string> = {
    backend: '🔧',
    frontend: '🎨',
    security: '🔒',
    quality: '✅',
    product: '📋',
    architecture: '🏗️',
    fullstack: '⚡',
    mobile: '📱',
    devops: '⚙️'
  };
  return avatars[agent] || '🤖';
}

/**
 * Format duration
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
