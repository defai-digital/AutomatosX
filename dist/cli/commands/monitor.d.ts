/**
 * Monitoring CLI Commands
 *
 * Provides real-time monitoring, metrics visualization, alert management,
 * and cost analytics through the command line.
 *
 * Commands:
 * - ax monitor status: System health dashboard
 * - ax monitor metrics: Query and visualize metrics
 * - ax monitor alerts: Manage alerts and alert rules
 * - ax monitor costs: Cost analytics and budget tracking
 *
 * @module MonitorCommands
 */
import { Command } from 'commander';
export declare function createMonitorCommand(): Command;
export declare function registerMonitorCommands(program: Command): void;
//# sourceMappingURL=monitor.d.ts.map