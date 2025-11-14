/**
 * Telemetry Reporter
 * Tracks extension usage and errors (privacy-respecting)
 */

import * as vscode from 'vscode';
import { ConfigurationProvider } from '../config/ConfigurationProvider.js';

interface TelemetryEvent {
  type: string;
  timestamp: string;
  data: Record<string, any>;
}

export class TelemetryReporter implements vscode.Disposable {
  private configProvider: ConfigurationProvider;
  private events: TelemetryEvent[] = [];
  private maxEvents = 1000;

  constructor(configProvider: ConfigurationProvider) {
    this.configProvider = configProvider;
  }

  /**
   * Check if telemetry is enabled
   */
  private isEnabled(): boolean {
    return this.configProvider.getConfig().enableTelemetry;
  }

  /**
   * Report extension activation
   */
  reportActivation(): void {
    this.reportEvent('activation', {
      platform: process.platform,
      nodeVersion: process.version,
      vscodeVersion: vscode.version,
    });
  }

  /**
   * Report extension deactivation
   */
  reportDeactivation(): void {
    this.reportEvent('deactivation', {
      sessionDuration: this.getSessionDuration(),
      eventCount: this.events.length,
    });
  }

  /**
   * Report command execution
   */
  reportCommand(commandName: string): void {
    this.reportEvent('command', {
      command: commandName,
    });
  }

  /**
   * Report indexing operation
   */
  reportIndexing(filesIndexed: number, duration: number): void {
    this.reportEvent('indexing', {
      filesIndexed,
      duration,
      filesPerSecond: duration > 0 ? filesIndexed / (duration / 1000) : 0,
    });
  }

  /**
   * Report error
   */
  reportError(error: Error): void {
    this.reportEvent('error', {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n')[0], // Only first line for privacy
    });
  }

  /**
   * Report performance metric
   */
  reportPerformance(metric: string, value: number): void {
    this.reportEvent('performance', {
      metric,
      value,
    });
  }

  /**
   * Report generic event
   */
  private reportEvent(type: string, data: Record<string, any>): void {
    if (!this.isEnabled()) {
      return;
    }

    const event: TelemetryEvent = {
      type,
      timestamp: new Date().toISOString(),
      data,
    };

    this.events.push(event);

    // Keep only last N events
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Log to console for debugging
    console.log('[Telemetry]', type, data);
  }

  /**
   * Get session duration
   */
  private getSessionDuration(): number {
    if (this.events.length === 0) {
      return 0;
    }

    const firstEvent = this.events[0];
    const lastEvent = this.events[this.events.length - 1];

    return (
      new Date(lastEvent.timestamp).getTime() -
      new Date(firstEvent.timestamp).getTime()
    );
  }

  /**
   * Get all events
   */
  getEvents(): TelemetryEvent[] {
    return [...this.events];
  }

  /**
   * Get events by type
   */
  getEventsByType(type: string): TelemetryEvent[] {
    return this.events.filter((e) => e.type === type);
  }

  /**
   * Get summary statistics
   */
  getSummary(): Record<string, any> {
    const summary: Record<string, any> = {
      totalEvents: this.events.length,
      sessionDuration: this.getSessionDuration(),
      eventTypes: {},
    };

    for (const event of this.events) {
      summary.eventTypes[event.type] = (summary.eventTypes[event.type] || 0) + 1;
    }

    return summary;
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Export events to JSON
   */
  export(): string {
    return JSON.stringify(
      {
        summary: this.getSummary(),
        events: this.events,
      },
      null,
      2
    );
  }

  dispose(): void {
    this.clear();
  }
}
