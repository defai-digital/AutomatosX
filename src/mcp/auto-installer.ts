/**
 * MCP Auto-Installer
 *
 * Automatically discovers and installs MCP servers from npm registry.
 * Supports @modelcontextprotocol/* packages and custom servers.
 *
 * Phase 4B: Auto-Installation System
 *
 * @module mcp/auto-installer
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { logger } from '../utils/logger.js';
import type { MCPRegistryEntry, MCPDiscoveryResult, KNOWN_MCP_SERVERS } from './types-common.js';

const execAsync = promisify(exec);

/**
 * Installation Options
 */
export interface InstallationOptions {
  /** Use global installation */
  global?: boolean;

  /** Installation directory */
  installDir?: string;

  /** Package manager (npm, yarn, pnpm) */
  packageManager?: 'npm' | 'yarn' | 'pnpm';

  /** Dry run mode (don't actually install) */
  dryRun?: boolean;

  /** Timeout for installation (ms) */
  timeoutMs?: number;
}

/**
 * Installation Result
 */
export interface InstallationResult {
  /** Package name */
  package: string;

  /** Whether installation succeeded */
  success: boolean;

  /** Installation path */
  installPath?: string;

  /** Error if failed */
  error?: string;

  /** Installation time in milliseconds */
  installTimeMs: number;
}

/**
 * MCP Auto-Installer
 *
 * Discovers and installs MCP servers automatically.
 */
export class AutoInstaller {
  private packageManager: 'npm' | 'yarn' | 'pnpm';
  private installDir: string;

  constructor(
    packageManager: 'npm' | 'yarn' | 'pnpm' = 'npm',
    installDir?: string
  ) {
    this.packageManager = packageManager;
    this.installDir = installDir || join(process.cwd(), 'node_modules');
  }

  /**
   * Discover available MCP servers
   *
   * @param searchPrefixes - Package prefixes to search for
   * @returns Discovery result with available servers
   */
  async discover(
    searchPrefixes: string[] = ['@modelcontextprotocol/server-']
  ): Promise<MCPDiscoveryResult> {
    logger.info('AutoInstaller: Starting discovery', {
      prefixes: searchPrefixes,
    });

    const installed: MCPRegistryEntry[] = [];
    const available: MCPRegistryEntry[] = [];
    const errors: Array<{ package: string; error: string }> = [];

    // Search for packages on npm
    for (const prefix of searchPrefixes) {
      try {
        const packages = await this.searchNpm(prefix);

        for (const pkg of packages) {
          const isInstalled = await this.isPackageInstalled(pkg.name);

          const entry: MCPRegistryEntry = {
            package: pkg.name,
            name: this.extractServerName(pkg.name),
            description: pkg.description || '',
            command: 'npx',
            defaultArgs: [pkg.name],
            installed: isInstalled,
            installPath: isInstalled ? this.getInstallPath(pkg.name) : undefined,
          };

          if (isInstalled) {
            installed.push(entry);
          } else {
            available.push(entry);
          }
        }
      } catch (error) {
        logger.error('AutoInstaller: Discovery failed for prefix', {
          prefix,
          error,
        });
        errors.push({
          package: prefix,
          error: (error as Error).message,
        });
      }
    }

    const result: MCPDiscoveryResult = {
      total: installed.length + available.length,
      installed,
      available,
      errors,
    };

    logger.info('AutoInstaller: Discovery complete', {
      total: result.total,
      installed: installed.length,
      available: available.length,
      errors: errors.length,
    });

    return result;
  }

