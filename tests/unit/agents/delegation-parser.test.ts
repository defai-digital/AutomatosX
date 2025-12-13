/**
 * Delegation Parser Unit Tests
 *
 * Comprehensive tests for the DelegationParser including:
 * - Multiple delegation syntaxes (DELEGATE TO, @mention, polite, Chinese)
 * - Edge cases and false positive filtering
 * - Display name resolution
 * - Performance characteristics
 *
 * @module tests/unit/agents/delegation-parser.test.ts
 * @since v12.8.3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DelegationParser, type ParsedDelegation } from '@/agents/delegation-parser.js';
import type { ProfileLoader } from '@/agents/profile-loader.js';

// ============================================================================
// Mock ProfileLoader
// ============================================================================

function createMockProfileLoader(
  nameMap: Record<string, string> = {}
): ProfileLoader {
  return {
    resolveAgentName: vi.fn().mockImplementation(async (name: string) => {
      if (nameMap[name]) {
        return nameMap[name];
      }
      // Default: return name as-is (agent exists with that name)
      return name;
    }),
    loadProfile: vi.fn(),
    listProfiles: vi.fn(),
    validateProfile: vi.fn(),
    getProfilePath: vi.fn(),
    clearCache: vi.fn(),
    findSimilarAgents: vi.fn(),
    getTeamConfig: vi.fn(),
    composeAgentPrompt: vi.fn(),
    getComposedPrompt: vi.fn(),
  } as unknown as ProfileLoader;
}

function createFailingProfileLoader(): ProfileLoader {
  return {
    resolveAgentName: vi.fn().mockRejectedValue(new Error('Agent not found')),
    loadProfile: vi.fn(),
    listProfiles: vi.fn(),
    validateProfile: vi.fn(),
    getProfilePath: vi.fn(),
    clearCache: vi.fn(),
    findSimilarAgents: vi.fn(),
    getTeamConfig: vi.fn(),
    composeAgentPrompt: vi.fn(),
    getComposedPrompt: vi.fn(),
  } as unknown as ProfileLoader;
}

// ============================================================================
// Test Setup
// ============================================================================

describe('DelegationParser', () => {
  let parser: DelegationParser;

  beforeEach(() => {
    parser = new DelegationParser();
  });

  // ============================================================================
  // DELEGATE TO Syntax Tests
  // ============================================================================

  describe('DELEGATE TO Syntax', () => {
    it('should parse basic DELEGATE TO syntax', async () => {
      const response = 'DELEGATE TO backend: Implement the user authentication API';
      const delegations = await parser.parse(response, 'frontend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]).toMatchObject({
        toAgent: 'backend',
        task: 'Implement the user authentication API',
      });
    });

    it('should parse DELEGATE TO with lowercase', async () => {
      const response = 'delegate to security: Review the authentication code';
      const delegations = await parser.parse(response, 'backend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('security');
    });

    it('should parse DELEGATE TO with mixed case', async () => {
      const response = 'Delegate To frontend: Create the login form';
      const delegations = await parser.parse(response, 'backend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('frontend');
    });

    it('should parse multiple DELEGATE TO in same response', async () => {
      const response = `
        First, DELEGATE TO backend: Build the API endpoints

        Then, DELEGATE TO frontend: Create the UI components
      `;
      const delegations = await parser.parse(response, 'architecture');

      expect(delegations).toHaveLength(2);
      expect(delegations[0]?.toAgent).toBe('backend');
      expect(delegations[1]?.toAgent).toBe('frontend');
    });

    it('should handle DELEGATE TO with extra whitespace', async () => {
      const response = 'DELEGATE   TO   backend  :   Handle the request';
      const delegations = await parser.parse(response, 'frontend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('backend');
    });
  });

  // ============================================================================
  // @mention Syntax Tests
  // ============================================================================

  describe('@mention Syntax', () => {
    it('should parse @agent: task syntax', async () => {
      const response = '@backend: Implement the REST API';
      const delegations = await parser.parse(response, 'frontend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]).toMatchObject({
        toAgent: 'backend',
        task: 'Implement the REST API',
      });
    });

    it('should parse @agent task syntax (without colon)', async () => {
      const response = '@frontend Create the login page with validation';
      const delegations = await parser.parse(response, 'backend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('frontend');
      expect(delegations[0]?.task).toContain('Create the login page');
    });

    it('should parse multiple @mentions', async () => {
      const response = `
        @backend Implement the API

        @frontend Build the UI
      `;
      const delegations = await parser.parse(response, 'architecture');

      expect(delegations).toHaveLength(2);
    });

    it('should handle agent names with hyphens', async () => {
      const response = '@data-engineer: Build the ETL pipeline';
      const delegations = await parser.parse(response, 'backend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('data-engineer');
    });

    it('should handle agent names with underscores', async () => {
      const response = '@ml_engineer: Train the model';
      const delegations = await parser.parse(response, 'backend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('ml_engineer');
    });
  });

  // ============================================================================
  // Polite Request Syntax Tests
  // ============================================================================

  describe('Polite Request Syntax', () => {
    it('should parse "please agent to task" syntax', async () => {
      const response = 'Please backend to implement the authentication system';
      const delegations = await parser.parse(response, 'frontend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('backend');
    });

    it('should parse "ask agent to task" syntax', async () => {
      const response = 'Ask security to review the code for vulnerabilities';
      const delegations = await parser.parse(response, 'backend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('security');
    });

    it('should parse "request agent to task" syntax', async () => {
      const response = 'Request devops to set up the CI/CD pipeline';
      const delegations = await parser.parse(response, 'backend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('devops');
    });

    it('should parse "please agent: task" syntax', async () => {
      const response = 'Please frontend: Create the dashboard components';
      const delegations = await parser.parse(response, 'backend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('frontend');
    });
  });

  // ============================================================================
  // Need Expression Syntax Tests
  // ============================================================================

  describe('Need Expression Syntax', () => {
    it('should parse "I need agent to task" syntax', async () => {
      const response = 'I need backend to handle the database migrations';
      const delegations = await parser.parse(response, 'frontend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('backend');
    });

    it('should parse "I require agent to task" syntax', async () => {
      const response = 'I require security to audit the authentication flow';
      const delegations = await parser.parse(response, 'backend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('security');
    });
  });

  // ============================================================================
  // Chinese Syntax Tests
  // ============================================================================

  describe('Chinese Syntax', () => {
    it('should parse 請 agent task syntax', async () => {
      const response = '請 backend 實現用戶認證系統';
      const delegations = await parser.parse(response, 'frontend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('backend');
    });

    it('should parse 委派給 agent：task syntax', async () => {
      const response = '委派給 frontend：建立登入介面';
      const delegations = await parser.parse(response, 'backend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('frontend');
    });

    it('should parse 委派給 agent:task syntax (ASCII colon)', async () => {
      const response = '委派給 security:審核安全性';
      const delegations = await parser.parse(response, 'backend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('security');
    });
  });

  // ============================================================================
  // Display Name Resolution Tests
  // ============================================================================

  describe('Display Name Resolution', () => {
    it('should resolve display names to agent names', async () => {
      const mockLoader = createMockProfileLoader({
        'Oliver': 'devops',
        'Bob': 'backend',
      });
      const parserWithLoader = new DelegationParser(mockLoader);

      const response = '@Oliver Deploy the application to production';
      const delegations = await parserWithLoader.parse(response, 'backend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('devops');
    });

    it('should cache resolved names for same response', async () => {
      const mockLoader = createMockProfileLoader({
        'Bob': 'backend',
      });
      const parserWithLoader = new DelegationParser(mockLoader);

      const response = `
        @Bob Implement feature A

        @Bob Implement feature B
      `;
      const delegations = await parserWithLoader.parse(response, 'frontend');

      expect(delegations).toHaveLength(2);
      // Should only call resolveAgentName once due to caching
      expect(mockLoader.resolveAgentName).toHaveBeenCalledTimes(1);
    });

    it('should skip delegation when agent not found', async () => {
      const mockLoader = createFailingProfileLoader();
      const parserWithLoader = new DelegationParser(mockLoader);

      const response = '@nonexistent Do something';
      const delegations = await parserWithLoader.parse(response, 'backend');

      expect(delegations).toHaveLength(0);
    });
  });

  // ============================================================================
  // False Positive Filtering Tests
  // ============================================================================

  describe('False Positive Filtering', () => {
    it('should skip JSDoc annotations', async () => {
      const response = `
        /**
         * @param request The incoming request
         * @returns The response
         */
        function handleRequest() {}
      `;
      const delegations = await parser.parse(response, 'backend');

      expect(delegations).toHaveLength(0);
    });

    it('should skip code blocks with triple backticks', async () => {
      const response = `
        Here's an example:
        \`\`\`typescript
        @backend.handler()
        class MyHandler {}
        \`\`\`
      `;
      const delegations = await parser.parse(response, 'frontend');

      expect(delegations).toHaveLength(0);
    });

    it('should skip inline code with single backticks', async () => {
      const response = 'Use the `@backend` decorator for this';
      const delegations = await parser.parse(response, 'frontend');

      expect(delegations).toHaveLength(0);
    });

    it('should skip quoted text', async () => {
      const response = 'The syntax is "@backend: task" for delegation';
      const delegations = await parser.parse(response, 'frontend');

      expect(delegations).toHaveLength(0);
    });

    it('should skip documentation examples', async () => {
      const response = `
        Supported syntaxes:
        1. @backend task
        2. DELEGATE TO backend: task
      `;
      const delegations = await parser.parse(response, 'frontend');

      expect(delegations).toHaveLength(0);
    });

    it('should skip test code patterns', async () => {
      const response = `
        it('should parse @backend syntax', async () => {
          const result = await parser.parse('@backend do task', 'frontend');
        });
      `;
      const delegations = await parser.parse(response, 'test');

      expect(delegations).toHaveLength(0);
    });

    it('should skip tasks that are too short', async () => {
      const response = '@backend foo';
      const delegations = await parser.parse(response, 'frontend');

      expect(delegations).toHaveLength(0);
    });

    it('should skip self-delegation', async () => {
      const response = '@backend Implement the API';
      const delegations = await parser.parse(response, 'backend');

      expect(delegations).toHaveLength(0);
    });

    it('should skip self-delegation case-insensitively', async () => {
      const response = '@Backend Implement the API';
      const delegations = await parser.parse(response, 'backend');

      expect(delegations).toHaveLength(0);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty response', async () => {
      const delegations = await parser.parse('', 'backend');
      expect(delegations).toHaveLength(0);
    });

    it('should handle response with no delegations', async () => {
      const response = 'This is just a regular response with no delegations.';
      const delegations = await parser.parse(response, 'backend');
      expect(delegations).toHaveLength(0);
    });

    it('should handle response with only whitespace', async () => {
      const delegations = await parser.parse('   \n\t\n   ', 'backend');
      expect(delegations).toHaveLength(0);
    });

    it('should preserve position ordering of delegations', async () => {
      const response = `
        @frontend Build the UI first

        DELEGATE TO backend: Then implement the API

        Please security to review everything at the end
      `;
      const delegations = await parser.parse(response, 'architecture');

      expect(delegations).toHaveLength(3);
      expect(delegations[0]?.toAgent).toBe('frontend');
      expect(delegations[1]?.toAgent).toBe('backend');
      expect(delegations[2]?.toAgent).toBe('security');
    });

    it('should handle very long task descriptions', async () => {
      const longTask = 'A'.repeat(1000);
      const response = `@backend: ${longTask}`;
      const delegations = await parser.parse(response, 'frontend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.task.length).toBeGreaterThan(100);
    });

    it('should handle unicode in task descriptions', async () => {
      const response = '@backend: 實現用戶認證系統 with emojis 🚀';
      const delegations = await parser.parse(response, 'frontend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.task).toContain('🚀');
    });

    it('should handle multiple delegations to same agent', async () => {
      const response = `
        @backend Implement feature A

        @backend Implement feature B
      `;
      const delegations = await parser.parse(response, 'frontend');

      expect(delegations).toHaveLength(2);
      expect(delegations[0]?.toAgent).toBe('backend');
      expect(delegations[1]?.toAgent).toBe('backend');
    });

    it('should handle newlines in task descriptions', async () => {
      const response = 'DELEGATE TO backend: Implement the API\nwith proper error handling';
      const delegations = await parser.parse(response, 'frontend');

      expect(delegations).toHaveLength(1);
      // Task should capture content up to paragraph break
      expect(delegations[0]?.task).toBeDefined();
    });

    it('should reset regex lastIndex between parse calls', async () => {
      // This tests the bug fix for global regex state persistence
      const response1 = '@backend: Task one';
      const response2 = '@frontend: Task two';

      const delegations1 = await parser.parse(response1, 'frontend');
      const delegations2 = await parser.parse(response2, 'backend');

      expect(delegations1).toHaveLength(1);
      expect(delegations2).toHaveLength(1);
      expect(delegations1[0]?.toAgent).toBe('backend');
      expect(delegations2[0]?.toAgent).toBe('frontend');
    });
  });

  // ============================================================================
  // Mixed Syntax Tests
  // ============================================================================

  describe('Mixed Syntax', () => {
    it('should handle mixed delegation syntaxes in same response', async () => {
      const response = `
        DELEGATE TO backend: Implement the API

        @frontend Create the UI

        Please security to audit the code

        委派給 devops：部署應用程式
      `;
      const delegations = await parser.parse(response, 'architecture');

      expect(delegations).toHaveLength(4);
      const agents = delegations.map(d => d.toAgent);
      expect(agents).toContain('backend');
      expect(agents).toContain('frontend');
      expect(agents).toContain('security');
      expect(agents).toContain('devops');
    });
  });

  // ============================================================================
  // Original Text Tracking
  // ============================================================================

  describe('Original Text Tracking', () => {
    it('should include original matched text', async () => {
      const response = '@backend: Implement the authentication';
      const delegations = await parser.parse(response, 'frontend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.originalText).toBeDefined();
      expect(delegations[0]?.originalText).toContain('@backend');
    });
  });
});
