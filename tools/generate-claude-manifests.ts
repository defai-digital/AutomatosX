#!/usr/bin/env tsx
/**
 * Generate Claude Code Integration Manifests
 *
 * Auto-generates Skills, Commands, and Sub-Agents from agent profiles.
 * Runs at build time to ensure integration always matches actual capabilities.
 *
 * Usage:
 *   tsx tools/generate-claude-manifests.ts
 *   npm run generate:claude-manifests
 */

import { join } from 'path';
import { ManifestGenerator } from '../src/integrations/claude-code/manifest-generator.js';
import { ProfileLoader } from '../src/agents/profile-loader.js';
import { TeamManager } from '../src/core/team-manager.js';
import { logger, setLogLevel } from '../src/utils/logger.js';

async function main(): Promise<void> {
  console.log('🔧 Claude Code Manifest Generator');
  console.log('---');

  // Set log level based on environment
  if (process.env.DEBUG || process.env.AUTOMATOSX_LOG_LEVEL === 'debug') {
    setLogLevel('debug');
  } else {
    setLogLevel('info');
  }

  try {
    const projectDir = process.cwd();
    const agentsDir = join(projectDir, '.automatosx', 'agents');
    const teamsDir = join(projectDir, '.automatosx', 'teams');

    console.log('📂 Project directory:', projectDir);
    console.log('📂 Agents directory:', agentsDir);

    // Initialize TeamManager
    const teamManager = new TeamManager(teamsDir);

    // Initialize ProfileLoader
    const profileLoader = new ProfileLoader(agentsDir, undefined, teamManager);

    // Load all agent profiles to verify directory exists
    const agentNames = await profileLoader.listProfiles();
    console.log(`✅ Found ${agentNames.length} agent profiles`);

    // Create ManifestGenerator
    const generator = new ManifestGenerator({
      profileLoader,
      projectDir
    });

    // Generate all manifests
    console.log('📝 Generating manifests...');
    await generator.generateAll();

    console.log('---');
    console.log('✅ Manifest generation complete!');
    console.log('');
    console.log('📦 Generated files:');
    console.log('  - .claude/skills/automatosx/SKILL.md');
    console.log(`  - .claude/commands/agent-*.md (${agentNames.length} commands)`);
    console.log('  - .claude/agents/automatosx-coordinator/AGENT.md');
    console.log('');
    console.log('🔄 Next steps:');
    console.log('  1. Review generated files in .claude/');
    console.log('  2. Run: ax setup --claude-code');
    console.log('  3. Test with: claude "List all available AutomatosX agents"');

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('❌ Manifest generation failed!');
    console.error('');
    if (error instanceof Error) {
      console.error('Error:', error.message);
      if (process.env.DEBUG) {
        console.error('Stack:', error.stack);
      }
    } else {
      console.error('Error:', String(error));
    }
    console.error('');
    console.error('💡 Troubleshooting:');
    console.error('  - Ensure .automatosx/agents/ directory exists');
    console.error('  - Run: ax setup (if not already initialized)');
    console.error('  - Check file permissions for .claude/ directory');

    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
