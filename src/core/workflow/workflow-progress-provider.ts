/**
 * Workflow Progress Provider
 *
 * Provides progress tracking instructions for workflow template execution.
 * Injects step progress reminders showing current position in the workflow.
 *
 * @since v11.3.1
 */

import { logger } from '../../shared/logging/logger.js';
import {
  type EmbeddedInstruction,
  type InstructionProvider,
  type OrchestrationContext,
  INSTRUCTION_SOURCE
} from '../orchestration/types.js';

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  /** Step name */
  name: string;
  /** Agent assigned to this step */
  agent: string;
  /** Task description */
  task: string;
  /** Step status */
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  /** Completion timestamp */
  completedAt?: number;
}

/**
 * Active workflow state
 */
export interface ActiveWorkflow {
  /** Workflow template name */
  name: string;
  /** Workflow steps */
  steps: WorkflowStep[];
  /** Current step index (0-based) */
  currentStepIndex: number;
  /** Start timestamp */
  startedAt: number;
  /** Whether workflow is complete */
  isComplete: boolean;
}

/**
 * Configuration for WorkflowProgressProvider
 */
export interface WorkflowProgressConfig {
  /** Whether the provider is enabled */
  enabled: boolean;
  /** Include progress bar visualization */
  showProgressBar: boolean;
  /** Include estimated remaining steps */
  showRemaining: boolean;
  /** Include completed steps summary */
  showCompletedSteps: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: WorkflowProgressConfig = {
  enabled: true,
  showProgressBar: true,
  showRemaining: true,
  showCompletedSteps: true
};

/**
 * Workflow Progress Provider
 *
 * Tracks and injects workflow progress instructions.
 */
export class WorkflowProgressProvider implements InstructionProvider {
  readonly name = 'workflow-progress';

  private config: WorkflowProgressConfig;
  private activeWorkflow: ActiveWorkflow | null = null;
  private lastInjectedStep: number = -1;

  constructor(config?: Partial<WorkflowProgressConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config
    };

    logger.debug('WorkflowProgressProvider initialized', {
      enabled: this.config.enabled
    });
  }

  /**
   * Start tracking a workflow
   */
  startWorkflow(name: string, steps: Array<{ name: string; agent: string; task: string }>): void {
    this.activeWorkflow = {
      name,
      steps: steps.map(step => ({
        ...step,
        status: 'pending'
      })),
      currentStepIndex: 0,
      startedAt: Date.now(),
      isComplete: false
    };

    // Mark first step as in_progress
    const firstStep = this.activeWorkflow.steps[0];
    if (firstStep) {
      firstStep.status = 'in_progress';
    }

    this.lastInjectedStep = -1;

    logger.info('Workflow started', {
      name,
      totalSteps: steps.length
    });
  }

  /**
   * Complete the current step and advance to next
   */
  completeCurrentStep(): boolean {
    return this.advanceStep('completed');
  }

  /**
   * Skip the current step
   */
  skipCurrentStep(): boolean {
    return this.advanceStep('skipped');
  }

  /**
   * Advance to the next step with the given status for the current step
   */
  private advanceStep(status: 'completed' | 'skipped'): boolean {
    if (!this.activeWorkflow || this.activeWorkflow.isComplete) {
      return false;
    }

    const currentStep = this.activeWorkflow.steps[this.activeWorkflow.currentStepIndex];
    if (currentStep) {
      currentStep.status = status;
      if (status === 'completed') {
        currentStep.completedAt = Date.now();
      }
    }

    this.activeWorkflow.currentStepIndex++;

    if (this.activeWorkflow.currentStepIndex >= this.activeWorkflow.steps.length) {
      this.activeWorkflow.isComplete = true;
      if (status === 'completed') {
        logger.info('Workflow completed', {
          name: this.activeWorkflow.name,
          totalSteps: this.activeWorkflow.steps.length
        });
      }
    } else {
      const nextStep = this.activeWorkflow.steps[this.activeWorkflow.currentStepIndex];
      if (nextStep) {
        nextStep.status = 'in_progress';
      }
    }

    return true;
  }

  /**
   * Get the active workflow state
   */
  getActiveWorkflow(): ActiveWorkflow | null {
    return this.activeWorkflow;
  }

  /**
   * Clear the active workflow
   */
  clearWorkflow(): void {
    this.activeWorkflow = null;
    this.lastInjectedStep = -1;
    logger.debug('Workflow cleared');
  }

