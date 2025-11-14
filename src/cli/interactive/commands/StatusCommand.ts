/**
 * AutomatosX v8.0.0 - Status Command
 *
 * Show system status and health
 */

import chalk from 'chalk';
import type { SlashCommand, CommandContext } from '../types.js';

/**
 * Status Command
 *
 * Displays system health and statistics
 */
export class StatusCommand implements SlashCommand {
  name = 'status';
  description = 'Show system status';
  usage = '/status';
  aliases = ['s'];

  async execute(args: string[], context: CommandContext): Promise<void> {
    console.log(chalk.bold.cyan('\n📊 System Status\n'));

    // Database status
    try {
      const dbInfo = context.db.prepare('PRAGMA database_list').all();
      console.log(chalk.bold('Database:'));
      console.log(`  ${chalk.green('✓')} Connected`);
      console.log(`  ${chalk.gray('Path:')} ${(dbInfo[0] as any).file || 'in-memory'}`);
      console.log();
    } catch (error) {
      console.log(chalk.bold('Database:'));
      console.log(`  ${chalk.red('✗')} Error: ${(error as Error).message}`);
      console.log();
    }

    // Agent Registry
    try {
      const agents = context.agentRegistry.getAllMetadata();
      console.log(chalk.bold('Agent Registry:'));
      console.log(`  ${chalk.green('✓')} ${agents.length} agents available`);
      if (context.activeAgent) {
        console.log(`  ${chalk.gray('Active:')} ${context.activeAgent}`);
      }
      console.log();
    } catch (error) {
      console.log(chalk.bold('Agent Registry:'));
      console.log(`  ${chalk.red('✗')} Error: ${(error as Error).message}`);
      console.log();
    }

    // Provider Router
    try {
      console.log(chalk.bold('Provider Router:'));
      const health = context.providerRouter.getHealth();

      for (const [providerName, providerHealth] of Object.entries(health)) {
        const statusIcon = providerHealth.available ? chalk.green('✓') : chalk.red('✗');
        console.log(`  ${statusIcon} ${providerName}`);
        if (providerHealth.latency) {
          console.log(`      ${chalk.gray('Latency:')} ${providerHealth.latency.toFixed(0)}ms`);
        }
        if (providerHealth.errorRate > 0) {
          console.log(`      ${chalk.gray('Error Rate:')} ${(providerHealth.errorRate * 100).toFixed(1)}%`);
        }
      }
      console.log();
    } catch (error) {
      console.log(chalk.bold('Provider Router:'));
      console.log(`  ${chalk.red('✗')} Error: ${(error as Error).message}`);
      console.log();
    }

    // Memory usage
    const memUsage = process.memoryUsage();
    console.log(chalk.bold('Memory:'));
    console.log(`  ${chalk.gray('RSS:')} ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  ${chalk.gray('Heap Used:')} ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  ${chalk.gray('Heap Total:')} ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
    console.log();

    // Uptime
    const uptime = process.uptime();
    console.log(chalk.bold('Process:'));
    console.log(`  ${chalk.gray('Uptime:')} ${this.formatUptime(uptime)}`);
    console.log(`  ${chalk.gray('PID:')} ${process.pid}`);
    console.log(`  ${chalk.gray('Node:')} ${process.version}`);
    console.log();
  }

  /**
   * Format uptime in human-readable format
   */
  private formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);

    return parts.join(' ');
  }
}
