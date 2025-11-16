/**
 * Package Manager
 *
 * Detects and manages npm/yarn/pnpm packages
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

export interface PackageManagerType {
  name: 'npm' | 'yarn' | 'pnpm';
  lockFile: string;
  command: string;
}

export interface InstallOptions {
  dev?: boolean;
  exact?: boolean;
  global?: boolean;
}

export interface UpdateOptions {
  latest?: boolean;
  interactive?: boolean;
}

export interface OutdatedPackage {
  name: string;
  current: string;
  wanted: string;
  latest: string;
  type: 'dependencies' | 'devDependencies';
}

export interface PackageInfo {
  name: string;
  version: string;
  description?: string;
  homepage?: string;
}

export class PackageManager {
  constructor(private workspaceRoot: string) {}

  /**
   * Detect package manager
   */
  async detectPackageManager(): Promise<PackageManagerType> {
    // Check for lockfiles in order of preference
    if (existsSync(join(this.workspaceRoot, 'pnpm-lock.yaml'))) {
      return {
        name: 'pnpm',
        lockFile: 'pnpm-lock.yaml',
        command: 'pnpm'
      };
    }

    if (existsSync(join(this.workspaceRoot, 'yarn.lock'))) {
      return {
        name: 'yarn',
        lockFile: 'yarn.lock',
        command: 'yarn'
      };
    }

    // Default to npm
    return {
      name: 'npm',
      lockFile: 'package-lock.json',
      command: 'npm'
    };
  }

  /**
   * Install packages
   */
  async install(packages: string[], options: InstallOptions = {}): Promise<void> {
    const pm = await this.detectPackageManager();
    const args = this.buildInstallArgs(pm, packages, options);

    await this.executeCommand(pm.command, args);
  }

  /**
   * Update packages
   */
  async update(packages?: string[], options: UpdateOptions = {}): Promise<void> {
    const pm = await this.detectPackageManager();
    const args = this.buildUpdateArgs(pm, packages, options);

    await this.executeCommand(pm.command, args);
  }

  /**
   * Get outdated packages
   */
  async getOutdated(): Promise<OutdatedPackage[]> {
    const pm = await this.detectPackageManager();
    const args = this.buildOutdatedArgs(pm);

    try {
      const result = await this.executeCommand(pm.command, args);
      return this.parseOutdatedOutput(result.stdout, pm.name);
    } catch (error) {
      // outdated command returns non-zero when packages are outdated
      // Parse output anyway if available
      if (error && typeof error === 'object' && 'stdout' in error) {
        return this.parseOutdatedOutput((error as any).stdout || '', pm.name);
      }
      return [];
    }
  }

  /**
   * Get package info
   */
  async getPackageInfo(packageName: string): Promise<PackageInfo> {
    const pm = await this.detectPackageManager();
    const args = this.buildInfoArgs(pm, packageName);

    const result = await this.executeCommand(pm.command, args);
    return this.parsePackageInfo(result.stdout, pm.name);
  }

  /**
   * Build install arguments
   */
  private buildInstallArgs(pm: PackageManagerType, packages: string[], options: InstallOptions): string[] {
    const args: string[] = [];

    switch (pm.name) {
      case 'npm':
        args.push('install');
        if (options.dev) args.push('--save-dev');
        if (options.exact) args.push('--save-exact');
        if (options.global) args.push('--global');
        break;

      case 'yarn':
        args.push('add');
        if (options.dev) args.push('--dev');
        if (options.exact) args.push('--exact');
        if (options.global) args.push('global');
        break;

      case 'pnpm':
        args.push('add');
        if (options.dev) args.push('--save-dev');
        if (options.exact) args.push('--save-exact');
        if (options.global) args.push('--global');
        break;
    }

    if (packages.length > 0) {
      args.push(...packages);
    }

    return args;
  }

  /**
   * Build update arguments
   */
  private buildUpdateArgs(pm: PackageManagerType, packages: string[] | undefined, options: UpdateOptions): string[] {
    const args: string[] = [];

    switch (pm.name) {
      case 'npm':
        args.push('update');
        if (options.latest) args.push('--latest');
        break;

      case 'yarn':
        args.push('upgrade');
        if (options.latest) args.push('--latest');
        if (options.interactive) args.push('--interactive');
        break;

      case 'pnpm':
        args.push('update');
        if (options.latest) args.push('--latest');
        if (options.interactive) args.push('--interactive');
        break;
    }

    if (packages && packages.length > 0) {
      args.push(...packages);
    }

    return args;
  }

  /**
   * Build outdated arguments
   */
  private buildOutdatedArgs(pm: PackageManagerType): string[] {
    const args: string[] = ['outdated'];

    // Request JSON output for easier parsing
    if (pm.name === 'npm' || pm.name === 'pnpm') {
      args.push('--json');
    }

    return args;
  }

  /**
   * Build info arguments
   */
  private buildInfoArgs(pm: PackageManagerType, packageName: string): string[] {
    switch (pm.name) {
      case 'npm':
        return ['view', packageName, '--json'];
      case 'yarn':
        return ['info', packageName, '--json'];
      case 'pnpm':
        return ['view', packageName, '--json'];
    }
  }

  /**
   * Parse outdated output
   */
  private parseOutdatedOutput(output: string, pmName: string): OutdatedPackage[] {
    const outdated: OutdatedPackage[] = [];

    if (pmName === 'npm' || pmName === 'pnpm') {
      try {
        const data = JSON.parse(output);

        for (const [name, info] of Object.entries(data)) {
          const pkgInfo = info as any;
          outdated.push({
            name,
            current: pkgInfo.current || '0.0.0',
            wanted: pkgInfo.wanted || pkgInfo.current || '0.0.0',
            latest: pkgInfo.latest || pkgInfo.wanted || pkgInfo.current || '0.0.0',
            type: pkgInfo.type || 'dependencies'
          });
        }
      } catch {
        // Failed to parse JSON, return empty array
      }
    } else if (pmName === 'yarn') {
      // Yarn doesn't provide JSON output for outdated
      // Parse text format: Package Current Wanted Latest
      const lines = output.split('\n');
      for (const line of lines) {
        const match = line.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/);
        if (match) {
          outdated.push({
            name: match[1] || '',
            current: match[2] || '0.0.0',
            wanted: match[3] || '0.0.0',
            latest: match[4] || '0.0.0',
            type: 'dependencies'
          });
        }
      }
    }

    return outdated;
  }

  /**
   * Parse package info
   */
  private parsePackageInfo(output: string, pmName: string): PackageInfo {
    try {
      const data = JSON.parse(output);

      if (pmName === 'yarn') {
        // Yarn wraps response in { data: {...} }
        const info = data.data || data;
        return {
          name: info.name || 'unknown',
          version: info.version || '0.0.0',
          description: info.description,
          homepage: info.homepage
        };
      }

      // npm and pnpm
      return {
        name: data.name || 'unknown',
        version: data.version || '0.0.0',
        description: data.description,
        homepage: data.homepage
      };
    } catch {
      return {
        name: 'unknown',
        version: '0.0.0'
      };
    }
  }

  /**
   * Execute command
   * BUG #41 FIX: Disable shell execution to prevent command injection
   */
  private async executeCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        cwd: this.workspaceRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false  // SECURITY: Prevent command injection via package names/versions
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (code: number | null) => {
        const exitCode = code ?? -1;
        if (exitCode === 0) {
          resolve({ stdout, stderr, exitCode });
        } else {
          const error = new Error(`Command failed with exit code ${exitCode}`);
          (error as any).stdout = stdout;
          (error as any).stderr = stderr;
          (error as any).exitCode = exitCode;
          reject(error);
        }
      });

      proc.on('error', (error: Error) => {
        reject(error);
      });
    });
  }
}
