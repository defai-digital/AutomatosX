/**
 * AutomatosX v8.0.0 - REPL Session Manager
 *
 * Core Interactive CLI session with readline interface
 */
import type { Database } from 'better-sqlite3';
import type { ProviderRouterV2 } from '../../services/ProviderRouterV2.js';
import type { AgentRegistry } from '../../agents/AgentRegistry.js';
import type { SlashCommandRegistry } from './SlashCommandRegistry.js';
import type { REPLOptions, REPLState } from './types.js';
import { ConversationContext } from './ConversationContext.js';
/**
 * REPL Session Manager
 *
 * Manages the interactive CLI session with readline interface
 */
export declare class REPLSession {
    private db;
    private providerRouter;
    private agentRegistry;
    private commandRegistry;
    private rl;
    private state;
    private options;
    private conversationContext;
    private streamingHandler;
    private multilineBuffer;
    private multilineMode;
    private multilineTrigger;
    private historySearchMode;
    private historySearchQuery;
    private historySearchIndex;
    private historySearchMatches;
    constructor(db: Database, providerRouter: ProviderRouterV2, agentRegistry: AgentRegistry, commandRegistry: SlashCommandRegistry, options?: REPLOptions);
    /**
     * Start the REPL session
     */
    start(): Promise<void>;
    /**
     * Stop the REPL session
     */
    stop(): Promise<void>;
    /**
     * Handle input line (with multiline support)
     */
    private handleInputLine;
    /**
     * Handle user input
     */
    private handleInput;
    /**
     * Handle slash command
     */
    private handleSlashCommand;
    /**
     * Handle natural language input
     */
    private handleNaturalLanguage;
    /**
     * Autocomplete handler
     */
    private autocomplete;
    /**
     * Display welcome message
     */
    private displayWelcome;
    /**
     * Get default welcome message
     */
    private getDefaultWelcome;
    /**
     * Get current state (for testing)
     */
    getState(): Readonly<REPLState>;
    /**
     * Get conversation context (for command injection)
     */
    getConversationContext(): ConversationContext;
    /**
     * Handle keypress events (for Ctrl+R history search)
     */
    private handleKeypress;
    /**
     * Enter history search mode
     */
    private enterHistorySearch;
    /**
     * Exit history search mode
     */
    private exitHistorySearch;
    /**
     * Update history search with current query
     */
    private updateHistorySearch;
    /**
     * Cycle to next history match
     */
    private nextHistoryMatch;
    /**
     * Update history search prompt display
     */
    private updateHistorySearchPrompt;
}
//# sourceMappingURL=REPLSession.d.ts.map