  /**
   * Check if provider should generate instructions
   */
  shouldGenerate(_context: OrchestrationContext): boolean {
    if (!this.config.enabled || !this.activeWorkflow) {
      return false;
    }

    // Only generate if we've moved to a new step
    return this.activeWorkflow.currentStepIndex !== this.lastInjectedStep;
  }

  /**
   * Generate workflow progress instructions
   */
  async getInstructions(context: OrchestrationContext): Promise<EmbeddedInstruction[]> {
    if (!this.activeWorkflow) {
      return [];
    }

    const instructions: EmbeddedInstruction[] = [];
    const content = this.formatProgressInstruction();

    if (content) {
      instructions.push({
        type: 'task',
        priority: 'high',
        content,
        source: INSTRUCTION_SOURCE,
        createdAt: Date.now(),
        createdAtTurn: context.turnCount,
        expiresAfter: 10,
        id: `workflow-progress-${this.activeWorkflow.name}-${Date.now()}`
      });

      this.lastInjectedStep = this.activeWorkflow.currentStepIndex;
    }

    return instructions;
  }

  /**
   * Format the progress instruction content
   */
  private formatProgressInstruction(): string | null {
    if (!this.activeWorkflow) {
      return null;
    }

    const { name, steps, currentStepIndex, isComplete } = this.activeWorkflow;
    const totalSteps = steps.length;

    if (isComplete) {
      return this.formatCompletionMessage(name, totalSteps);
    }

    const currentStep = steps[currentStepIndex];
    if (!currentStep) {
      return null;
    }

    const lines: string[] = [];

    // Header with workflow name
    lines.push(`## Workflow Progress: ${name}`);
    lines.push('');

    // Progress bar (if enabled)
    if (this.config.showProgressBar) {
      const completedCount = steps.filter(s => s.status === 'completed' || s.status === 'skipped').length;
      const progressBar = this.generateProgressBar(completedCount, totalSteps);
      lines.push(progressBar);
      lines.push('');
    }

    // Current step info
    lines.push(`**Current Step (${currentStepIndex + 1}/${totalSteps}):** ${currentStep.name}`);
    lines.push(`- Agent: @${currentStep.agent}`);
    lines.push(`- Task: ${currentStep.task}`);
    lines.push('');

    // Completed steps (if enabled)
    if (this.config.showCompletedSteps && currentStepIndex > 0) {
      const completed = steps.slice(0, currentStepIndex).filter(s => s.status === 'completed');
      if (completed.length > 0) {
        lines.push('**Completed:**');
        for (const step of completed.slice(-3)) { // Show last 3 completed
          lines.push(`- [x] ${step.name}`);
        }
        lines.push('');
      }
    }

    // Remaining steps (if enabled)
    if (this.config.showRemaining && currentStepIndex < totalSteps - 1) {
      const remaining = steps.slice(currentStepIndex + 1);
      lines.push('**Next:**');
      for (const step of remaining.slice(0, 2)) { // Show next 2 steps
        lines.push(`- [ ] ${step.name} (@${step.agent})`);
      }
      if (remaining.length > 2) {
        lines.push(`- ... and ${remaining.length - 2} more step(s)`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate a visual progress bar
   */
  private generateProgressBar(completed: number, total: number): string {
    const barLength = 20;

    // Guard against division by zero
    if (total <= 0) {
      const empty = '\u2591'.repeat(barLength);
      return `Progress: [${empty}] 0% (0/0 steps)`;
    }

    const filledLength = Math.round((completed / total) * barLength);
    const emptyLength = barLength - filledLength;
    const percent = Math.round((completed / total) * 100);

    const filled = '\u2588'.repeat(filledLength);  // Full block
    const empty = '\u2591'.repeat(emptyLength);    // Light shade

    return `Progress: [${filled}${empty}] ${percent}% (${completed}/${total} steps)`;
  }

  /**
   * Format completion message
   */
  private formatCompletionMessage(name: string, totalSteps: number): string {
    const lines = [
      `## Workflow Complete: ${name}`,
      '',
      this.generateProgressBar(totalSteps, totalSteps),
      '',
      `All ${totalSteps} steps have been completed.`,
      '',
      'Review the results and verify all objectives were met.'
    ];

    return lines.join('\n');
  }

  /**
   * Get current configuration
   */
  getConfig(): WorkflowProgressConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<WorkflowProgressConfig>): void {
    this.config = {
      ...this.config,
      ...updates
    };

    logger.debug('WorkflowProgressProvider config updated', {
      enabled: this.config.enabled
    });
  }

  /**
   * Reset state
   */
  reset(): void {
    this.activeWorkflow = null;
    this.lastInjectedStep = -1;
    logger.debug('WorkflowProgressProvider reset');
  }
}
