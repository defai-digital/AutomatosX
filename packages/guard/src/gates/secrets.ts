/**
 * Secrets Detection Gate
 *
 * Scans changed files for hardcoded secrets and credentials.
 *
 * Invariants:
 * - INV-GUARD-SEC-001: Pattern Matching - scans for common secret patterns
 * - INV-GUARD-SEC-002: Location Reporting - reports file path and line number
 * - INV-GUARD-SEC-003: Ignore Support - respects .secretsignore file
 * - INV-GUARD-SEC-004: No False Negatives - detects common patterns
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { GateResult } from '../types.js';
import {
  shouldScanFile,
  getPatternsForFile,
} from '../patterns/secret-patterns.js';

/**
 * Detected secret information
 */
interface DetectedSecret {
  /** File path where secret was found */
  file: string;

  /** Line number (1-indexed) */
  line: number;

  /** Pattern that matched */
  patternName: string;

  /** Description of the pattern */
  description: string;

  /** Severity level */
  severity: 'critical' | 'high' | 'medium' | 'low';

  /** Matched content (redacted) */
  match: string;
}

/**
 * Loads .secretsignore file and returns patterns to ignore
 * INV-GUARD-SEC-003: Respects .secretsignore file
 */
async function loadSecretsIgnore(cwd: string): Promise<Set<string>> {
  const ignoredPatterns = new Set<string>();
  const ignoreFilePath = join(cwd, '.secretsignore');

  if (!existsSync(ignoreFilePath)) {
    return ignoredPatterns;
  }

  try {
    const content = await readFile(ignoreFilePath, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      // Skip empty lines and comments
      if (trimmed.length > 0 && !trimmed.startsWith('#')) {
        ignoredPatterns.add(trimmed);
      }
    }
  } catch {
    // If we can't read the ignore file, continue without it
  }

  return ignoredPatterns;
}

/**
 * Checks if a detected secret should be ignored
 */
function shouldIgnoreSecret(
  secret: DetectedSecret,
  ignoredPatterns: Set<string>
): boolean {
  // Check file path matches
  for (const pattern of ignoredPatterns) {
    // Direct file match
    if (secret.file === pattern || secret.file.endsWith(`/${pattern}`)) {
      return true;
    }

    // Pattern match (simple glob: * matches anything)
    // INV-GUARD-SEC-005: Escape regex special chars before converting glob to prevent ReDoS
    if (pattern.includes('*') || pattern.includes('?')) {
      // Escape special regex characters first, then convert glob wildcards
      const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
      const regexPattern = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
      try {
        const regex = new RegExp('^' + regexPattern + '$');
        if (regex.test(secret.file)) {
          return true;
        }
      } catch {
        // Invalid pattern - skip it
        continue;
      }
    }

    // File:line match (e.g., "src/config.ts:42")
    if (pattern === `${secret.file}:${secret.line}`) {
      return true;
    }

    // Pattern name match (e.g., "generic_api_key")
    if (pattern === secret.patternName) {
      return true;
    }
  }

  return false;
}

/**
 * Redacts a secret for safe display
 */
function redactSecret(match: string): string {
  if (match.length <= 8) {
    return '***REDACTED***';
  }
  // Show first 4 and last 4 characters
  return `${match.substring(0, 4)}...${match.substring(match.length - 4)}`;
}

/**
 * Scans a file for secrets
 * INV-GUARD-SEC-001: Pattern Matching
 * INV-GUARD-SEC-002: Location Reporting
 */
async function scanFileForSecrets(
  filePath: string,
  cwd: string
): Promise<DetectedSecret[]> {
  const secrets: DetectedSecret[] = [];
  const fullPath = join(cwd, filePath);

  // Check if file should be scanned
  if (!shouldScanFile(filePath)) {
    return secrets;
  }

  // Check if file exists
  if (!existsSync(fullPath)) {
    return secrets;
  }

  try {
    const content = await readFile(fullPath, 'utf-8');
    const lines = content.split('\n');
    const patterns = getPatternsForFile(filePath);

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum] ?? '';

      for (const pattern of patterns) {
        // Reset regex state for global patterns
        pattern.pattern.lastIndex = 0;

        let match: RegExpExecArray | null;
        let lastIndex = -1;
        while ((match = pattern.pattern.exec(line)) !== null) {
          // INV-GUARD-SEC-006: Prevent infinite loop on zero-width matches
          // If lastIndex hasn't advanced, force it forward
          if (pattern.pattern.lastIndex === lastIndex) {
            pattern.pattern.lastIndex++;
            if (pattern.pattern.lastIndex > line.length) break;
            continue;
          }
          lastIndex = pattern.pattern.lastIndex;

          secrets.push({
            file: filePath,
            line: lineNum + 1, // 1-indexed
            patternName: pattern.name,
            description: pattern.description,
            severity: pattern.severity,
            match: redactSecret(match[0]),
          });

          // Prevent infinite loop for non-global patterns
          if (!pattern.pattern.global) {
            break;
          }
        }
      }
    }
  } catch {
    // If we can't read the file, skip it
  }

  return secrets;
}

/**
 * Executes the secrets detection gate
 * INV-GUARD-SEC-001 through INV-GUARD-SEC-004
 */
export async function secretsDetectionGate(
  _context: unknown,
  changedFiles: string[]
): Promise<GateResult> {
  const cwd = process.cwd();
  const allSecrets: DetectedSecret[] = [];

  // Load ignore patterns
  const ignoredPatterns = await loadSecretsIgnore(cwd);

  // Scan each changed file
  for (const file of changedFiles) {
    const fileSecrets = await scanFileForSecrets(file, cwd);

    // Filter out ignored secrets
    for (const secret of fileSecrets) {
      if (!shouldIgnoreSecret(secret, ignoredPatterns)) {
        allSecrets.push(secret);
      }
    }
  }

  // No secrets found - PASS
  if (allSecrets.length === 0) {
    return {
      gate: 'secrets_detection',
      status: 'PASS',
      message: `Scanned ${changedFiles.length} file(s), no secrets detected`,
    };
  }

  // Group by severity for reporting
  const critical = allSecrets.filter((s) => s.severity === 'critical');
  const high = allSecrets.filter((s) => s.severity === 'high');
  const medium = allSecrets.filter((s) => s.severity === 'medium');
  const low = allSecrets.filter((s) => s.severity === 'low');

  // Build message
  const severityCounts: string[] = [];
  if (critical.length > 0) severityCounts.push(`${critical.length} critical`);
  if (high.length > 0) severityCounts.push(`${high.length} high`);
  if (medium.length > 0) severityCounts.push(`${medium.length} medium`);
  if (low.length > 0) severityCounts.push(`${low.length} low`);

  const message = `Detected ${allSecrets.length} potential secret(s): ${severityCounts.join(', ')}`;

  // Critical or high severity secrets cause FAIL
  // Medium or low cause WARN
  const hasCriticalOrHigh = critical.length > 0 || high.length > 0;

  return {
    gate: 'secrets_detection',
    status: hasCriticalOrHigh ? 'FAIL' : 'WARN',
    message,
    details: {
      secretsFound: allSecrets.length,
      secrets: allSecrets.map((s) => ({
        file: s.file,
        line: s.line,
        type: s.patternName,
        description: s.description,
        severity: s.severity,
        match: s.match,
      })),
      bySeverity: {
        critical: critical.length,
        high: high.length,
        medium: medium.length,
        low: low.length,
      },
    },
  };
}
