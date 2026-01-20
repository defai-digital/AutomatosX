/**
 * Inject test classification data into traces for dashboard testing
 * PRD-2026-003: Dashboard Classification Observability
 *
 * This script creates test traces with classification data to demonstrate
 * the dashboard visualization.
 */

import { randomUUID } from 'crypto';
import BetterSqlite3 from 'better-sqlite3';
import { createSqliteTraceStore } from '../packages/adapters/sqlite/dist/index.js';
import { createTraceEvent } from '../packages/contracts/dist/index.js';
import * as os from 'os';
import * as path from 'path';

const DATA_DIR = path.join(os.homedir(), '.automatosx');
const DB_PATH = path.join(DATA_DIR, 'data.db');

async function injectTestTraces() {
  console.log('Injecting test traces with classification data...\n');
  console.log(`Using database: ${DB_PATH}\n`);

  // Create better-sqlite3 database instance
  const db = new BetterSqlite3(DB_PATH);
  db.pragma('journal_mode = WAL');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const traceStore = createSqliteTraceStore(db as any);

  // Define test classification scenarios
  const testScenarios = [
    {
      taskType: 'implementation',
      confidence: 0.92,
      matchedPatterns: ['typescript', 'feature', 'add'],
      selectedMapping: 'impl-typescript',
      task: 'Add user authentication with JWT tokens',
    },
    {
      taskType: 'debugging',
      confidence: 0.88,
      matchedPatterns: ['fix', 'bug', 'error'],
      selectedMapping: 'debug-standard',
      task: 'Fix the login timeout bug in auth service',
    },
    {
      taskType: 'testing',
      confidence: 0.95,
      matchedPatterns: ['test', 'unit', 'coverage'],
      selectedMapping: 'test-unit',
      task: 'Write unit tests for the payment module',
    },
    {
      taskType: 'documentation',
      confidence: 0.85,
      matchedPatterns: ['docs', 'readme', 'api'],
      selectedMapping: 'docs-api',
      task: 'Document the REST API endpoints',
    },
    {
      taskType: 'refactoring',
      confidence: 0.78,
      matchedPatterns: ['refactor', 'clean', 'improve'],
      selectedMapping: 'refactor-standard',
      task: 'Refactor the database connection module',
    },
    {
      taskType: 'analysis',
      confidence: 0.82,
      matchedPatterns: ['analyze', 'review', 'check'],
      selectedMapping: 'analysis-code',
      task: 'Analyze the codebase for security vulnerabilities',
    },
    {
      taskType: 'implementation',
      confidence: 0.65,
      matchedPatterns: ['create', 'new'],
      selectedMapping: null, // Fallback case
      task: 'Create a new microservice for notifications',
    },
  ];

  for (const scenario of testScenarios) {
    const traceId = randomUUID();
    const startTime = new Date(Date.now() - Math.random() * 3600000).toISOString();
    const endTime = new Date(new Date(startTime).getTime() + 5000 + Math.random() * 25000).toISOString();

    // Create classification snapshot
    const classification = {
      taskType: scenario.taskType,
      confidence: scenario.confidence,
      matchedPatterns: scenario.matchedPatterns,
      selectedMapping: scenario.selectedMapping,
      alternatives: [
        { mappingId: 'alt-mapping-1', score: scenario.confidence - 0.1 },
        { mappingId: 'alt-mapping-2', score: scenario.confidence - 0.2 },
      ],
      classificationTimeMs: Math.floor(Math.random() * 50) + 10,
      guardResults: [
        { gate: 'capability-check', passed: true },
        { gate: 'complexity-check', passed: Math.random() > 0.2 },
        { gate: 'security-check', passed: Math.random() > 0.1 },
      ],
      taskDescription: scenario.task.substring(0, 100),
    };

    // Create run.start event with classification
    const startEvent = createTraceEvent(traceId, 'run.start', {
      payload: {
        agentId: 'test-agent',
        command: `ax agent run test-agent`,
        task: scenario.task,
        classification, // Include classification snapshot
      },
      context: {
        agentId: 'test-agent',
        workflowId: 'test-workflow',
      },
      sequence: 0,
    });
    startEvent.timestamp = startTime;

    // Create run.end event
    const endEvent = createTraceEvent(traceId, 'run.end', {
      payload: {
        success: Math.random() > 0.15,
        stepCount: 3,
        output: `Completed: ${scenario.task}`,
        durationMs: new Date(endTime).getTime() - new Date(startTime).getTime(),
      },
      context: {
        agentId: 'test-agent',
      },
      sequence: 1,
    });
    endEvent.timestamp = endTime;

    // Write events to trace store
    await traceStore.write(startEvent);
    await traceStore.write(endEvent);

    console.log(`✓ Created trace: ${traceId.slice(0, 8)} (${scenario.taskType}, ${(scenario.confidence * 100).toFixed(0)}% confidence)`);
  }

  await traceStore.flush();
  console.log('\n✅ Injected', testScenarios.length, 'test traces with classification data');
  console.log('\nRefresh the dashboard to see the classification metrics!');
}

injectTestTraces().catch(console.error);
