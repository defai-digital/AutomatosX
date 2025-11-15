/**
 * workflow.ts
 *
 * CLI commands for workflow management
 * Phase 4 Week 2: Workflow Engine & Orchestration
 */
import { Command } from 'commander';
import { WorkflowEngine } from '../../services/WorkflowEngine.js';
import { WorkflowDAO } from '../../database/dao/WorkflowDAO.js';
import { CheckpointService } from '../../services/CheckpointService.js';
import chalk from 'chalk';
/**
 * Create workflow command with subcommands
 */
export function createWorkflowCommand() {
    const workflow = new Command('workflow')
        .description('Manage and execute declarative workflows');
    // Subcommands
    workflow.addCommand(createRunCommand());
    workflow.addCommand(createListCommand());
    workflow.addCommand(createStatusCommand());
    workflow.addCommand(createPauseCommand());
    workflow.addCommand(createResumeCommand());
    workflow.addCommand(createCancelCommand());
    workflow.addCommand(createCheckpointsCommand());
    return workflow;
}
/**
 * Run workflow from file
 */
function createRunCommand() {
    return new Command('run')
        .description('Execute a workflow from YAML/JSON file')
        .argument('<file>', 'Path to workflow definition file (.yaml, .yml, or .json)')
        .option('--context <json>', 'Initial context as JSON string')
        .option('--triggered-by <name>', 'Who/what triggered this execution')
        .option('--priority <number>', 'Execution priority (higher = more important)', parseInt)
        .option('--iterate', 'Enable autonomous retry loop with adaptive strategies')
        .option('--max-iterations <number>', 'Maximum retry iterations (default: 10)', parseInt)
        .option('--safety <level>', 'Safety level: permissive, normal, paranoid (default: normal)', 'normal')
        .option('--max-cost <amount>', 'Maximum cost limit in USD', parseFloat)
        .option('--timeout <seconds>', 'Total timeout in seconds', parseInt)
        .action(async (file, options) => {
        try {
            // Iterate mode
            if (options.iterate) {
                await runWithIterate(file, options);
            }
            else {
                // Normal execution
                await runNormal(file, options);
            }
        }
        catch (error) {
            console.error(chalk.red('\n✗ Workflow execution failed'));
            console.error(error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });
}
/**
 * Run workflow normally (without iterate)
 */
async function runNormal(file, options) {
    console.log(chalk.blue(`\nExecuting workflow from: ${file}`));
    const engine = new WorkflowEngine();
    // Parse context if provided
    let context = {};
    if (options.context) {
        try {
            context = JSON.parse(options.context);
        }
        catch (error) {
            console.error(chalk.red('Invalid context JSON'));
            process.exit(1);
        }
    }
    // Execute workflow
    const result = await engine.executeWorkflowFromFile(file, {
        context,
        triggeredBy: options.triggeredBy || 'cli',
        priority: options.priority || 0,
    });
    console.log(chalk.green('\n✓ Workflow completed successfully'));
    console.log(chalk.gray('Execution ID:'), result.executionId);
    console.log(chalk.gray('Workflow:'), result.workflowName);
    console.log(chalk.gray('State:'), result.state);
    console.log(chalk.gray('Duration:'), result.durationMs ? `${result.durationMs}ms` : 'N/A');
    console.log(chalk.gray('Steps:'), Object.keys(result.stepResults).length);
}
/**
 * Run workflow with iterate mode
 */
async function runWithIterate(file, options) {
    // Dynamic import to avoid circular dependencies
    const { IterateEngine } = await import('../../services/IterateEngine.js');
    const { WorkflowEngineV2 } = await import('../../services/WorkflowEngineV2.js');
    const { CheckpointServiceV2 } = await import('../../services/CheckpointServiceV2.js');
    const { getDatabase } = await import('../../database/connection.js');
    console.log(chalk.blue(`\n🔄 Executing workflow with Iterate Mode: ${file}`));
    // Initialize services
    const db = getDatabase();
    const workflowEngine = new WorkflowEngineV2(db);
    const checkpointService = new CheckpointServiceV2(db);
    // Create iterate engine
    const iterateEngine = new IterateEngine(workflowEngine, checkpointService);
    // Parse iterate options
    const iterateOptions = {
        maxIterations: options.maxIterations || 10,
        safetyLevel: (options.safety || 'normal'),
        maxCost: options.maxCost,
        timeout: options.timeout ? options.timeout * 1000 : undefined,
        verbose: true,
        onIteration: (iteration) => {
            // Callback for iteration progress
            if (iteration.success) {
                console.log(chalk.green(`   ✓ Iteration ${iteration.iteration} succeeded`));
            }
        }
    };
    // Execute with iterate
    const result = await iterateEngine.iterate(file, iterateOptions);
    // Display results
    if (result.success) {
        console.log(chalk.green.bold('\n✅ Workflow completed successfully with Iterate Mode!'));
    }
    else {
        console.log(chalk.red.bold('\n❌ Workflow failed after all iterations'));
    }
    console.log(chalk.gray('\nResults:'));
    console.log(chalk.gray('  Iterations:'), result.iterations);
    console.log(chalk.gray('  Duration:'), `${Math.round(result.totalDuration / 1000)}s`);
    console.log(chalk.gray('  Total Cost:'), `$${result.totalCost.toFixed(2)}`);
    console.log(chalk.gray('  Final Strategy:'), result.finalStrategy.name);
    console.log(chalk.gray('  Stop Reason:'), result.stopReason);
    if (!result.success) {
        process.exit(1);
    }
}
/**
 * List all workflows
 */
function createListCommand() {
    return new Command('list')
        .description('List all available workflows')
        .option('--format <format>', 'Output format (table|json)', 'table')
        .action(async (options) => {
        try {
            const dao = new WorkflowDAO();
            const workflows = dao.listWorkflows();
            if (options.format === 'json') {
                console.log(JSON.stringify(workflows, null, 2));
                return;
            }
            // Table format
            console.log(chalk.blue('\nAvailable Workflows:\n'));
            if (workflows.length === 0) {
                console.log(chalk.gray('No workflows found'));
                return;
            }
            workflows.forEach(wf => {
                console.log(chalk.bold(wf.name), chalk.gray(`(v${wf.version})`));
                if (wf.description) {
                    console.log(chalk.gray(`  ${wf.description}`));
                }
                console.log(chalk.gray(`  Executions: ${wf.totalExecutions} | Success rate: ${Math.round((wf.successfulExecutions / wf.totalExecutions) * 100)}%`));
                console.log();
            });
        }
        catch (error) {
            console.error(chalk.red('Error listing workflows:'), error);
            process.exit(1);
        }
    });
}
/**
 * Show workflow execution status
 */
function createStatusCommand() {
    return new Command('status')
        .description('Show workflow execution status')
        .argument('<execution-id>', 'Workflow execution ID')
        .option('--format <format>', 'Output format (table|json)', 'table')
        .action(async (executionId, options) => {
        try {
            const engine = new WorkflowEngine();
            const status = await engine.getExecutionStatus(executionId);
            if (options.format === 'json') {
                console.log(JSON.stringify(status, null, 2));
                return;
            }
            // Table format
            console.log(chalk.blue('\nWorkflow Execution Status:\n'));
            console.log(chalk.gray('Execution ID:'), executionId);
            console.log(chalk.gray('Workflow:'), status.workflowName);
            console.log(chalk.gray('State:'), getStateColor(status.state)(status.state));
            console.log(chalk.gray('Steps:'), `${status.stepsCompleted}/${status.stepsTotal} completed`);
            if (status.stepsFailed > 0) {
                console.log(chalk.red('Failed steps:'), status.stepsFailed);
            }
            if (status.startedAt) {
                console.log(chalk.gray('Started:'), new Date(status.startedAt).toISOString());
            }
            if (status.completedAt) {
                console.log(chalk.gray('Completed:'), new Date(status.completedAt).toISOString());
            }
            if (status.duration) {
                console.log(chalk.gray('Duration:'), `${status.duration}ms`);
            }
            if (status.error) {
                console.log(chalk.red('\nError:'), status.error);
            }
        }
        catch (error) {
            console.error(chalk.red('Error getting status:'), error);
            process.exit(1);
        }
    });
}
/**
 * Pause workflow execution
 */
function createPauseCommand() {
    return new Command('pause')
        .description('Pause a running workflow execution')
        .argument('<execution-id>', 'Workflow execution ID')
        .action(async (executionId) => {
        try {
            const engine = new WorkflowEngine();
            await engine.pauseWorkflow(executionId);
            console.log(chalk.green(`\n✓ Workflow execution paused: ${executionId}`));
            console.log(chalk.gray('Use "ax workflow resume" to continue execution'));
        }
        catch (error) {
            console.error(chalk.red('\n✗ Failed to pause workflow:'), error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });
}
/**
 * Resume workflow execution
 */
function createResumeCommand() {
    return new Command('resume')
        .description('Resume a paused workflow execution from latest checkpoint')
        .argument('<execution-id>', 'Workflow execution ID')
        .action(async (executionId) => {
        try {
            console.log(chalk.blue(`\nResuming workflow execution: ${executionId}`));
            const checkpointService = new CheckpointService();
            const checkpoint = await checkpointService.getLatestCheckpoint(executionId);
            if (!checkpoint) {
                console.error(chalk.red('No checkpoint found for this execution'));
                process.exit(1);
            }
            const engine = new WorkflowEngine();
            const result = await engine.resumeWorkflow(checkpoint.id);
            console.log(chalk.green('\n✓ Workflow resumed and completed successfully'));
            console.log(chalk.gray('State:'), result.state);
            console.log(chalk.gray('Duration:'), result.durationMs ? `${result.durationMs}ms` : 'N/A');
        }
        catch (error) {
            console.error(chalk.red('\n✗ Failed to resume workflow:'), error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });
}
/**
 * Cancel workflow execution
 */
function createCancelCommand() {
    return new Command('cancel')
        .description('Cancel a running workflow execution')
        .argument('<execution-id>', 'Workflow execution ID')
        .action(async (executionId) => {
        try {
            const engine = new WorkflowEngine();
            await engine.cancelWorkflow(executionId);
            console.log(chalk.green(`\n✓ Workflow execution cancelled: ${executionId}`));
        }
        catch (error) {
            console.error(chalk.red('\n✗ Failed to cancel workflow:'), error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });
}
/**
 * List checkpoints for execution
 */
function createCheckpointsCommand() {
    return new Command('checkpoints')
        .description('List checkpoints for a workflow execution')
        .argument('<execution-id>', 'Workflow execution ID')
        .option('--limit <number>', 'Maximum number of checkpoints to show', parseInt, 10)
        .option('--format <format>', 'Output format (table|json)', 'table')
        .action(async (executionId, options) => {
        try {
            const checkpointService = new CheckpointService();
            const checkpoints = await checkpointService.listCheckpoints(executionId, options.limit);
            if (options.format === 'json') {
                console.log(JSON.stringify(checkpoints, null, 2));
                return;
            }
            // Table format
            console.log(chalk.blue(`\nCheckpoints for execution: ${executionId}\n`));
            if (checkpoints.length === 0) {
                console.log(chalk.gray('No checkpoints found'));
                return;
            }
            checkpoints.forEach((cp, index) => {
                const age = Date.now() - cp.createdAt;
                const ageStr = age < 60000
                    ? `${Math.floor(age / 1000)}s ago`
                    : age < 3600000
                        ? `${Math.floor(age / 60000)}m ago`
                        : `${Math.floor(age / 3600000)}h ago`;
                console.log(chalk.bold(`${index + 1}. Checkpoint ${cp.id.slice(0, 8)}...`));
                console.log(chalk.gray(`   State: ${cp.state} | Created: ${ageStr} | By: ${cp.createdBy}`));
                if (cp.label) {
                    console.log(chalk.gray(`   Label: ${cp.label}`));
                }
                console.log(chalk.gray(`   Size: ${(cp.sizeBytes || 0 / 1024).toFixed(2)} KB`));
                console.log();
            });
            console.log(chalk.gray(`\nUse "ax workflow resume ${executionId}" to resume from latest checkpoint`));
        }
        catch (error) {
            console.error(chalk.red('Error listing checkpoints:'), error);
            process.exit(1);
        }
    });
}
/**
 * Get colored state text
 */
function getStateColor(state) {
    switch (state) {
        case 'completed':
            return chalk.green;
        case 'failed':
        case 'cancelled':
            return chalk.red;
        case 'executing':
        case 'running':
            return chalk.blue;
        case 'paused':
            return chalk.yellow;
        default:
            return chalk.gray;
    }
}
//# sourceMappingURL=workflow.js.map