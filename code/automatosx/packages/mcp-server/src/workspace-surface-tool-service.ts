import type { MpcToolResult } from './surface-types.js';
import {
  asOptionalBoolean,
  asOptionalString,
  asString,
} from './tool-argument-parsers.js';
import type { WorkspaceToolService } from './workspace-tool-service.js';

export interface WorkspaceSurfaceToolService {
  invokeTool(toolName: string, args: Record<string, unknown>): Promise<MpcToolResult | undefined>;
}

export function createWorkspaceSurfaceToolService(config: {
  workspaceToolService: WorkspaceToolService;
}): WorkspaceSurfaceToolService {
  return {
    async invokeTool(toolName, args) {
      switch (toolName) {
        case 'file_exists':
          return config.workspaceToolService.fileExists(
            asString(args.path, 'path'),
            asOptionalString(args.basePath),
          );
        case 'file_write':
          return config.workspaceToolService.writeWorkspaceFile({
            path: asString(args.path, 'path'),
            content: asString(args.content, 'content'),
            basePath: asOptionalString(args.basePath),
            overwrite: asOptionalBoolean(args.overwrite),
            createDirectories: asOptionalBoolean(args.createDirectories),
          });
        case 'directory_create':
          return config.workspaceToolService.createDirectory({
            path: asString(args.path, 'path'),
            basePath: asOptionalString(args.basePath),
            recursive: asOptionalBoolean(args.recursive),
          });
        default:
          return undefined;
      }
    },
  };
}
