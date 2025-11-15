/**
 * AutomatosX v8.0.0 - Intent Classifier
 *
 * Classifies natural language input into actionable intents
 * Routes: memory-search, workflow-execute, agent-delegate, chat
 */
import type { ProviderRouterV2 } from '../../services/ProviderRouterV2.js';
/**
 * Intent types for natural language routing
 */
export type IntentType = 'memory-search' | 'workflow-execute' | 'agent-delegate' | 'chat' | 'rephrase' | 'symbol-search';
/**
 * Classification method used
 */
export type ClassificationMethod = 'pattern' | 'llm';
/**
 * Classified intent with confidence and extracted data
 */
export interface Intent {
    type: IntentType;
    confidence: number;
    method: ClassificationMethod;
    extractedData?: {
        query?: string;
        workflowName?: string;
        agentName?: string;
    };
}
/**
 * Intent Classifier
 *
 * Uses pattern matching (fast) + LLM fallback (accurate) to classify user intent
 */
export declare class IntentClassifier {
    private providerRouter?;
    private patterns;
    constructor(providerRouter?: ProviderRouterV2 | undefined);
    /**
     * Classify user intent from natural language input
     */
    classify(input: string): Promise<Intent>;
    /**
     * Classify using pattern matching (fast path)
     */
    private classifyWithPatterns;
    /**
     * Classify using LLM (slow path, for ambiguous queries)
     */
    private classifyWithLLM;
    /**
     * Build pattern library for intent classification
     */
    private buildPatternLibrary;
    /**
     * Extract data based on intent type
     */
    private extractDataForIntent;
    /**
     * Extract search query from memory-search intent
     */
    private extractSearchQuery;
    /**
     * Extract workflow name from workflow-execute intent
     */
    private extractWorkflowName;
    /**
     * Extract agent name from agent-delegate intent
     */
    private extractAgentName;
    /**
     * Build LLM prompt for intent classification
     */
    private buildLLMPrompt;
    /**
     * Parse intent type from LLM response
     */
    private parseIntentFromLLM;
}
//# sourceMappingURL=IntentClassifier.d.ts.map