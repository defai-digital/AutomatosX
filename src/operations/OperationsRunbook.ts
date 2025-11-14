/**
 * Operations Runbook
 * Sprint 6 Day 53: Operations runbooks structure and templates
 */

import { EventEmitter } from 'events'

/**
 * Runbook category
 */
export enum RunbookCategory {
  INCIDENT_RESPONSE = 'incident_response',
  MAINTENANCE = 'maintenance',
  DEPLOYMENT = 'deployment',
  MONITORING = 'monitoring',
  BACKUP_RESTORE = 'backup_restore',
}

/**
 * Runbook step
 */
export interface RunbookStep {
  number: number
  title: string
  description: string
  command?: string
  expectedOutput?: string
  verification?: string
}

/**
 * Runbook
 */
export interface Runbook {
  id: string
  title: string
  category: RunbookCategory
  overview: string
  prerequisites: string[]
  steps: RunbookStep[]
  rollback?: RunbookStep[]
  verification: string[]
  lastUpdated: number
  version: string
}

/**
 * Runbook execution record
 */
export interface RunbookExecution {
  id: string
  runbookId: string
  executedBy: string
  startTime: number
  endTime?: number
  status: 'in_progress' | 'completed' | 'failed'
  currentStep?: number
  errors?: string[]
}

/**
 * Operations runbook manager
 */
export class OperationsRunbook extends EventEmitter {
  private runbooks = new Map<string, Runbook>()
  private executions = new Map<string, RunbookExecution>()
  private executionCounter = 0

  constructor() {
    super()
    this.registerBuiltInRunbooks()
  }

  /**
   * Register runbook
   */
  registerRunbook(runbook: Omit<Runbook, 'id' | 'lastUpdated' | 'version'>): Runbook {
    const id = this.generateRunbookId(runbook.title)

    const fullRunbook: Runbook = {
      ...runbook,
      id,
      lastUpdated: Date.now(),
      version: '1.0.0',
    }

    this.runbooks.set(id, fullRunbook)

    this.emit('runbook-registered', { id, title: runbook.title })

    return fullRunbook
  }

  /**
   * Get runbook
   */
  getRunbook(id: string): Runbook | undefined {
    return this.runbooks.get(id)
  }

  /**
   * Get runbooks by category
   */
  getRunbooksByCategory(category: RunbookCategory): Runbook[] {
    return Array.from(this.runbooks.values()).filter((r) => r.category === category)
  }

  /**
   * Get all runbooks
   */
  getAllRunbooks(): Runbook[] {
    return Array.from(this.runbooks.values())
  }

  /**
   * Start execution
   */
  startExecution(runbookId: string, executedBy: string): RunbookExecution {
    const runbook = this.runbooks.get(runbookId)

    if (!runbook) {
      throw new Error(`Runbook not found: ${runbookId}`)
    }

    const executionId = `exec-${++this.executionCounter}`

    const execution: RunbookExecution = {
      id: executionId,
      runbookId,
      executedBy,
      startTime: Date.now(),
      status: 'in_progress',
      currentStep: 0,
    }

    this.executions.set(executionId, execution)

    this.emit('execution-started', {
      executionId,
      runbookId,
      executedBy,
    })

    return execution
  }

  /**
   * Update execution
   */
  updateExecution(
    executionId: string,
    updates: Partial<Pick<RunbookExecution, 'currentStep' | 'status' | 'errors'>>
  ): RunbookExecution | null {
    const execution = this.executions.get(executionId)
    if (!execution) return null

    if (updates.currentStep !== undefined) {
      execution.currentStep = updates.currentStep
    }

    if (updates.status !== undefined) {
      execution.status = updates.status

      if (updates.status === 'completed' || updates.status === 'failed') {
        execution.endTime = Date.now()
      }
    }

    if (updates.errors !== undefined) {
      execution.errors = updates.errors
    }

    this.emit('execution-updated', { executionId, updates })

    return execution
  }

  /**
   * Complete execution
   */
  completeExecution(executionId: string, success: boolean): RunbookExecution | null {
    const execution = this.executions.get(executionId)
    if (!execution) return null

    execution.status = success ? 'completed' : 'failed'
    execution.endTime = Date.now()

    this.emit('execution-completed', {
      executionId,
      success,
      duration: execution.endTime - execution.startTime,
    })

    return execution
  }

  /**
   * Get execution
   */
  getExecution(executionId: string): RunbookExecution | undefined {
    return this.executions.get(executionId)
  }

  /**
   * Get executions for runbook
   */
  getExecutionsForRunbook(runbookId: string): RunbookExecution[] {
    return Array.from(this.executions.values()).filter((e) => e.runbookId === runbookId)
  }

