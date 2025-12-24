/**
 * File System MCP Tools
 *
 * Provides secure file and directory operations for scaffold tools.
 * Implements security invariants from INV-FS-* series.
 *
 * @module mcp-server/tools/file-system
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { MCPTool, ToolHandler } from '../types.js';
import {
  FileSystemErrorCode,
  validateFileWriteRequest,
  validateDirectoryCreateRequest,
  isPathSafe,
} from '@automatosx/contracts';

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * File write tool definition
 *
 * Invariants:
 * - INV-FS-001: No path traversal
 * - INV-FS-002: No silent overwrites
 * - INV-FS-003: Atomic writes
 * - INV-FS-004: UTF-8 default
 */
export const fileWriteTool: MCPTool = {
  name: 'file_write',
  description:
    'Write content to a file. Requires explicit overwrite flag for existing files. SIDE EFFECTS: Creates/modifies file on disk. Idempotent with same content.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'File path relative to workspace root',
      },
      content: {
        type: 'string',
        description: 'File content to write',
      },
      createDirectories: {
        type: 'boolean',
        description: 'Create parent directories if they don\'t exist',
        default: true,
      },
      overwrite: {
        type: 'boolean',
        description: 'Allow overwriting existing files',
        default: false,
      },
      encoding: {
        type: 'string',
        enum: ['utf-8', 'ascii', 'base64', 'binary'],
        description: 'File encoding',
        default: 'utf-8',
      },
      backup: {
        type: 'boolean',
        description: 'Create backup before overwriting',
        default: false,
      },
    },
    required: ['path', 'content'],
  },
  idempotent: true, // Same content = same result
  retryableErrors: ['WRITE_FAILED'],
};

/**
 * Directory create tool definition
 *
 * Invariants:
 * - INV-FS-001: No path traversal
 * - INV-FS-102: Idempotent operation
 */
export const directoryCreateTool: MCPTool = {
  name: 'directory_create',
  description:
    'Create a directory. SIDE EFFECTS: Creates directory on disk. Idempotent - existing directory returns success.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Directory path relative to workspace root',
      },
      recursive: {
        type: 'boolean',
        description: 'Create parent directories if they don\'t exist',
        default: true,
      },
    },
    required: ['path'],
  },
  idempotent: true,
};

/**
 * File exists tool definition
 *
 * INV-MCP-004: Idempotent - read-only operation
 */
export const fileExistsTool: MCPTool = {
  name: 'file_exists',
  description:
    'Check if a file or directory exists. Read-only, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to check relative to workspace root',
      },
    },
    required: ['path'],
  },
  idempotent: true,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get workspace root from context or use current working directory
 */
function getWorkspaceRoot(): string {
  return process.cwd();
}

/**
 * Validate and resolve a path within workspace
 *
 * INV-FS-001: Prevents path traversal
 * INV-FS-006: Ensures path stays within workspace
 */
function resolveSafePath(
  filePath: string,
  workspaceRoot: string
): { valid: true; resolved: string } | { valid: false; error: { code: string; message: string } } {
  // INV-FS-001: Check for path traversal in input
  if (!isPathSafe(filePath)) {
    return {
      valid: false,
      error: {
        code: FileSystemErrorCode.PATH_TRAVERSAL,
        message: 'Path contains invalid characters or traversal sequences',
      },
    };
  }

  // Resolve to absolute path
  const resolved = path.resolve(workspaceRoot, filePath);

  // INV-FS-006: Verify path is within workspace
  const relative = path.relative(workspaceRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return {
      valid: false,
      error: {
        code: FileSystemErrorCode.OUTSIDE_WORKSPACE,
        message: 'Path resolves outside workspace root',
      },
    };
  }

  // INV-FS-005: Check for symlinks
  try {
    // Check each path component for symlinks
    let currentPath = workspaceRoot;
    const parts = relative.split(path.sep);
    for (const part of parts) {
      currentPath = path.join(currentPath, part);
      if (fs.existsSync(currentPath)) {
        const stat = fs.lstatSync(currentPath);
        if (stat.isSymbolicLink()) {
          return {
            valid: false,
            error: {
              code: FileSystemErrorCode.SYMLINK_NOT_ALLOWED,
              message: 'Symlinks are not allowed in path',
            },
          };
        }
      }
    }
  } catch {
    // Path component doesn't exist yet, which is fine
  }

  return { valid: true, resolved };
}

// ============================================================================
// Tool Handlers
// ============================================================================

/**
 * Handle file_write tool
 *
 * Invariants enforced:
 * - INV-FS-001: Path traversal prevention
 * - INV-FS-002: No silent overwrites
 * - INV-FS-003: Atomic writes
 * - INV-FS-005: No symlink following
 * - INV-FS-006: Workspace boundary
 */