  /**
   * Install an MCP server package
   *
   * @param packageName - NPM package name
   * @param options - Installation options
   * @returns Installation result
   */
  async install(
    packageName: string,
    options: InstallationOptions = {}
  ): Promise<InstallationResult> {
    const startTime = Date.now();

    logger.info('AutoInstaller: Installing package', {
      package: packageName,
      packageManager: options.packageManager || this.packageManager,
      dryRun: options.dryRun,
    });

    // Check if already installed
    if (await this.isPackageInstalled(packageName)) {
      logger.info('AutoInstaller: Package already installed', {
        package: packageName,
      });

      return {
        package: packageName,
        success: true,
        installPath: this.getInstallPath(packageName),
        installTimeMs: Date.now() - startTime,
      };
    }

    // Dry run mode
    if (options.dryRun) {
      logger.info('AutoInstaller: Dry run mode, skipping installation');
      return {
        package: packageName,
        success: true,
        installTimeMs: Date.now() - startTime,
      };
    }

    try {
      // Build install command
      const pm = options.packageManager || this.packageManager;
      const globalFlag = options.global ? '-g' : '';
      const command = this.buildInstallCommand(pm, packageName, globalFlag);

      logger.debug('AutoInstaller: Executing install command', { command });

      // Execute installation
      const { stdout, stderr } = await execAsync(command, {
        timeout: options.timeoutMs || 120000, // 2 minutes default
        cwd: options.installDir || this.installDir,
      });

      if (stderr && !stderr.includes('npm WARN')) {
        logger.warn('AutoInstaller: Installation warnings', {
          package: packageName,
          stderr,
        });
      }

      const installPath = this.getInstallPath(packageName);

      logger.info('AutoInstaller: Installation successful', {
        package: packageName,
        installPath,
        durationMs: Date.now() - startTime,
      });

      return {
        package: packageName,
        success: true,
        installPath,
        installTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error('AutoInstaller: Installation failed', {
        package: packageName,
        error: (error as Error).message,
      });

      return {
        package: packageName,
        success: false,
        error: (error as Error).message,
        installTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Install multiple packages in parallel
   *
   * @param packageNames - Array of package names
   * @param options - Installation options
   * @returns Array of installation results
   */
  async installBatch(
    packageNames: string[],
    options: InstallationOptions = {}
  ): Promise<InstallationResult[]> {
    logger.info('AutoInstaller: Installing batch', {
      count: packageNames.length,
      packages: packageNames,
    });

    const results = await Promise.allSettled(
      packageNames.map(pkg => this.install(pkg, options))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          package: packageNames[index] || 'unknown',
          success: false,
          error: result.reason?.message || 'Unknown error',
          installTimeMs: 0,
        };
      }
    });
  }

  /**
   * Uninstall an MCP server package
   *
   * @param packageName - NPM package name
   * @param global - Whether to uninstall globally
   * @returns Whether uninstallation succeeded
   */
  async uninstall(packageName: string, global: boolean = false): Promise<boolean> {
    logger.info('AutoInstaller: Uninstalling package', {
      package: packageName,
      global,
    });

    try {
      const globalFlag = global ? '-g' : '';
      const command = this.buildUninstallCommand(
        this.packageManager,
        packageName,
        globalFlag
      );

      await execAsync(command, {
        cwd: this.installDir,
        timeout: 60000, // 1 minute
      });

      logger.info('AutoInstaller: Uninstallation successful', {
        package: packageName,
      });

      return true;
    } catch (error) {
      logger.error('AutoInstaller: Uninstallation failed', {
        package: packageName,
        error: (error as Error).message,
      });

      return false;
    }
  }

  /**
   * Update an MCP server package
   *
   * @param packageName - NPM package name
   * @param options - Installation options
   * @returns Installation result
   */
  async update(
    packageName: string,
    options: InstallationOptions = {}
  ): Promise<InstallationResult> {
    logger.info('AutoInstaller: Updating package', { package: packageName });

    const startTime = Date.now();

    try {
      const pm = options.packageManager || this.packageManager;
      const command = this.buildUpdateCommand(pm, packageName);

      await execAsync(command, {
        cwd: options.installDir || this.installDir,
        timeout: options.timeoutMs || 120000,
      });

      return {
        package: packageName,
        success: true,
        installPath: this.getInstallPath(packageName),
        installTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        package: packageName,
        success: false,
        error: (error as Error).message,
        installTimeMs: Date.now() - startTime,
      };
    }
  }

  // ========== Private Methods ==========

  /**
   * Search npm registry for packages
   */
  private async searchNpm(
    prefix: string
  ): Promise<Array<{ name: string; description: string }>> {
    try {
      const command = `npm search ${prefix} --json`;
      const { stdout } = await execAsync(command, { timeout: 30000 });

      const results = JSON.parse(stdout);
      return Array.isArray(results) ? results : [];
    } catch (error) {
      logger.error('AutoInstaller: npm search failed', {
        prefix,
        error,
      });
      return [];
    }
  }

  /**
   * Check if package is installed
   */
  private async isPackageInstalled(packageName: string): Promise<boolean> {
    const installPath = this.getInstallPath(packageName);
    return existsSync(installPath);
  }

  /**
   * Get installation path for package
   */
  private getInstallPath(packageName: string): string {
    return join(this.installDir, packageName);
  }

  /**
   * Extract server name from package name
   */
  private extractServerName(packageName: string): string {
    // @modelcontextprotocol/server-filesystem -> filesystem
    return packageName.replace(/^@[\w-]+\/server-/, '').replace(/-/g, '_');
  }

  /**
   * Build install command for package manager
   */
  private buildInstallCommand(
    pm: 'npm' | 'yarn' | 'pnpm',
    packageName: string,
    globalFlag: string
  ): string {
    switch (pm) {
      case 'npm':
        return `npm install ${globalFlag} ${packageName}`;
      case 'yarn':
        return `yarn ${globalFlag ? 'global ' : ''}add ${packageName}`;
      case 'pnpm':
        return `pnpm ${globalFlag ? '-g ' : ''}add ${packageName}`;
    }
  }

  /**
   * Build uninstall command for package manager
   */
  private buildUninstallCommand(
    pm: 'npm' | 'yarn' | 'pnpm',
    packageName: string,
    globalFlag: string
  ): string {
    switch (pm) {
      case 'npm':
        return `npm uninstall ${globalFlag} ${packageName}`;
      case 'yarn':
        return `yarn ${globalFlag ? 'global ' : ''}remove ${packageName}`;
      case 'pnpm':
        return `pnpm ${globalFlag ? '-g ' : ''}remove ${packageName}`;
    }
  }

  /**
   * Build update command for package manager
   */
  private buildUpdateCommand(
    pm: 'npm' | 'yarn' | 'pnpm',
    packageName: string
  ): string {
    switch (pm) {
      case 'npm':
        return `npm update ${packageName}`;
      case 'yarn':
        return `yarn upgrade ${packageName}`;
      case 'pnpm':
        return `pnpm update ${packageName}`;
    }
  }
}

/**
 * Default auto-installer instance
 */
let defaultInstaller: AutoInstaller | undefined;

/**
 * Get default auto-installer
 */
export function getAutoInstaller(): AutoInstaller {
  if (!defaultInstaller) {
    defaultInstaller = new AutoInstaller();
  }
  return defaultInstaller;
}
