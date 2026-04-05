import { access, readFile, writeFile } from 'node:fs/promises';
import { formatPrettyJson } from '../json-file-write.js';
import { isRecord, parseJsonObjectString } from '../utils/validation.js';
import { formatSurfaceSection, type ProductSurfaceSummaryData } from '../product-surface-summary.js';
import type { ProviderClientStatus } from '../utils/provider-detection.js';
import type { ProjectBootstrapResult } from './project-bootstrap.js';
import type { SetupWorkspaceResult } from './setup.js';
import {
  REPORT_BOLD,
  REPORT_CHECK,
  REPORT_CYAN,
  REPORT_DIM,
  REPORT_RESET,
  REPORT_WARN_ICON,
} from '../cli-report-style.js';

export interface SetupRenderContext {
  basePath: string;
  provider?: string;
  migrateStorage: boolean;
  workspace: SetupWorkspaceResult;
  project: ProjectBootstrapResult;
  productSurface: ProductSurfaceSummaryData;
  migration: {
    stateSkipped?: string;
    stateMigrated?: string;
    traceSkipped?: string;
    traceMigrated?: string;
  };
}

export function renderSetupReport(context: SetupRenderContext): string {
  const out: string[] = [
    '',
    `${REPORT_BOLD}AutomatosX Setup${REPORT_RESET}`,
    '',
    `${REPORT_BOLD}Step 1: System Check${REPORT_RESET}`,
    `  ${REPORT_CHECK} Node.js: ${process.version}`,
    `  ${REPORT_CHECK} Platform: ${process.platform}/${process.arch}`,
    '',
    `${REPORT_BOLD}Step 2: Storage${REPORT_RESET}`,
    ...renderStorageSection(context),
    '',
    `${REPORT_BOLD}Step 3: Workspace${REPORT_RESET}`,
    ...renderWorkspaceSection(context.basePath, context.workspace),
    '',
    `${REPORT_BOLD}Step 4: Provider Detection${REPORT_RESET}`,
    ...renderProviderDetectionSection(context.workspace.detectedProviders),
    '',
    `${REPORT_BOLD}Step 5: Project Bootstrap${REPORT_RESET}`,
    ...renderProjectBootstrapSection(context.project),
    '',
    `${REPORT_BOLD}Summary${REPORT_RESET}`,
    ...renderSummarySection(context),
    '',
    `${REPORT_BOLD}Default Surface${REPORT_RESET}`,
    ...renderDefaultSurfaceSection(context.productSurface),
    '',
    `${REPORT_BOLD}Next Steps${REPORT_RESET}`,
    ...renderNextSteps(context.productSurface, context.provider),
    '',
  ];

  return out.join('\n');
}

