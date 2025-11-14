/**
 * AutomatosX v8.0.0 - Agent Command
 *
 * Set active agent for conversation
 */
import chalk from 'chalk';
/**
 * Agent Command
 *
 * Sets the active agent for the conversation
 * Usage:
 *   /agent <name>     - Set active agent
 *   /agent clear      - Clear active agent
 *   /agent            - Show current active agent
 */
export class AgentCommand {
    name = 'agent';
    description = 'Set active agent';
    usage = '/agent [name|clear]';
    aliases = [];
    // ConversationContext will be injected by REPLSession
    conversationContext;
    setConversationContext(context) {
        this.conversationContext = context;
    }
    async execute(args, context) {
        if (!this.conversationContext) {
            console.log(chalk.red('\n❌ No conversation context available\n'));
            return;
        }
        // No args - show current active agent
        if (args.length === 0) {
            const activeAgent = this.conversationContext.getActiveAgent();
            if (activeAgent) {
                console.log(chalk.cyan(`\n🤖 Active Agent: ${chalk.bold(activeAgent)}\n`));
            }
            else {
                console.log(chalk.yellow('\n🤖 No active agent set\n'));
                console.log(chalk.gray('Use /agent <name> to set an active agent'));
                console.log(chalk.gray('Use /agents to list all available agents\n'));
            }
            return;
        }
        const agentName = args[0];
        // Clear active agent
        if (agentName.toLowerCase() === 'clear') {
            this.conversationContext.setActiveAgent(undefined);
            console.log(chalk.green('\n✓ Active agent cleared\n'));
            return;
        }
        // Validate agent exists
        const agents = context.agentRegistry.getAllMetadata();
        const agent = agents.find(a => a.name.toLowerCase() === agentName.toLowerCase());
        if (!agent) {
            console.log(chalk.red(`\n❌ Agent '${agentName}' not found\n`));
            console.log(chalk.gray('Available agents:'));
            // Show first 5 agents as suggestions
            const suggestions = agents.slice(0, 5);
            for (const a of suggestions) {
                console.log(chalk.gray(`  - ${a.name}`));
            }
            if (agents.length > 5) {
                console.log(chalk.gray(`  ... and ${agents.length - 5} more`));
            }
            console.log(chalk.gray('\nUse /agents to see all available agents\n'));
            return;
        }
        // Set active agent
        this.conversationContext.setActiveAgent(agent.name);
        console.log(chalk.green(`\n✓ Active agent set to: ${chalk.bold(agent.name)}\n`));
        console.log(chalk.gray(`Description: ${agent.description}`));
        if (agent.specializations && agent.specializations.length > 0) {
            console.log(chalk.gray(`Specializations: ${agent.specializations.join(', ')}`));
        }
        console.log();
    }
}
//# sourceMappingURL=AgentCommand.js.map