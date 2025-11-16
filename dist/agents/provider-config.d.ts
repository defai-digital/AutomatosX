/**
 * Provider configuration and constants
 * Centralized configuration for AI provider integration
 */
import type { ProviderRouterOptions } from '../services/ProviderRouterV2.js';
/**
 * Provider name constants
 */
export declare const PROVIDERS: {
    readonly CLAUDE: "claude";
    readonly GEMINI: "gemini";
    readonly OPENAI: "openai";
    readonly CODEX: "codex";
};
/**
 * Model name constants (loaded from YAML)
 */
export declare const MODELS: {
    readonly claude: string;
    readonly gemini: string;
    readonly openai: string;
    readonly codex: string;
};
/**
 * Get default provider router configuration
 * REFACTORING #33: Use YAML-configured provider settings
 */
export declare function getDefaultProviderConfig(): ProviderRouterOptions;
/**
 * Get model name for a provider
 */
export declare function getModelForProvider(providerName: string): string;
//# sourceMappingURL=provider-config.d.ts.map