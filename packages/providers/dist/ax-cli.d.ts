import { ExecutionRequest, ExecutionResponse } from '@ax/schemas';
import { BaseProvider } from './base.js';

/**
 * ax-cli Provider - SDK-based integration
 *
 * Integrates with ax-cli using its SDK for native execution.
 * This provider uses SDK mode for better performance and features
 * like checkpoints and subagent delegation.
 *
 * @module @ax/providers/ax-cli
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

interface AxCliSDKConfig {
    enableCheckpoints?: boolean;
    enableSubagents?: boolean;
    timeout?: number;
}
declare class AxCliProvider extends BaseProvider {
    readonly id: "ax-cli";
    readonly name = "ax-cli";
    readonly integrationMode: "sdk";
    private sdk;
    private sdkConfig;
    constructor(options?: AxCliSDKConfig);
    /**
     * Initialize ax-cli SDK
     */
    initialize(): Promise<void>;
    /**
     * Execute a task via ax-cli SDK
     */
    execute(request: ExecutionRequest): Promise<ExecutionResponse>;
    /**
     * Check ax-cli SDK health
     */
    checkHealth(): Promise<boolean>;
    /**
     * Cleanup SDK resources
     */
    cleanup(): Promise<void>;
    /**
     * Ensure SDK is initialized
     */
    private ensureInitialized;
}

export { AxCliProvider };