export async function writeJsonIfMissing(
  filePath: string,
  value: unknown,
  writtenFiles: string[],
  force = false,
): Promise<void> {
  if (await exists(filePath)) {
    if (force) {
      await writeFile(filePath, formatPrettyJson(value), 'utf8');
      writtenFiles.push(filePath);
      return;
    }
    if (isRecord(value)) {
      try {
        const existing = parseJsonObjectString(await readFile(filePath, 'utf8'));
        if (existing.error !== undefined) {
          return;
        }
        const additions = Object.fromEntries(
          Object.entries(value).filter(([key]) => !(key in existing.value)),
        );
        if (Object.keys(additions).length > 0) {
          await writeFile(filePath, formatPrettyJson({ ...existing.value, ...additions }), 'utf8');
          writtenFiles.push(filePath);
        }
      } catch {
        // leave file as-is on read/parse error
      }
    }
    return;
  }

  await writeFile(filePath, formatPrettyJson(value), 'utf8');
  writtenFiles.push(filePath);
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function renderStorageSection(context: SetupRenderContext): string[] {
  if (!context.migrateStorage) {
    return [`  ${REPORT_CHECK} Storage backend: SQLite (WAL mode)`];
  }

  const lines: string[] = [];
  if (context.migration.stateSkipped !== undefined) {
    lines.push(`  ${REPORT_WARN_ICON} State migration skipped: ${context.migration.stateSkipped}`);
  } else if (context.migration.stateMigrated !== undefined) {
    lines.push(`  ${REPORT_CHECK} State migrated to SQLite`);
  }

  if (context.migration.traceSkipped !== undefined) {
    lines.push(`  ${REPORT_WARN_ICON} Trace migration skipped: ${context.migration.traceSkipped}`);
  } else if (context.migration.traceMigrated !== undefined) {
    lines.push(`  ${REPORT_CHECK} Traces migrated to SQLite (${context.migration.traceMigrated} records)`);
  }

  return lines;
}

function renderWorkspaceSection(basePath: string, workspace: SetupWorkspaceResult): string[] {
  return [
    `  ${REPORT_CHECK} Directories: .automatosx/context, .automatosx/runtime, .automatosx/workflows`,
    workspace.writtenFiles.length > 0
      ? `  ${REPORT_CHECK} Config written: ${workspace.writtenFiles.map((file) => file.replace(basePath + '/', '')).join(', ')}`
      : `  ${REPORT_CHECK} Config up to date`,
    `  ${REPORT_CHECK} Agents ready: ${workspace.readyAgents.join(', ')}`,
    `  ${REPORT_CHECK} Policies registered: ${workspace.registeredPolicies.join(', ')}`,
  ];
}

function renderProviderDetectionSection(providers: ProviderClientStatus[]): string[] {
  const detectedNames = providers.filter((provider) => provider.installed).map((provider) => provider.providerId);
  return [
    ...providers.map((provider) => {
      const icon = provider.installed ? REPORT_CHECK : `  ${REPORT_DIM}-${REPORT_RESET}`;
      const status = provider.installed ? 'detected' : 'not detected';
      return `  ${icon} ${provider.providerId.padEnd(10)} ${status}`;
    }),
    `  Detected provider clients: ${detectedNames.length > 0 ? detectedNames.join(', ') : 'none'}`,
  ];
}

function renderProjectBootstrapSection(project: ProjectBootstrapResult): string[] {
  const enabledProviders = project.providers.filter((entry) => entry.enabled).map((entry) => entry.providerId);
  return [
    `  ${project.agentsMdWritten ? REPORT_CHECK : `${REPORT_CHECK} ${REPORT_DIM}(updated)${REPORT_RESET}`} AGENTS.md`,
    `  ${project.conventionsWritten ? REPORT_CHECK : `${REPORT_CHECK} ${REPORT_DIM}(updated)${REPORT_RESET}`} .automatosx/context/conventions.md`,
    `  ${project.rulesWritten ? REPORT_CHECK : `${REPORT_CHECK} ${REPORT_DIM}(updated)${REPORT_RESET}`} .automatosx/context/rules.md`,
    `  ${REPORT_CHECK} .automatosx/mcp.json ${REPORT_DIM}(${project.tools.length} tools)${REPORT_RESET}`,
    `  ${REPORT_CHECK} Provider integration files: ${enabledProviders.length > 0 ? enabledProviders.join(', ') : 'none'}`,
  ];
}

function renderSummarySection(context: SetupRenderContext): string[] {
  const detectedCount = context.workspace.detectedProviders.filter((provider) => provider.installed).length;
  const enabledProviders = context.project.providers.filter((entry) => entry.enabled).length;
  return [
    `  Providers detected: ${detectedCount}/${context.workspace.detectedProviders.length}`,
    `  MCP registered: ${enabledProviders} provider(s)`,
    `  Default provider: ${context.provider ?? 'claude'}`,
    `  Workspace: ${context.workspace.automatosxDir}`,
  ];
}

function renderDefaultSurfaceSection(productSurface: ProductSurfaceSummaryData): string[] {
  return [
    ...formatSurfaceSection('Workflow-first entry paths', productSurface.workflowCommands, {
      indent: '  ',
      stripPrefix: true,
    }),
    ...formatSurfaceSection('Stable support commands', productSurface.stableSupportCommands, {
      indent: '  ',
      stripPrefix: true,
      limit: 6,
    }),
    ...formatSurfaceSection('Advanced commands remain available', productSurface.advancedCommands, {
      indent: '  ',
      stripPrefix: true,
      limit: 5,
    }),
  ];
}

function renderNextSteps(productSurface: ProductSurfaceSummaryData, provider?: string): string[] {
  return [
    `  1. Start with ${REPORT_CYAN}ax setup${REPORT_RESET}, ${REPORT_CYAN}${productSurface.workflowCommands[0] ?? 'ax ship --scope <area>'}${REPORT_RESET}, and the stable support commands in ${REPORT_CYAN}AGENTS.md${REPORT_RESET}`,
    `  2. Edit ${REPORT_CYAN}AGENTS.md${REPORT_RESET}, ${REPORT_CYAN}.automatosx/context/rules.md${REPORT_RESET}, and ${REPORT_CYAN}.automatosx/context/conventions.md${REPORT_RESET} as needed`,
    `  3. Run ${REPORT_CYAN}ax doctor${REPORT_RESET} to verify the stable workflow-first surface and provider integrations`,
  ];
}
