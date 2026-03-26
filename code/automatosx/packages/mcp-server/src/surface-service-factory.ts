import { createDashboardService, type DashboardService } from '@defai.digital/monitoring';
import { createSharedRuntimeService, type SharedRuntimeService } from '@defai.digital/shared-runtime';
import { createMcpInProcessToolStateService } from './inprocess-tool-state-service.js';
import { createLocalSurfaceToolService } from './local-surface-tool-service.js';
import { createRuntimeBridgeToolService } from './runtime-bridge-tool-service.js';
import { createRuntimeOrchestrationToolService } from './runtime-orchestration-tool-service.js';
import { createRuntimeStateToolService } from './runtime-state-tool-service.js';
import { createRuntimeSupportToolService } from './runtime-support-tool-service.js';
import { createMcpSurfaceMetadataService } from './surface-metadata-service.js';
import { createSupplementalToolService } from './supplemental-tool-service.js';
import { createSupplementalSurfaceToolService } from './supplemental-surface-tool-service.js';
import { TOOL_DEFINITIONS } from './tool-definition-registry.js';
import { createWorkspaceToolService } from './workspace-tool-service.js';
import { createWorkspaceSurfaceToolService } from './workspace-surface-tool-service.js';

export const MCP_BASE_PATH_ENV_VAR = 'AUTOMATOSX_BASE_PATH';

export interface McpSurfaceServices {
  basePath: string;
  runtimeService: SharedRuntimeService;
  dashboardService: DashboardService;
  metadataService: ReturnType<typeof createMcpSurfaceMetadataService>;
  runtimeOrchestrationToolService: ReturnType<typeof createRuntimeOrchestrationToolService>;
  runtimeBridgeToolService: ReturnType<typeof createRuntimeBridgeToolService>;
  runtimeStateToolService: ReturnType<typeof createRuntimeStateToolService>;
  runtimeSupportToolService: ReturnType<typeof createRuntimeSupportToolService>;
  localSurfaceToolService: ReturnType<typeof createLocalSurfaceToolService>;
  workspaceSurfaceToolService: ReturnType<typeof createWorkspaceSurfaceToolService>;
  supplementalSurfaceToolService: ReturnType<typeof createSupplementalSurfaceToolService>;
}

export function resolveMcpSurfaceBasePath(basePath?: string): string {
  const envBasePath = process.env[MCP_BASE_PATH_ENV_VAR];
  return basePath ?? (typeof envBasePath === 'string' && envBasePath.trim().length > 0 ? envBasePath : undefined) ?? process.cwd();
}

export function createMcpSurfaceServices(config: {
  runtimeService?: SharedRuntimeService;
  dashboardService?: DashboardService;
  basePath?: string;
  toolPrefix?: string;
} = {}): McpSurfaceServices {
  const basePath = resolveMcpSurfaceBasePath(config.basePath);
  const runtimeService = config.runtimeService ?? createSharedRuntimeService({ basePath });
  const dashboardService = config.dashboardService ?? createDashboardService({
    traceStore: runtimeService.getStores().traceStore,
  });
  const inProcessStateService = createMcpInProcessToolStateService();
  const metadataService = createMcpSurfaceMetadataService({
    basePath,
    runtimeService,
    toolDefinitions: TOOL_DEFINITIONS,
    toolPrefix: config.toolPrefix,
  });
  const runtimeOrchestrationToolService = createRuntimeOrchestrationToolService({
    runtimeService,
  });
  const runtimeBridgeToolService = createRuntimeBridgeToolService({
    basePath,
    runtimeService,
  });
  const runtimeStateToolService = createRuntimeStateToolService({
    runtimeService,
  });
  const runtimeSupportToolService = createRuntimeSupportToolService({
    runtimeService,
    dashboardService,
  });
  const localSurfaceToolService = createLocalSurfaceToolService({
    inProcessStateService,
    metadataService,
  });
  const workspaceToolService = createWorkspaceToolService(basePath);
  const workspaceSurfaceToolService = createWorkspaceSurfaceToolService({
    workspaceToolService,
  });
  const supplementalToolService = createSupplementalToolService({
    runtimeService,
    onDesignArtifact: (artifact) => {
      inProcessStateService.storeDesignArtifact(artifact);
    },
  });
  const supplementalSurfaceToolService = createSupplementalSurfaceToolService({
    supplementalToolService,
  });

  return {
    basePath,
    runtimeService,
    dashboardService,
    metadataService,
    runtimeOrchestrationToolService,
    runtimeBridgeToolService,
    runtimeStateToolService,
    runtimeSupportToolService,
    localSurfaceToolService,
    workspaceSurfaceToolService,
    supplementalSurfaceToolService,
  };
}
