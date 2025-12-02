/**
 * Delegation Worker - Parse delegations in worker thread
 * v5.6.13: Phase 3.1 - CPU-intensive delegation parsing offloaded to worker
 */

import { parentPort } from 'worker_threads';
import type { WorkerTask, WorkerResult } from '../core/worker-pool.js';

/**
 * Delegation patterns (from delegation-parser.ts)
 */
const DELEGATION_PATTERNS = [
  // English: @mention style
  /@([a-zA-Z0-9_-]+)\s+(.+?)(?=@[a-zA-Z0-9_-]+|$)/gs,

  // English: "DELEGATE TO" style
  /DELEGATE\s+TO\s+([a-zA-Z0-9_-]+):\s*(.+?)(?=DELEGATE\s+TO|$)/gis,

  // English: "please ask" style
  /please\s+ask\s+([a-zA-Z0-9_-]+)\s+to\s+(.+?)(?=please\s+ask|$)/gis,

  // English: "I need" style
  /I\s+need\s+([a-zA-Z0-9_-]+)\s+to\s+(.+?)(?=I\s+need|$)/gis,

  // Chinese: @mention style
  /@([a-zA-Z0-9_\u4e00-\u9fa5-]+)\s+(.+?)(?=@[a-zA-Z0-9_\u4e00-\u9fa5-]+|$)/gs,

  // Chinese: "請" style
  /請\s*([a-zA-Z0-9_\u4e00-\u9fa5-]+)\s*(.+?)(?=請\s*[a-zA-Z0-9_\u4e00-\u9fa5-]+|$)/gs,

  // Chinese: "需要" style
  /需要\s*([a-zA-Z0-9_\u4e00-\u9fa5-]+)\s*(.+?)(?=需要|$)/gs
];

/**
 * False positive filters
 */
const FALSE_POSITIVE_FILTERS = [
  // Code blocks (```, ~~~)
  /```[\s\S]*?```/g,
  /~~~[\s\S]*?~~~/g,

  // Inline code (`code`)
  /`[^`]+`/g,

  // Quoted text ("...", '...')
  /"[^"]*"/g,
  /'[^']*'/g,

  // Email addresses
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

  // URLs
  /https?:\/\/[^\s]+/g,

  // Documentation comments (/** ... */, /* ... */)
  /\/\*\*[\s\S]*?\*\//g,
  /\/\*[\s\S]*?\*\//g,

  // Single-line comments (// ...)
  /\/\/[^\n]*/g
];

interface ParseDelegationData {
  response: string;
  availableAgents: string[];
}

interface ParsedDelegation {
  agent: string;
  task: string;
  source: 'response';
}

/**
 * Parse delegations from response text
 */
function parseDelegations(data: ParseDelegationData): ParsedDelegation[] {
  const { response, availableAgents } = data;
  const delegations: ParsedDelegation[] = [];
  const seen = new Set<string>();

  // Remove false positives
  let cleanedResponse = response;
  for (const filter of FALSE_POSITIVE_FILTERS) {
    cleanedResponse = cleanedResponse.replace(filter, '');
  }

  // Try each delegation pattern
  for (const pattern of DELEGATION_PATTERNS) {
    const matches = cleanedResponse.matchAll(pattern);

    for (const match of matches) {
      const agent = match[1]?.trim();
      const task = match[2]?.trim();

      if (!agent || !task) continue;

      // Validate agent exists
      if (!availableAgents.includes(agent)) {
        continue;
      }

      // Avoid duplicates
      const key = `${agent}:${task}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      delegations.push({
        agent,
        task,
        source: 'response'
      });
    }
  }

  return delegations;
}

/**
 * Message handler
 */
if (parentPort) {
  parentPort.on('message', (task: WorkerTask<ParseDelegationData>) => {
    const startTime = Date.now();

    try {
      const delegations = parseDelegations(task.data);

      const result: WorkerResult<ParsedDelegation[]> = {
        id: task.id,
        success: true,
        data: delegations,
        duration: Date.now() - startTime
      };

      parentPort!.postMessage(result);
    } catch (error) {
      const result: WorkerResult = {
        id: task.id,
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime
      };

      parentPort!.postMessage(result);
    }
  });
}
