/**
 * AutomatosX v8.0.0 - Clarification Handler
 *
 * Handles ambiguous queries by asking for clarification
 * Integrates with inquirer for interactive prompts
 */
import type { IntentType } from './IntentClassifier.js';
/**
 * Clarification question
 */
export interface ClarificationQuestion {
    type: 'choice' | 'confirm' | 'input';
    message: string;
    choices?: string[];
    default?: string | boolean;
}
/**
 * Clarification result
 */
export interface ClarificationResult {
    clarified: boolean;
    refinedQuery?: string;
    selectedOption?: string;
    userInput?: string;
    cancelled: boolean;
}
/**
 * Ambiguity detection result
 */
export interface AmbiguityDetection {
    isAmbiguous: boolean;
    reason?: 'multiple-intents' | 'vague-query' | 'missing-context' | 'conflicting-filters';
    suggestions?: string[];
    possibleIntents?: IntentType[];
}
/**
 * Clarification Handler
 *
 * Detects ambiguous queries and prompts user for clarification
 * Uses inquirer for interactive prompts
 */
export declare class ClarificationHandler {
    /**
     * Detect if a query is ambiguous
     */
    detectAmbiguity(query: string, intents?: IntentType[]): Promise<AmbiguityDetection>;
    /**
     * Ask for clarification
     */
    askForClarification(detection: AmbiguityDetection, originalQuery: string): Promise<ClarificationResult>;
    /**
     * Clarify which intent the user wants
     */
    private clarifyIntent;
    /**
     * Clarify a vague query
     */
    private clarifyVagueQuery;
    /**
     * Clarify missing context
     */
    private clarifyMissingContext;
    /**
     * Clarify conflicting filters
     */
    private clarifyConflictingFilters;
    /**
     * Prompt for rephrased query
     */
    private promptForRephrase;
    /**
     * Prompt for refined query
     */
    private promptForRefinedQuery;
    /**
     * Check if query is vague
     */
    private isVagueQuery;
    /**
     * Check if query has missing context
     */
    private hasMissingContext;
    /**
     * Detect conflicting filters
     */
    private detectConflictingFilters;
    /**
     * Generate intent choice suggestions
     */
    private generateIntentSuggestions;
    /**
     * Format intent as user-friendly choice
     */
    private formatIntentChoice;
}
//# sourceMappingURL=ClarificationHandler.d.ts.map