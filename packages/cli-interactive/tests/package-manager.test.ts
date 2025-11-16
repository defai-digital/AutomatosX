/**
 * Tests for PackageManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PackageManager } from '../src/package-manager.js';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn()
}));

describe('PackageManager', () => {
  let packageManager: PackageManager;
  const mockWorkspaceRoot = '/mock/workspace';

  beforeEach(() => {
    packageManager = new PackageManager(mockWorkspaceRoot);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Package Manager Detection', () => {
    it('should detect pnpm when pnpm-lock.yaml exists', async () => {
      const { existsSync } = await import('fs');

      vi.mocked(existsSync).mockImplementation((path: any) => {
        return path.toString().endsWith('pnpm-lock.yaml');
      });

      const pm = await packageManager.detectPackageManager();

      expect(pm.name).toBe('pnpm');
      expect(pm.command).toBe('pnpm');
      expect(pm.lockFile).toBe('pnpm-lock.yaml');
    });

    it('should detect yarn when yarn.lock exists', async () => {
      const { existsSync } = await import('fs');

      vi.mocked(existsSync).mockImplementation((path: any) => {
        const pathStr = path.toString();
        return pathStr.endsWith('yarn.lock') && !pathStr.endsWith('pnpm-lock.yaml');
      });

      const pm = await packageManager.detectPackageManager();

      expect(pm.name).toBe('yarn');
      expect(pm.command).toBe('yarn');
      expect(pm.lockFile).toBe('yarn.lock');
    });

    it('should default to npm when no lockfile exists', async () => {
      const { existsSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(false);

      const pm = await packageManager.detectPackageManager();

      expect(pm.name).toBe('npm');
      expect(pm.command).toBe('npm');
      expect(pm.lockFile).toBe('package-lock.json');
    });

    it('should prioritize pnpm over yarn and npm', async () => {
      const { existsSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(true); // All lockfiles exist

      const pm = await packageManager.detectPackageManager();

      expect(pm.name).toBe('pnpm');
    });
  });

  describe('Build Install Arguments', () => {
    it('should build npm install arguments correctly', () => {
      const packages = ['lodash', 'express'];
      const options = {};

      const args = packageManager['buildInstallArgs'](
        { name: 'npm', command: 'npm', lockFile: 'package-lock.json' },
        packages,
        options
      );

      expect(args).toContain('install');
      expect(args).toContain('lodash');
      expect(args).toContain('express');
    });

    it('should build npm install arguments with dev option', () => {
      const packages = ['typescript'];
      const options = { dev: true };

      const args = packageManager['buildInstallArgs'](
        { name: 'npm', command: 'npm', lockFile: 'package-lock.json' },
        packages,
        options
      );

      expect(args).toContain('install');
      expect(args).toContain('--save-dev');
      expect(args).toContain('typescript');
    });

    it('should build npm install arguments with exact option', () => {
      const packages = ['react@18.2.0'];
      const options = { exact: true };

      const args = packageManager['buildInstallArgs'](
        { name: 'npm', command: 'npm', lockFile: 'package-lock.json' },
        packages,
        options
      );

      expect(args).toContain('install');
      expect(args).toContain('--save-exact');
      expect(args).toContain('react@18.2.0');
    });

    it('should build npm install arguments with global option', () => {
      const packages = ['@automatosx/cli'];
      const options = { global: true };

      const args = packageManager['buildInstallArgs'](
        { name: 'npm', command: 'npm', lockFile: 'package-lock.json' },
        packages,
        options
      );

      expect(args).toContain('install');
      expect(args).toContain('--global');
      expect(args).toContain('@automatosx/cli');
    });

    it('should build yarn add arguments correctly', () => {
      const packages = ['lodash'];
      const options = { dev: true };

      const args = packageManager['buildInstallArgs'](
        { name: 'yarn', command: 'yarn', lockFile: 'yarn.lock' },
        packages,
        options
      );

      expect(args).toContain('add');
      expect(args).toContain('--dev');
      expect(args).toContain('lodash');
    });

    it('should build pnpm add arguments correctly', () => {
      const packages = ['lodash'];
      const options = { dev: true, exact: true };

      const args = packageManager['buildInstallArgs'](
        { name: 'pnpm', command: 'pnpm', lockFile: 'pnpm-lock.yaml' },
        packages,
        options
      );

      expect(args).toContain('add');
      expect(args).toContain('--save-dev');
      expect(args).toContain('--save-exact');
      expect(args).toContain('lodash');
    });

    it('should handle empty package list', () => {
      const packages: string[] = [];
      const options = {};

      const args = packageManager['buildInstallArgs'](
        { name: 'npm', command: 'npm', lockFile: 'package-lock.json' },
        packages,
        options
      );

      expect(args).toContain('install');
      expect(args).not.toContain('lodash');
    });
  });

  describe('Build Update Arguments', () => {
    it('should build npm update arguments correctly', () => {
      const packages = undefined;
      const options = {};

      const args = packageManager['buildUpdateArgs'](
        { name: 'npm', command: 'npm', lockFile: 'package-lock.json' },
        packages,
        options
      );

      expect(args).toContain('update');
    });

    it('should build npm update arguments with specific packages', () => {
      const packages = ['lodash', 'express'];
      const options = {};

      const args = packageManager['buildUpdateArgs'](
        { name: 'npm', command: 'npm', lockFile: 'package-lock.json' },
        packages,
        options
      );

      expect(args).toContain('update');
      expect(args).toContain('lodash');
      expect(args).toContain('express');
    });

    it('should build npm update arguments with latest option', () => {
      const packages = ['lodash'];
      const options = { latest: true };

      const args = packageManager['buildUpdateArgs'](
        { name: 'npm', command: 'npm', lockFile: 'package-lock.json' },
        packages,
        options
      );

      expect(args).toContain('update');
      expect(args).toContain('--latest');
      expect(args).toContain('lodash');
    });

    it('should build yarn upgrade arguments correctly', () => {
      const packages = ['lodash'];
      const options = { latest: true, interactive: true };

      const args = packageManager['buildUpdateArgs'](
        { name: 'yarn', command: 'yarn', lockFile: 'yarn.lock' },
        packages,
        options
      );

      expect(args).toContain('upgrade');
      expect(args).toContain('--latest');
      expect(args).toContain('--interactive');
      expect(args).toContain('lodash');
    });

    it('should build pnpm update arguments correctly', () => {
      const packages = undefined;
      const options = { latest: true };

      const args = packageManager['buildUpdateArgs'](
        { name: 'pnpm', command: 'pnpm', lockFile: 'pnpm-lock.yaml' },
        packages,
        options
      );

      expect(args).toContain('update');
      expect(args).toContain('--latest');
    });
  });

  describe('Build Outdated Arguments', () => {
    it('should build npm outdated arguments with JSON format', () => {
      const args = packageManager['buildOutdatedArgs']({
        name: 'npm',
        command: 'npm',
        lockFile: 'package-lock.json'
      });

      expect(args).toContain('outdated');
      expect(args).toContain('--json');
    });

    it('should build pnpm outdated arguments with JSON format', () => {
      const args = packageManager['buildOutdatedArgs']({
        name: 'pnpm',
        command: 'pnpm',
        lockFile: 'pnpm-lock.yaml'
      });

      expect(args).toContain('outdated');
      expect(args).toContain('--json');
    });

    it('should build yarn outdated arguments without JSON format', () => {
      const args = packageManager['buildOutdatedArgs']({
        name: 'yarn',
        command: 'yarn',
        lockFile: 'yarn.lock'
      });

      expect(args).toContain('outdated');
      // Yarn doesn't support JSON format for outdated
      expect(args).not.toContain('--json');
    });
  });

  describe('Build Info Arguments', () => {
    it('should build npm view arguments correctly', () => {
      const args = packageManager['buildInfoArgs'](
        { name: 'npm', command: 'npm', lockFile: 'package-lock.json' },
        'lodash'
      );

      expect(args).toContain('view');
      expect(args).toContain('lodash');
      expect(args).toContain('--json');
    });

    it('should build yarn info arguments correctly', () => {
      const args = packageManager['buildInfoArgs'](
        { name: 'yarn', command: 'yarn', lockFile: 'yarn.lock' },
        'lodash'
      );

      expect(args).toContain('info');
      expect(args).toContain('lodash');
      expect(args).toContain('--json');
    });

    it('should build pnpm view arguments correctly', () => {
      const args = packageManager['buildInfoArgs'](
        { name: 'pnpm', command: 'pnpm', lockFile: 'pnpm-lock.yaml' },
        'lodash'
      );

      expect(args).toContain('view');
      expect(args).toContain('lodash');
      expect(args).toContain('--json');
    });
  });

  describe('Parse Outdated Output', () => {
    it('should parse npm outdated JSON output correctly', () => {
      const output = JSON.stringify({
        lodash: {
          current: '4.17.20',
          wanted: '4.17.21',
          latest: '4.17.21',
          type: 'dependencies'
        },
        typescript: {
          current: '5.2.0',
          wanted: '5.2.2',
          latest: '5.3.3',
          type: 'devDependencies'
        }
      });

      const outdated = packageManager['parseOutdatedOutput'](output, 'npm');

      expect(outdated).toHaveLength(2);
      expect(outdated[0]?.name).toBe('lodash');
      expect(outdated[0]?.current).toBe('4.17.20');
      expect(outdated[0]?.wanted).toBe('4.17.21');
      expect(outdated[0]?.latest).toBe('4.17.21');
      expect(outdated[0]?.type).toBe('dependencies');
    });

    it('should parse yarn outdated text output correctly', () => {
      const output = `
lodash 4.17.20 4.17.21 4.17.21
typescript 5.2.0 5.2.2 5.3.3
      `.trim();

      const outdated = packageManager['parseOutdatedOutput'](output, 'yarn');

      expect(outdated).toHaveLength(2);
      expect(outdated[0]?.name).toBe('lodash');
      expect(outdated[0]?.current).toBe('4.17.20');
      expect(outdated[0]?.wanted).toBe('4.17.21');
      expect(outdated[0]?.latest).toBe('4.17.21');
    });

    it('should handle empty outdated output', () => {
      const output = '{}';

      const outdated = packageManager['parseOutdatedOutput'](output, 'npm');

      expect(outdated).toHaveLength(0);
    });

    it('should handle invalid JSON gracefully', () => {
      const output = 'Invalid JSON';

      const outdated = packageManager['parseOutdatedOutput'](output, 'npm');

      expect(outdated).toHaveLength(0);
    });
  });

  describe('Parse Package Info', () => {
    it('should parse npm package info correctly', () => {
      const output = JSON.stringify({
        name: 'lodash',
        version: '4.17.21',
        description: 'Lodash modular utilities.',
        homepage: 'https://lodash.com/'
      });

      const info = packageManager['parsePackageInfo'](output, 'npm');

      expect(info.name).toBe('lodash');
      expect(info.version).toBe('4.17.21');
      expect(info.description).toBe('Lodash modular utilities.');
      expect(info.homepage).toBe('https://lodash.com/');
    });

    it('should parse yarn package info correctly', () => {
      const output = JSON.stringify({
        data: {
          name: 'lodash',
          version: '4.17.21',
          description: 'Lodash modular utilities.',
          homepage: 'https://lodash.com/'
        }
      });

      const info = packageManager['parsePackageInfo'](output, 'yarn');

      expect(info.name).toBe('lodash');
      expect(info.version).toBe('4.17.21');
      expect(info.description).toBe('Lodash modular utilities.');
    });

    it('should handle missing optional fields', () => {
      const output = JSON.stringify({
        name: 'test-package',
        version: '1.0.0'
      });

      const info = packageManager['parsePackageInfo'](output, 'npm');

      expect(info.name).toBe('test-package');
      expect(info.version).toBe('1.0.0');
      expect(info.description).toBeUndefined();
      expect(info.homepage).toBeUndefined();
    });

    it('should handle invalid JSON gracefully', () => {
      const output = 'Invalid JSON';

      const info = packageManager['parsePackageInfo'](output, 'npm');

      expect(info.name).toBe('unknown');
      expect(info.version).toBe('0.0.0');
    });
  });
});
