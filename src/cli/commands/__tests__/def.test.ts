/**
 * Tests for def command
 * Sprint 3 Day 27: CLI command tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { Command } from 'commander'
import { createDefCommand } from '../def.js'
import * as FileService from '../../../services/FileService.js'

// Mock FileService
vi.mock('../../../services/FileService.js', () => ({
  findDefinition: vi.fn(),
  getFileService: vi.fn(() => ({
    findDefinition: vi.fn(),
  })),
}))

describe('def command', () => {
  let command: Command
  let program: Command

  beforeEach(() => {
    command = createDefCommand()
    program = new Command()
    program.addCommand(command)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('command registration', () => {
    it('should register def command', () => {
      expect(command.name()).toBe('def')
    })

    it('should have correct aliases', () => {
      expect(command.aliases()).toContain('definition')
    })

    it('should have description', () => {
      const desc = command.description()
      expect(desc).toBeTruthy()
      expect(desc.toLowerCase()).toContain('definition')
    })

    it('should require symbol argument', () => {
      const args = command.registeredArguments
      expect(args).toHaveLength(1)
      expect(args[0].name()).toBe('symbol')
      expect(args[0].required).toBe(true)
    })
  })

  describe('command options', () => {
    it('should have lang option', () => {
      const option = command.options.find((opt) => opt.long === '--lang')
      expect(option).toBeDefined()
    })

    it('should have kind option', () => {
      const option = command.options.find((opt) => opt.long === '--kind')
      expect(option).toBeDefined()
    })

    it('should have json option', () => {
      const option = command.options.find((opt) => opt.long === '--json')
      expect(option).toBeDefined()
    })

    it('should have verbose option', () => {
      const option = command.options.find((opt) => opt.long === '--verbose')
      expect(option).toBeDefined()
    })

    it('should have line option for line numbers', () => {
      const option = command.options.find((opt) => opt.long === '--line')
      expect(option).toBeDefined()
    })
  })

  describe('command execution', () => {
    it('should find definition for symbol', async () => {
      const mockFind = vi.fn().mockResolvedValue({
        symbol: 'getUserById',
        file: 'src/services/UserService.ts',
        line: 42,
        kind: 'function',
        signature: 'function getUserById(id: string): Promise<User>',
      })
      vi.mocked(FileService.findDefinition).mockImplementation(mockFind)

      await program.parseAsync(['node', 'test', 'def', 'getUserById'])

      expect(mockFind).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'getUserById',
        })
      )
    })

    it('should apply language filter', async () => {
      const mockFind = vi.fn().mockResolvedValue(null)
      vi.mocked(FileService.findDefinition).mockImplementation(mockFind)

      await program.parseAsync(['node', 'test', 'def', 'Calculator', '--lang', 'typescript'])

      expect(mockFind).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'Calculator',
          lang: 'typescript',
        })
      )
    })

    it('should apply kind filter', async () => {
      const mockFind = vi.fn().mockResolvedValue(null)
      vi.mocked(FileService.findDefinition).mockImplementation(mockFind)

      await program.parseAsync(['node', 'test', 'def', 'User', '--kind', 'class'])

      expect(mockFind).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'User',
          kind: 'class',
        })
      )
    })

    it('should show line numbers when requested', async () => {
      const mockFind = vi.fn().mockResolvedValue({
        symbol: 'add',
        file: 'src/math.ts',
        line: 10,
        kind: 'function',
        signature: 'function add(a: number, b: number): number',
        source: 'function add(a: number, b: number): number { return a + b; }',
      })
      vi.mocked(FileService.findDefinition).mockImplementation(mockFind)

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await program.parseAsync(['node', 'test', 'def', 'add', '--line'])

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('output formatting', () => {
    it('should format definition as text by default', async () => {
      const mockDefinition = {
        symbol: 'User',
        file: 'src/models/User.ts',
        line: 5,
        kind: 'class',
        signature: 'class User { }',
      }

      const mockFind = vi.fn().mockResolvedValue(mockDefinition)
      vi.mocked(FileService.findDefinition).mockImplementation(mockFind)

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await program.parseAsync(['node', 'test', 'def', 'User'])

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should format definition as JSON when requested', async () => {
      const mockDefinition = {
        symbol: 'User',
        file: 'src/models/User.ts',
        line: 5,
        kind: 'class',
        signature: 'class User { }',
      }

      const mockFind = vi.fn().mockResolvedValue(mockDefinition)
      vi.mocked(FileService.findDefinition).mockImplementation(mockFind)

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await program.parseAsync(['node', 'test', 'def', 'User', '--json'])

      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(mockDefinition, null, 2))
      consoleSpy.mockRestore()
    })

    it('should show verbose output with source code', async () => {
      const mockDefinition = {
        symbol: 'getUserById',
        file: 'src/services/UserService.ts',
        line: 42,
        kind: 'function',
        signature: 'function getUserById(id: string): Promise<User>',
        source: 'async function getUserById(id: string): Promise<User> { /* implementation */ }',
      }

      const mockFind = vi.fn().mockResolvedValue(mockDefinition)
      vi.mocked(FileService.findDefinition).mockImplementation(mockFind)

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await program.parseAsync(['node', 'test', 'def', 'getUserById', '--verbose'])

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('error handling', () => {
    it('should handle empty symbol', async () => {
      await expect(program.parseAsync(['node', 'test', 'def', ''])).rejects.toThrow()
    })

    it('should handle symbol not found', async () => {
      const mockFind = vi.fn().mockResolvedValue(null)
      vi.mocked(FileService.findDefinition).mockImplementation(mockFind)

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await program.parseAsync(['node', 'test', 'def', 'NonExistentSymbol'])

      expect(mockFind).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should handle search errors gracefully', async () => {
      const mockFind = vi.fn().mockRejectedValue(new Error('Database error'))
      vi.mocked(FileService.findDefinition).mockImplementation(mockFind)

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await program.parseAsync(['node', 'test', 'def', 'test'])

      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })
  })

  describe('definition types', () => {
    it('should find function definitions', async () => {
      const mockFind = vi.fn().mockResolvedValue({
        symbol: 'calculateTotal',
        file: 'src/utils/math.ts',
        line: 15,
        kind: 'function',
        signature: 'function calculateTotal(items: Item[]): number',
      })
      vi.mocked(FileService.findDefinition).mockImplementation(mockFind)

      await program.parseAsync(['node', 'test', 'def', 'calculateTotal', '--kind', 'function'])

      expect(mockFind).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'function',
        })
      )
    })

    it('should find class definitions', async () => {
      const mockFind = vi.fn().mockResolvedValue({
        symbol: 'UserService',
        file: 'src/services/UserService.ts',
        line: 10,
        kind: 'class',
        signature: 'class UserService { }',
      })
      vi.mocked(FileService.findDefinition).mockImplementation(mockFind)

      await program.parseAsync(['node', 'test', 'def', 'UserService', '--kind', 'class'])

      expect(mockFind).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'class',
        })
      )
    })

    it('should find interface definitions', async () => {
      const mockFind = vi.fn().mockResolvedValue({
        symbol: 'IUser',
        file: 'src/types/User.ts',
        line: 5,
        kind: 'interface',
        signature: 'interface IUser { id: string; name: string; }',
      })
      vi.mocked(FileService.findDefinition).mockImplementation(mockFind)

      await program.parseAsync(['node', 'test', 'def', 'IUser', '--kind', 'interface'])

      expect(mockFind).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'interface',
        })
      )
    })

    it('should find type definitions', async () => {
      const mockFind = vi.fn().mockResolvedValue({
        symbol: 'UserId',
        file: 'src/types/User.ts',
        line: 3,
        kind: 'type',
        signature: 'type UserId = string',
      })
      vi.mocked(FileService.findDefinition).mockImplementation(mockFind)

      await program.parseAsync(['node', 'test', 'def', 'UserId', '--kind', 'type'])

      expect(mockFind).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'type',
        })
      )
    })

    it('should find variable definitions', async () => {
      const mockFind = vi.fn().mockResolvedValue({
        symbol: 'API_KEY',
        file: 'src/config.ts',
        line: 8,
        kind: 'variable',
        signature: 'const API_KEY: string',
      })
      vi.mocked(FileService.findDefinition).mockImplementation(mockFind)

      await program.parseAsync(['node', 'test', 'def', 'API_KEY', '--kind', 'variable'])

      expect(mockFind).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'variable',
        })
      )
    })
  })

  describe('language-specific definitions', () => {
    it('should find TypeScript definitions', async () => {
      const mockFind = vi.fn().mockResolvedValue({
        symbol: 'UserService',
        file: 'src/services/UserService.ts',
        line: 10,
        kind: 'class',
        language: 'typescript',
      })
      vi.mocked(FileService.findDefinition).mockImplementation(mockFind)

      await program.parseAsync(['node', 'test', 'def', 'UserService', '--lang', 'typescript'])

      expect(mockFind).toHaveBeenCalledWith(
        expect.objectContaining({
          lang: 'typescript',
        })
      )
    })

    it('should find Python definitions', async () => {
      const mockFind = vi.fn().mockResolvedValue({
        symbol: 'calculate_total',
        file: 'src/utils/calculator.py',
        line: 15,
        kind: 'function',
        language: 'python',
      })
      vi.mocked(FileService.findDefinition).mockImplementation(mockFind)

      await program.parseAsync(['node', 'test', 'def', 'calculate_total', '--lang', 'python'])

      expect(mockFind).toHaveBeenCalledWith(
        expect.objectContaining({
          lang: 'python',
        })
      )
    })

    it('should find JavaScript definitions', async () => {
      const mockFind = vi.fn().mockResolvedValue({
        symbol: 'handleClick',
        file: 'src/components/Button.js',
        line: 20,
        kind: 'function',
        language: 'javascript',
      })
      vi.mocked(FileService.findDefinition).mockImplementation(mockFind)

      await program.parseAsync(['node', 'test', 'def', 'handleClick', '--lang', 'javascript'])

      expect(mockFind).toHaveBeenCalledWith(
        expect.objectContaining({
          lang: 'javascript',
        })
      )
    })
  })

  describe('performance', () => {
    it('should complete lookup within reasonable time', async () => {
      const mockFind = vi.fn().mockResolvedValue({
        symbol: 'test',
        file: 'test.ts',
        line: 1,
        kind: 'function',
      })
      vi.mocked(FileService.findDefinition).mockImplementation(mockFind)

      const startTime = Date.now()
      await program.parseAsync(['node', 'test', 'def', 'test'])
      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(500) // Should complete in < 500ms
    })
  })
})
