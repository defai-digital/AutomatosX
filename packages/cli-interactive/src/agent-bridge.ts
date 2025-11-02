/**
 * Agent Bridge
 *
 * Bridges the interactive CLI with AutomatosX agent system
 * Handles agent delegation and execution
 */

import type { AgentDelegation } from './types.js';

export interface AgentExecutionResult {
  success: boolean;
  output: string;
  agent: string;
  task: string;
  error?: Error;
}

/**
 * Mock Agent Executor for testing
 */
class MockAgentExecutor {
  async execute(delegation: AgentDelegation): Promise<AgentExecutionResult> {
    // Simulate agent execution time
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Generate mock output based on agent type
    const outputs: Record<string, string> = {
      backend: this.generateBackendOutput(delegation.task),
      frontend: this.generateFrontendOutput(delegation.task),
      security: this.generateSecurityOutput(delegation.task),
      quality: this.generateQualityOutput(delegation.task),
      devops: this.generateDevOpsOutput(delegation.task)
    };

    const output = outputs[delegation.agent.toLowerCase()] ||
      `[@${delegation.agent}] Task acknowledged: ${delegation.task}\n\n` +
      `This is simulated agent execution for testing.\n` +
      `Real agent integration will execute actual AutomatosX agents.`;

    return {
      success: true,
      output,
      agent: delegation.agent,
      task: delegation.task
    };
  }

  private generateBackendOutput(task: string): string {
    return `[@backend] Starting backend task: ${task}\n\n` +
      `Step 1/3: Analyzing requirements...\n` +
      `✓ Requirements analyzed\n\n` +
      `Step 2/3: Implementing solution...\n` +
      `✓ Implementation complete\n\n` +
      `Step 3/3: Testing...\n` +
      `✓ Tests passing\n\n` +
      `Backend task completed successfully!\n\n` +
      `Note: This is simulated output. Real integration will execute actual backend agent.`;
  }

  private generateFrontendOutput(task: string): string {
    return `[@frontend] Starting frontend task: ${task}\n\n` +
      `✓ Created component structure\n` +
      `✓ Added styles\n` +
      `✓ Implemented user interactions\n` +
      `✓ Added responsive design\n\n` +
      `Frontend task completed!\n\n` +
      `Note: This is simulated output.`;
  }

  private generateSecurityOutput(task: string): string {
    return `[@security] Security analysis: ${task}\n\n` +
      `Running security checks...\n` +
      `✓ No SQL injection vulnerabilities found\n` +
      `✓ No XSS vulnerabilities found\n` +
      `✓ Authentication properly implemented\n` +
      `✓ Authorization checks in place\n\n` +
      `Security scan complete. No critical issues found.\n\n` +
      `Note: This is simulated output.`;
  }

  private generateQualityOutput(task: string): string {
    return `[@quality] Quality check: ${task}\n\n` +
      `Running code review...\n` +
      `✓ Code style consistent\n` +
      `✓ Tests coverage >80%\n` +
      `✓ No code smells detected\n` +
      `✓ Documentation complete\n\n` +
      `Quality check passed!\n\n` +
      `Note: This is simulated output.`;
  }

  private generateDevOpsOutput(task: string): string {
    return `[@devops] DevOps task: ${task}\n\n` +
      `✓ CI/CD pipeline configured\n` +
      `✓ Deployment scripts created\n` +
      `✓ Monitoring set up\n` +
      `✓ Infrastructure as code updated\n\n` +
      `DevOps task completed!\n\n` +
      `Note: This is simulated output.`;
  }
}

/**
 * Real Agent Executor (integrates with AutomatosX)
 */
class RealAgentExecutor {
  async execute(delegation: AgentDelegation): Promise<AgentExecutionResult> {
    try {
      // Dynamic import at runtime only - TypeScript won't check these at compile time
      const profileLoaderModule = await import('../../../src/agents/profile-loader.js') as any;
      const agentExecutorModule = await import('../../../src/agents/executor.js') as any;
      const routerModule = await import('../../../src/core/router.js') as any;
      const configModule = await import('../../../src/core/config.js') as any;

      // Load configuration
      const config = await configModule.loadConfig();

      // Initialize router with providers
      const router = new routerModule.Router();

      // Load agent profile
      const profileLoader = new profileLoaderModule.ProfileLoader();
      const profile = await profileLoader.load(delegation.agent);

      if (!profile) {
        throw new Error(`Agent "${delegation.agent}" not found`);
      }

      // Execute agent
      const executor = new agentExecutorModule.AgentExecutor(profile, router);
      const result = await executor.execute(delegation.task, {
        verbose: true
      });

      return {
        success: true,
        output: result.output || result.result || 'Agent execution completed',
        agent: delegation.agent,
        task: delegation.task
      };

    } catch (error) {
      return {
        success: false,
        output: `Failed to execute agent: ${(error as Error).message}`,
        agent: delegation.agent,
        task: delegation.task,
        error: error as Error
      };
    }
  }
}

/**
 * Agent executor that automatically chooses mock or real based on environment
 */
export class AgentExecutorBridge {
  private useMock: boolean;
  private executor: MockAgentExecutor | RealAgentExecutor;

  constructor(useMock = true) {
    this.useMock = useMock;
    this.executor = useMock ? new MockAgentExecutor() : new RealAgentExecutor();
  }

  async execute(delegation: AgentDelegation): Promise<AgentExecutionResult> {
    return this.executor.execute(delegation);
  }

  /**
   * Check if agent is available
   */
  async isAgentAvailable(agentName: string): Promise<boolean> {
    if (this.useMock) {
      // Mock mode: All common agents are available
      const availableAgents = ['backend', 'frontend', 'security', 'quality', 'devops', 'data', 'ml'];
      return availableAgents.includes(agentName.toLowerCase());
    }

    try {
      // Check if agent profile exists
      const profileLoaderModule = await import('../../../src/agents/profile-loader.js') as any;
      const profileLoader = new profileLoaderModule.ProfileLoader();
      const profile = await profileLoader.load(agentName);
      return profile !== null;
    } catch {
      return false;
    }
  }

  /**
   * List all available agents
   */
  async listAgents(): Promise<Array<{ name: string; description?: string }>> {
    if (this.useMock) {
      // Mock mode: Return common agents
      return [
        { name: 'backend', description: 'Backend development and API implementation' },
        { name: 'frontend', description: 'Frontend development and UI/UX' },
        { name: 'security', description: 'Security audits and vulnerability analysis' },
        { name: 'quality', description: 'Code review and testing' },
        { name: 'devops', description: 'DevOps, deployment, and infrastructure' },
        { name: 'data', description: 'Data analysis and database operations' },
        { name: 'ml', description: 'Machine learning and AI tasks' }
      ];
    }

    try {
      // List real agents
      const profileLoaderModule = await import('../../../src/agents/profile-loader.js') as any;
      const profileLoader = new profileLoaderModule.ProfileLoader();
      const agents = await profileLoader.listAll();
      return agents.map((agent: any) => ({
        name: agent.name,
        description: agent.persona
      }));
    } catch (error) {
      console.error('[AgentBridge] Failed to list agents:', error);
      return [];
    }
  }
}

/**
 * Get agent executor based on environment
 */
export function getAgentExecutor(): AgentExecutorBridge {
  const useMock = process.env.AUTOMATOSX_MOCK_PROVIDERS !== 'false';
  return new AgentExecutorBridge(useMock);
}
