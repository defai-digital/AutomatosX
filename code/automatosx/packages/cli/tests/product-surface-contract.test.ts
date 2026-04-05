import { describe, expect, it } from 'vitest';
import {
  ADVANCED_COMMANDS,
  COMMAND_ALIASES,
  COMMAND_METADATA,
  EXPERIMENTAL_COMMANDS,
  RETAINED_COMMANDS,
  WORKFLOW_COMMAND_NAMES,
  getCommandMetadata,
  resolveCommandAlias,
} from '../src/command-metadata.js';

describe('v15 product surface contract', () => {
  it('marks the workflow-first core and supporting stable commands as stable product tier', () => {
    const stableCommands = [
      'setup',
      'ship',
      'architect',
      'audit',
      'qa',
      'release',
      'list',
      'run',
      'resume',
      'trace',
      'agent',
      'discuss',
      'review',
      'policy',
      'doctor',
      'status',
      'config',
    ] as const;

    for (const command of stableCommands) {
      expect(getCommandMetadata(command)?.productTier).toBe('stable');
    }
  });

  it('keeps bridge, skill, and monitor outside the stable default product tier', () => {
    expect(getCommandMetadata('bridge')?.productTier).toBe('advanced');
    expect(getCommandMetadata('skill')?.productTier).toBe('advanced');
    expect(getCommandMetadata('monitor')?.productTier).toBe('advanced');
  });

  it('treats all first-class workflow commands as stable', () => {
    for (const command of WORKFLOW_COMMAND_NAMES) {
      expect(getCommandMetadata(command)?.productTier).toBe('stable');
    }
  });

  it('keeps retained and advanced command groupings disjoint', () => {
    const stableCommands = new Set(RETAINED_COMMANDS.map((entry) => entry.command));
    const advancedCommands = new Set(ADVANCED_COMMANDS.map((entry) => entry.command));

    for (const command of stableCommands) {
      expect(advancedCommands.has(command)).toBe(false);
    }
  });

  it('does not currently expose experimental CLI commands by default', () => {
    expect(EXPERIMENTAL_COMMANDS).toEqual([]);
    expect(COMMAND_METADATA.some((entry) => entry.productTier === 'experimental')).toBe(false);
  });

  it('resolves command aliases to their canonical names', () => {
    expect(resolveCommandAlias('guard')).toBe('policy');
    expect(getCommandMetadata('guard')?.command).toBe('policy');
  });

  it('ensures every alias target exists in command metadata', () => {
    for (const [alias, canonical] of Object.entries(COMMAND_ALIASES)) {
      expect(getCommandMetadata(canonical)).toBeDefined();
      expect(getCommandMetadata(alias)?.command).toBe(canonical);
    }
  });
});
