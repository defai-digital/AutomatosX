import type { MCPTimeoutConfig, TimeoutResult, ToolCategory } from '@automatosx/contracts';
/**
 * Default timeout configuration.
 */
export declare const DEFAULT_TIMEOUT_CONFIG: MCPTimeoutConfig;
/**
 * Timeout error class for identification.
 */
export declare class TimeoutError extends Error {
    readonly code = "TOOL_TIMEOUT";
    readonly timeoutMs: number;
    constructor(timeoutMs: number, message?: string);
}
/**
 * Wrap an async operation with timeout protection.
 *
 * Invariants enforced:
 * - INV-MCP-TIMEOUT-001: Guaranteed termination
 * - INV-MCP-TIMEOUT-004: Returns TOOL_TIMEOUT error code
 * - INV-MCP-TIMEOUT-005: Duration tracking
 */
export declare function withTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<TimeoutResult>;
/**
 * Wrap a tool handler with timeout protection.
 *
 * Invariants enforced:
 * - INV-MCP-TIMEOUT-002: Category consistency
 * - INV-MCP-TIMEOUT-003: Override precedence
 */
export declare function withToolTimeout<TArgs, TResult>(toolName: string, handler: (args: TArgs) => Promise<TResult>, config?: MCPTimeoutConfig): (args: TArgs) => Promise<TimeoutResult>;
/**
 * Create a timeout-wrapped handler factory.
 */
export declare function createTimeoutWrapper(config?: MCPTimeoutConfig): <TArgs, TResult>(toolName: string, handler: (args: TArgs) => Promise<TResult>) => (args: TArgs) => Promise<TimeoutResult>;
/**
 * Get the category for a tool.
 */
export declare function getToolCategory(toolName: string): ToolCategory | undefined;
/**
 * Check if a result is a timeout.
 */
export declare function isTimeoutResult(result: TimeoutResult): boolean;
/**
 * Check if a result is successful.
 */
export declare function isSuccessResult(result: TimeoutResult): boolean;
/**
 * Extract the result value from a successful TimeoutResult.
 * Throws if result is not successful.
 */
export declare function unwrapResult<T>(result: TimeoutResult): T;
//# sourceMappingURL=wrapper.d.ts.map