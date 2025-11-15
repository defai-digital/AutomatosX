/**
 * AutomatosX v8.0.0 - Context-Aware Intent Classifier
 *
 * Extends IntentClassifier with conversation context awareness
 * Resolves pronouns and references using conversation history
 */
import { IntentClassifier, Intent } from '../cli/interactive/IntentClassifier.js';
import type { ConversationContext } from '../cli/interactive/ConversationContext.js';
import type { ProviderRouterV2 } from '../services/ProviderRouterV2.js';
/**
 * Classification result with context metadata
 */
export interface ContextualIntent extends Intent {
    metadata?: {
        originalQuery?: string;
        expandedQuery?: string;
        usedContext?: boolean;
        contextMessages?: number;
        resolvedEntities?: Record<string, string>;
    };
}
/**
 * Context-Aware Intent Classifier
 *
 * Enhances base IntentClassifier with:
 * - Pronoun resolution ("it", "this", "that")
 * - Reference expansion ("the results", "last workflow")
 * - Entity extraction from conversation history
 * - Context-aware classification
 */
export declare class ContextAwareIntentClassifier extends IntentClassifier {
    private conversationContext;
    constructor(conversationContext: ConversationContext, providerRouter?: ProviderRouterV2);
    /**
     * Classify intent with context awareness
     */
    classify(input: string): Promise<ContextualIntent>;
    /**
     * Detect if input contains contextual references
     */
    private containsReference;
    /**
     * Expand query using conversation context
     */
    private expandWithContext;
    /**
     * Extract entities from conversation history
     */
    private extractEntitiesFromHistory;
    /**
     * Get resolved entities for metadata
     */
    private getResolvedEntities;
    /**
     * Extract what a pronoun was resolved to
     */
    private extractResolved;
    /**
     * Override classify to use context awareness by default
     */
    classifyWithContext(input: string): Promise<ContextualIntent>;
}
//# sourceMappingURL=ContextAwareIntentClassifier.d.ts.map