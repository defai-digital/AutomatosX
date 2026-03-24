import { getErrorMessage } from '@defai.digital/contracts';
import { createSharedRuntimeService } from '@defai.digital/shared-runtime';
import type { CLIOptions, CommandResult } from '../types.js';

export function createRuntime(options: CLIOptions): ReturnType<typeof createSharedRuntimeService> {
  const basePath = options.outputDir ?? process.cwd();
  return createSharedRuntimeService({ basePath });
}

export function success(message: string, data: unknown = undefined): CommandResult {
  return {
    success: true,
    message,
    data,
    exitCode: 0,
  };
}

export function failure(message: string, data: unknown = undefined): CommandResult {
  return {
    success: false,
    message,
    data,
    exitCode: 1,
  };
}

export function failureFromError(action: string, error: unknown): CommandResult {
  const message = getErrorMessage(error);
  const stack = error instanceof Error ? error.stack : undefined;
  return failure(`Failed to ${action}: ${message}`, stack !== undefined ? { stack } : undefined);
}

export function usageError(usage: string): CommandResult {
  return failure(`Usage: ${usage}`);
}