export const handleFileWrite: ToolHandler = async (args) => {
  const workspaceRoot = getWorkspaceRoot();

  try {
    // Validate input against schema
    const request = validateFileWriteRequest(args);

    // INV-FS-001, INV-FS-005, INV-FS-006: Validate and resolve path
    const pathResult = resolveSafePath(request.path, workspaceRoot);
    if (!pathResult.valid) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              path: request.path,
              bytesWritten: 0,
              created: false,
              overwritten: false,
              error: pathResult.error,
            }),
          },
        ],
        isError: true,
      };
    }

    const resolvedPath = pathResult.resolved;
    const fileExists = fs.existsSync(resolvedPath);

    // INV-FS-002: No silent overwrites
    if (fileExists && !request.overwrite) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              path: request.path,
              bytesWritten: 0,
              created: false,
              overwritten: false,
              error: {
                code: FileSystemErrorCode.FILE_EXISTS,
                message: 'File exists. Set overwrite=true to replace.',
              },
            }),
          },
        ],
        isError: true,
      };
    }

    // INV-FS-101: Create parent directories if needed
    if (request.createDirectories) {
      const dir = path.dirname(resolvedPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    // Create backup if requested
    let backupPath: string | undefined;
    if (fileExists && request.backup) {
      backupPath = `${resolvedPath}.backup.${Date.now()}`;
      fs.copyFileSync(resolvedPath, backupPath);
    }

    // INV-FS-003: Atomic write (write to temp, then rename)
    const tempPath = `${resolvedPath}.tmp.${Date.now()}.${process.pid}`;

    try {
      // Write to temp file
      fs.writeFileSync(tempPath, request.content, {
        encoding: request.encoding as BufferEncoding,
      });

      // Atomic rename
      fs.renameSync(tempPath, resolvedPath);
    } catch (writeError) {
      // Clean up temp file if it exists
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch {
        // Ignore cleanup errors
      }
      throw writeError;
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            path: request.path,
            bytesWritten: Buffer.byteLength(request.content, request.encoding as BufferEncoding),
            created: !fileExists,
            overwritten: fileExists,
            ...(backupPath ? { backupPath: path.relative(workspaceRoot, backupPath) } : {}),
          }),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            path: typeof args.path === 'string' ? args.path : '',
            bytesWritten: 0,
            created: false,
            overwritten: false,
            error: {
              code: FileSystemErrorCode.WRITE_FAILED,
              message,
            },
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handle directory_create tool
 *
 * Invariants enforced:
 * - INV-FS-001: Path traversal prevention
 * - INV-FS-005: No symlink following
 * - INV-FS-006: Workspace boundary
 * - INV-FS-102: Idempotent operation
 */
export const handleDirectoryCreate: ToolHandler = async (args) => {
  const workspaceRoot = getWorkspaceRoot();

  try {
    // Validate input against schema
    const request = validateDirectoryCreateRequest(args);

    // INV-FS-001, INV-FS-005, INV-FS-006: Validate and resolve path
    const pathResult = resolveSafePath(request.path, workspaceRoot);
    if (!pathResult.valid) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              path: request.path,
              created: false,
              existed: false,
              error: pathResult.error,
            }),
          },
        ],
        isError: true,
      };
    }

    const resolvedPath = pathResult.resolved;
    const existed = fs.existsSync(resolvedPath);

    // INV-FS-102: Idempotent - existing directory is success
    if (existed) {
      const stat = fs.statSync(resolvedPath);
      if (!stat.isDirectory()) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                path: request.path,
                created: false,
                existed: true,
                error: {
                  code: FileSystemErrorCode.INVALID_PATH,
                  message: 'Path exists but is not a directory',
                },
              }),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              path: request.path,
              created: false,
              existed: true,
            }),
          },
        ],
      };
    }

    // Create directory
    fs.mkdirSync(resolvedPath, { recursive: request.recursive });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            path: request.path,
            created: true,
            existed: false,
          }),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            path: typeof args.path === 'string' ? args.path : '',
            created: false,
            existed: false,
            error: {
              code: FileSystemErrorCode.MKDIR_FAILED,
              message,
            },
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handle file_exists tool
 *
 * Read-only operation - no side effects
 */
export const handleFileExists: ToolHandler = async (args) => {
  const workspaceRoot = getWorkspaceRoot();

  try {
    const filePath = args.path as string;

    // Validate path
    const pathResult = resolveSafePath(filePath, workspaceRoot);
    if (!pathResult.valid) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              path: filePath,
              exists: false,
              error: pathResult.error,
            }),
          },
        ],
        isError: true,
      };
    }

    const resolvedPath = pathResult.resolved;
    const exists = fs.existsSync(resolvedPath);

    if (!exists) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              path: filePath,
              exists: false,
            }),
          },
        ],
      };
    }

    const stat = fs.statSync(resolvedPath);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            path: filePath,
            exists: true,
            isFile: stat.isFile(),
            isDirectory: stat.isDirectory(),
            size: stat.isFile() ? stat.size : undefined,
          }),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            path: typeof args.path === 'string' ? args.path : '',
            exists: false,
            error: {
              code: 'CHECK_FAILED',
              message,
            },
          }),
        },
      ],
      isError: true,
    };
  }
};

// ============================================================================
// Exports
// ============================================================================

export const FILE_SYSTEM_TOOLS: MCPTool[] = [
  fileWriteTool,
  directoryCreateTool,
  fileExistsTool,
];

export const FILE_SYSTEM_HANDLERS: Record<string, ToolHandler> = {
  file_write: handleFileWrite,
  directory_create: handleDirectoryCreate,
  file_exists: handleFileExists,
};
