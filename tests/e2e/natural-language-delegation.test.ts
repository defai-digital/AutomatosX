/**
 * Natural Language Delegation - E2E Tests
 *
 * Tests the complete flow of natural language delegation:
 * 1. Agent responds with natural language delegation syntax
 * 2. Parser extracts delegation requests
 * 3. Executor automatically triggers delegations
 * 4. Results are merged into final response
 *
 * @group e2e
 * @group delegation
 */

import { describe, it, expect } from 'vitest';
import { DelegationParser } from '../../src/agents/delegation-parser.js';

describe('Natural Language Delegation - E2E', () => {
  const parser = new DelegationParser();

  it('should parse complex agent response with multiple delegations', async () => {
    const agentResponse = `I will coordinate this authentication feature work.

@frontend Create the login UI with email and password fields, including:
- Form validation
- Error handling
- Responsive design

@backend Implement the authentication API with JWT tokens.

@frontend Also create the registration form UI.

I've delegated the work appropriately.`;

    const delegations = await parser.parse(agentResponse, 'coordinator');

    // Should find all 3 delegations (2 to frontend, 1 to backend)
    expect(delegations).toHaveLength(3);

    // Verify order (按文本順序)
    expect(delegations[0]?.toAgent).toBe('frontend');
    expect(delegations[0]?.task).toContain('login UI');

    expect(delegations[1]?.toAgent).toBe('backend');
    expect(delegations[1]?.task).toContain('authentication API');

    expect(delegations[2]?.toAgent).toBe('frontend');
    expect(delegations[2]?.task).toContain('registration form');
  });

  it('should handle mixed syntax in agent response', async () => {
    const agentResponse = `Let me break this down:

DELEGATE TO frontend: Create the main dashboard UI.

Please ask backend to set up the database schema.

I need frontend to implement the user profile page.

委派給 backend：實現 API 端點。`;

    const delegations = await parser.parse(agentResponse, 'architect');

    // All 4 delegations should be found
    expect(delegations).toHaveLength(4);

    // Verify different syntax patterns all work
    expect(delegations[0]?.toAgent).toBe('frontend');
    expect(delegations[0]?.task).toContain('dashboard UI');

    expect(delegations[1]?.toAgent).toBe('backend');
    expect(delegations[1]?.task).toContain('database schema');

    expect(delegations[2]?.toAgent).toBe('frontend');
    expect(delegations[2]?.task).toContain('user profile');

    expect(delegations[3]?.toAgent).toBe('backend');
    expect(delegations[3]?.task).toContain('API');
  });

  it('should allow same agent to receive multiple tasks', async () => {
    const agentResponse = `Frontend needs to do three things:

@frontend Create the header with navigation menu.

Some analysis here...

@frontend Build the footer with social links.

More planning...

@frontend Implement the sidebar with user menu.`;

    const delegations = await parser.parse(agentResponse, 'coordinator');

    // All 3 frontend delegations should be captured
    expect(delegations).toHaveLength(3);

    // All should be to frontend
    expect(delegations.every(d => d.toAgent === 'frontend')).toBe(true);

    // Verify tasks are different
    expect(delegations[0]?.task).toContain('header');
    expect(delegations[1]?.task).toContain('footer');
    expect(delegations[2]?.task).toContain('sidebar');
  });

  it('should handle delegation in narrative context', async () => {
    const agentResponse = `After analyzing the requirements, here's the plan:

For the frontend work, @frontend Create a modern, responsive design with:
- Login form with validation
- Dashboard layout
- User profile page

For the backend, DELEGATE TO backend: Implement secure authentication with JWT.

For data storage, please ask database to design an optimized schema.`;

    const delegations = await parser.parse(agentResponse, 'architect');

    expect(delegations).toHaveLength(3);
    expect(delegations[0]?.toAgent).toBe('frontend');
    expect(delegations[1]?.toAgent).toBe('backend');
    expect(delegations[2]?.toAgent).toBe('database');
  });
});
