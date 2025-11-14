/**
 * Tests for status command
 * Sprint 3 Day 27: CLI command tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { Command } from 'commander'
import { createStatusCommand } from '../status.js'
import * as FileService from '../../../services/FileService.js'

// Mock FileService and dependencies
vi.mock('../../../services/FileService.js', () => ({
  getIndexStats: vi.fn(),
  getCacheStats: vi.fn(),
}))

describe('status command', () => {
  let command: Command
  let program: Command

  beforeEach(() => {
    command = createStatusCommand()
    program = new Command()
    program.addCommand(command)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('command registration', () => {
    it('should register status command', () => {
      expect(command.name()).toBe('status')
    })

    it('should have correct aliases', () => {
      expect(command.aliases()).toContain('stat')
    })

    it('should have description', () => {
      const desc = command.description()
      expect(desc).toBeTruthy()
      expect(desc.toLowerCase()).toContain('status')
    })
  })

  describe('command options', () => {
    it('should have verbose option', () => {
      const option = command.options.find((opt) => opt.long === '--verbose')
      expect(option).toBeDefined()
      expect(option?.short).toBe('-v')
    })

    it('should have json option', () => {
      const option = command.options.find((opt) => opt.long === '--json')
      expect(option).toBeDefined()
    })

    it('should have cache option', () => {
      const option = command.options.find((opt) => opt.long === '--cache')
      expect(option).toBeDefined()
    })
  })

  describe('command execution', () => {
    it('should show basic index stats', async () => {
      const mockStats = {
        totalFiles: 100,
        totalSymbols: 500,
        totalChunks: 300,
        indexSize: 1024 * 1024, // 1 MB
        lastIndexed: new Date().toISOString(),
      }

      const mockGetStats = vi.fn().mockResolvedValue(mockStats)
      vi.mocked(FileService.getIndexStats).mockImplementation(mockGetStats)

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await program.parseAsync(['node', 'test', 'status'])

      expect(mockGetStats).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should show cache stats when requested', async () => {
      const mockIndexStats = {
        totalFiles: 100,
        totalSymbols: 500,
      }

      const mockCacheStats = {
        hitRate: 0.75,
        totalQueries: 1000,
        cachedQueries: 750,
        cacheSize: 512 * 1024, // 512 KB
      }

      vi.mocked(FileService.getIndexStats).mockResolvedValue(mockIndexStats)
      vi.mocked(FileService.getCacheStats).mockResolvedValue(mockCacheStats)

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await program.parseAsync(['node', 'test', 'status', '--cache'])

      expect(FileService.getCacheStats).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should show verbose stats', async () => {
      const mockStats = {
        totalFiles: 100,
        totalSymbols: 500,
        totalChunks: 300,
        indexSize: 1024 * 1024,
        lastIndexed: new Date().toISOString(),
        byLanguage: {
          typescript: 60,
          javascript: 30,
          python: 10,
        },
        byKind: {
          function: 200,
          class: 100,
          interface: 50,
        },
      }

      vi.mocked(FileService.getIndexStats).mockResolvedValue(mockStats)

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await program.parseAsync(['node', 'test', 'status', '--verbose'])

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('output formatting', () => {
    it('should format stats as text by default', async () => {
      const mockStats = {
        totalFiles: 100,
        totalSymbols: 500,
      }

      vi.mocked(FileService.getIndexStats).mockResolvedValue(mockStats)

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await program.parseAsync(['node', 'test', 'status'])

      const output = consoleSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('100')
      expect(output).toContain('500')
      consoleSpy.mockRestore()
    })

    it('should format stats as JSON when requested', async () => {
      const mockStats = {
        totalFiles: 100,
        totalSymbols: 500,
        totalChunks: 300,
      }

      vi.mocked(FileService.getIndexStats).mockResolvedValue(mockStats)

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await program.parseAsync(['node', 'test', 'status', '--json'])

      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(mockStats, null, 2))
      consoleSpy.mockRestore()
    })
  })

  describe('statistics display', () => {
    it('should show file count', async () => {
      const mockStats = {
        totalFiles: 250,
        totalSymbols: 1000,
      }

      vi.mocked(FileService.getIndexStats).mockResolvedValue(mockStats)

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await program.parseAsync(['node', 'test', 'status'])

      const output = consoleSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('250')
      consoleSpy.mockRestore()
    })

    it('should show symbol count', async () => {
      const mockStats = {
        totalFiles: 100,
        totalSymbols: 1500,
      }

      vi.mocked(FileService.getIndexStats).mockResolvedValue(mockStats)

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await program.parseAsync(['node', 'test', 'status'])

      const output = consoleSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('1500')
      consoleSpy.mockRestore()
    })

    it('should show index size in human-readable format', async () => {
      const mockStats = {
        totalFiles: 100,
        totalSymbols: 500,
        indexSize: 5 * 1024 * 1024, // 5 MB
      }

      vi.mocked(FileService.getIndexStats).mockResolvedValue(mockStats)

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await program.parseAsync(['node', 'test', 'status'])

      const output = consoleSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toMatch(/5(.0)?\s*MB/i)
      consoleSpy.mockRestore()
    })

    it('should show last indexed time', async () => {
      const lastIndexed = new Date('2025-01-01T12:00:00Z')
      const mockStats = {
        totalFiles: 100,
        totalSymbols: 500,
        lastIndexed: lastIndexed.toISOString(),
      }

      vi.mocked(FileService.getIndexStats).mockResolvedValue(mockStats)

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await program.parseAsync(['node', 'test', 'status'])

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('cache statistics', () => {
    it('should show cache hit rate', async () => {
      const mockIndexStats = {
        totalFiles: 100,
        totalSymbols: 500,
      }

      const mockCacheStats = {
        hitRate: 0.85,
        totalQueries: 1000,
        cachedQueries: 850,
      }

      vi.mocked(FileService.getIndexStats).mockResolvedValue(mockIndexStats)
      vi.mocked(FileService.getCacheStats).mockResolvedValue(mockCacheStats)

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await program.parseAsync(['node', 'test', 'status', '--cache'])

      const output = consoleSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toMatch(/85%|0\.85/)
      consoleSpy.mockRestore()
    })

    it('should show total queries', async () => {
      const mockIndexStats = {
        totalFiles: 100,
        totalSymbols: 500,
      }

      const mockCacheStats = {
        hitRate: 0.75,
        totalQueries: 2500,
        cachedQueries: 1875,
      }

      vi.mocked(FileService.getIndexStats).mockResolvedValue(mockIndexStats)
      vi.mocked(FileService.getCacheStats).mockResolvedValue(mockCacheStats)

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await program.parseAsync(['node', 'test', 'status', '--cache'])

      const output = consoleSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('2500')
      consoleSpy.mockRestore()
    })

    it('should show cache size', async () => {
      const mockIndexStats = {
        totalFiles: 100,
        totalSymbols: 500,
      }

      const mockCacheStats = {
        hitRate: 0.75,
        totalQueries: 1000,
        cachedQueries: 750,
        cacheSize: 2 * 1024 * 1024, // 2 MB
      }

      vi.mocked(FileService.getIndexStats).mockResolvedValue(mockIndexStats)
      vi.mocked(FileService.getCacheStats).mockResolvedValue(mockCacheStats)

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await program.parseAsync(['node', 'test', 'status', '--cache'])

      const output = consoleSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toMatch(/2(.0)?\s*MB/i)
      consoleSpy.mockRestore()
    })
  })

  describe('error handling', () => {
    it('should handle stats retrieval errors gracefully', async () => {
      vi.mocked(FileService.getIndexStats).mockRejectedValue(new Error('Database error'))

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await program.parseAsync(['node', 'test', 'status'])

      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })

    it('should handle cache stats errors gracefully', async () => {
      const mockIndexStats = {
        totalFiles: 100,
        totalSymbols: 500,
      }

      vi.mocked(FileService.getIndexStats).mockResolvedValue(mockIndexStats)
      vi.mocked(FileService.getCacheStats).mockRejectedValue(new Error('Cache error'))

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await program.parseAsync(['node', 'test', 'status', '--cache'])

      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })

    it('should handle empty index gracefully', async () => {
      const mockStats = {
        totalFiles: 0,
        totalSymbols: 0,
        totalChunks: 0,
      }

      vi.mocked(FileService.getIndexStats).mockResolvedValue(mockStats)

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await program.parseAsync(['node', 'test', 'status'])

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('performance', () => {
    it('should complete status check quickly', async () => {
      const mockStats = {
        totalFiles: 1000,
        totalSymbols: 5000,
      }

      vi.mocked(FileService.getIndexStats).mockResolvedValue(mockStats)

      const startTime = Date.now()
      await program.parseAsync(['node', 'test', 'status'])
      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(500) // Should complete in < 500ms
    })
  })
})
