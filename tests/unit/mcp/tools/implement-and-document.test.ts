/**
 * MCP Tool Tests: implement_and_document
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createImplementAndDocumentHandler } from '../../../../src/mcp/tools/implement-and-document.js';

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn()
}));

// Mock AgentExecutor with proper constructor mock
vi.mock('../../../../src/agents/executor.js', () => ({
  AgentExecutor: vi.fn().mockImplementation(function(this: any) {
    this.execute = vi.fn().mockResolvedValue({ response: { content: '' } });
    return this;
  })
}));

describe('MCP Tool: implement_and_document', () => {
  let mockContextManager: any;
  let mockSessionManager: any;
  let mockWorkspaceManager: any;
  let mockProfileLoader: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockContextManager = {
      createContext: vi.fn()
    };

    mockSessionManager = {
      createSession: vi.fn(),
      getSession: vi.fn()
    };

    mockWorkspaceManager = {
      getProjectDir: vi.fn().mockReturnValue('/project')
    };

    mockProfileLoader = {
      loadProfile: vi.fn()
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Implementation Phase', () => {
    it('should execute implementation with default agent', async () => {
      const mockContext = {
        agent: 'backend',
        task: 'Implement feature',
        provider: undefined
      };

      mockContextManager.createContext.mockResolvedValue(mockContext);

      const { AgentExecutor } = await import('../../../../src/agents/executor.js');
      vi.mocked(AgentExecutor).mockImplementation(function(this: any) {
        this.execute = vi.fn().mockResolvedValue({
          response: { content: 'Modified: src/feature.ts\nImplementation complete' }
        });
        return this;
      });

      const handler = createImplementAndDocumentHandler({
        contextManager: mockContextManager,
        executorConfig: {
          sessionManager: mockSessionManager,
          workspaceManager: mockWorkspaceManager,
          contextManager: mockContextManager,
          profileLoader: mockProfileLoader
        }
      });

      const result = await handler({
        task: 'Implement user authentication'
      });

      expect(mockContextManager.createContext).toHaveBeenCalledWith(
        'backend',
        expect.stringContaining('Implement user authentication'),
        expect.any(Object)
      );
      expect(result.implementation.files).toContain('src/feature.ts');
      expect(result.success).toBeDefined();
    });

    it('should use specified agent', async () => {
      mockContextManager.createContext.mockResolvedValue({
        agent: 'frontend',
        task: 'Task'
      });

      const { AgentExecutor } = await import('../../../../src/agents/executor.js');
      vi.mocked(AgentExecutor).mockImplementation(function(this: any) {
        this.execute = vi.fn().mockResolvedValue({
          response: { content: 'Done' }
        });
        return this;
      });

      const handler = createImplementAndDocumentHandler({
        contextManager: mockContextManager,
        executorConfig: {
          sessionManager: mockSessionManager,
          workspaceManager: mockWorkspaceManager,
          contextManager: mockContextManager,
          profileLoader: mockProfileLoader
        }
      });

      await handler({
        task: 'Build UI component',
        agent: 'frontend'
      });

      expect(mockContextManager.createContext).toHaveBeenCalledWith(
        'frontend',
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should use specified provider', async () => {
      mockContextManager.createContext.mockResolvedValue({
        agent: 'backend',
        task: 'Task',
        provider: 'claude'
      });

      const { AgentExecutor } = await import('../../../../src/agents/executor.js');
      vi.mocked(AgentExecutor).mockImplementation(function(this: any) {
        this.execute = vi.fn().mockResolvedValue({
          response: { content: 'Done' }
        });
        return this;
      });

      const handler = createImplementAndDocumentHandler({
        contextManager: mockContextManager,
        executorConfig: {
          sessionManager: mockSessionManager,
          workspaceManager: mockWorkspaceManager,
          contextManager: mockContextManager,
          profileLoader: mockProfileLoader
        }
      });

      await handler({
        task: 'Task',
        provider: 'claude'
      });

      expect(mockContextManager.createContext).toHaveBeenCalledWith(
        'backend',
        expect.any(String),
        expect.objectContaining({ provider: 'claude' })
      );
    });
  });

  describe('Documentation Phase', () => {
    it('should generate markdown documentation by default', async () => {
      mockContextManager.createContext.mockResolvedValue({ agent: 'backend', task: 'Task' });

      const { AgentExecutor } = await import('../../../../src/agents/executor.js');
      vi.mocked(AgentExecutor).mockImplementation(function(this: any) {
        this.execute = vi.fn().mockResolvedValue({
          response: { content: 'Documentation generated' }
        });
        return this;
      });

      const handler = createImplementAndDocumentHandler({
        contextManager: mockContextManager,
        executorConfig: {
          sessionManager: mockSessionManager,
          workspaceManager: mockWorkspaceManager,
          contextManager: mockContextManager,
          profileLoader: mockProfileLoader
        }
      });

      const result = await handler({ task: 'Implement feature' });

      // Second createContext call should be for writer agent with markdown format
      expect(mockContextManager.createContext).toHaveBeenNthCalledWith(
        2,
        'writer',
        expect.stringContaining('markdown'),
        expect.any(Object)
      );
      expect(result.documentation.format).toBe('markdown');
    });

    it('should generate jsdoc documentation when specified', async () => {
      mockContextManager.createContext.mockResolvedValue({ agent: 'backend', task: 'Task' });

      const { AgentExecutor } = await import('../../../../src/agents/executor.js');
      vi.mocked(AgentExecutor).mockImplementation(function(this: any) {
        this.execute = vi.fn().mockResolvedValue({
          response: { content: 'JSDoc comments added' }
        });
        return this;
      });

      const handler = createImplementAndDocumentHandler({
        contextManager: mockContextManager,
        executorConfig: {
          sessionManager: mockSessionManager,
          workspaceManager: mockWorkspaceManager,
          contextManager: mockContextManager,
          profileLoader: mockProfileLoader
        }
      });

      const result = await handler({
        task: 'Implement feature',
        documentation: {
          format: 'jsdoc'
        }
      });

      expect(mockContextManager.createContext).toHaveBeenNthCalledWith(
        2,
        'writer',
        expect.stringContaining('JSDoc'),
        expect.any(Object)
      );
      expect(result.documentation.format).toBe('jsdoc');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when implementation fails', async () => {
      mockContextManager.createContext.mockRejectedValue(
        new Error('Context creation failed')
      );

      const handler = createImplementAndDocumentHandler({
        contextManager: mockContextManager,
        executorConfig: {
          sessionManager: mockSessionManager,
          workspaceManager: mockWorkspaceManager,
          contextManager: mockContextManager,
          profileLoader: mockProfileLoader
        }
      });

      await expect(handler({ task: 'Implement feature' })).rejects.toThrow(
        'Failed to implement and document: Context creation failed'
      );
    });
  });

  describe('File Extraction', () => {
    it('should extract modified files from response', async () => {
      mockContextManager.createContext.mockResolvedValue({ agent: 'backend', task: 'Task' });

      const { AgentExecutor } = await import('../../../../src/agents/executor.js');
      vi.mocked(AgentExecutor).mockImplementation(function(this: any) {
        this.execute = vi.fn().mockResolvedValue({
          response: {
            content: `
              Modified: src/auth/login.ts
              Created: src/auth/logout.ts
              Updated: src/utils/helpers.ts
            `
          }
        });
        return this;
      });

      const handler = createImplementAndDocumentHandler({
        contextManager: mockContextManager,
        executorConfig: {
          sessionManager: mockSessionManager,
          workspaceManager: mockWorkspaceManager,
          contextManager: mockContextManager,
          profileLoader: mockProfileLoader
        }
      });

      const result = await handler({ task: 'Implement auth' });

      expect(result.implementation.files).toContain('src/auth/login.ts');
      expect(result.implementation.files).toContain('src/auth/logout.ts');
      expect(result.implementation.files).toContain('src/utils/helpers.ts');
    });

    it('should deduplicate extracted files', async () => {
      mockContextManager.createContext.mockResolvedValue({ agent: 'backend', task: 'Task' });

      const { AgentExecutor } = await import('../../../../src/agents/executor.js');
      vi.mocked(AgentExecutor).mockImplementation(function(this: any) {
        this.execute = vi.fn().mockResolvedValue({
          response: {
            content: `
              Modified: src/file.ts
              Updated: src/file.ts
            `
          }
        });
        return this;
      });

      const handler = createImplementAndDocumentHandler({
        contextManager: mockContextManager,
        executorConfig: {
          sessionManager: mockSessionManager,
          workspaceManager: mockWorkspaceManager,
          contextManager: mockContextManager,
          profileLoader: mockProfileLoader
        }
      });

      const result = await handler({ task: 'Update file' });

      // Should only have one entry for src/file.ts
      const fileCount = result.implementation.files.filter(f => f === 'src/file.ts').length;
      expect(fileCount).toBe(1);
    });
  });
});
