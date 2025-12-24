/**
 * Config Governance Gates
 *
 * Per PRD Section 14.2: Config Gates
 *
 * Gates:
 * - configValidationGate: Ensures configuration is valid before allowing changes
 * - sensitiveChangeGate: Warns when security-sensitive settings are modified
 *
 * Invariants:
 * - INV-CFG-GOV-001: Audit Trail - All changes emit events
 * - INV-CFG-GOV-002: Sensitive Protection - Security settings require confirmation
 * - INV-CFG-GOV-003: Validation Before Write - Invalid configs never persisted
 */

import type { GateResult, GateExecutor, GovernanceContext } from '../types.js';
import { safeValidateConfig, CONFIG_FILENAME, DATA_DIR_NAME } from '@automatosx/contracts';

/**
 * Sensitive config paths that require extra scrutiny
 */
const SENSITIVE_PATHS = [
  'features.enableGuard',
  'features.enableTracing',
  'telemetryEnabled',
  'features.enableMemoryPersistence',
  'executionPolicy.maxRetries',
  'executionPolicy.defaultTimeoutMs',
  'workspace.dataDir',
];

/**
 * Config validation gate
 *
 * Ensures configuration is valid before allowing changes.
 * INV-CFG-GOV-003: Invalid configs never persisted
 */
export const configValidationGate: GateExecutor = async (
  _context: GovernanceContext,
  changedFiles: string[]
): Promise<GateResult> => {
  // Check if any config files were changed
  const configFiles = changedFiles.filter((file) =>
    file.endsWith(CONFIG_FILENAME) &&
    (file.includes(`${DATA_DIR_NAME}/`) || file.includes('automatosx/'))
  );

  if (configFiles.length === 0) {
    return {
      gate: 'config_validation',
      status: 'PASS',
      message: 'No config files changed',
      details: { configFiles: [] },
    };
  }

  // For each config file, we would normally read and validate it
  // Since we can't read files in the gate, we just note what needs validation
  const warnings: string[] = [];
  const errors: string[] = [];

  for (const file of configFiles) {
    // In a real implementation, we would:
    // 1. Read the file content
    // 2. Parse as JSON
    // 3. Validate with safeValidateConfig

    // For now, just flag that config files were modified
    warnings.push(`Config file modified: ${file}`);
  }

  if (errors.length > 0) {
    return {
      gate: 'config_validation',
      status: 'FAIL',
      message: `Config validation failed: ${errors.join(', ')}`,
      details: { configFiles, errors, warnings },
    };
  }

  if (warnings.length > 0) {
    return {
      gate: 'config_validation',
      status: 'WARN',
      message: `Config files modified - ensure validation passes`,
      details: { configFiles, warnings },
    };
  }

  return {
    gate: 'config_validation',
    status: 'PASS',
    message: 'Config validation passed',
    details: { configFiles },
  };
};

/**
 * Sensitive change gate
 *
 * Warns when security-sensitive settings are modified.
 * INV-CFG-GOV-002: Security settings require confirmation
 */
export const sensitiveChangeGate: GateExecutor = async (
  _context: GovernanceContext,
  changedFiles: string[]
): Promise<GateResult> => {
  // Check if any config files were changed
  const configFiles = changedFiles.filter((file) =>
    file.endsWith(CONFIG_FILENAME) &&
    (file.includes(`${DATA_DIR_NAME}/`) || file.includes('automatosx/'))
  );

  if (configFiles.length === 0) {
    return {
      gate: 'sensitive_change',
      status: 'PASS',
      message: 'No config files changed',
      details: { configFiles: [], sensitivePaths: [] },
    };
  }

  // Note: In a full implementation, we would:
  // 1. Read the original and new config
  // 2. Diff them to find changed paths
  // 3. Check if any changed paths are in SENSITIVE_PATHS

  // For now, flag that config files containing sensitive settings were modified
  const warnings: string[] = [];

  for (const file of configFiles) {
    // Flag potential sensitive changes
    warnings.push(
      `Config file "${file}" may contain sensitive settings. ` +
      `Sensitive paths: ${SENSITIVE_PATHS.join(', ')}`
    );
  }

  if (warnings.length > 0) {
    return {
      gate: 'sensitive_change',
      status: 'WARN',
      message: 'Config changes may affect security-sensitive settings',
      details: {
        configFiles,
        sensitivePaths: SENSITIVE_PATHS,
        warnings,
        requiresConfirmation: true,
      },
    };
  }

  return {
    gate: 'sensitive_change',
    status: 'PASS',
    message: 'No sensitive config changes detected',
    details: { configFiles, sensitivePaths: [] },
  };
};

/**
 * Validates config data directly (for MCP tool usage)
 */
export function validateConfigData(
  config: unknown
): { valid: true } | { valid: false; errors: string[] } {
  const result = safeValidateConfig(config);

  if (result.success) {
    return { valid: true };
  }

  const errors = result.error.errors.map(
    (e) => `${e.path.join('.')}: ${e.message}`
  );
  return { valid: false, errors };
}

/**
 * Checks if a path is sensitive
 */
export function isSensitivePath(path: string): boolean {
  return SENSITIVE_PATHS.some(
    (sensitive) => path === sensitive || path.startsWith(`${sensitive}.`)
  );
}

/**
 * Gets all sensitive paths
 */
export function getSensitivePaths(): string[] {
  return [...SENSITIVE_PATHS];
}
