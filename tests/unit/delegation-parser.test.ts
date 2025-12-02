/**
 * Delegation Parser Tests
 *
 * Tests natural language delegation parsing with multiple syntax patterns.
 */

import { describe, it, expect, vi } from 'vitest';
import { DelegationParser } from '../../src/agents/delegation-parser.js';
import type { ProfileLoader } from '../../src/agents/profile-loader.js';
import { AgentNotFoundError } from '../../src/types/agent.js';

describe('DelegationParser', () => {
  const parser = new DelegationParser();

  describe('Pattern 1: DELEGATE TO syntax', () => {
    it('should parse "DELEGATE TO frontend: Create login UI"', async () => {
      const response = 'I will handle the backend. DELEGATE TO frontend: Create login UI with validation.';
      const delegations = await parser.parse(response, 'backend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('frontend');
      expect(delegations[0]?.task).toBe('Create login UI with validation.');
    });

    it('should parse multiple DELEGATE TO statements', async () => {
      const response = `
        DELEGATE TO frontend: Create UI components.

        DELEGATE TO database: Design schema.
      `;
      const delegations = await parser.parse(response, 'backend');

      expect(delegations).toHaveLength(2);
      expect(delegations[0]?.toAgent).toBe('frontend');
      expect(delegations[0]?.task).toContain('Create UI components');
      expect(delegations[1]?.toAgent).toBe('database');
      expect(delegations[1]?.task).toContain('Design schema');
    });

    it('should handle case-insensitive DELEGATE TO', async () => {
      const response = 'delegate to frontend: Build the UI';
      const delegations = await parser.parse(response, 'backend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('frontend');
    });
  });

  describe('Pattern 2: @agent syntax', () => {
    it('should parse "@frontend: Create login UI"', async () => {
      const response = 'I will handle auth. @frontend: Create login UI with email/password fields.';
      const delegations = await parser.parse(response, 'backend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('frontend');
      expect(delegations[0]?.task).toContain('Create login UI');
    });

    it('should parse "@frontend Create login UI" (no colon)', async () => {
      const response = 'Let me delegate this. @frontend Create responsive login UI.';
      const delegations = await parser.parse(response, 'backend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('frontend');
      expect(delegations[0]?.task).toContain('Create responsive login UI');
    });

    it('should parse multiple @agent mentions', async () => {
      const response = `
        @frontend Create the UI components.

        @backend: Implement the REST API.
      `;
      const delegations = await parser.parse(response, 'coordinator');

      expect(delegations).toHaveLength(2);
      expect(delegations[0]?.toAgent).toBe('frontend');
      expect(delegations[1]?.toAgent).toBe('backend');
    });

    it('should handle agent names with hyphens and underscores', async () => {
      const response = '@user-service: Create user profile API. @data_validator Validate inputs.';
      const delegations = await parser.parse(response, 'backend');

      expect(delegations).toHaveLength(2);
      expect(delegations[0]?.toAgent).toBe('user-service');
      expect(delegations[1]?.toAgent).toBe('data_validator');
    });
  });

  describe('Pattern 3: Please/Request/Ask syntax', () => {
    it('should parse "Please ask frontend to create UI"', async () => {
      const response = 'Please ask frontend to create a responsive login UI.';
      const delegations = await parser.parse(response, 'backend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('frontend');
      expect(delegations[0]?.task).toContain('create a responsive login UI');
    });

    it('should parse "Request backend to implement API"', async () => {
      const response = 'Request backend to implement authentication API with JWT.';
      const delegations = await parser.parse(response, 'coordinator');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('backend');
      expect(delegations[0]?.task).toContain('implement authentication API');
    });

    it('should parse "Request frontend: build UI"', async () => {
      const response = 'Request frontend: build the dashboard UI.';
      const delegations = await parser.parse(response, 'backend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('frontend');
      expect(delegations[0]?.task).toContain('build the dashboard UI');
    });

    it('should handle case-insensitive please/request/ask', async () => {
      const response = 'PLEASE ask frontend to create UI. REQUEST backend: implement API.';
      const delegations = await parser.parse(response, 'coordinator');

      expect(delegations).toHaveLength(2);
      expect(delegations[0]?.toAgent).toBe('frontend');
      expect(delegations[1]?.toAgent).toBe('backend');
    });
  });

  describe('Pattern 4: I need/require syntax', () => {
    it('should parse "I need frontend to handle UI"', async () => {
      const response = 'I need frontend to handle the user interface components.';
      const delegations = await parser.parse(response, 'backend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('frontend');
      expect(delegations[0]?.task).toContain('handle the user interface');
    });

    it('should parse "I require backend to implement auth"', async () => {
      const response = 'I require backend to implement secure authentication.';
      const delegations = await parser.parse(response, 'frontend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('backend');
      expect(delegations[0]?.task).toContain('implement secure authentication');
    });
  });

  describe('Pattern 5: Chinese syntax', () => {
    it('should parse "請 frontend 建立登入 UI"', async () => {
      const response = '我會處理後端。請 frontend 建立登入 UI 和表單驗證。';
      const delegations = await parser.parse(response, 'backend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('frontend');
      expect(delegations[0]?.task).toContain('建立登入 UI');
    });

    it('should parse "委派給 backend：實現 API"', async () => {
      const response = '委派給 backend：實現認證 API 和資料庫整合。';
      const delegations = await parser.parse(response, 'frontend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('backend');
      expect(delegations[0]?.task).toContain('實現認證 API');
    });

    it('should parse mixed Chinese and English', async () => {
      const response = '請 frontend 建立 UI。DELEGATE TO backend: Implement API.';
      const delegations = await parser.parse(response, 'coordinator');

      expect(delegations).toHaveLength(2);
      expect(delegations[0]?.toAgent).toBe('frontend');
      expect(delegations[1]?.toAgent).toBe('backend');
    });
  });

  describe('Edge cases', () => {
    it('should skip self-delegation', async () => {
      const response = 'DELEGATE TO backend: Handle this task.';
      const delegations = await parser.parse(response, 'backend');

      expect(delegations).toHaveLength(0);
    });

    it('should allow multiple delegations to same agent', async () => {
      const response = `
        DELEGATE TO frontend: Create login UI.
        @frontend Build the dashboard.
      `;
      const delegations = await parser.parse(response, 'backend');

      // Should keep both delegations to 'frontend'
      expect(delegations).toHaveLength(2);
      expect(delegations[0]?.toAgent).toBe('frontend');
      expect(delegations[0]?.task).toContain('Create login UI');
      expect(delegations[1]?.toAgent).toBe('frontend');
      expect(delegations[1]?.task).toContain('Build the dashboard');
    });

    it('should skip tasks that are too short', async () => {
      const response = '@frontend: UI';
      const delegations = await parser.parse(response, 'backend');

      // Task "UI" is too short (< 5 chars)
      expect(delegations).toHaveLength(0);
    });

    it('should handle empty response', async () => {
      const delegations = await parser.parse('', 'backend');
      expect(delegations).toHaveLength(0);
    });

    it('should handle response with no delegations', async () => {
      const response = 'I will implement this feature myself without delegating.';
      const delegations = await parser.parse(response, 'backend');

      expect(delegations).toHaveLength(0);
    });

    it('should extract originalText for debugging', async () => {
      const response = 'DELEGATE TO frontend: Create login UI.';
      const delegations = await parser.parse(response, 'backend');

      expect(delegations[0]?.originalText).toBeDefined();
      expect(delegations[0]?.originalText).toContain('DELEGATE TO frontend');
    });

    it('should handle multiple tasks to same agent in order', async () => {
      const response = `
        @frontend Create the header component.

        Some intermediate text here.

        @frontend Also create the footer component.

        @frontend And finally create the navigation menu.
      `;
      const delegations = await parser.parse(response, 'backend');

      expect(delegations).toHaveLength(3);
      expect(delegations[0]?.task).toContain('header component');
      expect(delegations[1]?.task).toContain('footer component');
      expect(delegations[2]?.task).toContain('navigation menu');

      // All should be to frontend
      delegations.forEach(d => {
        expect(d.toAgent).toBe('frontend');
      });
    });

    it('should handle mixed agents with duplicates', async () => {
      const response = `
        @frontend Create UI for login.
        @backend Implement auth API.
        @frontend Create UI for dashboard.
        @database Design user schema.
        @backend Add session management.
      `;
      const delegations = await parser.parse(response, 'coordinator');

      expect(delegations).toHaveLength(5);

      // Check order and agents
      expect(delegations[0]?.toAgent).toBe('frontend');
      expect(delegations[0]?.task).toContain('login');

      expect(delegations[1]?.toAgent).toBe('backend');
      expect(delegations[1]?.task).toContain('auth API');

      expect(delegations[2]?.toAgent).toBe('frontend');
      expect(delegations[2]?.task).toContain('dashboard');

      expect(delegations[3]?.toAgent).toBe('database');
      expect(delegations[3]?.task).toContain('user schema');

      expect(delegations[4]?.toAgent).toBe('backend');
      expect(delegations[4]?.task).toContain('session management');
    });
  });

  describe('Complex scenarios', () => {
    it('should parse multi-line tasks', async () => {
      const response = `
        DELEGATE TO frontend: Create a responsive login UI with the following requirements:
        - Email and password fields
        - Form validation
        - Error handling
      `;
      const delegations = await parser.parse(response, 'backend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('frontend');
      expect(delegations[0]?.task).toContain('Create a responsive login UI');
    });

    it('should handle mixed syntax patterns in same response', async () => {
      const response = `
        I'll coordinate the work:

        DELEGATE TO frontend: Create the UI components.

        @backend Implement REST API.

        Please ask database to design the schema.

        I need security to review the authentication flow.
      `;
      const delegations = await parser.parse(response, 'coordinator');

      expect(delegations).toHaveLength(4);
      expect(delegations.map(d => d.toAgent)).toEqual(['frontend', 'backend', 'database', 'security']);
    });

    it('should handle delegations in narrative context', async () => {
      const response = `
        After analyzing the requirements, I've determined we need specialized help:

        For the user interface, @frontend Create a modern, responsive design with these features:
        - Login form with validation
        - Dashboard layout
        - User profile page

        For the backend, DELEGATE TO backend: Implement secure authentication with JWT and role-based access control.

        For data storage, please ask database to design an optimized schema for user data and sessions.
      `;
      const delegations = await parser.parse(response, 'architect');

      expect(delegations).toHaveLength(3);
      expect(delegations[0]?.toAgent).toBe('frontend');
      expect(delegations[1]?.toAgent).toBe('backend');
      expect(delegations[2]?.toAgent).toBe('database');
    });
  });

  describe('Performance', () => {
    it('should parse large responses efficiently', async () => {
      // Create a large response with multiple delegations
      const lines = [
        'This is a complex project requiring multiple delegations.',
        '',
        'DELEGATE TO frontend: Create comprehensive UI.',
        '',
        ...Array(100).fill('Some intermediate text here.'),
        '',
        '@backend Implement robust API.',
        '',
        ...Array(100).fill('More intermediate text.'),
        '',
        'Please ask database to optimize queries.'
      ];
      const response = lines.join('\n');

      const startTime = Date.now();
      const delegations = await parser.parse(response, 'coordinator');
      const duration = Date.now() - startTime;

      expect(delegations).toHaveLength(3);
      expect(duration).toBeLessThan(10); // Should be < 10ms
    });
  });

  describe('Display Name Resolution (Integration)', () => {
    it('should work without ProfileLoader (uses raw agent names)', async () => {
      const parserWithoutLoader = new DelegationParser();
      const response = '@frontend Create UI components.';
      const delegations = await parserWithoutLoader.parse(response, 'backend');

      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('frontend'); // Raw name, not resolved
    });

    it('should skip invalid agent names when ProfileLoader is not provided', async () => {
      const parserWithoutLoader = new DelegationParser();
      const response = '@nonexistent Create something.';
      const delegations = await parserWithoutLoader.parse(response, 'backend');

      // Without ProfileLoader, we can't validate if agent exists
      // So it will be included (validation happens during execution)
      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('nonexistent');
    });

    it('should resolve display names to agent names with ProfileLoader', async () => {
      // Mock ProfileLoader with display name mapping
      const mockProfileLoader = {
        resolveAgentName: vi.fn().mockImplementation(async (identifier: string) => {
          const mapping: Record<string, string> = {
            'oliver': 'devops',   // Oliver → devops
            'tony': 'cto',        // Tony → cto
            'steve': 'security',  // Steve → security
            'devops': 'devops',   // Direct agent name
            'cto': 'cto',
            'security': 'security'
          };
          const resolved = mapping[identifier.toLowerCase()];
          if (!resolved) {
            throw new AgentNotFoundError(identifier);
          }
          return resolved;
        })
      } as unknown as ProfileLoader;

      const parserWithLoader = new DelegationParser(mockProfileLoader);

      // Test with display name
      const response1 = '@Oliver Create the infrastructure setup.';
      const delegations1 = await parserWithLoader.parse(response1, 'backend');

      expect(delegations1).toHaveLength(1);
      expect(delegations1[0]?.toAgent).toBe('devops'); // Resolved Oliver → devops
      expect(mockProfileLoader.resolveAgentName).toHaveBeenCalledWith('Oliver');
    });

    it('should handle multiple display names in same response', async () => {
      const mockProfileLoader = {
        resolveAgentName: vi.fn().mockImplementation(async (identifier: string) => {
          const mapping: Record<string, string> = {
            'oliver': 'devops',
            'tony': 'cto',
            'steve': 'security'
          };
          const resolved = mapping[identifier.toLowerCase()];
          if (!resolved) {
            throw new AgentNotFoundError(identifier);
          }
          return resolved;
        })
      } as unknown as ProfileLoader;

      const parserWithLoader = new DelegationParser(mockProfileLoader);

      const response = `
        @Oliver Setup the CI/CD pipeline.
        @Tony Review the technical architecture.
        @Steve Conduct security audit.
      `;
      const delegations = await parserWithLoader.parse(response, 'coordinator');

      expect(delegations).toHaveLength(3);
      expect(delegations[0]?.toAgent).toBe('devops');
      expect(delegations[1]?.toAgent).toBe('cto');
      expect(delegations[2]?.toAgent).toBe('security');
    });

    it('should skip delegations when agent not found via ProfileLoader', async () => {
      const mockProfileLoader = {
        resolveAgentName: vi.fn().mockImplementation(async (identifier: string) => {
          if (identifier.toLowerCase() === 'frontend') {
            return 'frontend';
          }
          throw new AgentNotFoundError(identifier);
        })
      } as unknown as ProfileLoader;

      const parserWithLoader = new DelegationParser(mockProfileLoader);

      const response = `
        @frontend Create UI.
        @nonexistent Do something.
        @backend Create API.
      `;
      const delegations = await parserWithLoader.parse(response, 'coordinator');

      // Only frontend should be included, others skipped
      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('frontend');
    });

    it('should handle case-insensitive display names', async () => {
      const mockProfileLoader = {
        resolveAgentName: vi.fn().mockImplementation(async (identifier: string) => {
          if (identifier.toLowerCase() === 'oliver') {
            return 'devops';
          }
          throw new AgentNotFoundError(identifier);
        })
      } as unknown as ProfileLoader;

      const parserWithLoader = new DelegationParser(mockProfileLoader);

      // Test different cases
      const responses = [
        '@oliver Create infrastructure.',   // lowercase
        '@Oliver Create infrastructure.',   // capitalized
        '@OLIVER Create infrastructure.',   // uppercase
        '@oLiVeR Create infrastructure.'    // mixed case
      ];

      for (const response of responses) {
        const delegations = await parserWithLoader.parse(response, 'backend');
        expect(delegations).toHaveLength(1);
        expect(delegations[0]?.toAgent).toBe('devops');
      }
    });
  });

  describe('Documentation Example Filtering (v5.0.1)', () => {
    it('should skip delegations in quoted text', async () => {
      const response = `
        Here are some examples of delegation syntax:
        1. "DELEGATE TO frontend: Create login UI"
        2. "@frontend Create login UI"
        3. "Please ask backend to implement auth API"

        These are just examples, not actual delegations.
      `;
      const delegations = await parser.parse(response, 'coordinator');

      // Should not parse any of the quoted examples
      expect(delegations).toHaveLength(0);
    });

    it('should skip delegations in documentation examples', async () => {
      const response = `
        Supported syntaxes for delegation:
        1. @frontend Create UI
        2. DELEGATE TO backend: Implement API
        3. Please ask database to design schema
      `;
      const delegations = await parser.parse(response, 'coordinator');

      // Should skip examples after "Supported syntaxes:" with numbered list
      expect(delegations).toHaveLength(0);
    });

    it('should skip delegations in test code patterns', async () => {
      const response = `
        it('should parse "@frontend Create UI"', async () => {
          const response = '@frontend Create login component';
          expect(result).toBeTruthy();
        });
      `;
      const delegations = await parser.parse(response, 'backend');

      // Should skip test code
      expect(delegations).toHaveLength(0);
    });

    it('should parse actual delegations but skip examples', async () => {
      const response = `
        I'll delegate this task to the frontend team.

        @frontend Create the user dashboard with real-time updates.

        Example delegation syntax:
        "@frontend Create login UI"

        The above is just an example.
      `;
      const delegations = await parser.parse(response, 'coordinator');

      // Should parse only the actual delegation, not the example
      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.toAgent).toBe('frontend');
      expect(delegations[0]?.task).toContain('dashboard');
    });

    it('should handle numbered lists with quoted examples', async () => {
      const response = `
        Delegation patterns:
        1. "@frontend Create UI"
        2. "DELEGATE TO backend: API"
        3. "Request database: schema"
      `;
      const delegations = await parser.parse(response, 'coordinator');

      // Should skip all numbered list examples
      expect(delegations).toHaveLength(0);
    });
  });
});
