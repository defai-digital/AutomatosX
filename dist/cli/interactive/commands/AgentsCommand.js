/**
 * AutomatosX v8.0.0 - Agents Command
 *
 * List available agents with filtering
 */
import chalk from 'chalk';
/**
 * Agents Command
 *
 * Lists all available agents or filters by name/category
 */
export class AgentsCommand {
    name = 'agents';
    description = 'List available agents';
    usage = '/agents [filter]';
    aliases = ['a'];
    async execute(args, context) {
        const filter = args[0]?.toLowerCase();
        // Get all agents metadata from registry
        const allAgents = context.agentRegistry.getAllMetadata();
        // Filter if provided
        const agents = filter
            ? allAgents.filter(agent => agent.name.toLowerCase().includes(filter) ||
                agent.description.toLowerCase().includes(filter) ||
                agent.specializations.some(s => s.toLowerCase().includes(filter)))
            : allAgents;
        // Display results
        if (agents.length === 0) {
            console.log(chalk.yellow(`\n⚠️  No agents found matching "${filter}"\n`));
            return;
        }
        console.log(chalk.bold.cyan(`\n🤖 Available Agents${filter ? ` (filtered by "${filter}")` : ''}\n`));
        // Group by category
        const categories = new Map();
        for (const agent of agents) {
            const category = this.getCategory(agent.name);
            if (!categories.has(category)) {
                categories.set(category, []);
            }
            categories.get(category).push(agent);
        }
        // Display by category
        for (const [category, categoryAgents] of categories) {
            console.log(chalk.bold.white(`${category}:`));
            for (const agent of categoryAgents) {
                const active = context.activeAgent === agent.name ? chalk.green(' ✓ (active)') : '';
                console.log(`  ${chalk.cyan(agent.name)}${active}`);
                console.log(`    ${chalk.gray(agent.description)}`);
                if (agent.specializations.length > 0) {
                    console.log(`    ${chalk.gray('Specializations:')} ${agent.specializations.slice(0, 3).join(', ')}`);
                }
                console.log();
            }
        }
        console.log(chalk.gray(`Total: ${agents.length} agent(s)\n`));
        console.log(chalk.gray('Use /agent <name> to set active agent\n'));
    }
    /**
     * Categorize agent by name
     */
    getCategory(name) {
        const lower = name.toLowerCase();
        if (lower.includes('backend') || lower.includes('frontend') || lower.includes('api')) {
            return 'Engineering';
        }
        if (lower.includes('security') || lower.includes('quality') || lower.includes('testing')) {
            return 'Quality & Security';
        }
        if (lower.includes('devops') || lower.includes('infrastructure')) {
            return 'Operations';
        }
        if (lower.includes('ceo') || lower.includes('cto') || lower.includes('product')) {
            return 'Leadership';
        }
        if (lower.includes('data') || lower.includes('research')) {
            return 'Science';
        }
        if (lower.includes('writer')) {
            return 'Creative';
        }
        return 'Other';
    }
}
//# sourceMappingURL=AgentsCommand.js.map