import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';

export interface WorkspaceToolService {
  fileExists(path: string, basePath?: string): Promise<{ success: true; data: { exists: boolean } }>;
  writeWorkspaceFile(input: {
    path: string;
    content: string;
    basePath?: string;
    overwrite?: boolean;
    createDirectories?: boolean;
  }): Promise<{ success: true; data: { path: string; written: true } }>;
  createDirectory(input: {
    path: string;
    basePath?: string;
    recursive?: boolean;
  }): Promise<{ success: true; data: { path: string; created: true } }>;
}

export function createWorkspaceToolService(defaultBasePath: string): WorkspaceToolService {
  return {
    async fileExists(path, basePath) {
      return {
        success: true,
        data: {
          exists: await pathExists(resolveWorkspacePath(basePath ?? defaultBasePath, path)),
        },
      };
    },

    async writeWorkspaceFile(input) {
      const filePath = resolveWorkspacePath(input.basePath ?? defaultBasePath, input.path);
      const overwrite = input.overwrite ?? false;
      const createDirectories = input.createDirectories ?? false;
      if (!overwrite && await pathExists(filePath)) {
        throw new Error(`File already exists: ${input.path}`);
      }
      if (createDirectories) {
        await mkdir(dirname(filePath), { recursive: true });
      }
      await writeFile(filePath, input.content, 'utf8');
      return {
        success: true,
        data: { path: filePath, written: true },
      };
    },

    async createDirectory(input) {
      const directoryPath = resolveWorkspacePath(input.basePath ?? defaultBasePath, input.path);
      await mkdir(directoryPath, { recursive: input.recursive ?? true });
      return {
        success: true,
        data: { path: directoryPath, created: true },
      };
    },
  };
}

function resolveWorkspacePath(basePath: string, targetPath: string): string {
  const resolvedBasePath = resolve(basePath);
  const resolvedTargetPath = resolve(resolvedBasePath, targetPath);
  const relativePath = relative(resolvedBasePath, resolvedTargetPath);
  if (relativePath === '..' || /^\.\.(?:[\\/]|$)/.test(relativePath)) {
    throw new Error(`Path escapes workspace: ${targetPath}`);
  }
  return resolvedTargetPath;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
