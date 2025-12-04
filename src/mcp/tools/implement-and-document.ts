/**
 * MCP Tool: implement_and_document
 *
 * Composite tool that implements code AND generates documentation atomically.
 * Reduces documentation drift by ensuring code and docs are always in sync.
 *
 * @since v10.2.0 (Phase 3.1)
 */

import type { ToolHandler } from '../types.js';
import type { ContextManager } from '../../agents/context-manager.js';
import type { SessionManager } from '../../core/session/manager.js';
import type { WorkspaceManager } from '../../core/workspace-manager.js';
import type { ProfileLoader } from '../../agents/profile-loader.js';
import { AgentExecutor } from '../../agents/executor.js';
import { logger } from '../../shared/logging/logger.js';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'path';

export interface ImplementAndDocumentInput {
  task: string;                         // Task description
  agent?: string;                        // Optional: Agent to use (default: "backend")
  documentation?: {
    format?: 'markdown' | 'jsdoc';       // Doc format (default: markdown)
    outputPath?: string;                 // Optional: Custom doc output path
    updateChangelog?: boolean;           // Update CHANGELOG.md (default: true)
  };
  provider?: 'claude' | 'gemini' | 'openai';  // Optional: AI provider override
}

export interface ImplementAndDocumentOutput {
  implementation: {
    files: string[];                     // Files modified
    summary: string;                     // Implementation summary
  };
  documentation: {
    files: string[];                     // Documentation files created/updated
    format: string;                      // Format used
    changelogUpdated: boolean;           // Whether CHANGELOG was updated
  };
  success: boolean;
  errors?: string[];                     // Any errors encountered
}

export interface ImplementAndDocumentHandlerDeps {
  contextManager: ContextManager;
  executorConfig: {
    sessionManager: SessionManager;
    workspaceManager: WorkspaceManager;
    contextManager: ContextManager;
    profileLoader: ProfileLoader;
  };
}

export function createImplementAndDocumentHandler(
  deps: ImplementAndDocumentHandlerDeps
): ToolHandler<ImplementAndDocumentInput, ImplementAndDocumentOutput> {
  return async (input: ImplementAndDocumentInput): Promise<ImplementAndDocumentOutput> => {
    logger.info('[MCP Tool] implement_and_document', {
      task: input.task,
      agent: input.agent ?? 'backend'
    });

    const { contextManager } = deps;
    const errors: string[] = [];

    try {
      // Step 1: Implementation phase
      const agent = input.agent ?? 'backend';
      const implementationTask = `${input.task}\n\nIMPORTANT: Provide a summary of all files modified and key changes made.`;

      logger.info('[MCP Tool] Starting implementation phase', { agent });

      const context = await contextManager.createContext(agent, implementationTask, {
        provider: input.provider,
        skipMemory: false
      });

      const executor = new AgentExecutor(deps.executorConfig);
      const implementationResult = await executor.execute(context, {
        showProgress: false,
        verbose: false
      });

      // Parse implementation result to extract modified files
      const modifiedFiles = extractModifiedFiles(implementationResult.response.content);

      // Step 2: Documentation phase
      logger.info('[MCP Tool] Starting documentation phase');

      const docFormat = input.documentation?.format ?? 'markdown';
      const updateChangelog = input.documentation?.updateChangelog ?? true;

      const documentationTask = `Generate comprehensive documentation for the following implementation:

Task: ${input.task}

Implementation Summary: ${implementationResult.response}

Modified Files: ${modifiedFiles.join(', ')}

Please create:
1. ${docFormat === 'markdown' ? 'Markdown documentation' : 'JSDoc comments'}
2. Usage examples
3. API reference (if applicable)

Format: ${docFormat}`;

      const docContext = await contextManager.createContext('writer', documentationTask, {
        provider: input.provider,
        skipMemory: false
      });

      const docExecutor = new AgentExecutor(deps.executorConfig);
      const documentationResult = await docExecutor.execute(docContext, {
        showProgress: false,
        verbose: false
      });

      // Extract documentation files from response
      const docFiles = extractModifiedFiles(documentationResult.response.content);

      // Step 3: Update CHANGELOG.md (if requested)
      let changelogUpdated = false;
      if (updateChangelog) {
        try {
          await updateChangelog_atomic(input.task, modifiedFiles);
          changelogUpdated = true;
          logger.info('[MCP Tool] CHANGELOG.md updated');
        } catch (error) {
          errors.push(`Failed to update CHANGELOG: ${(error as Error).message}`);
          logger.warn('[MCP Tool] CHANGELOG update failed', { error });
        }
      }

      return {
        implementation: {
          files: modifiedFiles,
          summary: implementationResult.response.content
        },
        documentation: {
          files: docFiles,
          format: docFormat,
          changelogUpdated
        },
        success: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      logger.error('[MCP Tool] implement_and_document failed', { error });
      throw new Error(`Failed to implement and document: ${(error as Error).message}`);
    }
  };
}

/**
 * Extract modified files from agent response
 */
function extractModifiedFiles(response: string): string[] {
  const files: string[] = [];

  // Look for file references in response
  // Pattern 1: "Modified: src/foo.ts"
  const modifiedPattern = /(?:Modified|Created|Updated):\s*([^\s,]+(?:\.[a-z]+)?)/gi;
  let match;
  while ((match = modifiedPattern.exec(response)) !== null) {
    if (match[1]) {
      files.push(match[1]);
    }
  }

  // Pattern 2: Code blocks with file paths
  const codeBlockPattern = /```[a-z]*\s*\/\/\s*([^\n]+)\n/gi;
  while ((match = codeBlockPattern.exec(response)) !== null) {
    if (match[1]) {
      files.push(match[1]);
    }
  }

  // Deduplicate
  return Array.from(new Set(files));
}

/**
 * Update CHANGELOG.md atomically
 */
async function updateChangelog_atomic(task: string, files: string[]): Promise<void> {
  const changelogPath = join(process.cwd(), 'CHANGELOG.md');
  const timestamp = new Date().toISOString().split('T')[0];

  try {
    // Read existing changelog
    let content = '';
    try {
      content = await readFile(changelogPath, 'utf-8');
    } catch (error) {
      // Create new changelog if doesn't exist
      content = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n';
    }

    // Find the first ## heading or create one
    const entry = `## ${timestamp}

### Added
- ${task}

**Files Modified:**
${files.map(f => `- ${f}`).join('\n')}

`;

    // Insert after first heading
    const headingIndex = content.indexOf('## ');
    if (headingIndex === -1) {
      // No headings yet, append
      content += `\n${entry}`;
    } else {
      // Insert before first heading
      content = content.slice(0, headingIndex) + entry + '\n' + content.slice(headingIndex);
    }

    // Write back
    await writeFile(changelogPath, content, 'utf-8');
    logger.info('[MCP Tool] CHANGELOG.md updated', { timestamp, filesCount: files.length });
  } catch (error) {
    logger.error('[MCP Tool] Failed to update CHANGELOG.md', { error });
    throw error;
  }
}
