/**
 * AutomatosX v8.0.0 - Clarification Handler
 *
 * Handles ambiguous queries by asking for clarification
 * Integrates with inquirer for interactive prompts
 */
import inquirer from 'inquirer';
import chalk from 'chalk';
/**
 * Clarification Handler
 *
 * Detects ambiguous queries and prompts user for clarification
 * Uses inquirer for interactive prompts
 */
export class ClarificationHandler {
    /**
     * Detect if a query is ambiguous
     */
    async detectAmbiguity(query, intents) {
        // Check for multiple possible intents
        if (intents && intents.length > 1) {
            return {
                isAmbiguous: true,
                reason: 'multiple-intents',
                possibleIntents: intents,
                suggestions: this.generateIntentSuggestions(intents)
            };
        }
        // Check for vague queries (too short, too general)
        if (this.isVagueQuery(query)) {
            return {
                isAmbiguous: true,
                reason: 'vague-query',
                suggestions: [
                    'Please be more specific about what you\'re looking for',
                    'Add filters like lang:ts or file:src/',
                    'Include specific function or class names'
                ]
            };
        }
        // Check for missing context (pronouns without history)
        if (this.hasMissingContext(query)) {
            return {
                isAmbiguous: true,
                reason: 'missing-context',
                suggestions: [
                    'Please specify what "it", "this", or "that" refers to',
                    'Include the workflow, file, or agent name',
                    'Provide more context about your previous action'
                ]
            };
        }
        // Check for conflicting filters
        const conflicts = this.detectConflictingFilters(query);
        if (conflicts.length > 0) {
            return {
                isAmbiguous: true,
                reason: 'conflicting-filters',
                suggestions: conflicts
            };
        }
        // Not ambiguous
        return { isAmbiguous: false };
    }
    /**
     * Ask for clarification
     */
    async askForClarification(detection, originalQuery) {
        console.log(chalk.yellow('\n⚠ Your query seems ambiguous.'));
        // Handle different ambiguity reasons
        switch (detection.reason) {
            case 'multiple-intents':
                return await this.clarifyIntent(detection);
            case 'vague-query':
                return await this.clarifyVagueQuery(originalQuery, detection);
            case 'missing-context':
                return await this.clarifyMissingContext(originalQuery, detection);
            case 'conflicting-filters':
                return await this.clarifyConflictingFilters(originalQuery, detection);
            default:
                return { clarified: false, cancelled: false };
        }
    }
    /**
     * Clarify which intent the user wants
     */
    async clarifyIntent(detection) {
        if (!detection.possibleIntents || detection.possibleIntents.length === 0) {
            return { clarified: false, cancelled: false };
        }
        console.log(chalk.gray('Multiple interpretations found. Which did you mean?\n'));
        const choices = detection.possibleIntents.map(intent => ({
            name: this.formatIntentChoice(intent),
            value: intent
        }));
        choices.push({
            name: chalk.gray('None of the above - let me rephrase'),
            value: 'rephrase'
        });
        try {
            const answer = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'intent',
                    message: 'Select the intended action:',
                    choices
                }
            ]);
            if (answer.intent === 'rephrase') {
                const rephrased = await this.promptForRephrase();
                return rephrased;
            }
            return {
                clarified: true,
                selectedOption: answer.intent,
                cancelled: false
            };
        }
        catch (error) {
            // User cancelled (CTRL+C)
            return { clarified: false, cancelled: true };
        }
    }
    /**
     * Clarify a vague query
     */
    async clarifyVagueQuery(query, detection) {
        console.log(chalk.gray('Your query is too vague. Here are some suggestions:\n'));
        if (detection.suggestions) {
            detection.suggestions.forEach((suggestion, index) => {
                console.log(chalk.gray(`  ${index + 1}. ${suggestion}`));
            });
            console.log('');
        }
        try {
            const answer = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'refine',
                    message: 'Would you like to refine your query?',
                    default: true
                }
            ]);
            if (answer.refine) {
                const refined = await this.promptForRefinedQuery(query);
                return refined;
            }
            return { clarified: false, cancelled: false };
        }
        catch (error) {
            return { clarified: false, cancelled: true };
        }
    }
    /**
     * Clarify missing context
     */
    async clarifyMissingContext(query, detection) {
        console.log(chalk.gray('Your query uses pronouns without clear context.\n'));
        if (detection.suggestions) {
            detection.suggestions.forEach((suggestion, index) => {
                console.log(chalk.gray(`  ${index + 1}. ${suggestion}`));
            });
            console.log('');
        }
        try {
            const answer = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'refinedQuery',
                    message: 'Please rephrase with more context:',
                    default: query
                }
            ]);
            if (answer.refinedQuery && answer.refinedQuery !== query) {
                return {
                    clarified: true,
                    refinedQuery: answer.refinedQuery,
                    cancelled: false
                };
            }
            return { clarified: false, cancelled: false };
        }
        catch (error) {
            return { clarified: false, cancelled: true };
        }
    }
    /**
     * Clarify conflicting filters
     */
    async clarifyConflictingFilters(query, detection) {
        console.log(chalk.yellow('Conflicting filters detected:'));
        if (detection.suggestions) {
            detection.suggestions.forEach(conflict => {
                console.log(chalk.gray(`  • ${conflict}`));
            });
            console.log('');
        }
        try {
            const answer = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'refinedQuery',
                    message: 'Please fix the conflicts:',
                    default: query
                }
            ]);
            if (answer.refinedQuery && answer.refinedQuery !== query) {
                return {
                    clarified: true,
                    refinedQuery: answer.refinedQuery,
                    cancelled: false
                };
            }
            return { clarified: false, cancelled: false };
        }
        catch (error) {
            return { clarified: false, cancelled: true };
        }
    }
    /**
     * Prompt for rephrased query
     */
    async promptForRephrase() {
        try {
            const answer = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'query',
                    message: 'Please rephrase your query:'
                }
            ]);
            if (answer.query) {
                return {
                    clarified: true,
                    refinedQuery: answer.query,
                    cancelled: false
                };
            }
            return { clarified: false, cancelled: false };
        }
        catch (error) {
            return { clarified: false, cancelled: true };
        }
    }
    /**
     * Prompt for refined query
     */
    async promptForRefinedQuery(originalQuery) {
        try {
            const answer = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'query',
                    message: 'Enter a more specific query:',
                    default: originalQuery
                }
            ]);
            if (answer.query && answer.query !== originalQuery) {
                return {
                    clarified: true,
                    refinedQuery: answer.query,
                    cancelled: false
                };
            }
            return { clarified: false, cancelled: false };
        }
        catch (error) {
            return { clarified: false, cancelled: true };
        }
    }
    /**
     * Check if query is vague
     */
    isVagueQuery(query) {
        const trimmed = query.trim();
        // Too short
        if (trimmed.length < 3) {
            return true;
        }
        // Single word queries without filters
        const words = trimmed.split(/\s+/);
        if (words.length === 1 && !trimmed.includes(':')) {
            return true;
        }
        // Common vague patterns
        const vaguePatterns = [
            /^show\s*$/i,
            /^list\s*$/i,
            /^get\s*$/i,
            /^find\s*$/i,
            /^search\s*$/i,
            /^what\s*$/i,
            /^how\s*$/i
        ];
        return vaguePatterns.some(pattern => pattern.test(trimmed));
    }
    /**
     * Check if query has missing context
     */
    hasMissingContext(query) {
        // Pronouns without context indicators
        const pronounPatterns = [
            /^\s*(it|this|that|these|those)\b/i, // Starts with pronoun
            /^(show|display|get|find)\s+(it|this|that)\b/i // Action + pronoun without context
        ];
        return pronounPatterns.some(pattern => pattern.test(query));
    }
    /**
     * Detect conflicting filters
     */
    detectConflictingFilters(query) {
        const conflicts = [];
        // Extract all filters
        const langFilters = query.match(/lang:(\w+)/g) || [];
        const kindFilters = query.match(/kind:(\w+)/g) || [];
        // Multiple language filters
        if (langFilters.length > 1) {
            conflicts.push(`Multiple language filters: ${langFilters.join(', ')}`);
        }
        // Multiple kind filters
        if (kindFilters.length > 1) {
            conflicts.push(`Multiple kind filters: ${kindFilters.join(', ')}`);
        }
        return conflicts;
    }
    /**
     * Generate intent choice suggestions
     */
    generateIntentSuggestions(intents) {
        return intents.map(intent => this.formatIntentChoice(intent));
    }
    /**
     * Format intent as user-friendly choice
     */
    formatIntentChoice(intent) {
        const descriptions = {
            'symbol-search': 'Search for function/class definitions',
            'natural-language': 'Natural language query about code',
            'workflow-run': 'Run a workflow',
            'agent-query': 'Ask an AI agent',
            'file-search': 'Search for files',
            'hybrid-search': 'Combined code and documentation search',
            'slash-command': 'Execute a slash command',
            'unknown': 'Something else'
        };
        return descriptions[intent] || intent;
    }
}
//# sourceMappingURL=ClarificationHandler.js.map