  /**
   * Search runbooks
   */
  searchRunbooks(query: string): Runbook[] {
    const lowerQuery = query.toLowerCase()

    return Array.from(this.runbooks.values()).filter(
      (r) =>
        r.title.toLowerCase().includes(lowerQuery) ||
        r.overview.toLowerCase().includes(lowerQuery) ||
        r.steps.some((s) => s.description.toLowerCase().includes(lowerQuery))
    )
  }

  /**
   * Generate runbook ID from title
   */
  private generateRunbookId(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  /**
   * Register built-in runbooks
   */
  private registerBuiltInRunbooks(): void {
    // Deployment runbook
    this.registerRunbook({
      title: 'Deploy AutomatosX CLI Update',
      category: RunbookCategory.DEPLOYMENT,
      overview: 'Deploy a new version of the AutomatosX CLI to npm',
      prerequisites: [
        'npm publish access',
        'Latest code pulled from main branch',
        'All tests passing',
        'Changelog updated',
      ],
      steps: [
        {
          number: 1,
          title: 'Run tests',
          description: 'Ensure all tests pass before deployment',
          command: 'npm test',
          expectedOutput: 'All tests passing',
          verification: 'Check for "Tests passed" message',
        },
        {
          number: 2,
          title: 'Build project',
          description: 'Build TypeScript and ReScript code',
          command: 'npm run build',
          expectedOutput: 'Build completed successfully',
          verification: 'Check dist/ directory exists',
        },
        {
          number: 3,
          title: 'Update version',
          description: 'Bump version in package.json',
          command: 'npm version patch',
          expectedOutput: 'Version updated',
          verification: 'Check package.json version field',
        },
        {
          number: 4,
          title: 'Publish to npm',
          description: 'Publish package to npm registry',
          command: 'npm publish',
          expectedOutput: 'Package published successfully',
          verification: 'Check npm registry for new version',
        },
        {
          number: 5,
          title: 'Tag release',
          description: 'Create git tag for release',
          command: 'git push --tags',
          expectedOutput: 'Tags pushed to remote',
          verification: 'Check GitHub releases page',
        },
      ],
      rollback: [
        {
          number: 1,
          title: 'Unpublish version',
          description: 'Unpublish the broken version from npm',
          command: 'npm unpublish @automatosx/cli@<version>',
          verification: 'Verify version no longer on npm',
        },
        {
          number: 2,
          title: 'Revert git tag',
          description: 'Delete the git tag',
          command: 'git tag -d v<version> && git push origin :refs/tags/v<version>',
          verification: 'Verify tag removed from GitHub',
        },
      ],
      verification: [
        'Install new version: npm install -g @automatosx/cli',
        'Check version: ax --version',
        'Run basic command: ax find "test"',
      ],
    })

    // Incident response runbook
    this.registerRunbook({
      title: 'Handle Plugin Sandbox Escape',
      category: RunbookCategory.INCIDENT_RESPONSE,
      overview: 'Respond to plugin attempting to escape sandbox environment',
      prerequisites: [
        'Admin access to AutomatosX infrastructure',
        'Plugin ID of offending plugin',
        'Access to telemetry logs',
      ],
      steps: [
        {
          number: 1,
          title: 'Detect sandbox escape',
          description: 'Identify plugin attempting unauthorized operations',
          command: 'ax telemetry query "sandbox_escape"',
          verification: 'Confirm plugin ID and escape attempt details',
        },
        {
          number: 2,
          title: 'Kill plugin process',
          description: 'Immediately terminate the plugin process',
          command: 'ax plugin kill <plugin-id>',
          verification: 'Verify process is terminated',
        },
        {
          number: 3,
          title: 'Revoke capabilities',
          description: 'Remove all capabilities from plugin',
          command: 'ax plugin revoke-caps <plugin-id>',
          verification: 'Check plugin has no active capabilities',
        },
        {
          number: 4,
          title: 'Audit logs',
          description: 'Review all actions taken by plugin',
          command: 'ax audit logs --plugin <plugin-id> --last 24h',
          verification: 'Identify scope of damage',
        },
        {
          number: 5,
          title: 'Notify plugin author',
          description: 'Contact plugin author about security violation',
          verification: 'Email sent to plugin author',
        },
        {
          number: 6,
          title: 'Update security policies',
          description: 'Add additional restrictions to prevent future escapes',
          verification: 'Security policy updated',
        },
      ],
      verification: [
        'Plugin process terminated',
        'No unauthorized file access',
        'Security team notified',
        'Incident documented',
      ],
    })

    // Maintenance runbook
    this.registerRunbook({
      title: 'Database Backup and Restore',
      category: RunbookCategory.BACKUP_RESTORE,
      overview: 'Backup and restore SQLite code intelligence database',
      prerequisites: ['SQLite installed', 'Write access to backup directory', 'Database path'],
      steps: [
        {
          number: 1,
          title: 'Create backup directory',
          description: 'Ensure backup directory exists',
          command: 'mkdir -p ~/.automatosx/backups',
          verification: 'Directory exists',
        },
        {
          number: 2,
          title: 'Backup database',
          description: 'Create SQLite backup',
          command: 'sqlite3 ~/.automatosx/db/code-intelligence.db ".backup ~/.automatosx/backups/backup-$(date +%Y%m%d).db"',
          expectedOutput: 'Backup completed',
          verification: 'Backup file exists',
        },
        {
          number: 3,
          title: 'Verify backup integrity',
          description: 'Check backup is valid',
          command: 'sqlite3 ~/.automatosx/backups/backup-*.db "PRAGMA integrity_check"',
          expectedOutput: 'ok',
          verification: 'Integrity check passes',
        },
        {
          number: 4,
          title: 'Compress backup',
          description: 'Compress backup file',
          command: 'gzip ~/.automatosx/backups/backup-*.db',
          verification: 'Compressed file exists',
        },
      ],
      rollback: [
        {
          number: 1,
          title: 'Stop AutomatosX',
          description: 'Stop all AutomatosX processes',
          command: 'pkill -f automatosx',
          verification: 'No AutomatosX processes running',
        },
        {
          number: 2,
          title: 'Restore backup',
          description: 'Restore database from backup',
          command: 'cp ~/.automatosx/backups/backup-*.db ~/.automatosx/db/code-intelligence.db',
          verification: 'Database restored',
        },
        {
          number: 3,
          title: 'Verify database',
          description: 'Check database integrity',
          command: 'sqlite3 ~/.automatosx/db/code-intelligence.db "PRAGMA integrity_check"',
          verification: 'Integrity check passes',
        },
      ],
      verification: ['Backup file exists', 'Backup is compressed', 'Integrity check passes'],
    })

    // Day 54: Monitoring runbook - Telemetry Dashboard Alerts
    this.registerRunbook({
      title: 'Respond to Telemetry Dashboard Alerts',
      category: RunbookCategory.MONITORING,
      overview:
        'Triage and respond to telemetry dashboard alerts for performance degradation, error rate spikes, or quota exhaustion',
      prerequisites: [
        'Access to telemetry dashboard',
        'Admin access to AutomatosX infrastructure',
        'Familiarity with normal performance baselines',
      ],
      steps: [
        {
          number: 1,
          title: 'Identify alert type',
          description: 'Determine alert severity and category (performance, error rate, quota)',
          command: 'ax telemetry query --alert-id <alert-id>',
          verification: 'Alert details retrieved with severity level',
        },
        {
          number: 2,
          title: 'Check current metrics',
          description: 'Compare current metrics against baselines',
          command: 'ax telemetry dashboard --live',
          expectedOutput: 'Real-time metrics displayed',
          verification: 'Identify affected components and severity',
        },
        {
          number: 3,
          title: 'Review recent changes',
          description: 'Check for recent deployments, configuration changes, or traffic spikes',
          command: 'git log --since="1 hour ago" && ax config history',
          verification: 'Recent changes identified',
        },
        {
          number: 4,
          title: 'Triage severity',
          description: 'Determine if immediate action required or escalation needed',
          verification: 'Severity classified: P0 (critical), P1 (high), P2 (medium), P3 (low)',
        },
        {
          number: 5,
          title: 'Execute remediation',
          description: 'Apply appropriate fix based on alert type',
          verification: 'Remediation completed',
        },
        {
          number: 6,
          title: 'Verify resolution',
          description: 'Confirm metrics returned to normal levels',
          command: 'ax telemetry verify --alert-id <alert-id>',
          expectedOutput: 'Alert resolved',
          verification: 'Metrics within acceptable range',
        },
      ],
      rollback: [
        {
          number: 1,
          title: 'Revert recent changes',
          description: 'Roll back recent deployments or configuration changes',
          command: 'ax deploy rollback',
          verification: 'System restored to previous stable state',
        },
      ],
      verification: [
        'Alert cleared in dashboard',
        'Metrics within normal baselines',
        'No new related alerts',
        'Incident documented in runbook log',
      ],
    })

    // Day 54: Marketplace runbook - Plugin Moderation and Removal
    this.registerRunbook({
      title: 'Plugin Moderation and Removal',
      category: RunbookCategory.INCIDENT_RESPONSE,
      overview:
        'Handle flagged plugins, perform moderation review, and remove plugins violating policies',
      prerequisites: [
        'Moderator access to marketplace',
        'Access to plugin review checklist',
        'Authority to remove plugins',
      ],
      steps: [
        {
          number: 1,
          title: 'Review flag report',
          description: 'Examine the flag report for the plugin',
          command: 'ax plugin flag-details <plugin-id>',
          verification: 'Flag reason and reporter identified',
        },
        {
          number: 2,
          title: 'Download and inspect plugin',
          description: 'Download plugin source code for security review',
          command: 'ax plugin download <plugin-id> --source',
          expectedOutput: 'Plugin source downloaded to review directory',
          verification: 'Source code available for inspection',
        },
        {
          number: 3,
          title: 'Run security scan',
          description: 'Scan plugin for malware, vulnerabilities, and policy violations',
          command: 'ax plugin scan <plugin-id> --security --policy',
          expectedOutput: 'Security scan results',
          verification: 'Violations identified or no issues found',
        },
        {
          number: 4,
          title: 'Review plugin metadata',
          description: 'Check plugin description, permissions, and declared capabilities',
          command: 'ax plugin info <plugin-id> --detailed',
          verification: 'Metadata matches actual plugin behavior',
        },
        {
          number: 5,
          title: 'Make moderation decision',
          description: 'Decide: approve, request changes, or remove plugin',
          verification: 'Decision documented with reasoning',
        },
        {
          number: 6,
          title: 'Notify plugin author',
          description: 'Send notification to plugin author with decision and next steps',
          command: 'ax plugin notify-author <plugin-id> --decision <decision> --message "<message>"',
          verification: 'Author notified',
        },
        {
          number: 7,
          title: 'Execute decision',
          description: 'Remove plugin if policy violation confirmed',
          command: 'ax plugin remove <plugin-id> --reason "<reason>"',
          expectedOutput: 'Plugin removed from marketplace',
          verification: 'Plugin no longer available for download',
        },
      ],
      verification: [
        'Flag resolved',
        'Author notified',
        'Plugin removed if necessary',
        'Moderation log updated',
        'Community notified if high-profile plugin',
      ],
    })

    // Day 54: Monitoring runbook - Performance Degradation Investigation
    this.registerRunbook({
      title: 'Investigate Performance Degradation',
      category: RunbookCategory.MONITORING,
      overview:
        'Diagnose and remediate performance issues including slow queries, high resource usage, or latency spikes',
      prerequisites: [
        'Access to performance dashboards',
        'Profiling tools installed',
        'Admin access to infrastructure',
      ],
      steps: [
        {
          number: 1,
          title: 'Identify affected component',
          description: 'Determine which component is experiencing degradation',
          command: 'ax telemetry performance --component all',
          expectedOutput: 'Performance metrics for all components',
          verification: 'Slow component identified',
        },
        {
          number: 2,
          title: 'Check resource usage',
          description: 'Review CPU, memory, disk I/O, and network usage',
          command: 'ax status --resources --verbose',
          expectedOutput: 'Resource usage statistics',
          verification: 'Resource bottleneck identified if present',
        },
        {
          number: 3,
          title: 'Analyze slow queries',
          description: 'Identify slow database queries or API calls',
          command: 'ax telemetry slow-queries --threshold 100ms',
          expectedOutput: 'List of slow queries with execution times',
          verification: 'Query performance issues identified',
        },
        {
          number: 4,
          title: 'Profile code execution',
          description: 'Run performance profiler to identify hot paths',
          command: 'ax profile --duration 60s --flamegraph',
          expectedOutput: 'Flamegraph and profiling report',
          verification: 'Performance bottleneck identified in code',
        },
        {
          number: 5,
          title: 'Check for memory leaks',
          description: 'Monitor memory usage over time for leaks',
          command: 'ax telemetry memory --watch --duration 300s',
          expectedOutput: 'Memory usage trend',
          verification: 'Memory leak detected or ruled out',
        },
        {
          number: 6,
          title: 'Apply remediation',
          description: 'Execute appropriate fix based on diagnosis',
          verification: 'Fix applied (query optimization, caching, resource scaling, etc.)',
        },
        {
          number: 7,
          title: 'Verify performance recovery',
          description: 'Confirm performance returned to baseline',
          command: 'ax telemetry performance --compare baseline',
          expectedOutput: 'Performance within acceptable range',
          verification: 'Latency and throughput back to normal',
        },
      ],
      rollback: [
        {
          number: 1,
          title: 'Revert performance changes',
          description: 'Roll back optimization attempts if they caused issues',
          verification: 'System stable at baseline performance',
        },
      ],
      verification: [
        'Performance metrics within SLA',
        'No user-reported slowness',
        'Root cause identified and documented',
        'Preventive measures planned',
      ],
    })

    // Day 54: DR runbook - Full System Restore
    this.registerRunbook({
      title: 'Full System Restore from Disaster',
      category: RunbookCategory.BACKUP_RESTORE,
      overview:
        'Complete disaster recovery procedure to restore AutomatosX from backups after catastrophic failure',
      prerequisites: [
        'Access to off-site backups',
        'Infrastructure provisioning access',
        'DR credentials and access keys',
        'RTO: 1 hour, RPO: 15 minutes',
      ],
      steps: [
        {
          number: 1,
          title: 'Assess damage scope',
          description: 'Determine what needs to be restored (partial vs full system)',
          verification: 'Scope documented: DB only, full config, complete system',
        },
        {
          number: 2,
          title: 'Provision infrastructure',
          description: 'Spin up replacement infrastructure if needed',
          command: 'terraform apply -var="environment=production"',
          expectedOutput: 'Infrastructure provisioned',
          verification: 'Servers, databases, and networking ready',
        },
        {
          number: 3,
          title: 'Retrieve latest backups',
          description: 'Download most recent backups from off-site storage',
          command: 'ax dr restore --fetch-backups --target all',
          expectedOutput: 'Backups downloaded and verified',
          verification: 'Backup integrity checks passed',
        },
        {
          number: 4,
          title: 'Restore code intelligence database',
          description: 'Restore primary SQLite database',
          command: 'ax dr restore --target code-intelligence-db',
          expectedOutput: 'Database restored successfully',
          verification: 'Database integrity check passes',
        },
        {
          number: 5,
          title: 'Restore plugin metadata',
          description: 'Restore plugin registry and marketplace data',
          command: 'ax dr restore --target plugin-metadata',
          expectedOutput: 'Plugin metadata restored',
          verification: 'Plugin registry accessible',
        },
        {
          number: 6,
          title: 'Restore user configurations',
          description: 'Restore user settings and preferences',
          command: 'ax dr restore --target user-config',
          expectedOutput: 'User configs restored',
          verification: 'User settings verified',
        },
        {
          number: 7,
          title: 'Restore telemetry data',
          description: 'Restore historical telemetry and analytics',
          command: 'ax dr restore --target telemetry-data',
          expectedOutput: 'Telemetry data restored',
          verification: 'Historical data accessible',
        },
        {
          number: 8,
          title: 'Restart services',
          description: 'Bring all AutomatosX services back online',
          command: 'ax services restart --all',
          expectedOutput: 'All services running',
          verification: 'Health checks passing',
        },
        {
          number: 9,
          title: 'Verify system functionality',
          description: 'Run smoke tests to confirm system operational',
          command: 'ax test smoke --production',
          expectedOutput: 'All smoke tests passing',
          verification: 'Critical user flows working',
        },
        {
          number: 10,
          title: 'Monitor for issues',
          description: 'Watch telemetry for anomalies after restore',
          command: 'ax telemetry watch --alert-threshold high',
          expectedOutput: 'Real-time monitoring active',
          verification: 'No critical alerts in first 15 minutes',
        },
      ],
      rollback: [
        {
          number: 1,
          title: 'Switch to failover system',
          description: 'If restore fails, switch traffic to backup datacenter',
          command: 'ax dr failover --target backup-dc',
          verification: 'Traffic routed to backup system',
        },
      ],
      verification: [
        'All critical services operational',
        'Data integrity verified',
        'RTO met (< 1 hour)',
        'RPO met (< 15 minutes data loss)',
        'Incident report filed',
        'Post-mortem scheduled',
      ],
    })
  }

  /**
   * Clear all
   */
  clearAll(): void {
    this.runbooks.clear()
    this.executions.clear()
    this.executionCounter = 0
    this.emit('all-cleared')
  }
}

/**
 * Create operations runbook
 */
export function createOperationsRunbook(): OperationsRunbook {
  return new OperationsRunbook()
}

/**
 * Global runbook instance
 */
let globalRunbook: OperationsRunbook | null = null

/**
 * Get global runbook
 */
export function getGlobalRunbook(): OperationsRunbook {
  if (!globalRunbook) {
    globalRunbook = createOperationsRunbook()
  }
  return globalRunbook
}

/**
 * Reset global runbook
 */
export function resetGlobalRunbook(): void {
  globalRunbook = null
}
