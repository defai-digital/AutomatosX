/**
 * telemetryConsent.ts
 * First-run telemetry consent prompt
 */
/**
 * Check if telemetry has been configured (user has made a choice)
 */
export declare function isTelemetryConfigured(): boolean;
/**
 * Show telemetry consent prompt on first run
 *
 * This prompt asks the user whether they want to:
 * - Enable telemetry (local only)
 * - Enable telemetry with remote submission
 * - Disable telemetry
 *
 * @returns Promise that resolves when the user has made a choice
 */
export declare function showTelemetryConsent(): Promise<void>;
/**
 * Check if telemetry consent is needed and configure if required
 *
 * This should be called at the start of CLI execution (in src/cli/index.ts)
 *
 * Privacy by Default: Telemetry is disabled by default without prompting.
 * Users can enable it later with: ax telemetry enable
 *
 * BUG FIX #37: Remove telemetry message to reduce noise
 *
 * @returns Promise that resolves when consent check is complete
 */
export declare function checkTelemetryConsent(): Promise<void>;
//# sourceMappingURL=telemetryConsent.d.ts.map