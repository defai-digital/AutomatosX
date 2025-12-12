/**
 * Gemini CLI Command Translator Unit Tests
 *
 * Tests for bidirectional translation between Gemini CLI TOML commands
 * and AutomatosX markdown abilities.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import { CommandTranslator } from '../../../../src/integrations/gemini-cli/command-translator.js';
import { GeminiCLIError, GeminiCLIErrorType } from '../../../../src/integrations/gemini-cli/types.js';

// Mock fs/promises
vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

vi.mock('os', () => ({
  homedir: () => '/home/user',
}));

vi.mock('../../../../src/shared/logging/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('CommandTranslator', () => {
  // Paths must match the actual implementation in utils/file-reader.ts
  const userCommandsPath = '/home/user/.gemini/commands';
  const projectCommandsPath = `${process.cwd()}/.gemini/commands`;

  beforeEach(() => {
    vi.clearAllMocks();
    vol.reset();
  });

  afterEach(() => {
    vol.reset();
  });

  describe('constructor', () => {
    it('should create CommandTranslator', () => {
      const translator = new CommandTranslator();
      expect(translator).toBeDefined();
    });
  });

  describe('tomlToAbility', () => {
    const validToml = `
description = "Test command"
prompt = """
This is a test prompt with {{args}} placeholder.
"""
`;

    it('should convert TOML to ability markdown', async () => {
      vol.fromJSON({
        '/test/command.toml': validToml,
      });

      const translator = new CommandTranslator();
      await translator.tomlToAbility(
        '/test/command.toml',
        '/output/command.md',
        { includeTimestamp: false }
      );

      // Read output
      const output = vol.readFileSync('/output/command.md', 'utf-8') as string;

      expect(output).toContain('# Test command');
      expect(output).toContain('## Objective');
      expect(output).toContain('## Instructions');
      expect(output).toContain('{USER_INPUT}'); // {{args}} should be converted
      expect(output).toContain('Imported from Gemini CLI command: /command');
    });

    it('should include timestamp when option is true', async () => {
      vol.fromJSON({
        '/test/command.toml': validToml,
      });

      const translator = new CommandTranslator();
      await translator.tomlToAbility(
        '/test/command.toml',
        '/output/command.md',
        { includeTimestamp: true }
      );

      const output = vol.readFileSync('/output/command.md', 'utf-8') as string;
      expect(output).toContain('Generated on');
    });

    it('should throw when output file exists and overwrite is false', async () => {
      vol.fromJSON({
        '/test/command.toml': validToml,
        '/output/command.md': 'existing content',
      });

      const translator = new CommandTranslator();
      await expect(
        translator.tomlToAbility(
          '/test/command.toml',
          '/output/command.md',
          { overwrite: false }
        )
      ).rejects.toThrow(GeminiCLIError);
    });

    it('should overwrite when option is true', async () => {
      vol.fromJSON({
        '/test/command.toml': validToml,
        '/output/command.md': 'existing content',
      });

      const translator = new CommandTranslator();
      await translator.tomlToAbility(
        '/test/command.toml',
        '/output/command.md',
        { overwrite: true, includeTimestamp: false }
      );

      const output = vol.readFileSync('/output/command.md', 'utf-8') as string;
      expect(output).toContain('# Test command');
    });

    it('should throw on file exceeding size limit', async () => {
      // Create a large file (> 1MB)
      const largeContent = 'x'.repeat(1024 * 1024 + 1);
      vol.fromJSON({
        '/test/large.toml': largeContent,
      });

      const translator = new CommandTranslator();
      await expect(
        translator.tomlToAbility('/test/large.toml', '/output/large.md')
      ).rejects.toThrow(/exceeds maximum allowed size/);
    });

    it('should throw on validation failure when validate is true', async () => {
      const invalidToml = `
# Missing required fields
invalid = "config"
`;
      vol.fromJSON({
        '/test/invalid.toml': invalidToml,
      });

      const translator = new CommandTranslator();
      await expect(
        translator.tomlToAbility(
          '/test/invalid.toml',
          '/output/invalid.md',
          { validate: true }
        )
      ).rejects.toThrow(GeminiCLIError);
    });

    it('should escape markdown special characters', async () => {
      const tomlWithSpecialChars = `
description = "Test *bold* and _italic_ and \`code\`"
prompt = "Test prompt"
`;
      vol.fromJSON({
        '/test/special.toml': tomlWithSpecialChars,
      });

      const translator = new CommandTranslator();
      await translator.tomlToAbility(
        '/test/special.toml',
        '/output/special.md',
        { includeTimestamp: false }
      );

      const output = vol.readFileSync('/output/special.md', 'utf-8') as string;
      expect(output).toContain('\\*bold\\*');
      expect(output).toContain('\\_italic\\_');
      expect(output).toContain('\\`code\\`');
    });

    it('should create output directory if not exists', async () => {
      vol.fromJSON({
        '/test/command.toml': validToml,
      });

      const translator = new CommandTranslator();
      await translator.tomlToAbility(
        '/test/command.toml',
        '/deep/nested/output/command.md',
        { includeTimestamp: false }
      );

      expect(vol.existsSync('/deep/nested/output/command.md')).toBe(true);
    });
  });

  describe('abilityToToml', () => {
    const validAbility = `# Test Ability

## Objective
This is a test objective.

## Instructions
This is a test prompt with {USER_INPUT} placeholder.

## Expected Output
Clear results.

## Notes
- Notes here
`;

    it('should convert ability markdown to TOML', async () => {
      vol.fromJSON({
        '/test/ability.md': validAbility,
      });

      const translator = new CommandTranslator();
      await translator.abilityToToml(
        '/test/ability.md',
        '/output/command.toml'
      );

      const output = vol.readFileSync('/output/command.toml', 'utf-8') as string;
      expect(output).toContain('description = "This is a test objective."');
      expect(output).toContain('{{args}}'); // {USER_INPUT} should be converted
      expect(output).toContain('prompt = """');
    });

    it('should throw when output file exists and overwrite is false', async () => {
      vol.fromJSON({
        '/test/ability.md': validAbility,
        '/output/command.toml': 'existing content',
      });

      const translator = new CommandTranslator();
      await expect(
        translator.abilityToToml(
          '/test/ability.md',
          '/output/command.toml',
          { overwrite: false }
        )
      ).rejects.toThrow(GeminiCLIError);
    });

    it('should overwrite when option is true', async () => {
      vol.fromJSON({
        '/test/ability.md': validAbility,
        '/output/command.toml': 'existing content',
      });

      const translator = new CommandTranslator();
      await translator.abilityToToml(
        '/test/ability.md',
        '/output/command.toml',
        { overwrite: true }
      );

      const output = vol.readFileSync('/output/command.toml', 'utf-8') as string;
      expect(output).toContain('description');
    });

    it('should throw when Objective section is missing', async () => {
      const invalidAbility = `# Test

## Instructions
Some instructions.
`;
      vol.fromJSON({
        '/test/invalid.md': invalidAbility,
      });

      const translator = new CommandTranslator();
      await expect(
        translator.abilityToToml('/test/invalid.md', '/output/invalid.toml')
      ).rejects.toThrow(/no Objective section found/);
    });

    it('should throw when Instructions section is missing', async () => {
      const invalidAbility = `# Test

## Objective
Some objective.
`;
      vol.fromJSON({
        '/test/invalid.md': invalidAbility,
      });

      const translator = new CommandTranslator();
      await expect(
        translator.abilityToToml('/test/invalid.md', '/output/invalid.toml')
      ).rejects.toThrow(/no Instructions section found/);
    });

    it('should escape quotes in description', async () => {
      const abilityWithQuotes = `# Test

## Objective
This has "quotes" in it.

## Instructions
Some instructions.
`;
      vol.fromJSON({
        '/test/quotes.md': abilityWithQuotes,
      });

      const translator = new CommandTranslator();
      await translator.abilityToToml('/test/quotes.md', '/output/quotes.toml');

      const output = vol.readFileSync('/output/quotes.toml', 'utf-8') as string;
      expect(output).toContain('\\"quotes\\"');
    });
  });

  describe('scanGeminiCommands', () => {
    it('should scan directory for TOML commands', async () => {
      const toml1 = `description = "Command 1"\nprompt = "test"`;
      const toml2 = `description = "Command 2"\nprompt = "test"`;

      vol.fromJSON({
        [`${userCommandsPath}/cmd1.toml`]: toml1,
        [`${userCommandsPath}/cmd2.toml`]: toml2,
      });

      const translator = new CommandTranslator();
      const commands = await translator.scanGeminiCommands(userCommandsPath);

      expect(commands).toHaveLength(2);
      expect(commands.map(c => c.name)).toContain('cmd1');
      expect(commands.map(c => c.name)).toContain('cmd2');
    });

    it('should handle nested directories with namespaces', async () => {
      const toml = `description = "Nested command"\nprompt = "test"`;

      vol.fromJSON({
        [`${userCommandsPath}/subdir/nested.toml`]: toml,
      });

      const translator = new CommandTranslator();
      const commands = await translator.scanGeminiCommands(userCommandsPath);

      expect(commands).toHaveLength(1);
      expect(commands[0]?.name).toBe('subdir:nested');
    });

    it('should limit recursion depth', async () => {
      const toml = `description = "Deep command"\nprompt = "test"`;

      // Create deeply nested structure (> 3 levels)
      vol.fromJSON({
        [`${userCommandsPath}/a/b/c/d/deep.toml`]: toml,
      });

      const translator = new CommandTranslator();
      const consoleSpy = vi.spyOn(console, 'warn');

      const commands = await translator.scanGeminiCommands(userCommandsPath);

      // Should not find the deep command due to recursion limit
      expect(commands.find(c => c.name.includes('deep'))).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Maximum recursion depth')
      );
    });

    it('should return empty array for non-existent directory', async () => {
      const translator = new CommandTranslator();
      const commands = await translator.scanGeminiCommands('/non/existent');

      expect(commands).toEqual([]);
    });

    it('should skip files exceeding size limit', async () => {
      const largeContent = 'x'.repeat(1024 * 1024 + 1);

      vol.fromJSON({
        [`${userCommandsPath}/large.toml`]: largeContent,
        [`${userCommandsPath}/normal.toml`]: 'description = "Normal"\nprompt = "test"',
      });

      const translator = new CommandTranslator();
      const consoleSpy = vi.spyOn(console, 'warn');

      const commands = await translator.scanGeminiCommands(userCommandsPath);

      expect(commands).toHaveLength(1);
      expect(commands[0]?.name).toBe('normal');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('exceeds maximum size')
      );
    });

    it('should skip invalid TOML files', async () => {
      vol.fromJSON({
        [`${userCommandsPath}/invalid.toml`]: 'not valid toml {{',
        [`${userCommandsPath}/valid.toml`]: 'description = "Valid"\nprompt = "test"',
      });

      const translator = new CommandTranslator();
      const consoleSpy = vi.spyOn(console, 'error');

      const commands = await translator.scanGeminiCommands(userCommandsPath);

      expect(commands).toHaveLength(1);
      expect(commands[0]?.name).toBe('valid');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should include project commands when option is true', async () => {
      vol.fromJSON({
        [`${userCommandsPath}/user-cmd.toml`]: 'description = "User"\nprompt = "test"',
        [`${projectCommandsPath}/project-cmd.toml`]: 'description = "Project"\nprompt = "test"',
      });

      const translator = new CommandTranslator();
      const commands = await translator.scanGeminiCommands(undefined, true);

      expect(commands.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('importCommand', () => {
    it('should import a command by name', async () => {
      const toml = `description = "Importable command"\nprompt = "test {{args}}"`;

      vol.fromJSON({
        [`${userCommandsPath}/importme.toml`]: toml,
      });

      const translator = new CommandTranslator();
      const outputPath = await translator.importCommand('importme', '/output');

      expect(outputPath).toBe('/output/gemini-importme.md');
      expect(vol.existsSync('/output/gemini-importme.md')).toBe(true);
    });

    it('should handle command names with colons', async () => {
      const toml = `description = "Namespaced command"\nprompt = "test"`;

      vol.fromJSON({
        [`${userCommandsPath}/ns/cmd.toml`]: toml,
      });

      const translator = new CommandTranslator();
      const outputPath = await translator.importCommand('ns:cmd', '/output');

      // Colons should be replaced with hyphens
      expect(outputPath).toBe('/output/gemini-ns-cmd.md');
    });

    it('should throw when command not found', async () => {
      const translator = new CommandTranslator();

      await expect(
        translator.importCommand('nonexistent', '/output')
      ).rejects.toThrow(GeminiCLIError);
    });

    it('should include available commands in error', async () => {
      vol.fromJSON({
        [`${userCommandsPath}/available.toml`]: 'description = "Available"\nprompt = "test"',
      });

      const translator = new CommandTranslator();

      try {
        await translator.importCommand('nonexistent', '/output');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(GeminiCLIError);
        // GeminiCLIError uses 'details' not 'context'
        expect((error as GeminiCLIError).details?.availableCommands).toContain('available');
      }
    });
  });

  describe('importCommands', () => {
    it('should import multiple commands', async () => {
      vol.fromJSON({
        [`${userCommandsPath}/cmd1.toml`]: 'description = "Command 1"\nprompt = "test"',
        [`${userCommandsPath}/cmd2.toml`]: 'description = "Command 2"\nprompt = "test"',
      });

      const translator = new CommandTranslator();
      const paths = await translator.importCommands(['cmd1', 'cmd2'], '/output');

      expect(paths).toHaveLength(2);
      expect(vol.existsSync('/output/gemini-cmd1.md')).toBe(true);
      expect(vol.existsSync('/output/gemini-cmd2.md')).toBe(true);
    });

    it('should continue on error and log failures', async () => {
      vol.fromJSON({
        [`${userCommandsPath}/exists.toml`]: 'description = "Exists"\nprompt = "test"',
      });

      const translator = new CommandTranslator();
      const consoleSpy = vi.spyOn(console, 'error');

      const paths = await translator.importCommands(
        ['exists', 'missing'],
        '/output'
      );

      expect(paths).toHaveLength(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to import missing')
      );
    });
  });

  describe('listCommands', () => {
    it('should list all command names', async () => {
      vol.fromJSON({
        [`${userCommandsPath}/cmd1.toml`]: 'description = "Command 1"\nprompt = "test"',
        [`${userCommandsPath}/cmd2.toml`]: 'description = "Command 2"\nprompt = "test"',
      });

      const translator = new CommandTranslator();
      const names = await translator.listCommands();

      expect(names).toContain('cmd1');
      expect(names).toContain('cmd2');
    });

    it('should include project commands when option is true', async () => {
      vol.fromJSON({
        [`${userCommandsPath}/user.toml`]: 'description = "User"\nprompt = "test"',
        [`${projectCommandsPath}/project.toml`]: 'description = "Project"\nprompt = "test"',
      });

      const translator = new CommandTranslator();
      const names = await translator.listCommands(true);

      expect(names.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getCommand', () => {
    it('should get command by name', async () => {
      vol.fromJSON({
        [`${userCommandsPath}/target.toml`]: 'description = "Target command"\nprompt = "test"',
      });

      const translator = new CommandTranslator();
      const command = await translator.getCommand('target');

      expect(command).toBeDefined();
      expect(command?.name).toBe('target');
      expect(command?.description).toBe('Target command');
    });

    it('should return undefined for non-existent command', async () => {
      const translator = new CommandTranslator();
      const command = await translator.getCommand('nonexistent');

      expect(command).toBeUndefined();
    });
  });
});

describe('defaultTranslator', () => {
  it('should export a default CommandTranslator instance', async () => {
    const { defaultTranslator, CommandTranslator: CT } = await import(
      '../../../../src/integrations/gemini-cli/command-translator.js'
    );
    expect(defaultTranslator).toBeInstanceOf(CT);
  });
});
