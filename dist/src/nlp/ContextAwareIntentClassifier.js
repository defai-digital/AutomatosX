/**
 * AutomatosX v8.0.0 - Context-Aware Intent Classifier
 *
 * Extends IntentClassifier with conversation context awareness
 * Resolves pronouns and references using conversation history
 */
import { IntentClassifier } from '../cli/interactive/IntentClassifier.js';
/**
 * Context-Aware Intent Classifier
 *
 * Enhances base IntentClassifier with:
 * - Pronoun resolution ("it", "this", "that")
 * - Reference expansion ("the results", "last workflow")
 * - Entity extraction from conversation history
 * - Context-aware classification
 */
export class ContextAwareIntentClassifier extends IntentClassifier {
    conversationContext;
    constructor(conversationContext, providerRouter) {
        super(providerRouter);
        this.conversationContext = conversationContext;
    }
    /**
     * Classify intent with context awareness
     */
    async classify(input) {
        // Check if input contains contextual references
        const hasReference = this.containsReference(input);
        if (!hasReference) {
            // No context needed, use base classification
            const baseResult = await super.classify(input);
            return baseResult;
        }
        // Get recent conversation history
        const recentMessages = this.conversationContext.getRecentMessages(5);
        // Expand query with context
        const expandedQuery = this.expandWithContext(input, recentMessages);
        // Classify expanded query
        const result = await super.classify(expandedQuery);
        // Add context metadata
        return {
            ...result,
            metadata: {
                originalQuery: input,
                expandedQuery,
                usedContext: true,
                contextMessages: recentMessages.length,
                resolvedEntities: this.getResolvedEntities(input, expandedQuery)
            }
        };
    }
    /**
     * Detect if input contains contextual references
     */
    containsReference(input) {
        const referencePatterns = [
            // Pronouns
            /\b(it|this|that|these|those)\b/i,
            // Reference to results/output
            /\b(the|this|that) (results?|output|status|logs?|errors?)\b/i,
            // Reference to previous actions
            /\b(last|previous|same|current) (workflow|command|run|execution|agent|file)\b/i,
            // Implicit references
            /\bshow me\b/i,
            /\btell me (more |about )?/i,
            /\bwhat (is|are|was|were)\b/i,
            /\b(explain|describe) (it|this|that)\b/i,
            // Continuation words
            /\b(also|additionally|furthermore|moreover)\b/i,
            /\band (then|also)\b/i
        ];
        return referencePatterns.some(pattern => pattern.test(input));
    }
    /**
     * Expand query using conversation context
     */
    expandWithContext(input, history) {
        if (history.length === 0) {
            return input;
        }
        // Extract entities from conversation history
        const entities = this.extractEntitiesFromHistory(history);
        // Expand input by replacing references
        let expanded = input;
        // Replace "it" with workflow/file name
        if (/\bit\b/i.test(expanded) && entities.workflow) {
            expanded = expanded.replace(/\bit\b/i, entities.workflow);
        }
        // Replace "the results" with explicit reference
        if (/the results?/i.test(expanded)) {
            if (entities.workflow) {
                expanded = expanded.replace(/the results?/i, `the results of ${entities.workflow}`);
            }
            else if (entities.query) {
                expanded = expanded.replace(/the results?/i, `the results of ${entities.query}`);
            }
        }
        // Replace "last workflow" with actual workflow name
        if (/last workflow/i.test(expanded) && entities.workflow) {
            expanded = expanded.replace(/last workflow/i, entities.workflow);
        }
        // Replace "current agent" or "this agent"
        if (/(current|this|that) agent/i.test(expanded) && entities.agent) {
            expanded = expanded.replace(/(current|this|that) agent/i, entities.agent);
        }
        // Replace "that file" or "this file"
        if (/(that|this) file/i.test(expanded) && entities.file) {
            expanded = expanded.replace(/(that|this) file/i, entities.file);
        }
        // Handle "show me" - infer what to show from last action
        if (/^show me$/i.test(expanded.trim())) {
            if (entities.workflow) {
                expanded = `show me the results of ${entities.workflow}`;
            }
            else if (entities.query) {
                expanded = `show me ${entities.query}`;
            }
        }
        return expanded;
    }
    /**
     * Extract entities from conversation history
     */
    extractEntitiesFromHistory(history) {
        const entities = {};
        // Process messages in reverse (most recent first)
        for (let i = history.length - 1; i >= 0; i--) {
            const message = history[i];
            // Skip assistant messages for entity extraction
            if (message.role !== 'user') {
                continue;
            }
            const content = message.content;
            // Extract workflow references
            if (!entities.workflow) {
                const workflowMatch = content.match(/workflow\s+(?:run\s+)?([a-z0-9-]+\.ya?ml)/i);
                if (workflowMatch) {
                    entities.workflow = workflowMatch[1];
                }
                // Also check for workflow-like names (security-audit, quality-check, etc.)
                const namedWorkflowMatch = content.match(/\b([a-z]+-[a-z]+(?:-[a-z]+)?)\b/i);
                if (namedWorkflowMatch) {
                    entities.workflow = entities.workflow || namedWorkflowMatch[1];
                }
            }
            // Extract agent references
            if (!entities.agent) {
                const agentMatch = content.match(/\b(backend|frontend|security|testing|quality|deployment|database)agent\b/i);
                if (agentMatch) {
                    entities.agent = agentMatch[0];
                }
            }
            // Extract file references
            if (!entities.file) {
                const fileMatch = content.match(/([a-z0-9-_/]+\.[a-z]+)/i);
                if (fileMatch) {
                    entities.file = fileMatch[1];
                }
            }
            // Extract search queries (for "find X" or "search for X")
            if (!entities.query) {
                const queryMatch = content.match(/\b(find|search for?|show me)\s+([a-z0-9-_]+)/i);
                if (queryMatch) {
                    entities.query = queryMatch[2];
                }
            }
            // Stop if we've found all entities
            if (entities.workflow && entities.agent && entities.file && entities.query) {
                break;
            }
        }
        return entities;
    }
    /**
     * Get resolved entities for metadata
     */
    getResolvedEntities(original, expanded) {
        const resolved = {};
        // Check which pronouns were replaced
        if (/\bit\b/i.test(original) && !/\bit\b/i.test(expanded)) {
            resolved['it'] = this.extractResolved(original, expanded, /\bit\b/i);
        }
        if (/\bthis\b/i.test(original) && !/\bthis\b/i.test(expanded)) {
            resolved['this'] = this.extractResolved(original, expanded, /\bthis\b/i);
        }
        if (/\bthat\b/i.test(original) && !/\bthat\b/i.test(expanded)) {
            resolved['that'] = this.extractResolved(original, expanded, /\bthat\b/i);
        }
        return resolved;
    }
    /**
     * Extract what a pronoun was resolved to
     */
    extractResolved(original, expanded, pattern) {
        // Find the word that replaced the pronoun
        const originalWords = original.split(/\s+/);
        const expandedWords = expanded.split(/\s+/);
        for (let i = 0; i < originalWords.length; i++) {
            if (pattern.test(originalWords[i]) && expandedWords[i] !== originalWords[i]) {
                return expandedWords[i];
            }
        }
        return '(resolved)';
    }
    /**
     * Override classify to use context awareness by default
     */
    async classifyWithContext(input) {
        return this.classify(input);
    }
}
//# sourceMappingURL=ContextAwareIntentClassifier.js.map