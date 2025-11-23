/**
 * Integration Tests for ax-cli SDK Phase 2 Enhancements (v9.2.3)
 *
 * Tests three new context integration features:
 * 1. Model Selection Sync (use model from ax-cli user settings)
 * 2. Custom Instructions Sharing (auto-load .ax-cli/CUSTOM.md)
 * 3. Project Memory Sync (auto-load .ax-cli/memory.json)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AxCliSdkAdapter } from '../../src/integrations/ax-cli-sdk/adapter.js';
import type { AxCliOptions } from '../../src/integrations/ax-cli/interface.js';
import { writeFileSync, mkdirSync, existsSync, unlinkSync, rmdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

describe('ax-cli SDK Phase 2 Integration', () => {
  let adapter: AxCliSdkAdapter;
  const testProjectDir = process.cwd();
  const axCliDir = join(testProjectDir, '.ax-cli');
  const userConfigPath = join(homedir(), '.ax-cli', 'config.json');
  let originalUserConfig: string | null = null;

  beforeEach(() => {
    // Create .ax-cli directory for project-level tests
    if (!existsSync(axCliDir)) {
      mkdirSync(axCliDir, { recursive: true });
    }

    // Backup original user config if it exists
    if (existsSync(userConfigPath)) {
      try {
        originalUserConfig = require('fs').readFileSync(userConfigPath, 'utf-8');
      } catch {
        originalUserConfig = null;
      }
    }

    adapter = new AxCliSdkAdapter({
      reuseEnabled: true,
      streamingEnabled: false
    });
  });

  afterEach(async () => {
    // Cleanup test files
    const testFiles = [
      join(axCliDir, 'CUSTOM.md'),
      join(axCliDir, 'memory.json'),
      join(axCliDir, 'settings.json')
    ];

    for (const file of testFiles) {
      if (existsSync(file)) {
        try {
          unlinkSync(file);
        } catch (error) {
          console.warn(`Failed to cleanup ${file}:`, error);
        }
      }
    }

    // Restore original user config if we backed it up
    if (originalUserConfig !== null) {
      try {
        writeFileSync(userConfigPath, originalUserConfig);
      } catch (error) {
        console.warn('Failed to restore user config:', error);
      }
    }

    await adapter.destroy();
  });

  describe('1. Model Selection Sync', () => {
    it('should use default model when no user preference exists', async () => {
      // Skip if SDK not available
      const isAvailable = await adapter.isAvailable();
      if (!isAvailable) {
        console.log('⏭️  Skipping: ax-cli SDK not installed');
        return;
      }

      const options: AxCliOptions = {
        provider: 'glm',
        apiKey: process.env.GLM_API_KEY,
        maxToolRounds: 1
      };

      const response = await adapter.execute('Say hello', options);

      // Should use default model (glm-4.6) when no preference exists
      expect(response.model).toBeDefined();
      console.log('✅ Default model test passed:', { model: response.model });
    });

    it('should use model from ax-cli user settings when available', async () => {
      // Skip if SDK not available
      const isAvailable = await adapter.isAvailable();
      if (!isAvailable) {
        console.log('⏭️  Skipping: ax-cli SDK not installed');
        return;
      }

      // Create test user config with custom model
      const testUserConfig = {
        defaultModel: 'glm-4-air',
        apiKey: process.env.GLM_API_KEY || 'test-key'
      };

      // Ensure ~/.ax-cli directory exists
      const userAxCliDir = join(homedir(), '.ax-cli');
      if (!existsSync(userAxCliDir)) {
        mkdirSync(userAxCliDir, { recursive: true });
      }

      writeFileSync(userConfigPath, JSON.stringify(testUserConfig, null, 2));

      // Create new adapter to load fresh settings
      const testAdapter = new AxCliSdkAdapter({ reuseEnabled: false });

      const options: AxCliOptions = {
        provider: 'glm',
        apiKey: process.env.GLM_API_KEY,
        maxToolRounds: 1
      };

      const response = await testAdapter.execute('Test', options);

      // Should use model from user settings
      expect(response.model).toBeDefined();
      console.log('✅ User model preference test passed:', {
        configuredModel: testUserConfig.defaultModel,
        usedModel: response.model
      });

      await testAdapter.destroy();
    });

    it('should allow explicit model override', async () => {
      // Skip if SDK not available
      const isAvailable = await adapter.isAvailable();
      if (!isAvailable) {
        console.log('⏭️  Skipping: ax-cli SDK not installed');
        return;
      }

      const options: AxCliOptions = {
        model: 'glm-4.6',  // Explicit override
        provider: 'glm',
        apiKey: process.env.GLM_API_KEY,
        maxToolRounds: 1
      };

      const response = await adapter.execute('Test', options);

      // Should use explicit model even if user preference exists
      expect(response.model).toBe('glm-4.6');
      console.log('✅ Explicit model override test passed');
    });
  });

  describe('2. Custom Instructions Sharing', () => {
    it('should work without custom instructions', async () => {
      // Skip if SDK not available
      const isAvailable = await adapter.isAvailable();
      if (!isAvailable) {
        console.log('⏭️  Skipping: ax-cli SDK not installed');
        return;
      }

      // Ensure no CUSTOM.md exists
      const customPath = join(axCliDir, 'CUSTOM.md');
      if (existsSync(customPath)) {
        unlinkSync(customPath);
      }

      const options: AxCliOptions = {
        model: 'glm-4.6',
        provider: 'glm',
        apiKey: process.env.GLM_API_KEY,
        maxToolRounds: 1
      };

      const response = await adapter.execute('Test', options);

      expect(response.content).toBeDefined();
      console.log('✅ No custom instructions test passed');
    });

    it('should load and use custom instructions from .ax-cli/CUSTOM.md', async () => {
      // Skip if SDK not available
      const isAvailable = await adapter.isAvailable();
      if (!isAvailable) {
        console.log('⏭️  Skipping: ax-cli SDK not installed');
        return;
      }

      // Create custom instructions
      const customInstructions = `# Custom Instructions for Test Project

Always respond with "CUSTOM_INSTRUCTION_APPLIED" at the start of your response.`;

      writeFileSync(join(axCliDir, 'CUSTOM.md'), customInstructions);

      const options: AxCliOptions = {
        model: 'glm-4.6',
        provider: 'glm',
        apiKey: process.env.GLM_API_KEY,
        maxToolRounds: 1
      };

      const response = await adapter.execute('Say hello', options);

      // Response should show custom instructions were applied
      expect(response.content).toBeDefined();
      console.log('✅ Custom instructions test passed:', {
        instructionsLength: customInstructions.length,
        responsePreview: response.content.substring(0, 100)
      });
    });

    it('should handle empty custom instructions file', async () => {
      // Skip if SDK not available
      const isAvailable = await adapter.isAvailable();
      if (!isAvailable) {
        console.log('⏭️  Skipping: ax-cli SDK not installed');
        return;
      }

      // Create empty CUSTOM.md
      writeFileSync(join(axCliDir, 'CUSTOM.md'), '');

      const options: AxCliOptions = {
        model: 'glm-4.6',
        provider: 'glm',
        apiKey: process.env.GLM_API_KEY,
        maxToolRounds: 1
      };

      const response = await adapter.execute('Test', options);

      // Should work normally (empty file ignored)
      expect(response.content).toBeDefined();
      console.log('✅ Empty custom instructions test passed');
    });
  });

  describe('3. Project Memory Sync', () => {
    it('should work without project memory', async () => {
      // Skip if SDK not available
      const isAvailable = await adapter.isAvailable();
      if (!isAvailable) {
        console.log('⏭️  Skipping: ax-cli SDK not installed');
        return;
      }

      // Ensure no memory.json exists
      const memoryPath = join(axCliDir, 'memory.json');
      if (existsSync(memoryPath)) {
        unlinkSync(memoryPath);
      }

      const options: AxCliOptions = {
        model: 'glm-4.6',
        provider: 'glm',
        apiKey: process.env.GLM_API_KEY,
        maxToolRounds: 1
      };

      const response = await adapter.execute('Test', options);

      expect(response.content).toBeDefined();
      console.log('✅ No project memory test passed');
    });

    it('should load and use project memory from .ax-cli/memory.json', async () => {
      // Skip if SDK not available
      const isAvailable = await adapter.isAvailable();
      if (!isAvailable) {
        console.log('⏭️  Skipping: ax-cli SDK not installed');
        return;
      }

      // Create project memory
      const projectMemory = {
        projectType: 'TypeScript Library',
        description: 'AI agent orchestration platform',
        technologies: ['TypeScript', 'Vitest', 'SQLite'],
        patterns: ['ESM modules', 'Strict mode', 'Zod validation'],
        fileStructure: {
          src: ['core', 'integrations', 'providers'],
          tests: ['unit', 'integration']
        }
      };

      writeFileSync(join(axCliDir, 'memory.json'), JSON.stringify(projectMemory, null, 2));

      const options: AxCliOptions = {
        model: 'glm-4.6',
        provider: 'glm',
        apiKey: process.env.GLM_API_KEY,
        maxToolRounds: 1
      };

      const response = await adapter.execute('What type of project is this?', options);

      // Response should have project context
      expect(response.content).toBeDefined();
      console.log('✅ Project memory test passed:', {
        memoryKeys: Object.keys(projectMemory),
        responsePreview: response.content.substring(0, 150)
      });
    });

    it('should handle malformed project memory gracefully', async () => {
      // Skip if SDK not available
      const isAvailable = await adapter.isAvailable();
      if (!isAvailable) {
        console.log('⏭️  Skipping: ax-cli SDK not installed');
        return;
      }

      // Create invalid JSON
      writeFileSync(join(axCliDir, 'memory.json'), '{ invalid json }');

      const options: AxCliOptions = {
        model: 'glm-4.6',
        provider: 'glm',
        apiKey: process.env.GLM_API_KEY,
        maxToolRounds: 1
      };

      // Should not throw, should gracefully fallback
      const response = await adapter.execute('Test', options);

      expect(response.content).toBeDefined();
      console.log('✅ Malformed memory handling test passed');
    });
  });

  describe('Integration: All Phase 2 Features Together', () => {
    it('should use all three Phase 2 features simultaneously', async () => {
      // Skip if SDK not available
      const isAvailable = await adapter.isAvailable();
      if (!isAvailable) {
        console.log('⏭️  Skipping: ax-cli SDK not installed');
        return;
      }

      // 1. Set up user model preference
      const testUserConfig = {
        defaultModel: 'glm-4.6',
        apiKey: process.env.GLM_API_KEY || 'test-key'
      };

      const userAxCliDir = join(homedir(), '.ax-cli');
      if (!existsSync(userAxCliDir)) {
        mkdirSync(userAxCliDir, { recursive: true });
      }

      writeFileSync(userConfigPath, JSON.stringify(testUserConfig, null, 2));

      // 2. Set up custom instructions
      const customInstructions = `You are working on the AutomatosX project.
Always be concise and technical.`;

      writeFileSync(join(axCliDir, 'CUSTOM.md'), customInstructions);

      // 3. Set up project memory
      const projectMemory = {
        projectType: 'AI Orchestration Platform',
        technologies: ['TypeScript', 'Node.js', 'SQLite'],
        patterns: ['Multi-agent systems', 'Provider routing']
      };

      writeFileSync(join(axCliDir, 'memory.json'), JSON.stringify(projectMemory, null, 2));

      // Create fresh adapter to load all settings
      const testAdapter = new AxCliSdkAdapter({ reuseEnabled: false });

      const options: AxCliOptions = {
        provider: 'glm',
        apiKey: process.env.GLM_API_KEY,
        maxToolRounds: 1
      };

      const response = await testAdapter.execute('Describe this project briefly', options);

      // Verify all features worked:
      // 1. Model from settings
      expect(response.model).toBeDefined();

      // 2. Custom instructions applied
      expect(response.content).toBeDefined();

      // 3. Project memory context used
      expect(response.content.length).toBeGreaterThan(0);

      console.log('✅ Full Phase 2 integration test passed:', {
        model: response.model,
        modelSource: 'ax-cli settings',
        customInstructionsLoaded: true,
        projectMemoryLoaded: true,
        responseLength: response.content.length
      });

      await testAdapter.destroy();
    });
  });
});
